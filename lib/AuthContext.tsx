import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { User } from '@supabase/supabase-js'

type AuthType = {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthType>({
  user: null,
  loading: true,
})

export function AuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.log('Ошибка старой сессии:', error.message)

          await supabase.auth.signOut()
          setUser(null)
        } else {
          setUser(data.session?.user ?? null)
        }
      } catch (error) {
        console.log('Не удалось загрузить сессию:', error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    loadSession()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)