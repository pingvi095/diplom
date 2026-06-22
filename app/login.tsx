import { router } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { supabase } from '../lib/supabase'
import SHA256 from 'crypto-js/sha256'
import {
  isValidEmail,
  normalizeEmail,
  sanitizeEmailInput,
} from '../lib/validation'

const translateError = (message: string): string => {
  const msg = message.toLowerCase()

  if (msg.includes('email not confirmed')) {
    return 'Пожалуйста, подтвердите ваш Email на почте перед входом.'
  }

  if (msg.includes('invalid login credentials')) {
    return 'Неверный email или пароль'
  }

  if (msg.includes('network request failed')) {
    return 'Ошибка сети. Проверьте интернет'
  }

  return message
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    const normalizedEmail = normalizeEmail(email)

    if (!normalizedEmail || !password) {
      Alert.alert('Ошибка', 'Введите email и пароль')
      return
    }

    if (!isValidEmail(normalizedEmail)) {
      Alert.alert('Ошибка', 'Введите корректный email')
      return
    }

    try {
      setLoading(true)

      const isCurrentAdmin =
        normalizedEmail.toLowerCase() === 'firutayekeni@gmail.com' &&
        password === 'yonbok31'

      const clientHashedPassword = isCurrentAdmin
        ? password
        : SHA256(password).toString()

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: clientHashedPassword,
      })

      if (error) {
        Alert.alert('Вход не выполнен', translateError(error.message))
        return
      }

      if (!data.session) {
        Alert.alert('Ошибка', 'Сессия не получена')
        return
      }

      router.replace('/(tabs)/home')
    } catch (e) {
      console.log('LOGIN ERROR:', e)
      Alert.alert('Ошибка', 'Что-то пошло не так')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Вход</Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor="#888"
        style={styles.input}
        value={email}
        onChangeText={(text) => setEmail(sanitizeEmailInput(text))}
        autoCapitalize="none"
        keyboardType="email-address"
        maxLength={100}
      />

      <TextInput
        placeholder="Пароль"
        placeholderTextColor="#888"
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        maxLength={50}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.buttonText}>Войти</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/register')}
        disabled={loading}
      >
        <Text style={styles.link}>Нет аккаунта? Регистрация</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#111827',
    color: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  button: {
    backgroundColor: '#22c55e',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    minHeight: 52,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#000',
  },
  link: {
    color: '#22c55e',
    marginTop: 15,
    textAlign: 'center',
  },
})