import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Register = lazy(() => import('./pages/Register'));

export default function App(){
  return <Suspense fallback={<div className="page-loading" role="status">Loading PulseFit…</div>}>
    <Routes>
      <Route path="/" element={<Landing/>}/>
      <Route path="/login" element={<Login/>}/>
      <Route path="/register" element={<Register/>}/>
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
}
