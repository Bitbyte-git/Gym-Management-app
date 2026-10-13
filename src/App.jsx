import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

export default function App(){
  return <Routes>
    <Route path="/" element={<Landing/>}/>
    <Route path="/login" element={<Login/>}/>
    <Route path="/admin/*" element={<Dashboard/>}/>
    <Route path="/trainer/*" element={<Dashboard role="trainer"/>}/>
    <Route path="/member/*" element={<Dashboard role="member"/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>
}
