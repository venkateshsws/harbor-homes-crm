# Harbor Homes — Real Estate CRM

Frontend-only CRM for Admin, Team Lead, and Employee screens: dashboard, leads, employees, properties, follow-ups, calls, attendance, and reports.

**Stack:** React (Vite) + Tailwind. There is no PHP API and no database. Screen data is saved demo JSON served by the Vite dev server.

## Run it on Windows

In the Cursor terminal, from the project folder:

```bat
cd frontend
npm install
npm run dev
```

Open **http://127.0.0.1:5173/** or **http://localhost:5173/**.

If port 5173 is already in use, Vite prints the next free port. Open that URL.

Sign in with any demo account. Password for all: `Password123!`

| Role | Email |
|------|-------|
| Admin | admin@harborhomes.crm |
| Team Lead | lead.north@harborhomes.crm |
| Employee | anita@harborhomes.crm |

Changes you make in the browser stay in the dev server's memory and reset when you stop it. They are not written to a database.
