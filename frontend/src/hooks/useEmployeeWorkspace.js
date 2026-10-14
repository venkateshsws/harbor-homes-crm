import { useCallback, useEffect, useState } from 'react'
import { employeeService } from '../services/employeeService'

export function useEmployeeWorkspace(month) {
  const [state, setState] = useState({ data: null, source: null, loading: true, error: '', fetchedAt: 0 })

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setState((s) => ({ ...s, loading: true }))
    try {
      const { data, source } = await employeeService.getWorkspace(month)
      setState({ data, source, loading: false, error: '', fetchedAt: Date.now() })
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message }))
    }
  }, [month])

  useEffect(() => { load() }, [load])

  return { ...state, reload: load }
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
