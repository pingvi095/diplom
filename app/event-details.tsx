import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { formatIsoDateForDisplay } from '../lib/validation'

const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80'

type Participant = {
  id: string
  user_id: string
  profile?: {
    full_name?: string | null
    email?: string | null
  } | null
}

export default function EventDetails() {
  const params = useLocalSearchParams()
  const router = useRouter()
  const eventId = Array.isArray(params.id) ? params.id[0] : params.id

  const [event, setEvent] = useState<any>(null)
  const [isFavorite, setIsFavorite] = useState(false)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [role, setRole] = useState('participant')
  const [isJoined, setIsJoined] = useState(false)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (eventId) loadAll()
  }, [eventId])

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([
      loadEvent(),
      loadParticipants(),
      loadRole(),
      checkIfJoined(),
    ])
    setLoading(false)
  }

  const loadEvent = async () => {
    if (!eventId) return

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle()

    if (error) {
      Alert.alert('Ошибка', error.message)
      return
    }

    setEvent(data || null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data: fav } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .maybeSingle()

    setIsFavorite(!!fav)
  }

  const loadParticipants = async () => {
    if (!eventId) return

    const { data: tickets } = await supabase
      .from('tickets')
      .select('id, user_id')
      .eq('event_id', eventId)
      .eq('status', 'approved')

    if (!tickets?.length) {
      setParticipants([])
      return
    }

    const userIds = tickets.map((t) => t.user_id)

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)

    const merged = tickets.map((t) => ({
      ...t,
      profile: profiles?.find((p) => p.id === t.user_id),
    }))

    setParticipants(merged)
  }

  const loadRole = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    setRole(data?.role || 'participant')
  }

  const checkIfJoined = async () => {
    if (!eventId) return

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data } = await supabase
      .from('tickets')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .eq('status', 'approved')
      .maybeSingle()

    setIsJoined(!!data)
  }

  const toggleFavorite = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !eventId) {
      Alert.alert('Ошибка', 'Нужно войти')
      return
    }

    if (isFavorite) {
      await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('event_id', eventId)
    } else {
      await supabase.from('favorites').insert([
        { user_id: user.id, event_id: eventId },
      ])
    }

    setIsFavorite(!isFavorite)
  }

  const joinEvent = async () => {
    if (!eventId || !event || joining) return

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      Alert.alert('Ошибка', 'Нужно войти')
      return
    }

    setJoining(true)

    try {
      if (event.age_limit) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('age')
          .eq('id', user.id)
          .maybeSingle()

        const userAge = Number(profile?.age || 0)
        const eventAge = Number(event.age_limit)

        if (!userAge || userAge < eventAge) {
          Alert.alert('Доступ запрещён', `Требуется ${eventAge}+`)
          return
        }
      }

      if (event.max_participants) {
        const { count } = await supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('status', 'approved')

        if ((count || 0) >= Number(event.max_participants)) {
          Alert.alert('Мест нет', 'Лимит участников уже достигнут')
          return
        }
      }

      if (isJoined) {
        Alert.alert('Вы уже участвуете')
        return
      }

      const { error } = await supabase.from('tickets').insert([
        {
          user_id: user.id,
          event_id: eventId,
          status: 'approved',
        },
      ])

      if (error) {
        Alert.alert('Ошибка', error.message)
        return
      }

      setIsJoined(true)
      await loadParticipants()

      Alert.alert('Успех', 'Ты записан на мероприятие')
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color="#22c55e" />
        <Text style={styles.loadingText}>Загрузка события...</Text>
      </View>
    )
  }

  if (!event) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>Событие не найдено</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Назад</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const maxParticipants = event.max_participants
    ? Number(event.max_participants)
    : null

  const remainingPlaces =
    maxParticipants === null
      ? null
      : Math.max(maxParticipants - participants.length, 0)

  const isFull = remainingPlaces === 0

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity style={styles.backIcon} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </TouchableOpacity>

      <Image
        source={{ uri: event.image_url || DEFAULT_IMAGE }}
        style={styles.image}
      />

      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.title}>{event.title}</Text>

          <TouchableOpacity onPress={toggleFavorite}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={28}
              color={isFavorite ? '#ef4444' : '#fff'}
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.text}>{event.description}</Text>

        <View style={styles.infoCard}>
          <Text style={styles.info}>📅 {formatIsoDateForDisplay(event.date)}</Text>
          <Text style={styles.info}>📍 {event.location || 'Место не указано'}</Text>
          <Text style={styles.info}>
            🔞 {event.age_limit ? `${event.age_limit}+` : 'Без ограничения'}
          </Text>

          {maxParticipants !== null && (
            <Text style={styles.info}>
              👥 Мест осталось: {remainingPlaces} из {maxParticipants}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            (isJoined || isFull) && { backgroundColor: '#334155' },
          ]}
          onPress={joinEvent}
          disabled={isJoined || isFull || joining}
        >
          {joining ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>
              {isJoined ? 'Ты участвуешь' : isFull ? 'Мест нет' : 'Участвовать'}
            </Text>
          )}
        </TouchableOpacity>

        {(role === 'organizer' || role === 'admin') && (
          <View style={{ marginTop: 20 }}>
            <Text style={styles.section}>Список участников</Text>

            {participants.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Пока нет участников</Text>
              </View>
            ) : (
              participants.map((p) => (
                <View key={p.id} style={styles.participantCard}>
                  <Text style={styles.participantName}>
                    {p.profile?.full_name || 'Без имени'}
                  </Text>
                  <Text style={styles.participantEmail}>
                    {p.profile?.email || 'Нет email'}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  centerContainer: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 10,
  },
  image: { width: '100%', height: 240 },
  content: { padding: 20 },
  backIcon: {
    position: 'absolute',
    top: 40,
    left: 16,
    zIndex: 10,
    backgroundColor: '#111827',
    borderRadius: 999,
    padding: 8,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
    paddingRight: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  text: { color: '#cbd5e1', marginTop: 12, lineHeight: 20 },
  infoCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
  },
  info: { color: '#fff', marginTop: 6 },
  button: {
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 14,
    marginTop: 20,
    minHeight: 52,
    justifyContent: 'center',
  },
  buttonText: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#000',
  },
  section: {
    color: '#22c55e',
    fontSize: 18,
    marginBottom: 10,
    fontWeight: '700',
  },
  participantCard: {
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  participantName: {
    color: '#fff',
    fontWeight: '700',
  },
  participantEmail: {
    color: '#9ca3af',
    marginTop: 4,
  },
  emptyBox: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  emptyText: {
    color: '#9ca3af',
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#334155',
    padding: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
})