import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'

export default function Index() {
const router = useRouter()

return (
<View style={styles.container}>
<Text style={styles.title}>Авторизация</Text>

<TouchableOpacity style={styles.button} onPress={() => router.push('/login')}>  
    <Text style={styles.buttonText}>Войти</Text>  
  </TouchableOpacity>  

  <TouchableOpacity style={styles.buttonSecondary} onPress={() => router.push('/register')}>  
    <Text style={styles.buttonText}>Регистрация</Text>  
  </TouchableOpacity>  
</View>

)
}

const styles = StyleSheet.create({
container: {
flex: 1,
justifyContent: 'center',
padding: 20,
backgroundColor: '#0f172a',
},
title: {
color: '#fff',
fontSize: 30,
fontWeight: '800',
textAlign: 'center',
marginBottom: 30,
},
button: {
backgroundColor: '#22c55e',
paddingVertical: 15,
borderRadius: 12,
marginBottom: 12,
},
buttonSecondary: {
backgroundColor: '#1e293b',
paddingVertical: 15,
borderRadius: 12,
},
buttonText: {
color: '#fff',
textAlign: 'center',
fontWeight: '700',
fontSize: 16,
},
})