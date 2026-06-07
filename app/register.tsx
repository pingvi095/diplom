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
import {
  isValidEmail,
  normalizeEmail,
  sanitizeDigits,
  sanitizeEmailInput,
  sanitizeName,
  sanitizePhone,
} from '../lib/validation'

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

    if (!password.trim()) {
      Alert.alert('Ошибка', 'Введите пароль')
      return
    }

    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: name.trim(),
          phone: phone.trim() || null,
          age: age ? Number(age) : null,
        },
      },
    })

    if (error) {
      Alert.alert('Ошибка', error.message)
      return
    }

    Alert.alert('Успех', 'Аккаунт создан')
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
        placeholder="Пароль"
        placeholderTextColor="#888"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
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
        value={age}
        onChangeText={(text) => setAge(sanitizeDigits(text))}
        keyboardType="numeric"
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