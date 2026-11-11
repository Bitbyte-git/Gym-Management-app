import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AppSkeleton } from './Skeleton';

export const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return <AppSkeleton />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && (!user.role || !allowedRoles.includes(user.role))) {
    const targetPath = user.role === 'kiosk' ? '/kiosk' : user.role ? `/${user.role}` : '/login';
    return <Navigate to={targetPath} replace />;
  }

  return children;
};
