import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  View,
  ActivityIndicator,
} from 'react-native'
import { supabase } from '../lib/supabase'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import {
  displayDateToIsoDate,
  formatIsoDateForDisplay,
  isValidDisplayDate,
  sanitizeDigits,
  sanitizeDisplayDateInput,
} from '../lib/validation'
import { SelectedEventImage, uploadEventImage } from '../lib/eventImages'

const MAX_TITLE_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 1000
const MAX_LOCATION_LENGTH = 250
const MAX_PARTICIPANTS = 100000
const MAX_AGE_LIMIT = 100

export default function EditEvent() {
  const params = useLocalSearchParams()
  const router = useRouter()

  const eventId = Array.isArray(params.id) ? params.id[0] : params.id

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [location, setLocation] = useState('')
  const [maxParticipants, setMaxParticipants] = useState('')
  const [ageLimit, setAgeLimit] = useState('')
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<SelectedEventImage | null>(
    null
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (eventId) {
      loadEvent()
    }
  }, [eventId])

  const loadEvent = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle()

    if (error || !data) {
      Alert.alert('Ошибка', 'Событие не найдено')
      router.back()
      return
    }

    setTitle(data.title || '')
    setDescription(data.description || '')
    setDate(formatIsoDateForDisplay(data.date || ''))
    setEndDate(formatIsoDateForDisplay(data.end_date || data.date || ''))
    setLocation(data.location || '')
    setMaxParticipants(
      data.max_participants ? String(data.max_participants) : ''
    )
    setAgeLimit(data.age_limit ? String(data.age_limit) : '')
    setExistingImageUrl(data.image_url || null)
  }

  const pickImageFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (permission.status !== 'granted') {
      Alert.alert('Ошибка', 'Нужен доступ к галерее')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
      base64: true,
    })

    if (result.canceled) return

    const image = result.assets[0]

    setSelectedImage({
      uri: image.uri,
      base64: image.base64,
      fileName: image.fileName,
      mimeType: image.mimeType,
    })
  }

  const pickImageFromFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: true,
    })

    if (result.canceled) return

    const image = result.assets[0]

    setSelectedImage({
      uri: image.uri,
      fileName: image.name,
      mimeType: image.mimeType,
    })
  }

  const updateEvent = async () => {
    const trimmedTitle = title.trim()
    const trimmedDescription = description.trim()
    const trimmedLocation = location.trim()

    if (!trimmedTitle) {
      Alert.alert('Ошибка', 'Введите название мероприятия')
      return
    }

    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      Alert.alert(
        'Ошибка',
        `Название не должно быть длиннее ${MAX_TITLE_LENGTH} символов`
      )
      return
    }

    if (!trimmedDescription) {
      Alert.alert('Ошибка', 'Введите описание мероприятия')
      return
    }

    if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
      Alert.alert(
        'Ошибка',
        `Описание не должно быть длиннее ${MAX_DESCRIPTION_LENGTH} символов`
      )
      return
    }

    if (!date.trim() || !isValidDisplayDate(date)) {
      Alert.alert('Ошибка', 'Введите дату начала в формате ДД.ММ.ГГГГ')
      return
    }

    if (!endDate.trim() || !isValidDisplayDate(endDate)) {
      Alert.alert('Ошибка', 'Введите дату окончания в формате ДД.ММ.ГГГГ')
      return
    }

    const startDateIso = displayDateToIsoDate(date)
    const endDateIso = displayDateToIsoDate(endDate)

    if (new Date(endDateIso) < new Date(startDateIso)) {
      Alert.alert(
        'Ошибка',
        'Дата окончания мероприятия не может быть раньше даты начала'
      )
      return
    }

    if (!trimmedLocation) {
      Alert.alert('Ошибка', 'Введите адрес или место проведения')
      return
    }

    if (trimmedLocation.length > MAX_LOCATION_LENGTH) {
      Alert.alert(
        'Ошибка',
        `Адрес не должен быть длиннее ${MAX_LOCATION_LENGTH} символов`
      )
      return
    }

    if (
      maxParticipants &&
      (Number(maxParticipants) < 1 ||
        Number(maxParticipants) > MAX_PARTICIPANTS)
    ) {
      Alert.alert(
        'Ошибка',
        `Количество участников должно быть от 1 до ${MAX_PARTICIPANTS}`
      )
      return
    }

    if (
      ageLimit &&
      (Number(ageLimit) < 0 || Number(ageLimit) > MAX_AGE_LIMIT)
    ) {
      Alert.alert(
        'Ошибка',
        `Возрастное ограничение должно быть от 0 до ${MAX_AGE_LIMIT}`
      )
      return
    }

    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        Alert.alert('Ошибка', 'Не авторизован')
        return
      }

      let imageUrl = existingImageUrl

      if (selectedImage) {
        try {
          imageUrl = await uploadEventImage(selectedImage, user.id)
        } catch (error: any) {
          Alert.alert(
            'Ошибка фото',
            error.message || 'Не удалось загрузить новое фото'
          )
          return
        }
      }

      const { error } = await supabase
        .from('events')
        .update({
          title: trimmedTitle,
          description: trimmedDescription,
          date: startDateIso,
          end_date: endDateIso,
          location: trimmedLocation,
          max_participants: maxParticipants
            ? Number(maxParticipants)
            : null,
          age_limit: ageLimit ? Number(ageLimit) : null,
          image_url: imageUrl,
        })
        .eq('id', eventId)
        .eq('user_id', user.id)

      if (error) {
        Alert.alert('Ошибка', error.message)
      } else {
        Alert.alert('Успех', 'Мероприятие обновлено')
        router.back()
      }
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось обновить мероприятие')
    } finally {
      setLoading(false)
    }
  }

  const previewUri = selectedImage?.uri || existingImageUrl

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.header}>Редактировать событие</Text>

      <TextInput
        style={styles.input}
        placeholder="Название"
        placeholderTextColor="#888"
        value={title}
        onChangeText={setTitle}
        maxLength={MAX_TITLE_LENGTH}
      />

      <Text style={styles.counter}>
        {title.length}/{MAX_TITLE_LENGTH}
      </Text>

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Описание"
        placeholderTextColor="#888"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={MAX_DESCRIPTION_LENGTH}
      />

      <Text style={styles.counter}>
        {description.length}/{MAX_DESCRIPTION_LENGTH}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Дата начала (например 20.05.2026)"
        placeholderTextColor="#888"
        value={date}
        onChangeText={(text) => setDate(sanitizeDisplayDateInput(text))}
        keyboardType="numeric"
        maxLength={10}
      />

      <TextInput
        style={styles.input}
        placeholder="Дата окончания (например 21.05.2026)"
        placeholderTextColor="#888"
        value={endDate}
        onChangeText={(text) => setEndDate(sanitizeDisplayDateInput(text))}
        keyboardType="numeric"
        maxLength={10}
      />

      <TextInput
        style={styles.input}
        placeholder="Адрес / место проведения"
        placeholderTextColor="#888"
        value={location}
        onChangeText={setLocation}
        maxLength={MAX_LOCATION_LENGTH}
      />

      <Text style={styles.counter}>
        {location.length}/{MAX_LOCATION_LENGTH}
      </Text>

      <TextInput
        style={styles.input}
        placeholder={`Максимум участников (от 1 до ${MAX_PARTICIPANTS})`}
        placeholderTextColor="#888"
        value={maxParticipants}
        onChangeText={(text) => setMaxParticipants(sanitizeDigits(text))}
        keyboardType="numeric"
        maxLength={6}
      />

      <TextInput
        style={styles.input}
        placeholder="Возрастное ограничение (например 18)"
        placeholderTextColor="#888"
        value={ageLimit}
        onChangeText={(text) => setAgeLimit(sanitizeDigits(text))}
        keyboardType="numeric"
        maxLength={3}
      />

      <View style={styles.imageBox}>
        {previewUri ? (
          <>
            <Image source={{ uri: previewUri }} style={styles.preview} />

            {selectedImage && (
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => setSelectedImage(null)}
              >
                <Text style={styles.removeImageText}>Отменить новое фото</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <Text style={styles.imageHint}>Фото мероприятия не выбрано</Text>
        )}

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={pickImageFromGallery}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Выбрать из галереи</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={pickImageFromFile}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Выбрать из файлов</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.6 }]}
        onPress={updateEvent}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.btnText}>Сохранить</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()} disabled={loading}>
        <Text style={styles.cancel}>Отмена</Text>
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
    fontSize: 26,
    marginBottom: 20,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#111827',
    color: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  counter: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'right',
    marginTop: -6,
    marginBottom: 10,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  imageBox: {
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 10,
  },
  imageHint: {
    color: '#9ca3af',
    marginBottom: 10,
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: '#334155',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
  },
  removeImageButton: {
    backgroundColor: '#7f1d1d',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  removeImageText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#22c55e',
    padding: 14,
    borderRadius: 12,
    marginTop: 10,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  btnText: {
    color: '#000',
    fontWeight: '700',
  },
  cancel: {
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 12,
  },
})