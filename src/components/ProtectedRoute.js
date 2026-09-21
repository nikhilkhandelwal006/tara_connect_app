import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  // if (loading) {
  //   return (
  //     <div style={{
  //       display: 'flex',
  //       alignItems: 'center',
  //       justifyContent: 'center',
  //       minHeight: '100vh',
  //       background: 'var(--bg-primary)'
  //     }}>
  //       <div className="spinner"></div>
  //     </div>
  //   );
  // }
  if (loading) {
    return null;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard
    switch (user.role) {
      case 'admin':
        return <Navigate to="/admin" replace />;
      case 'seller':
        return <Navigate to="/seller" replace />;
      case 'buyer':
        return <Navigate to="/buyer" replace />;
      case 'representative':
        return <Navigate to="/representative" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
