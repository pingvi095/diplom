import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sbsnjxmxtgfoxbncqxsw.supabase.co'
const supabaseAnonKey =
'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNic25qeG14dGdmb3hibmNxeHN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NjQ5MDMsImV4cCI6MjA5MTA0MDkwM30.Lc8dRZn0YkCo5e0TYTh_h-9kTcHHCg_6L8516p8Ygd8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
auth: {
storage: AsyncStorage,
autoRefreshToken: true,
persistSession: true,
detectSessionInUrl: false,
},
})