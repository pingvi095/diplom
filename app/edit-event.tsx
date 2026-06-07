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

export default function EditEvent() {
  const params = useLocalSearchParams()
  const router = useRouter()

  const eventId = Array.isArray(params.id) ? params.id[0] : params.id

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [location, setLocation] = useState('')
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
    setLocation(data.location || '')
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
    if (!title.trim()) {
      Alert.alert('Ошибка', 'Введите название мероприятия')
      return
    }

    if (!description.trim()) {
      Alert.alert('Ошибка', 'Введите описание мероприятия')
      return
    }

    if (!date.trim() || !isValidDisplayDate(date)) {
      Alert.alert('Ошибка', 'Введите дату в формате ДД.ММ.ГГГГ')
      return
    }

    if (!location.trim()) {
      Alert.alert('Ошибка', 'Введите адрес или место проведения')
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
        } catch (e: any) {
          Alert.alert(
            'Ошибка фото',
            e.message || 'Не удалось загрузить новое фото'
          )
          return
        }
      }

      const { error } = await supabase
        .from('events')
        .update({
          title: title.trim(),
          description: description.trim(),
          date: displayDateToIsoDate(date),
          location: location.trim(),
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
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось обновить мероприятие')
    } finally {
      setLoading(false)
    }
  }

  const previewUri = selectedImage?.uri || existingImageUrl

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.header}>Редактировать событие</Text>

      <TextInput
        style={styles.input}
        placeholder="Название"
        placeholderTextColor="#888"
        value={title}
        onChangeText={setTitle}
      />

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Описание"
        placeholderTextColor="#888"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <TextInput
        style={styles.input}
        placeholder="Дата (например 20.05.2026)"
        placeholderTextColor="#888"
        value={date}
        onChangeText={(text) => setDate(sanitizeDisplayDateInput(text))}
        keyboardType="numeric"
      />

      <TextInput
        style={styles.input}
        placeholder="Локация"
        placeholderTextColor="#888"
        value={location}
        onChangeText={setLocation}
      />

      <TextInput
        style={styles.input}
        placeholder="Возраст (например 18)"
        placeholderTextColor="#888"
        value={ageLimit}
        onChangeText={(text) => setAgeLimit(sanitizeDigits(text))}
        keyboardType="numeric"
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
    marginBottom: 12,
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