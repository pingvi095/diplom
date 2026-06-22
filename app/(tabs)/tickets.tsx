import { useFocusEffect } from '@react-navigation/native'
import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { formatIsoDateForDisplay } from '../../lib/validation'

const statusLabels: Record<string, string> = {
  approved: 'Активен ✅',
  active: 'Активен ✅',
  pending: 'В ожидании ⏳',
  declined: 'Отклонён ❌',
  rejected: 'Отклонён ❌',
  cancelled: 'Отменён ❌',
}

const isEventFinished = (endDate: string | null | undefined) => {
  if (!endDate) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const eventEndDate = new Date(`${endDate}T00:00:00`)
  eventEndDate.setHours(0, 0, 0, 0)

  return today > eventEndDate
}

export default function Tickets() {
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const router = useRouter()

  useFocusEffect(
    useCallback(() => {
      loadTickets()
    }, [])
  )

  const loadTickets = async () => {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setTickets([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('tickets')
      .select(`
        id,
        status,
        event_id,
        created_at,
        events (
          id,
          title,
          date,
          end_date,
          location,
          age_limit,
          distance_km
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setLoading(false)

    if (error) {
      console.log('Ошибка загрузки билетов:', error.message)
      return
    }

    setTickets(Array.isArray(data) ? data : [])
  }

  const getStatusColor = (status: string) => {
    if (status === 'pending') return '#eab308'

    if (
      status === 'declined' ||
      status === 'rejected' ||
      status === 'cancelled'
    ) {
      return '#ef4444'
    }

    return '#22c55e'
  }

  const cancelParticipation = (ticketId: string) => {
    Alert.alert(
      'Отменить участие?',
      'Билет останется в списке, но получит статус «Отменён».',
      [
        {
          text: 'Нет',
          style: 'cancel',
        },
        {
          text: 'Да, отменить',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(ticketId)

            const { error } = await supabase
              .from('tickets')
              .update({ status: 'cancelled' })
              .eq('id', ticketId)

            setCancellingId(null)

            if (error) {
              Alert.alert('Ошибка', error.message)
              return
            }

            Alert.alert('Готово', 'Участие в мероприятии отменено')
            loadTickets()
          },
        },
      ]
    )
  }

  const renderItem = ({ item }: any) => {
    const event = item.events

    if (!event) return null

    const status = item.status || 'active'
    const finished = isEventFinished(event.end_date)

    const canCancel =
      !finished && (status === 'approved' || status === 'active' || status === 'pending')

    return (
      <View style={[styles.card, finished && styles.finishedCard]}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() =>
            router.push({
              pathname: '/ticket-details',
              params: { eventId: item.event_id },
            })
          }
        >
          <Text style={styles.badge}>🎟️ Билет</Text>

          <Text style={styles.title}>{event.title}</Text>

          <Text style={styles.text}>
            📅 Начало: {formatIsoDateForDisplay(event.date)}
          </Text>

          <Text style={styles.text}>
            🏁 Окончание:{' '}
            {event.end_date
              ? formatIsoDateForDisplay(event.end_date)
              : 'Не указано'}
          </Text>

          <Text style={styles.text}>
            📍 {event.location || 'Место не указано'}
          </Text>

          <Text style={styles.text}>
            🔞 {event.age_limit ? `${event.age_limit}+` : 'Без ограничения'}
          </Text>

          {event.distance_km !== null && event.distance_km !== undefined && (
            <Text style={styles.text}>📏 {event.distance_km} км</Text>
          )}

          {finished ? (
            <Text style={styles.invalidText}>
              Билет недействителен — мероприятие завершено
            </Text>
          ) : (
            <Text style={[styles.status, { color: getStatusColor(status) }]}>
              Статус: {statusLabels[status] || status}
            </Text>
          )}
        </TouchableOpacity>

        {canCancel && (
          <TouchableOpacity
            style={[
              styles.cancelButton,
              cancellingId === item.id && styles.cancelButtonDisabled,
            ]}
            onPress={() => cancelParticipation(item.id)}
            disabled={cancellingId === item.id}
          >
            <Text style={styles.cancelButtonText}>
              {cancellingId === item.id
                ? 'Отмена...'
                : 'Отменить участие'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Мои билеты</Text>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color="#22c55e" />
          <Text style={styles.empty}>Загружаем билеты...</Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Билетов пока нет</Text>
              <Text style={styles.empty}>
                Когда ты примешь приглашение или запишешься на событие, билет появится здесь.
              </Text>
            </View>
          }
        />
      )}
    </View>
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
    fontSize: 26,
    marginBottom: 20,
    fontWeight: '700',
  },
  centerBox: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  card: {
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  finishedCard: {
    borderColor: '#ef4444',
    opacity: 0.8,
  },
  badge: {
    color: '#22c55e',
    fontWeight: '700',
    marginBottom: 8,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  text: {
    color: '#9ca3af',
    marginTop: 5,
  },
  status: {
    marginTop: 12,
    fontWeight: '700',
  },
  invalidText: {
    color: '#ef4444',
    marginTop: 12,
    fontWeight: '700',
    fontSize: 15,
  },
  cancelButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 14,
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  empty: {
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
})