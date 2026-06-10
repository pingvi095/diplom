import { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  SafeAreaView,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
// Импортируем нашу функцию автоматических уведомлений
import { sendLocalNotification } from '../lib/NotificationService'

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  phone: string | null
  role: string
  age: number | null
}

type RoleRequest = {
  id: string
  user_id: string
  status: string
  created_at?: string
}

export default function Admin() {
  const [users, setUsers] = useState<ProfileRow[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [requests, setRequests] = useState<RoleRequest[]>([])
  const [search, setSearch] = useState('')
  
  // Стейты для управления сворачиванием секций (аккордеонов)
  const [requestsExpanded, setRequestsExpanded] = useState(false)
  const [usersExpanded, setUsersExpanded] = useState(false)
  const [eventsExpanded, setEventsExpanded] = useState(false)

  const router = useRouter()

  useEffect(() => {
    loadUsers()
    loadEvents()
    loadRequests()
  }, [])

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone, role, age')
      .order('created_at', { ascending: false })

    if (error) {
      Alert.alert('Ошибка', error.message)
      return
    }

    setUsers((data || []) as ProfileRow[])
  }

  const loadEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      Alert.alert('Ошибка', error.message)
      return
    }

    setEvents(data || [])
  }

  const loadRequests = async () => {
    const { data, error } = await supabase
      .from('role_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      Alert.alert('Ошибка заявок', error.message)
      return
    }

    const fetchedRequests = (data || []) as RoleRequest[]
    setRequests(fetchedRequests)

    // АВТОМАТИЧЕСКАЯ ПРОВЕРКА ДЛЯ УВЕДОМЛЕНИЙ
    // Считаем заявки со статусом 'pending'
    const pendingCount = fetchedRequests.filter((r) => r.status === 'pending').length
    
    if (pendingCount > 0) {
      // Сама магия автоматического уведомления при входе админа!
      await sendLocalNotification(
        "📢 Новая заявка на роль",
        `Внимание! В системе обнаружено ${pendingCount} новых запросов на статус Организатора.`
      )
      // Для красоты автоматически приоткрываем вкладку с заявками на экране
      setRequestsExpanded(true)
    }
  }

  const changeRole = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) {
      Alert.alert('Ошибка', error.message)
      return
    }

    loadUsers()
    Alert.alert('Успех', 'Роль пользователя успешно изменена')
  }

  const handleRequest = async (request: RoleRequest, status: 'approved' | 'declined') => {
    const { error: requestError } = await supabase
      .from('role_requests')
      .update({ status })
      .eq('id', request.id)

    if (requestError) {
      Alert.alert('Ошибка', requestError.message)
      return
    }

    if (status === 'approved') {
      const { error: roleError } = await supabase
        .from('profiles')
        .update({ role: 'organizer' })
        .eq('id', request.user_id)

      if (roleError) {
        Alert.alert('Ошибка', roleError.message)
        return
      }
    }

    loadRequests()
    loadUsers()
    Alert.alert('Готово', status === 'approved' ? 'Заявка одобрена' : 'Заявка отклонена')
  }

  const deleteEvent = async (id: string) => {
    const { error } = await supabase.from('events').delete().eq('id', id)

    if (error) {
      Alert.alert('Ошибка', error.message)
      return
    }

    loadEvents()
    Alert.alert('Готово', 'Мероприятие удалено')
  }

  const deleteProfile = async (profile: ProfileRow) => {
    Alert.alert(
      'Удаление профиля',
      `Удалить профиль ${profile.full_name || profile.email || profile.id}?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              if (profile.email) {
                await supabase
                  .from('invitations')
                  .delete()
                  .eq('recipient_email', profile.email)
              }

              await supabase.from('invitations').delete().eq('sender_id', profile.id)
              await supabase.from('favorites').delete().eq('user_id', profile.id)
              await supabase.from('tickets').delete().eq('user_id', profile.id)
              await supabase.from('events').delete().eq('user_id', profile.id)
              await supabase.from('role_requests').delete().eq('user_id', profile.id)

              const { error: profileError } = await supabase
                .from('profiles')
                .delete()
                .eq('id', profile.id)

              if (profileError) {
                Alert.alert('Ошибка', profileError.message)
                return
              }

              loadUsers()
              loadEvents()
              loadRequests()
              Alert.alert('Готово', 'Профиль удалён')
            } catch (e: any) {
              Alert.alert('Ошибка', e.message || 'Не удалось удалить профиль')
            }
          },
        },
      ]
    )
  }

  // Перевод ролей на русский язык для отображения
  const translateRole = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Администратор'
      case 'organizer':
        return 'Организатор'
      case 'participant':
        return 'Участник'
      default:
        return role
    }
  }

  // Перевод статусов на русский язык для отображения
  const translateStatus = (status: string) => {
    switch (status) {
      case 'pending':
        return 'В ожидании ⏳'
      case 'approved':
        return 'Одобрено ✅'
      case 'declined':
        return 'Отклонено ❌'
      default:
        return status
    }
  }

  const filteredUsers = users.filter((user) => {
    const q = search.trim().toLowerCase()
    if (!q) return true

    return (
      String(user.email || '').toLowerCase().includes(q) ||
      String(user.full_name || '').toLowerCase().includes(q) ||
      String(user.phone || '').toLowerCase().includes(q) ||
      translateRole(user.role).toLowerCase().includes(q)
    )
  })

  // Подсчет количества активных заявок "в ожидании" для вывода на бейдж
  const pendingRequestsCount = requests.filter((r) => r.status === 'pending').length

  return (
    <SafeAreaView style={styles.container}>
      {/* ЗАКРЕПЛЕННЫЙ ВЕРХНИЙ ХЕДЕР */}
      <View style={styles.fixedHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
          <Text style={styles.backButtonText}>Назад</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Админ панель</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* СЕКЦИЯ 1: ЗАЯВКИ НА РОЛЬ ОРГАНИЗАТОРА */}
        <TouchableOpacity 
          style={styles.accordionHeader} 
          onPress={() => setRequestsExpanded(!requestsExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.accordionTitleRow}>
            <Text style={styles.sectionTitle}>Заявки на организатора</Text>
            {pendingRequestsCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingRequestsCount}</Text>
              </View>
            )}
          </View>
          <Ionicons 
            name={requestsExpanded ? 'chevron-up' : 'chevron-down'} 
            size={22} 
            color="#22c55e" 
          />
        </TouchableOpacity>

        {requestsExpanded && (
          <View style={styles.accordionBody}>
            {requests.length === 0 ? (
              <Text style={styles.emptyText}>Пока нет заявок</Text>
            ) : (
              requests.map((req) => (
                <View key={req.id} style={styles.card}>
                  <Text style={styles.text}>ID Пользователя: {req.user_id}</Text>
                  <Text style={styles.subText}>Статус: {translateStatus(req.status)}</Text>

                  {req.status === 'pending' && (
                    <View style={styles.row}>
                      <TouchableOpacity
                        style={styles.button}
                        onPress={() => handleRequest(req, 'approved')}
                      >
                        <Text style={styles.btnText}>Принять</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleRequest(req, 'declined')}
                      >
                        <Text style={styles.btnText}>Отклонить</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* СЕКЦИЯ 2: ПОЛЬЗОВАТЕЛИ */}
        <TouchableOpacity 
          style={styles.accordionHeader} 
          onPress={() => setUsersExpanded(!usersExpanded)}
          activeOpacity={0.7}
        >
          <Text style={styles.sectionTitle}>Пользователи</Text>
          <Ionicons 
            name={usersExpanded ? 'chevron-up' : 'chevron-down'} 
            size={22} 
            color="#22c55e" 
          />
        </TouchableOpacity>

        {usersExpanded && (
          <View style={styles.accordionBody}>
            <TextInput
              style={styles.search}
              placeholder="Поиск пользователя по имени, почте или роли..."
              placeholderTextColor="#888"
              value={search}
              onChangeText={setSearch}
            />

            {filteredUsers.length === 0 ? (
              <Text style={styles.emptyText}>Пользователи не найдены</Text>
            ) : (
              filteredUsers.map((user) => (
                <View key={user.id} style={styles.card}>
                  <Text style={styles.text}>{user.full_name || 'Без имени'}</Text>
                  <Text style={styles.subText}>{user.email || 'Без email'}</Text>
                  <Text style={styles.subText}>Телефон: {user.phone || 'не указан'}</Text>
                  <Text style={styles.role}>Роль: <Text style={styles.roleHighlight}>{translateRole(user.role)}</Text></Text>
                  <Text style={styles.subText}>Возраст: {user.age ?? 'не указан'}</Text>

                  <View style={styles.roleChangeRow}>
                    <TouchableOpacity
                      style={styles.roleButton}
                      onPress={() => changeRole(user.id, 'participant')}
                    >
                      <Text style={styles.roleBtnText}>Юзер</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.roleButton}
                      onPress={() => changeRole(user.id, 'organizer')}
                    >
                      <Text style={styles.roleBtnText}>Орг</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.roleButton}
                      onPress={() => changeRole(user.id, 'admin')}
                    >
                      <Text style={styles.roleBtnText}>Админ</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteProfile(user)}
                  >
                    <Text style={styles.btnText}>Удалить профиль</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* СЕКЦИЯ 3: СОБЫТИЯ */}
        <TouchableOpacity 
          style={styles.accordionHeader} 
          onPress={() => setEventsExpanded(!eventsExpanded)}
          activeOpacity={0.7}
        >
          <Text style={styles.sectionTitle}>События</Text>
          <Ionicons 
            name={eventsExpanded ? 'chevron-up' : 'chevron-down'} 
            size={22} 
            color="#22c55e" 
          />
        </TouchableOpacity>

        {eventsExpanded && (
          <View style={styles.accordionBody}>
            {events.length === 0 ? (
              <Text style={styles.emptyText}>Событий нет</Text>
            ) : (
              events.map((event) => (
                <View key={event.id} style={styles.card}>
                  <Text style={styles.text}>{event.title}</Text>
                  <Text style={styles.subText}>Дата: {event.date}</Text>
                  <Text style={styles.subText}>Место: {event.location || 'Не указано'}</Text>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteEvent(event.id)}
                  >
                    <Text style={styles.btnText}>Удалить событие</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  fixedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 2,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 16,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  accordionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accordionBody: {
    backgroundColor: '#0f172a',
    padding: 10,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    borderTopWidth: 0,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: '#ef4444',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  search: {
    backgroundColor: '#111827',
    color: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyText: {
    color: '#9ca3af',
    padding: 10,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#111827',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  text: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  subText: {
    color: '#cbd5e1',
    marginTop: 4,
    fontSize: 13,
  },
  role: {
    color: '#9ca3af',
    marginTop: 6,
    marginBottom: 8,
    fontSize: 13,
  },
  roleHighlight: {
    color: '#22c55e',
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  roleChangeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#0f172a',
    padding: 6,
    borderRadius: 8,
  },
  button: {
    backgroundColor: '#22c55e',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  roleButton: {
    backgroundColor: '#334155',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  btnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  roleBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
})
