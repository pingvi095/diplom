import { useState } from 'react'
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  View,
  ActivityIndicator,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useRouter } from 'expo-router'
import * as Location from 'expo-location'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import {
  displayDateToIsoDate,
  isValidDisplayDate,
  sanitizeDigits,
  sanitizeDisplayDateInput,
} from '../lib/validation'
import { SelectedEventImage, uploadEventImage } from '../lib/eventImages'

export default function CreateEvent() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [locationText, setLocationText] = useState('')
  const [maxParticipants, setMaxParticipants] = useState('')
  const [ageLimit, setAgeLimit] = useState('')
  const [selectedImage, setSelectedImage] = useState<SelectedEventImage | null>(
    null
  )
  const [loading, setLoading] = useState(false)

  const router = useRouter()

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

  const handleCreate = async () => {
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

    if (!locationText.trim()) {
      Alert.alert('Ошибка', 'Введите адрес или место проведения')
      return
    }

    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        Alert.alert('Ошибка', 'Нужно войти')
        return
      }

      const { status } = await Location.requestForegroundPermissionsAsync()

      let latitude = null
      let longitude = null

      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({})
        latitude = loc.coords.latitude
        longitude = loc.coords.longitude
      }

      let imageUrl = null

      if (selectedImage) {
        try {
          imageUrl = await uploadEventImage(selectedImage, user.id)
        } catch (e: any) {
          Alert.alert(
            'Ошибка фото',
            e.message || 'Не удалось загрузить фото мероприятия'
          )
          return
        }
      }

      const { error } = await supabase.from('events').insert([
        {
          title: title.trim(),
          description: description.trim(),
          date: displayDateToIsoDate(date),
          location: locationText.trim(),
          max_participants: maxParticipants ? Number(maxParticipants) : null,
          age_limit: ageLimit ? Number(ageLimit) : null,
          image_url: imageUrl,
          latitude,
          longitude,
          user_id: user.id,
        },
      ])

      if (error) {
        Alert.alert('Ошибка', error.message)
        return
      }

      Alert.alert('Успех', 'Мероприятие создано')
      router.back()
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось создать мероприятие')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Создать мероприятие</Text>

      <TextInput
        placeholder="Название"
        placeholderTextColor="#888"
        style={styles.input}
        value={title}
        onChangeText={setTitle}
      />

      <TextInput
        placeholder="Описание"
        placeholderTextColor="#888"
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <TextInput
        placeholder="Дата (например 20.05.2026)"
        placeholderTextColor="#888"
        style={styles.input}
        value={date}
        onChangeText={(text) => setDate(sanitizeDisplayDateInput(text))}
        keyboardType="numeric"
      />

      <TextInput
        placeholder="Адрес / место"
        placeholderTextColor="#888"
        style={styles.input}
        value={locationText}
        onChangeText={setLocationText}
      />

      <TextInput
        placeholder="Макс участников"
        placeholderTextColor="#888"
        style={styles.input}
        value={maxParticipants}
        onChangeText={(text) => setMaxParticipants(sanitizeDigits(text))}
        keyboardType="numeric"
      />

      <TextInput
        placeholder="Возрастное ограничение (например 18)"
        placeholderTextColor="#888"
        style={styles.input}
        value={ageLimit}
        onChangeText={(text) => setAgeLimit(sanitizeDigits(text))}
        keyboardType="numeric"
      />

      <View style={styles.imageBox}>
        {selectedImage ? (
          <>
            <Image source={{ uri: selectedImage.uri }} style={styles.preview} />
            <TouchableOpacity
              style={styles.removeImageButton}
              onPress={() => setSelectedImage(null)}
            >
              <Text style={styles.removeImageText}>Удалить выбранное фото</Text>
            </TouchableOpacity>
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
        onPress={handleCreate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.buttonText}>Создать</Text>
        )}
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
  title: {
    color: '#fff',
    fontSize: 24,
    marginBottom: 20,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#111827',
    color: '#fff',
    padding: 12,
    borderRadius: 10,
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
    marginBottom: 10,
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
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    minHeight: 50,
    justifyContent: 'center',
  },
  buttonText: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#000',
  },
})