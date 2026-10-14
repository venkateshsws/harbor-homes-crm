import { api } from '../api/client'
import { mockAttendance, mockMutations, mockWorkspace } from './employeeMock'

// Service boundary for the employee workspace. Pages call these methods only; they
// never talk to fetch() or the mock directly. Each method returns { data, source }
// where source is 'api' (frontend demo records) or 'mock' (in-memory fallback).
//
// The mock is used when VITE_EMPLOYEE_MOCK=true, or when the API is unreachable
// (network error / 5xx / missing endpoint). Auth and validation errors (401/403/422)
// are always surfaced so real permission problems are never hidden behind demo data.

const FORCE_MOCK = import.meta.env.VITE_EMPLOYEE_MOCK === 'true'

function shouldFallBack(err) {
  return !err.status || err.status >= 500 || err.status === 404
}

async function read(live, fallback) {
  if (FORCE_MOCK) return { data: fallback(), source: 'mock' }
  try {
    const res = await live()
    return { data: res.data, source: 'api' }
  } catch (err) {
    if (!shouldFallBack(err)) throw err
    return { data: fallback(), source: 'mock' }
  }
}

async function write(source, live, fallback) {
  if (source === 'mock' || FORCE_MOCK) {
    fallback()
    return { source: 'mock' }
  }
  await live()
  return { source: 'api' }
}

const currentMonth = () => new Date().toISOString().slice(0, 7)

export const employeeService = {
  getWorkspace(month = currentMonth()) {
    return read(
      () => api(`/api/employee/workspace?month=${encodeURIComponent(month)}`),
      () => mockWorkspace(month),
    )
  },

  getAttendance(month = currentMonth()) {
    return read(
      () => api(`/api/employee/attendance?month=${encodeURIComponent(month)}`),
      () => mockAttendance(month),
    )
  },

  logCall(source, payload) {
    return write(source, () => api('/api/calls', { method: 'POST', body: payload }), () => mockMutations.logCall(payload))
  },

  updateLeadStatus(source, leadId, statusId, reason) {
    return write(
      source,
      () => api(`/api/leads/${leadId}`, { method: 'PUT', body: { status_id: Number(statusId), status_reason: reason || 'Updated from employee dashboard' } }),
      () => mockMutations.setStatus(leadId, statusId),
    )
  },

  scheduleFollowUp(source, payload) {
    return write(source, () => api('/api/follow-ups', { method: 'POST', body: payload }), () => mockMutations.addFollowUp(payload))
  },

  updateFollowUp(source, id, patch) {
    return write(source, () => api(`/api/follow-ups/${id}`, { method: 'PUT', body: patch }), () => mockMutations.updateFollowUp(id, patch))
  },

  scheduleSiteVisit(source, payload) {
    return write(source, () => api('/api/site-visits', { method: 'POST', body: payload }), () => mockMutations.addSiteVisit(payload))
  },

  updateSiteVisit(source, id, patch) {
    return write(source, () => api(`/api/site-visits/${id}`, { method: 'PUT', body: patch }), () => mockMutations.updateSiteVisit(id, patch))
  },

  startBreak(source) {
    return write(source, () => api('/api/attendance/breaks/start', { method: 'POST' }), () => mockMutations.startBreak())
  },

  endBreak(source) {
    return write(source, () => api('/api/attendance/breaks/end', { method: 'POST' }), () => mockMutations.endBreak())
  },
}
