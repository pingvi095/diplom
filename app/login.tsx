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
import {
  isValidEmail,
  normalizeEmail,
  sanitizeEmailInput,
} from '../lib/validation'

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

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (error) {
        Alert.alert('Ошибка', error.message)
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
      />

      <TextInput
        placeholder="Пароль"
        placeholderTextColor="#888"
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.buttonText}>Войти</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/register')}>
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
  link: {
    color: '#22c55e',
    marginTop: 15,
    textAlign: 'center',
  },
})