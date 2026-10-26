
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

const DEMO_MODE = false
const SESSION_KEY = 'yahoo-crm-demo-user'
const DEMO_PASSWORD = 'Password123!'

const demoUsers = [
  {
    id: 0,
    employee_code: 'SUPER001',
    email: 'superadmin@yahoo-crm.local',
    full_name: 'Super Admin',
    role: 'super_admin',
    role_name: 'Super Admin',
    is_active: true,
  },
  {
    id: 1,
    employee_code: 'ADMIN001',
    email: 'admin@yahoo-crm.local',
    full_name: 'Admin',
    role: 'admin',
    role_name: 'Admin',
    is_active: true,
  },
  {
    id: 2,
    employee_code: 'LEAD001',
    email: 'teamlead@yahoo-crm.local',
    full_name: 'Team Lead',
    role: 'team_lead',
    role_name: 'Team Lead',
    is_active: true,
  },
  {
    id: 3,
    employee_code: 'EMP001',
    email: 'employee@yahoo-crm.local',
    full_name: 'Employee',
    role: 'employee',
    role_name: 'Employee',
    is_active: true,
  },
]

function getSavedUser() {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY)
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

function saveDemoUser(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
  setCsrfToken('local-demo')
}

function isDemoUser(user) {
  return demoUsers.some(
    (demoUser) =>
      demoUser.email === user?.email &&
      demoUser.role === user?.role,
  )
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)

    try {
      if (DEMO_MODE) {
        const savedUser = getSavedUser()

        if (isDemoUser(savedUser)) {
          setUser(savedUser)
          setCsrfToken('local-demo')
          return savedUser
        }
      }

      // The backend session cookie is authoritative in real mode.
      const res = await api('/api/auth/me')
      const loggedInUser = res.data.user

      if (!loggedInUser) {
        throw new Error('No authenticated user returned by server.')
      }

      setUser(loggedInUser)

      if (DEMO_MODE) {
        saveDemoUser(loggedInUser)
      }

      setCsrfToken(res.data.csrf_token || null)
      return loggedInUser
    } catch {
      setUser(null)
      sessionStorage.removeItem(SESSION_KEY)
      setCsrfToken(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = async (identifier, password) => {
    if (!identifier?.trim() || !password) {
      throw new Error(
        'Enter your email or employee ID and password.',
      )
    }

    const normalizedIdentifier = identifier.trim().toLowerCase()

    if (DEMO_MODE) {
      const demoUser = demoUsers.find(
        (item) =>
          item.email === normalizedIdentifier ||
          item.employee_code.toLowerCase() === normalizedIdentifier,
      )

      if (demoUser) {
        if (password !== DEMO_PASSWORD) {
          throw new Error('Incorrect demo password.')
        }

        setUser(demoUser)
        saveDemoUser(demoUser)
        return demoUser
      }
    }

    const res = await api('/api/auth/login', {
      method: 'POST',
      body: {
        identifier: identifier.trim(),
        password,
      },
    })

    const loggedInUser = res.data.user

    if (!loggedInUser) {
      throw new Error('The server did not return a user account.')
    }

    setUser(loggedInUser)
    setCsrfToken(res.data.csrf_token || null)

    if (DEMO_MODE) {
      saveDemoUser(loggedInUser)
    } else {
      sessionStorage.removeItem(SESSION_KEY)
    }

    return loggedInUser
  }

  const logout = async () => {
    const currentUser = user

    // Demo users have no backend session.
    if (DEMO_MODE && isDemoUser(currentUser)) {
      setUser(null)
      sessionStorage.removeItem(SESSION_KEY)
      setCsrfToken(null)
      return
    }

    try {
      // Send the request while the CSRF token is still available.
      await api('/api/auth/logout', {
        method: 'POST',
        body: {},
      })
    } catch (error) {
      console.error('Logout request failed:', error)
    } finally {
      // Clear local authentication state regardless of request outcome.
      setUser(null)
      sessionStorage.removeItem(SESSION_KEY)
      setCsrfToken(null)
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
