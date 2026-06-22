import { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { useFocusEffect } from '@react-navigation/native'
import { useRouter } from 'expo-router'
import { formatIsoDateForDisplay } from '../../lib/validation'

const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80'

const isEventFinished = (endDate: string | null | undefined) => {
  if (!endDate) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const eventEndDate = new Date(`${endDate}T00:00:00`)
  eventEndDate.setHours(0, 0, 0, 0)

  return today > eventEndDate
}

export default function MyEvents() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useFocusEffect(
    useCallback(() => {
      loadMyEvents()
    }, [])
  )

  const loadMyEvents = async () => {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setEvents([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setLoading(false)

    if (error) {
      Alert.alert('Ошибка', error.message)
      return
    }

    setEvents(data || [])
  }

  const deleteEvent = async (id: string) => {
    Alert.alert('Удаление', 'Удалить событие?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('events').delete().eq('id', id)

          if (error) {
            Alert.alert('Ошибка', error.message)
          } else {
            loadMyEvents()
          }
        },
      },
    ])
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Мои события</Text>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color="#22c55e" />
          <Text style={styles.emptyText}>Загружаем события...</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const finished = isEventFinished(item.end_date)

            return (
              <View style={[styles.card, finished && styles.finishedCard]}>
                <Image
                  source={{ uri: item.image_url || DEFAULT_IMAGE }}
                  style={styles.image}
                />

                <View style={styles.content}>
                  <Text style={styles.title}>
                    {item.title || 'Без названия'}
                  </Text>

                  <Text style={styles.text}>
                    📅 Начало: {formatIsoDateForDisplay(item.date)}
                  </Text>

                  <Text style={styles.text}>
                    🏁 Окончание:{' '}
                    {item.end_date
                      ? formatIsoDateForDisplay(item.end_date)
                      : 'Не указано'}
                  </Text>

                  <Text style={styles.text}>
                    📍 {item.location || 'Место не указано'}
                  </Text>

                  {finished ? (
                    <Text style={styles.finishedText}>Статус: Завершено</Text>
                  ) : (
                    <Text style={styles.activeText}>Статус: Активно</Text>
                  )}

                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() =>
                      router.push({
                        pathname: '/edit-event',
                        params: { id: item.id },
                      })
                    }
                  >
                    <Text style={styles.btnText}>Редактировать</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteEvent(item.id)}
                  >
                    <Text style={styles.deleteBtnText}>Удалить</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          }}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>У тебя пока нет событий</Text>
              <Text style={styles.emptyText}>
                Создай первое мероприятие, и оно появится здесь.
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
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
  },
  centerBox: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  finishedCard: {
    opacity: 0.75,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  image: {
    width: '100%',
    height: 150,
  },
  content: {
    padding: 14,
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
  activeText: {
    color: '#22c55e',
    marginTop: 10,
    fontWeight: '700',
  },
  finishedText: {
    color: '#ef4444',
    marginTop: 10,
    fontWeight: '700',
  },
  editButton: {
    backgroundColor: '#22c55e',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  btnText: {
    color: '#000',
    fontWeight: '700',
    textAlign: 'center',
  },
  deleteBtnText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
})