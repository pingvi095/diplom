import { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useRouter } from 'expo-router'

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

    setRequests((data || []) as RoleRequest[])
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
                const { error: inv1 } = await supabase
                  .from('invitations')
                  .delete()
                  .eq('recipient_email', profile.email)

                if (inv1) {
                  Alert.alert('Ошибка', inv1.message)
                  return
                }
              }

              const { error: inv2 } = await supabase
                .from('invitations')
                .delete()
                .eq('sender_id', profile.id)

              if (inv2) {
                Alert.alert('Ошибка', inv2.message)
                return
              }

              const { error: favError } = await supabase
                .from('favorites')
                .delete()
                .eq('user_id', profile.id)

              if (favError) {
                Alert.alert('Ошибка', favError.message)
                return
              }

              const { error: ticketsError } = await supabase
                .from('tickets')
                .delete()
                .eq('user_id', profile.id)

              if (ticketsError) {
                Alert.alert('Ошибка', ticketsError.message)
                return
              }

              const { error: eventsError } = await supabase
                .from('events')
                .delete()
                .eq('user_id', profile.id)

              if (eventsError) {
                Alert.alert('Ошибка', eventsError.message)
                return
              }

              const { error: requestsError } = await supabase
                .from('role_requests')
                .delete()
                .eq('user_id', profile.id)

              if (requestsError) {
                Alert.alert('Ошибка', requestsError.message)
                return
              }

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

  const filteredUsers = users.filter((user) => {
    const q = search.trim().toLowerCase()
    if (!q) return true

    return (
      String(user.email || '').toLowerCase().includes(q) ||
      String(user.full_name || '').toLowerCase().includes(q) ||
      String(user.phone || '').toLowerCase().includes(q) ||
      String(user.role || '').toLowerCase().includes(q)
    )
  })

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.header}>Админ панель</Text>

      <TextInput
        style={styles.search}
        placeholder="Поиск пользователя"
        placeholderTextColor="#888"
        value={search}
        onChangeText={setSearch}
      />

      <Text style={styles.section}>Заявки на организатора</Text>

      {requests.length === 0 ? (
        <Text style={styles.emptyText}>Пока нет заявок</Text>
      ) : (
        requests.map((req) => (
          <View key={req.id} style={styles.card}>
            <Text style={styles.text}>User ID: {req.user_id}</Text>
            <Text style={styles.subText}>Статус: {req.status}</Text>

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

      <Text style={styles.section}>Пользователи</Text>

      {filteredUsers.length === 0 ? (
        <Text style={styles.emptyText}>Пользователи не найдены</Text>
      ) : (
        filteredUsers.map((user) => (
          <View key={user.id} style={styles.card}>
            <Text style={styles.text}>{user.full_name || 'Без имени'}</Text>
            <Text style={styles.subText}>{user.email || 'Без email'}</Text>
            <Text style={styles.subText}>Телефон: {user.phone || 'не указан'}</Text>
            <Text style={styles.role}>Роль: {user.role}</Text>
            <Text style={styles.subText}>Возраст: {user.age ?? 'не указан'}</Text>

            <View style={styles.row}>
              <TouchableOpacity
                style={styles.button}
                onPress={() => changeRole(user.id, 'participant')}
              >
                <Text style={styles.btnText}>User</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.button}
                onPress={() => changeRole(user.id, 'organizer')}
              >
                <Text style={styles.btnText}>Org</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.button}
                onPress={() => changeRole(user.id, 'admin')}
              >
                <Text style={styles.btnText}>Admin</Text>
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

      <Text style={styles.section}>События</Text>

      {events.length === 0 ? (
        <Text style={styles.emptyText}>Событий нет</Text>
      ) : (
        events.map((event) => (
          <View key={event.id} style={styles.card}>
            <Text style={styles.text}>{event.title}</Text>
            <Text style={styles.subText}>{event.date}</Text>
            <Text style={styles.subText}>{event.location}</Text>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => deleteEvent(event.id)}
            >
              <Text style={styles.btnText}>Удалить событие</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>Назад</Text>
      </TouchableOpacity>
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
    marginBottom: 20,
    fontWeight: '700',
  },
  search: {
    backgroundColor: '#111827',
    color: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  section: {
    color: '#22c55e',
    fontSize: 20,
    marginTop: 16,
    marginBottom: 10,
    fontWeight: '700',
  },
  emptyText: {
    color: '#9ca3af',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#111827',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  subText: {
    color: '#cbd5e1',
    marginTop: 4,
  },
  role: {
    color: '#9ca3af',
    marginTop: 8,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  button: {
    backgroundColor: '#22c55e',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  btnText: {
    color: '#000',
    fontWeight: '700',
  },
  backButton: {
    backgroundColor: '#334155',
    padding: 14,
    borderRadius: 12,
    marginTop: 20,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
})