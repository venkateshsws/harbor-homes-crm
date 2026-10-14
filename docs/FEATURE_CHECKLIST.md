# Feature checklist

The PHP API and MySQL database are not part of this project. These screens run in the React frontend on saved demo data.

Legend: **Done** · **Partial** · **Simulated / external** · **Pending**

## Phase 1–2 — Auth, roles, employees, attendance
| Feature | Status |
|---------|--------|
| Login / logout / sessions / CSRF | Done |
| RBAC + record-level lead access | Done |
| Failed login logging + lockout | Done |
| Employees CRUD (admin) | Done |
| Teams + members | Done |
| Attendance sessions on login/logout | Done |
| Breaks excluded from working time | Done |
| Attendance summary reports | Done |
| Leave / correction requests | Done (API + basic flow) |
| Holidays calendar UI polish | Partial |

## Phase 3 — Leads & assignment
| Feature | Status |
|---------|--------|
| Lead CRUD, search, filters, pagination | Done |
| Status pipeline + history | Done |
| Notes / activities / assignment history | Done |
| CSV import / export | Done |
| Duplicate detection (phone/email) | Done |
| Round-robin / weighted / workload / priority / manual | Done |
| Queue pause/reset + race-safe locking | Done |
| Unaccepted timeout auto-reassign cron | Partial (rules stored; full timeout worker pending) |

## Phase 4 — Calls, follow-ups, site visits
| Feature | Status |
|---------|--------|
| tel: click-to-call + employee-reported outcomes | Done |
| Call analytics (logged, not verified connected) | Done |
| Follow-ups list/complete/escalate | Done |
| Site visits schedule/complete | Done |
| Telephony provider verified duration | External dependency |

## Phase 5 — Properties
| Feature | Status |
|---------|--------|
| Property/project inventory | Done |
| Lead–property matching | Done |
| Image/brochure upload hardening | Partial (fields exist; upload pipeline basic) |

## Phase 6 — Dashboards & reports
| Feature | Status |
|---------|--------|
| Role dashboards + charts | Done |
| Performance / conversion / assignment reports | Done |
| Metric definitions in UI/API | Done |
| Employee dashboard (shift bar, KPI tiles, call queue, follow-ups, site visits) | Done |
| Employee call history + notes, monthly attendance calendar, profile, performance graphs + CSV reports | Done |
| Offline mock fallback for employee screens (`VITE_EMPLOYEE_MOCK`) | Done |

## Phase 7 — Nurturing, campaigns, WhatsApp
| Feature | Status |
|---------|--------|
| Nurturing sequences UI/API | Done |
| Drip campaigns + enroll + process | Done |
| WhatsApp send path | Simulated until Meta credentials |
| WhatsApp webhooks + idempotency | Done (ready for live) |
| Email/SMS providers | Pending (show as unavailable without config) |

## Phase 8 — Security, docs, deploy
| Feature | Status |
|---------|--------|
| Sign-in for the demo accounts | Done |
| Audit log screen | Done (demo records) |
| Full load/performance test suite | Pending |

## Known limitations
1. Personal SIM `tel:` links cannot verify call duration/connection.
2. WhatsApp requires Meta Cloud API credentials and paid conversations.
3. Browser session time is not the same as productive work time.
