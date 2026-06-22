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
import * as Location from 'expo-location'

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

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3
  const p1 = (lat1 * Math.PI) / 180
  const p2 = (lat2 * Math.PI) / 180
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(p1) *
      Math.cos(p2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

function isEventFinished(event: any): boolean {
  const endDateValue = event?.end_date || event?.date

  if (!endDateValue) return false

  const endDate = new Date(`${endDateValue}T23:59:59`)
  const now = new Date()

  return now > endDate
}

export default function EventDetails() {
  const params = useLocalSearchParams()
  const router = useRouter()
  const eventId = Array.isArray(params.id) ? params.id[0] : params.id

  const [event, setEvent] = useState<any>(null)
  const [isFavorite, setIsFavorite] = useState(false)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [role, setRole] = useState('participant')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isJoined, setIsJoined] = useState(false)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [removingParticipantId, setRemovingParticipantId] = useState<string | null>(
    null
  )
  const [distanceText, setDistanceText] = useState('')
  const [distanceLoading, setDistanceLoading] = useState(false)

  useEffect(() => {
    if (eventId) loadAll()
  }, [eventId])

  useEffect(() => {
    if (!event?.latitude || !event?.longitude) return

    async function getEventDistance() {
      setDistanceLoading(true)

      try {
        const { status } = await Location.requestForegroundPermissionsAsync()

        if (status !== 'granted') {
          setDistanceText('Нет доступа к геопозиции')
          return
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })

        const rawDistance = calculateDistance(
          location.coords.latitude,
          location.coords.longitude,
          Number(event.latitude),
          Number(event.longitude)
        )

        const roundedDistance = Math.round(rawDistance / 100) * 100

        if (roundedDistance >= 1000) {
          setDistanceText(`~${(roundedDistance / 1000).toFixed(1)} км от вас`)
        } else {
          setDistanceText(`~${roundedDistance} м от вас`)
        }
      } catch {
        setDistanceText('Не удалось определить расстояние')
      } finally {
        setDistanceLoading(false)
      }
    }

    getEventDistance()
  }, [event?.latitude, event?.longitude])

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

    setCurrentUserId(user.id)

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

    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('id, user_id')
      .eq('event_id', eventId)
      .eq('status', 'approved')

    if (ticketsError) {
      console.log('Ошибка загрузки участников:', ticketsError.message)
      return
    }

    if (!tickets?.length) {
      setParticipants([])
      return
    }

    const userIds = tickets.map((ticket) => ticket.user_id)

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)

    if (profilesError) {
      console.log('Ошибка загрузки профилей участников:', profilesError.message)
    }

    const merged = tickets.map((ticket) => ({
      ...ticket,
      profile: profiles?.find((profile) => profile.id === ticket.user_id),
    }))

    setParticipants(merged)
  }

  const loadRole = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    setCurrentUserId(user.id)

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
        {
          user_id: user.id,
          event_id: eventId,
        },
      ])
    }

    setIsFavorite(!isFavorite)
  }

  const joinEvent = async () => {
    if (!eventId || !event || joining) return

    if (isEventFinished(event)) {
      Alert.alert(
        'Мероприятие завершено',
        'Запись на завершённое мероприятие недоступна'
      )
      return
    }

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
          Alert.alert('Доступ запрещён', `Требуется возраст ${eventAge}+`)
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

  const cancelParticipation = async () => {
    if (!eventId || !event) return

    if (isEventFinished(event)) {
      Alert.alert(
        'Нельзя отменить участие',
        'Мероприятие уже завершено'
      )
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    Alert.alert(
      'Отмена участия',
      'Ты действительно хочешь отменить участие в мероприятии?',
      [
        {
          text: 'Нет',
          style: 'cancel',
        },
        {
          text: 'Да, отменить',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('tickets')
              .delete()
              .eq('user_id', user.id)
              .eq('event_id', eventId)

            if (error) {
              Alert.alert('Ошибка', error.message)
              return
            }

            setIsJoined(false)
            await loadParticipants()

            Alert.alert('Готово', 'Участие в мероприятии отменено')
          },
        },
      ]
    )
  }

  const removeParticipant = (participant: Participant) => {
    if (!eventId || !event) return

    if (isEventFinished(event)) {
      Alert.alert(
        'Нельзя исключить участника',
        'Мероприятие уже завершено'
      )
      return
    }

    const participantName =
      participant.profile?.full_name ||
      participant.profile?.email ||
      'этого участника'

    Alert.alert(
      'Исключить участника?',
      `Удалить ${participantName} из списка участников?`,
      [
        {
          text: 'Отмена',
          style: 'cancel',
        },
        {
          text: 'Исключить',
          style: 'destructive',
          onPress: async () => {
            setRemovingParticipantId(participant.id)

            const { error } = await supabase
              .from('tickets')
              .delete()
              .eq('id', participant.id)
              .eq('event_id', eventId)

            setRemovingParticipantId(null)

            if (error) {
              Alert.alert('Ошибка', error.message)
              return
            }

            if (participant.user_id === currentUserId) {
              setIsJoined(false)
            }

            await loadParticipants()

            Alert.alert('Готово', 'Участник исключён из мероприятия')
          },
        },
      ]
    )
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

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
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
  const finished = isEventFinished(event)
  const canManageParticipants = role === 'organizer' || role === 'admin'

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
          <Text style={styles.info}>
            📅 Начало: {formatIsoDateForDisplay(event.date)}
          </Text>

          <Text style={styles.info}>
            🏁 Окончание:{' '}
            {formatIsoDateForDisplay(event.end_date || event.date)}
          </Text>

          <Text style={styles.info}>
            📍 {event.location || 'Место не указано'}
          </Text>

          {distanceLoading ? (
            <View style={styles.distanceLoadingBox}>
              <ActivityIndicator size="small" color="#22c55e" />
              <Text style={styles.distanceLoadingText}>
                Вычисляем расстояние...
              </Text>
            </View>
          ) : distanceText ? (
            <Text style={styles.distanceText}>🧭 {distanceText}</Text>
          ) : null}

          <Text style={styles.info}>
            🔞 {event.age_limit ? `${event.age_limit}+` : 'Без ограничения'}
          </Text>

          {maxParticipants !== null && (
            <Text style={styles.info}>
              👥 Мест осталось: {remainingPlaces} из {maxParticipants}
            </Text>
          )}

          {finished && (
            <Text style={styles.finishedText}>
              ⛔ Мероприятие завершено
            </Text>
          )}
        </View>

        {finished ? (
          <View style={styles.finishedButton}>
            <Text style={styles.finishedButtonText}>
              Мероприятие завершено. Регистрация недоступна
            </Text>
          </View>
        ) : isJoined ? (
          <>
            <View style={[styles.button, styles.joinedButton]}>
              <Text style={styles.buttonText}>Ты участвуешь</Text>
            </View>

            <TouchableOpacity
              style={styles.cancelParticipationButton}
              onPress={cancelParticipation}
            >
              <Text style={styles.cancelParticipationText}>
                Отменить участие
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[
              styles.button,
              isFull && { backgroundColor: '#334155' },
            ]}
            onPress={joinEvent}
            disabled={isFull || joining}
          >
            {joining ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.buttonText}>
                {isFull ? 'Мест нет' : 'Участвовать'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {canManageParticipants && (
          <View style={styles.participantsSection}>
            <Text style={styles.section}>Список участников</Text>

            {participants.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Пока нет участников</Text>
              </View>
            ) : (
              participants.map((participant) => (
                <View key={participant.id} style={styles.participantCard}>
                  <Text style={styles.participantName}>
                    {participant.profile?.full_name || 'Без имени'}
                  </Text>

                  <Text style={styles.participantEmail}>
                    {participant.profile?.email || 'Нет email'}
                  </Text>

                  {!finished && (
                    <TouchableOpacity
                      style={[
                        styles.removeParticipantButton,
                        removingParticipantId === participant.id &&
                          styles.removeParticipantButtonDisabled,
                      ]}
                      onPress={() => removeParticipant(participant)}
                      disabled={removingParticipantId === participant.id}
                    >
                      <Text style={styles.removeParticipantText}>
                        {removingParticipantId === participant.id
                          ? 'Исключаем...'
                          : 'Исключить участника'}
                      </Text>
                    </TouchableOpacity>
                  )}
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
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
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
  image: {
    width: '100%',
    height: 240,
  },
  content: {
    padding: 20,
  },
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
  text: {
    color: '#cbd5e1',
    marginTop: 12,
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
  },
  info: {
    color: '#fff',
    marginTop: 6,
  },
  distanceText: {
    color: '#22c55e',
    marginTop: 6,
    fontWeight: '600',
  },
  distanceLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  distanceLoadingText: {
    color: '#9ca3af',
    fontSize: 14,
    marginLeft: 6,
  },
  finishedText: {
    color: '#f87171',
    fontWeight: '700',
    marginTop: 12,
  },
  button: {
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 14,
    marginTop: 20,
    minHeight: 52,
    justifyContent: 'center',
  },
  joinedButton: {
    backgroundColor: '#334155',
  },
  buttonText: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#000',
  },
  finishedButton: {
    backgroundColor: '#7f1d1d',
    padding: 16,
    borderRadius: 14,
    marginTop: 20,
  },
  finishedButtonText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  cancelParticipationButton: {
    backgroundColor: '#ef4444',
    padding: 14,
    borderRadius: 14,
    marginTop: 10,
  },
  cancelParticipationText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  participantsSection: {
    marginTop: 20,
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
  removeParticipantButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  removeParticipantButtonDisabled: {
    opacity: 0.6,
  },
  removeParticipantText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
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