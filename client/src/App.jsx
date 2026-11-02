import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import ScrollToTop from './components/ScrollToTop';

const Landing = lazy(() => import('./pages/Landing'));
const Programs = lazy(() => import('./pages/Programs'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Trainers = lazy(() => import('./pages/Trainers'));
const Memberships = lazy(() => import('./pages/Memberships'));
const Facilities = lazy(() => import('./pages/Facilities'));
const Contact = lazy(() => import('./pages/Contact'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Register = lazy(() => import('./pages/Register'));
const AttendanceVerification = lazy(() => import('./pages/AttendanceVerification'));

export default function App(){
  return <ErrorBoundary>
    <Suspense fallback={<div className="page-loading" role="status">Loading Vino Fitness Studio…</div>}>
    <ScrollToTop />
    <Routes>
      {/* Member-Centric Public Routes */}
      <Route path="/" element={<Landing/>}/>
      <Route path="/programs" element={<Programs/>}/>
      <Route path="/schedule" element={<Schedule/>}/>
      <Route path="/trainers" element={<Trainers/>}/>
      <Route path="/memberships" element={<Memberships/>}/>
      <Route path="/facilities" element={<Facilities/>}/>
      <Route path="/contact" element={<Contact/>}/>

      {/* Aliases & Redirects */}
      <Route path="/pricing" element={<Navigate to="/memberships" replace/>}/>
      <Route path="/solutions" element={<Navigate to="/programs" replace/>}/>
      <Route path="/features" element={<Navigate to="/facilities" replace/>}/>
      <Route path="/resources" element={<Navigate to="/programs" replace/>}/>

      {/* Authentication & Registration */}
      <Route path="/login" element={<Login/>}/>
      <Route path="/register" element={<Register/>}/>

      {/* Internal & Member Dashboards */}
      <Route path="/kiosk" element={
        <ProtectedRoute allowedRoles={['kiosk', 'admin', 'reception']}>
          <AttendanceVerification standalone={true}/>
        </ProtectedRoute>
      }/>
      <Route path="/admin/*" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Dashboard role="admin"/>
        </ProtectedRoute>
      }/>
      <Route path="/reception/*" element={
        <ProtectedRoute allowedRoles={['reception']}>
          <Dashboard role="reception"/>
        </ProtectedRoute>
      }/>
      <Route path="/trainer/*" element={
        <ProtectedRoute allowedRoles={['trainer']}>
          <Dashboard role="trainer"/>
        </ProtectedRoute>
      }/>
      <Route path="/member/*" element={
        <ProtectedRoute allowedRoles={['member']}>
          <Dashboard role="member"/>
        </ProtectedRoute>
      }/>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  </Suspense>
  </ErrorBoundary>;
}
