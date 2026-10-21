
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { api, setCsrfToken } from '../api/client'

const AuthContext = createContext(null)

// Keep true while developing the frontend without a backend.
const DEMO_MODE = true

const demoUsers = {
  'admin@harborhomes.crm': {
    id: 1,
    employee_code: 'ADM001',
    email: 'admin@harborhomes.crm',
    full_name: 'Asha Verma',
    role: 'admin',
    role_name: 'Admin',
    is_active: true,
  },

  'employee@yahoo-crm.local': {
    id: 2,
    employee_code: 'EMP001',
    email: 'employee@yahoo-crm.local',
    full_name: 'Demo Employee',
    role: 'employee',
    role_name: 'Employee',
    is_active: true,
  },

  'superadmin@yahoo-crm.local': {
    id: 0,
    employee_code: 'SUPER001',
    email: 'superadmin@yahoo-crm.local',
    full_name: 'Super Admin',
    role: 'super_admin',
    role_name: 'Super Admin',
    is_active: true,
  },
}

const demoPasswords = {
  'admin@harborhomes.crm': 'Password123!',
  'employee@yahoo-crm.local': 'Employee123!',
  'superadmin@yahoo-crm.local': 'SuperAdmin123!',
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (!DEMO_MODE) return null

    try {
      const savedUser = sessionStorage.getItem(
        'yahoo-crm-demo-user',
      )
      if (!savedUser) return null

      const parsedUser = JSON.parse(savedUser)

      // Do not restore unknown or outdated demo roles.
      return parsedUser?.email &&
        demoUsers[parsedUser.email.toLowerCase()]?.role === parsedUser.role
        ? demoUsers[parsedUser.email.toLowerCase()]
        : null
    } catch {
      return null
    }
  })

  const [loading, setLoading] = useState(!DEMO_MODE)

  const refresh = useCallback(async () => {
    if (DEMO_MODE) {
      setLoading(false)
      return
    }

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
    if (DEMO_MODE) {
      const email = identifier?.trim().toLowerCase()

      if (!email || !password) {
        throw new Error('Enter your email and password.')
      }

      const demoUser = demoUsers[email]

      if (!demoUser) {
        throw new Error(
          'Demo account not found. Use one of the demo emails below.',
        )
      }

      if (demoPasswords[email] !== password) {
        throw new Error('Incorrect demo password.')
      }

      sessionStorage.setItem(
        'yahoo-crm-demo-user',
        JSON.stringify(demoUser),
      )

      setCsrfToken('local-demo')
      setUser(demoUser)

      return demoUser
    }

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
    sessionStorage.removeItem('yahoo-crm-demo-user')
    setCsrfToken(null)

    if (DEMO_MODE) return

    try {
      await api('/api/auth/logout', {
        method: 'POST',
        body: {},
      })
    } catch {
      // Clear client state even if the server is unavailable.
    }
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refresh,
      isAdmin: user?.role === 'admin',
      isSuperAdmin: user?.role === 'super_admin',
      isLead: user?.role === 'team_lead',
      isEmployee: user?.role === 'employee',
    }),
    [user, loading, refresh],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)

  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return ctx
}
