import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useRouter } from 'expo-router'
import SHA256 from 'crypto-js/sha256'
import {
  isValidEmail,
  normalizeEmail,
  sanitizeDigits,
  sanitizeEmailInput,
  sanitizeName,
  sanitizePhone,
} from '../lib/validation'

// Локализатор системных ошибок от Supabase Auth
const translateError = (message: string): string => {
  const msg = message.toLowerCase()
  if (msg.includes('invalid login credentials')) return 'Неверный email или пароль'
  if (msg.includes('user already exists')) return 'Пользователь с таким email уже зарегистрирован'
  if (msg.includes('password should be at least')) return 'Пароль должен быть не менее 6 символов'
  if (msg.includes('network request failed')) return 'Ошибка сети. Проверьте интернет-соединение'
  return message
}

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [age, setAge] = useState('')

  const router = useRouter()

  const handleRegister = async () => {
    const normalizedEmail = normalizeEmail(email)

    if (!name.trim()) {
      Alert.alert('Ошибка', 'Введите имя')
      return
    }

    if (!isValidEmail(normalizedEmail)) {
      Alert.alert('Ошибка', 'Введите корректный email')
      return
    }

    if (!password.trim() || password.length < 6) {
      Alert.alert('Ошибка', 'Пароль должен быть не менее 6 символов')
      return
    }

    // Проверка длины телефона (если поле заполнено)
    if (phone.trim() && phone.trim().length < 11) {
      Alert.alert('Ошибка', 'Номер телефона должен состоять из 11 цифр')
      return
    }

    // Двойное хэширование: первый слой на клиенте
    const clientHashedPassword = SHA256(password).toString()

    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: clientHashedPassword,
      options: {
        data: {
          full_name: name.trim(),
          phone: phone.trim() || null,
          age: age ? Number(age) : null,
        },
      },
    })

    if (error) {
      Alert.alert('Ошибка', translateError(error.message))
      return
    }

    Alert.alert('Успех', 'Аккаунт успешно создан!')
    router.replace('/login')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Регистрация</Text>

      <TextInput
        style={styles.input}
        placeholder="Имя"
        placeholderTextColor="#888"
        value={name}
        onChangeText={(text) => setName(sanitizeName(text))}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        value={email}
        onChangeText={(text) => setEmail(sanitizeEmailInput(text))}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Пароль (минимум 6 символов)"
        placeholderTextColor="#888"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TextInput
        style={styles.input}
        placeholder="Телефон (11 цифр без +)"
        placeholderTextColor="#888"
        value={phone}
        onChangeText={(text) => setPhone(sanitizePhone(text))}
        keyboardType="phone-pad"
        maxLength={11} // Ограничение аппаратного ввода на уровне клавиатуры
      />

      <TextInput
        style={styles.input}
        placeholder="Возраст"
        placeholderTextColor="#888"
        value={age}
        onChangeText={(text) => setAge(sanitizeDigits(text))}
        keyboardType="numeric"
        maxLength={3}
      />

      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>Зарегистрироваться</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    marginBottom: 20,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#111827',
    color: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  button: {
    backgroundColor: '#22c55e',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
  },
  buttonText: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#000',
  },
})
