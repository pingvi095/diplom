import { Stack } from 'expo-router'
import { AuthProvider } from '../lib/AuthContext'

export default function RootLayout() {
return (
<AuthProvider>
<Stack screenOptions={{ headerShown: false }}>
<Stack.Screen name="index" />
<Stack.Screen name="login" />
<Stack.Screen name="register" />
<Stack.Screen name="(tabs)" />
<Stack.Screen name="create-event" />
<Stack.Screen name="event-details" />
<Stack.Screen name="ticket-details" />
<Stack.Screen name="admin" />
</Stack>
</AuthProvider>
)
}