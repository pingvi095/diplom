import { useFocusEffect } from '@react-navigation/native'
import { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'expo-router'
import {
  formatIsoDateForDisplay,
  isValidEmail,
  parseEmailList,
  sanitizeEmailListInput,
} from '../../lib/validation'

const statusLabels: Record<string, string> = {
  sent: 'Ожидает ответа',
  accepted: 'Принято',
  declined: 'Отклонено',
}

export default function Invitations() {
  const [role, setRole] = useState('participant')
  const [events, setEvents] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [recipientEmails, setRecipientEmails] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [eventPickerVisible, setEventPickerVisible] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const router = useRouter()

  useFocusEffect(
    useCallback(() => {
      loadAll()
    }, [])
  )

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([loadRole(), loadEvents(), loadInvitations()])
    setLoading(false)
  }

  const loadRole = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .maybeSingle()

    setRole(data?.role || 'participant')
    setCurrentUserEmail((data?.email || user.email || '').toLowerCase())
  }

  const loadEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, date, location')
      .order('created_at', { ascending: false })

    if (error) {
      Alert.alert('Ошибка', error.message)
      return
    }

    setEvents(data || [])

    if (!selectedEventId && data && data.length > 0) {
      setSelectedEventId(data[0].id)
    }
  }

  const loadInvitations = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      setItems([])
      return
    }

    const email = user.email.toLowerCase()
    setCurrentUserEmail(email)

    const { data, error } = await supabase
      .from('invitations')
      .select(`
        id,
        sender_id,
        event_id,
        recipient_email,
        message,
        status,
        created_at,
        events (
          id,
          title,
          date,
          location,
          age_limit,
          max_participants
        )
      `)
      .or(`sender_id.eq.${user.id},recipient_email.eq.${email}`)
      .order('created_at', { ascending: false })

    if (error) {
      Alert.alert('Ошибка', error.message)
      return
    }

    setItems(data || [])
  }

  const sendInvitation = async () => {
    if (role !== 'organizer' && role !== 'admin') {
      Alert.alert(
        'Нет доступа',
        'Отправлять приглашения могут только организатор и админ'
      )
      return
    }

    if (!selectedEventId) {
      Alert.alert('Ошибка', 'Выбери мероприятие')
      return
    }

    const emails = parseEmailList(recipientEmails)

    if (emails.length === 0) {
      Alert.alert('Ошибка', 'Введи хотя бы один email')
      return
    }

    const invalidEmails = emails.filter((email) => !isValidEmail(email))

    if (invalidEmails.length > 0) {
      Alert.alert('Ошибка', `Проверь email: ${invalidEmails.join(', ')}`)
      return
    }

    setSending(true)

    const { data, error } = await supabase.functions.invoke('send-invitations', {
      body: {
        eventId: selectedEventId,
        emails,
        message: message.trim() || null,
      },
    })

    setSending(false)

    if (error) {
      let errorMessage = error.message

      try {
        const context = (error as any).context
        if (context) {
          const body = await context.json()
          if (body?.error) {
            errorMessage = body.error
          }
        }
      } catch {}

      Alert.alert('Ошибка', errorMessage)
      return
    }

    if (data?.error) {
      Alert.alert('Ошибка', data.error)
      return
    }

    if (data?.failedEmails?.length) {
      Alert.alert(
        'Частично отправлено',
        `Приглашения созданы, но письма не ушли на: ${data.failedEmails.join(', ')}`
      )
    } else {
      Alert.alert('Готово', 'Приглашения отправлены')
    }

    setRecipientEmails('')
    setMessage('')
    loadInvitations()
  }

  const acceptInvitation = async (item: any) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      Alert.alert('Ошибка', 'Нужно войти')
      return
    }

    const userEmail = user.email.toLowerCase()
    const recipientEmail = String(item.recipient_email || '').toLowerCase()

    if (userEmail !== recipientEmail) {
      Alert.alert(
        'Ошибка',
        'Это приглашение отправлено на другой email. Войдите с нужной почты.'
      )
      return
    }

    const event = item.events

    if (!event) {
      Alert.alert('Ошибка', 'Событие не найдено')
      return
    }

    if (event.age_limit && Number(event.age_limit) > 0) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('age')
        .eq('id', user.id)
        .maybeSingle()

      const age = Number(profile?.age || 0)

      if (age < Number(event.age_limit)) {
        Alert.alert('Доступ запрещён', `Требуется ${event.age_limit}+`)
        return
      }
    }

    if (event.max_participants) {
      const { count } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', item.event_id)
        .eq('status', 'approved')

      if ((count || 0) >= Number(event.max_participants)) {
        Alert.alert('Мест нет', 'Лимит участников уже достигнут')
        return
      }
    }

    const { data: existing } = await supabase
      .from('tickets')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_id', item.event_id)
      .maybeSingle()

    if (!existing) {
      const { error: ticketError } = await supabase.from('tickets').insert([
        {
          user_id: user.id,
          event_id: item.event_id,
          status: 'approved',
        },
      ])

      if (ticketError) {
        Alert.alert('Ошибка', ticketError.message)
        return
      }
    }

    const { error } = await supabase
      .from('invitations')
      .update({ status: 'accepted' })
      .eq('id', item.id)

    if (error) {
      Alert.alert('Ошибка', error.message)
      return
    }

    Alert.alert('Готово', 'Приглашение принято')
    await loadInvitations()

    router.push({
      pathname: '/ticket-details',
      params: { eventId: item.event_id },
    })
  }

  const declineInvitation = async (item: any) => {
    const { error } = await supabase
      .from('invitations')
      .update({ status: 'declined' })
      .eq('id', item.id)

    if (error) {
      Alert.alert('Ошибка', error.message)
      return
    }

    Alert.alert('Готово', 'Приглашение отклонено')
    loadInvitations()
  }

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId),
    [events, selectedEventId]
  )

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.header}>Приглашения</Text>

      {(role === 'organizer' || role === 'admin') && (
        <View style={styles.sendCard}>
          <Text style={styles.sectionTitle}>Отправить приглашение</Text>

          <TouchableOpacity
            style={styles.eventPicker}
            onPress={() => setEventPickerVisible(true)}
            disabled={sending}
          >
            <Text style={styles.eventPickerText}>
              {selectedEvent ? selectedEvent.title : 'Выбрать мероприятие'}
            </Text>
            {!!selectedEvent?.date && (
              <Text style={styles.eventPickerSubText}>
                {formatIsoDateForDisplay(selectedEvent.date)}
              </Text>
            )}
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Email получателя, можно несколько через запятую"
            placeholderTextColor="#888"
            value={recipientEmails}
            onChangeText={(text) =>
              setRecipientEmails(sanitizeEmailListInput(text))
            }
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!sending}
          />

          <TextInput
            style={[styles.input, styles.messageInput]}
            placeholder="Текст приглашения"
            placeholderTextColor="#888"
            value={message}
            onChangeText={setMessage}
            multiline
            editable={!sending}
          />

          <TouchableOpacity
            style={[styles.sendButton, sending && { opacity: 0.7 }]}
            onPress={sendInvitation}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.sendButtonText}>Отправить приглашение</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionTitle}>Мои приглашения</Text>

      {loading ? (
        <Text style={styles.emptyText}>Загрузка приглашений...</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Пока нет приглашений</Text>
          }
          renderItem={({ item }) => {
            const event = item.events
            const status = item.status || 'sent'
            const isRecipient =
              (item.recipient_email || '').toLowerCase() === currentUserEmail

            return (
              <View style={styles.card}>
                <Text style={styles.title}>{event?.title || 'Событие'}</Text>
                <Text style={styles.text}>📅 {formatIsoDateForDisplay(event?.date)}</Text>
                <Text style={styles.text}>📍 {event?.location || '—'}</Text>
                <Text style={styles.text}>📩 {item.recipient_email}</Text>
                <Text style={styles.text}>
                  🔞 {event?.age_limit ? `${event.age_limit}+` : 'Без ограничения'}
                </Text>

                <Text
                  style={[
                    styles.status,
                    status === 'declined' && styles.statusDeclined,
                  ]}
                >
                  Статус: {statusLabels[status] || status}
                </Text>

                {!!item.message && (
                  <Text style={styles.message}>{item.message}</Text>
                )}

                {status === 'sent' && isRecipient && (
                  <View style={styles.row}>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => acceptInvitation(item)}
                    >
                      <Text style={styles.buttonText}>Принять</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.declineButton}
                      onPress={() => declineInvitation(item)}
                    >
                      <Text style={styles.buttonText}>Отклонить</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {status === 'accepted' && isRecipient && (
                  <TouchableOpacity
                    style={styles.openButton}
                    onPress={() =>
                      router.push({
                        pathname: '/ticket-details',
                        params: { eventId: item.event_id },
                      })
                    }
                  >
                    <Text style={styles.openButtonText}>Открыть билет</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          }}
        />
      )}

      <Modal
        visible={eventPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEventPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Выбрать мероприятие</Text>
              <TouchableOpacity onPress={() => setEventPickerVisible(false)}>
                <Text style={styles.closeText}>Закрыть</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={events}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Нет доступных мероприятий</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.pickItem,
                    selectedEventId === item.id && styles.pickItemActive,
                  ]}
                  onPress={() => {
                    setSelectedEventId(item.id)
                    setEventPickerVisible(false)
                  }}
                >
                  <Text style={styles.pickTitle}>{item.title}</Text>
                  <Text style={styles.pickText}>
                    {formatIsoDateForDisplay(item.date)}
                  </Text>
                  <Text style={styles.pickText}>{item.location}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    padding: 20,
  },
  header: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#22c55e',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 8,
  },
  sendCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
  },
  eventPicker: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  eventPickerText: {
    color: '#fff',
    fontWeight: '700',
  },
  eventPickerSubText: {
    color: '#9ca3af',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#020617',
    color: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  messageInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  sendButton: {
    backgroundColor: '#22c55e',
    padding: 14,
    borderRadius: 12,
    marginTop: 4,
    minHeight: 48,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#000',
    textAlign: 'center',
    fontWeight: '700',
  },
  emptyText: {
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  text: {
    color: '#cbd5e1',
    marginTop: 5,
  },
  status: {
    color: '#22c55e',
    marginTop: 8,
    fontWeight: '700',
  },
  statusDeclined: {
    color: '#ef4444',
  },
  message: {
    color: '#fff',
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    padding: 12,
    borderRadius: 12,
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 12,
  },
  buttonText: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#000',
  },
  openButton: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#22c55e',
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  openButtonText: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#22c55e',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#020617',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderColor: '#1f2937',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  closeText: {
    color: '#22c55e',
    fontWeight: '700',
  },
  pickItem: {
    backgroundColor: '#111827',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  pickItemActive: {
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  pickTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  pickText: {
    color: '#cbd5e1',
    marginTop: 4,
  },
})