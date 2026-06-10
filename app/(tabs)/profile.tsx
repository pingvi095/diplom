import { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'expo-router'
import {
  sanitizeDigits,
  sanitizeName,
  sanitizePhone,
} from '../../lib/validation'

export default function Profile() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('participant')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [age, setAge] = useState<number | null>(null)

  const [editVisible, setEditVisible] = useState(false)

  const router = useRouter()

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    setEmail(user.email ?? '')

    const { data, error } = await supabase
      .from('profiles')
      .select('role, full_name, phone, age')
      .eq('id', user.id)
      .maybeSingle()

    if (!error && data) {
      setRole(data.role || 'participant')
      setName(data.full_name || '')
      setPhone(data.phone || '')
      setAge(data.age ?? null)
    }
  }

  const translateRole = (userRole: string) => {
    switch (userRole) {
      case 'admin':
        return 'Администратор'
      case 'organizer':
        return 'Организатор'
      case 'participant':
        return 'Участник'
      default:
        return userRole
    }
  }

  const requestOrganizer = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data: existing } = await supabase
      .from('role_requests')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) {
      Alert.alert('Уже отправлено', 'Вы уже подали заявку')
      return
    }

    const { error } = await supabase.from('role_requests').insert([
      {
        user_id: user.id,
      },
    ])

    if (error) {
      Alert.alert('Ошибка', error.message)
    } else {
      Alert.alert('Готово', 'Заявка отправлена администратору')
    }
  }

  const saveProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: name.trim(),
        phone: phone.trim() || null,
        age,
      })
      .eq('id', user.id)

    if (error) {
      Alert.alert('Ошибка', error.message)
    } else {
      Alert.alert('Успех', 'Изменения сохранены')
      setEditVisible(false)
      loadProfile()
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Профиль</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{email}</Text>

        <Text style={styles.label}>Имя</Text>
        <Text style={styles.value}>{name || 'Не указано'}</Text>

        <Text style={styles.label}>Телефон</Text>
        <Text style={styles.value}>{phone || 'Не указан'}</Text>

        <Text style={styles.label}>Возраст</Text>
        <Text style={styles.value}>{age ?? 'Не указан'}</Text>

        <Text style={styles.label}>Роль</Text>
        <Text style={styles.value}>{translateRole(role)}</Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => setEditVisible(true)}
      >
        <Text style={styles.buttonText}>Редактировать профиль</Text>
      </TouchableOpacity>

      {role === 'participant' && (
        <TouchableOpacity style={styles.button} onPress={requestOrganizer}>
          <Text style={styles.buttonText}>Стать организатором</Text>
        </TouchableOpacity>
      )}

      {role === 'admin' && (
        <TouchableOpacity
          style={styles.adminButton}
          onPress={() => router.push('/admin')}
        >
          <Text style={styles.adminButtonText}>Админ панель</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutButtonText}>Выйти</Text>
      </TouchableOpacity>

      <Modal visible={editVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Редактировать</Text>

            <TextInput
              style={styles.input}
              placeholder="Имя"
              placeholderTextColor="#888"
              value={name}
              onChangeText={(text) => setName(sanitizeName(text))}
            />

            <TextInput
              style={styles.input}
              placeholder="Телефон"
              placeholderTextColor="#888"
              value={phone}
              onChangeText={(text) => setPhone(sanitizePhone(text))}
              keyboardType="phone-pad"
            />

            <TextInput
              style={styles.input}
              placeholder="Возраст"
              placeholderTextColor="#888"
              value={age === null ? '' : String(age)}
              onChangeText={(text) => {
                const cleaned = sanitizeDigits(text)
                setAge(cleaned ? Number(cleaned) : null)
              }}
              keyboardType="numeric"
            />

            <TouchableOpacity style={styles.saveButton} onPress={saveProfile}>
              <Text style={styles.buttonText}>Сохранить</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setEditVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
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
    fontSize: 28,
    marginBottom: 20,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  label: {
    color: '#9ca3af',
    marginTop: 10,
    fontSize: 12,
  },
  value: {
    color: '#fff',
    fontSize: 16,
    marginTop: 2,
  },
  button: {
    backgroundColor: '#22c55e',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  adminButton: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    padding: 15,
    borderRadius: 12,
  },
  buttonText: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#000',
  },
  adminButtonText: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#fff',
  },
  logoutButtonText: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#020617',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    marginBottom: 16,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#111827',
    color: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  saveButton: {
    backgroundColor: '#22c55e',
    padding: 14,
    borderRadius: 12,
    marginTop: 10,
  },
  cancelButton: {
    backgroundColor: '#374151',
    padding: 14,
    borderRadius: 12,
    marginTop: 10,
  },
  cancelButtonText: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#fff',
  },
})
