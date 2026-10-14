import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, setCsrfToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await api('/api/auth/me')
      setUser(res.data.user)
      setCsrfToken(res.data.csrf_token)
    } catch {
      setUser(null)
      setCsrfToken(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = async (identifier, password) => {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: { identifier, password },
    })
    setUser(res.data.user)
    setCsrfToken(res.data.csrf_token)
    return res.data.user
  }

  const logout = async () => {
    setUser(null)
    setCsrfToken(null)
    try {
      await api('/api/auth/logout', { method: 'POST', body: {} })
    } catch {
      // Still clear client state; server may already have revoked the session.
    }
  }

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh, isAdmin: user?.role === 'admin', isLead: user?.role === 'team_lead', isEmployee: user?.role === 'employee' }),
    [user, loading, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
