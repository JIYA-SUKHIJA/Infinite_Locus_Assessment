import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../api/hooks/useAuth';

export interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Route boundary guard.
 * Redirects unauthenticated users to /login preserving the requested location in state.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
