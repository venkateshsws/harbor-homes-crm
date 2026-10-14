# Role & permission matrix

| Capability | Admin | Team Lead | Employee |
|------------|:-----:|:---------:|:--------:|
| Company-wide dashboards/reports | ✓ | Team only | Own only |
| Manage employees / deactivate | ✓ | View team | Own profile |
| Create teams / assign team leads | ✓ | — | — |
| View all leads | ✓ | Own team | Own leads |
| Create leads | ✓ | ✓ | ✓ (self-owned) |
| Import / export leads | ✓ | Export team | — |
| Manual assign within team | ✓ | ✓ | — |
| Auto assignment rules/queues | ✓ | — | — |
| Attendance all employees | ✓ | Team | Own |
| Call logs | ✓ | Team | Own |
| Follow-ups | ✓ | Team | Own |
| Properties inventory write | ✓ | Read | Read |
| Campaigns / nurturing config | ✓ | View | — |
| WhatsApp admin status | ✓ | Send if lead access | Send if lead access |
| System settings / audit | ✓ | — | — |
| Create admin accounts | ✓ | — | — |

Enforcement is **server-side** on every endpoint. Changing URL/IDs returns HTTP 403.
