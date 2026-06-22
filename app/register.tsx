import { useEffect, useState } from 'react'
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

const MIN_AGE = 12
const MAX_AGE = 100

const translateError = (message: string): string => {
  const msg = message.toLowerCase()

  if (
    msg.includes('user already registered') ||
    msg.includes('user already exists') ||
    msg.includes('already been registered')
  ) {
    return 'Пользователь с таким email уже зарегистрирован. Войдите в аккаунт.'
  }

  if (msg.includes('password should be at least')) {
    return 'Пароль должен быть не менее 6 символов'
  }

  if (msg.includes('network request failed')) {
    return 'Ошибка сети. Проверьте интернет-соединение'
  }

  return message
}

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [age, setAge] = useState('')

  const router = useRouter()

  useEffect(() => {
    const checkCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        Alert.alert(
          'Вы уже зарегистрированы',
          'Для этого аккаунта уже создана учётная запись.'
        )
        router.replace('/(tabs)/home')
      }
    }

    checkCurrentUser()
  }, [])

  const handleRegister = async () => {
    const normalizedEmail = normalizeEmail(email)
    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()
    const numericAge = Number(age)

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()

    if (currentUser) {
      Alert.alert(
        'Регистрация невозможна',
        'Вы уже вошли в аккаунт. Сначала выйдите из него.'
      )
      router.replace('/(tabs)/home')
      return
    }

    if (trimmedName.length < 2 || trimmedName.length > 50) {
      Alert.alert('Ошибка', 'Имя должно содержать от 2 до 50 символов')
      return
    }

    if (!isValidEmail(normalizedEmail)) {
      Alert.alert('Ошибка', 'Введите корректный email')
      return
    }

    if (!password.trim() || password.length < 6 || password.length > 50) {
      Alert.alert('Ошибка', 'Пароль должен содержать от 6 до 50 символов')
      return
    }

    if (trimmedPhone && trimmedPhone.length !== 11) {
      Alert.alert('Ошибка', 'Номер телефона должен состоять из 11 цифр')
      return
    }

    if (!age || numericAge < MIN_AGE || numericAge > MAX_AGE) {
      Alert.alert(
        'Ошибка',
        `Регистрация доступна пользователям от ${MIN_AGE} до ${MAX_AGE} лет`
      )
      return
    }

    // Проверяем, существует ли профиль с таким email
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (checkError) {
      Alert.alert(
        'Ошибка',
        'Не удалось проверить, зарегистрирован ли пользователь. Попробуйте ещё раз.'
      )
      return
    }

    if (existingProfile) {
      Alert.alert(
        'Регистрация невозможна',
        'Пользователь с таким email уже зарегистрирован. Войдите в аккаунт.'
      )
      return
    }

    const clientHashedPassword = SHA256(password).toString()

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: clientHashedPassword,
      options: {
        data: {
          full_name: trimmedName,
          phone: trimmedPhone || null,
          age: numericAge,
        },
      },
    })

    if (error) {
      Alert.alert('Ошибка', translateError(error.message))
      return
    }

    // Supabase может не вернуть ошибку при повторном email,
    // поэтому оставляем и дополнительную проверку.
    if (data.user && data.user.identities?.length === 0) {
      Alert.alert(
        'Регистрация невозможна',
        'Пользователь с таким email уже зарегистрирован. Войдите в аккаунт.'
      )
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
        maxLength={50}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        value={email}
        onChangeText={(text) => setEmail(sanitizeEmailInput(text))}
        autoCapitalize="none"
        keyboardType="email-address"
        maxLength={100}
      />

      <TextInput
        style={styles.input}
        placeholder="Пароль (от 6 до 50 символов)"
        placeholderTextColor="#888"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        maxLength={50}
      />

      <TextInput
        style={styles.input}
        placeholder="Телефон (11 цифр без +)"
        placeholderTextColor="#888"
        value={phone}
        onChangeText={(text) => setPhone(sanitizePhone(text))}
        keyboardType="phone-pad"
        maxLength={11}
      />

      <TextInput
        style={styles.input}
        placeholder="Возраст (от 12 лет)"
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