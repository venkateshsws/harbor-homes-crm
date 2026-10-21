import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import LeadDetail from './pages/LeadDetail'
import Employees from './pages/Employees'
import Teams from './pages/Teams'
import Attendance from './pages/Attendance'
import Calls from './pages/Calls'
import FollowUps from './pages/FollowUps'
import Properties from './pages/Properties'
import Campaigns from './pages/Campaigns'
import Nurturing from './pages/Nurturing'
import Reports from './pages/Reports'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'
import Audit from './pages/Audit'
import Assignment from './pages/Assignment'
import Profile from './pages/Profile'
import Performance from './pages/Performance'
import SiteVisits from './pages/SiteVisits'
import MyCalls from './pages/employee/MyCalls'
import MyFollowUps from './pages/employee/MyFollowUps'
import MySiteVisits from './pages/employee/MySiteVisits'
import MyAttendance from './pages/employee/MyAttendance'
import { LoadingBlock } from './components/ui'

// Employees get self-service versions of shared routes; admin / team lead keep the originals.
function ByRole({ employee, fallback }) {
  const { user } = useAuth()
  return user?.role === 'employee' ? employee : fallback
}

function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingBlock label="Checking session…" />
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/super-admin"
        element={
          <RequireAuth roles={['super_admin']}>
            <SuperAdminDashboard />
          </RequireAuth>
        }
/>
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="leads/:id" element={<LeadDetail />} />
        <Route path="assignment" element={<RequireAuth roles={['admin']}><Assignment /></RequireAuth>} />
        <Route path="employees" element={<RequireAuth roles={['admin', 'team_lead']}><Employees /></RequireAuth>} />
        <Route path="teams" element={<RequireAuth roles={['admin', 'team_lead']}><Teams /></RequireAuth>} />
        <Route path="attendance" element={<ByRole employee={<MyAttendance />} fallback={<Attendance />} />} />
        <Route path="calls" element={<ByRole employee={<MyCalls />} fallback={<Calls />} />} />
        <Route path="follow-ups" element={<ByRole employee={<MyFollowUps />} fallback={<FollowUps />} />} />
        <Route path="properties" element={<Properties />} />
        <Route path="site-visits" element={<ByRole employee={<MySiteVisits />} fallback={<SiteVisits />} />} />
        <Route path="campaigns" element={<RequireAuth roles={['admin', 'team_lead']}><Campaigns /></RequireAuth>} />
        <Route path="nurturing" element={<RequireAuth roles={['admin', 'team_lead']}><Nurturing /></RequireAuth>} />
        <Route path="reports" element={<RequireAuth roles={['admin', 'team_lead']}><Reports /></RequireAuth>} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<RequireAuth roles={['admin']}><Settings /></RequireAuth>} />
        <Route path="audit" element={<RequireAuth roles={['admin']}><Audit /></RequireAuth>} />
        <Route path="profile" element={<Profile />} />
        <Route path="performance" element={<Performance />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
