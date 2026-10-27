import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--ink)' }}>
      <div className="text-white">Loading...</div>
    </div>;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && (!user.role || !allowedRoles.includes(user.role))) {
    const targetPath = user.role ? `/${user.role}` : '/login';
    return <Navigate to={targetPath} replace />;
  }

  return children;
};
