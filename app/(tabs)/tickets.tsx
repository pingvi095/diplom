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
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { formatIsoDateForDisplay } from '../../lib/validation'

// Перевод всех возможных статусов билета на русский язык
const statusLabels: Record<string, string> = {
  approved: 'Активен ✅',
  active: 'Активен ✅',
  pending: 'В ожидании ⏳',
  declined: 'Отклонён ❌',
  rejected: 'Отклонён ❌',
}

export default function Tickets() {
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
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

  // Функция для красивой подсветки разных статусов
  const getStatusColor = (status: string) => {
    if (status === 'pending') return '#eab308' // Желтый
    if (status === 'declined' || status === 'rejected') return '#ef4444' // Красный
    return '#22c55e' // Зеленый для активных
  }

  const renderItem = ({ item }: any) => {
    const event = item.events

    if (!event) return null

    const status = item.status || 'active'

    return (
      <TouchableOpacity
        style={styles.card}
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
        <Text style={styles.text}>📅 {formatIsoDateForDisplay(event.date)}</Text>
        <Text style={styles.text}>📍 {event.location || 'Место не указано'}</Text>
        <Text style={styles.text}>
          🔞 {event.age_limit ? `${event.age_limit}+` : 'Без ограничения'}
        </Text>

        {event.distance_km !== null && event.distance_km !== undefined && (
          <Text style={styles.text}>📏 {event.distance_km} км</Text>
        )}

        <Text style={[styles.status, { color: getStatusColor(status) }]}>
          Статус: {statusLabels[status] || status}
        </Text>
      </TouchableOpacity>
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
          keyExtractor={(item) => item.id}
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
