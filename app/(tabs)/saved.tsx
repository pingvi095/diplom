import { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { formatIsoDateForDisplay } from '../../lib/validation'

const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80'

type SavedEvent = {
  id: string
  title: string | null
  description: string | null
  date: string | null
  location: string | null
  image_url: string | null
}

export default function Saved() {
  const [events, setEvents] = useState<SavedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useFocusEffect(
    useCallback(() => {
      loadSaved()
    }, [])
  )

  const loadSaved = async () => {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setEvents([])
      setLoading(false)
      return
    }

    const { data: favorites, error: favError } = await supabase
      .from('favorites')
      .select('event_id')
      .eq('user_id', user.id)

    if (favError) {
      setLoading(false)
      Alert.alert('Ошибка', favError.message)
      return
    }

    const ids = (favorites || []).map((item) => item.event_id)

    if (ids.length === 0) {
      setEvents([])
      setLoading(false)
      return
    }

    const { data: savedEvents, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .in('id', ids)
      .order('created_at', { ascending: false })

    setLoading(false)

    if (eventsError) {
      Alert.alert('Ошибка', eventsError.message)
      return
    }

    setEvents((savedEvents || []) as SavedEvent[])
  }

  const openEvent = (eventId: string) => {
    router.push({
      pathname: '/event-details',
      params: { id: eventId },
    })
  }

  const renderItem = ({ item }: { item: SavedEvent }) => {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => openEvent(item.id)}
      >
        <Image
          source={{ uri: item.image_url || DEFAULT_IMAGE }}
          style={styles.image}
        />

        <View style={styles.content}>
          <Text style={styles.title}>{item.title || 'Без названия'}</Text>
          <Text style={styles.desc} numberOfLines={2}>
            {item.description || 'Описание не указано'}
          </Text>
          <Text style={styles.info}>📅 {formatIsoDateForDisplay(item.date)}</Text>
          <Text style={styles.info}>📍 {item.location || 'Место не указано'}</Text>

          <Text style={styles.openText}>Открыть детали</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Избранное</Text>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color="#22c55e" />
          <Text style={styles.emptyText}>Загружаем избранное...</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Избранных событий пока нет</Text>
              <Text style={styles.emptyText}>
                Нажимай на сердечко у мероприятий, чтобы сохранить их здесь.
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
  image: {
    width: '100%',
    height: 160,
  },
  content: {
    padding: 12,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  desc: {
    color: '#9ca3af',
    marginTop: 6,
  },
  info: {
    color: '#fff',
    marginTop: 4,
  },
  openText: {
    color: '#22c55e',
    marginTop: 10,
    fontWeight: '700',
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