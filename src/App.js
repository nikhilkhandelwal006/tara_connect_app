import React, { Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login/Login';
import RepresentativeSignup from './pages/RepresentativeSignup/RepresentativeSignup';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import './index.css';

// 👇 Yeh 4 lines change hui — lazy() se wrap kiya
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'));
const BuyerDashboard = lazy(() => import('./pages/Buyer/BuyerDashboard'));
const RepresentativeDashboard = lazy(() => import('./pages/Representative/RepresentativeDashboard'));

// Home redirect — bilkul same, kuch change nahi
const HomeRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-primary)'
      }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'buyer':
      return <Navigate to="/buyer" replace />;
    case 'representative':
      return <Navigate to="/representative" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

// 👇 Suspense fallback — dashboard load hote time yeh dikhega
const PageLoader = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'var(--bg-primary)'
  }}>
    <div className="spinner"></div>
  </div>
);

const CapacitorAppHandler = () => {
  React.useEffect(() => {
    try {
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    } catch (err) {}

    const backListener = CapApp.addListener('backButton', ({ canGoBack }) => {
      const currentPath = window.location.pathname;
      if (currentPath === '/login' || currentPath === '/' || currentPath === '/admin' || currentPath === '/buyer' || currentPath === '/representative') {
        CapApp.exitApp();
      } else {
        window.history.back();
      }
    });

    return () => {
      backListener.then(l => l.remove()).catch(() => {});
    };
  }, []);

  return null;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <CapacitorAppHandler />
        {/* 👇 Routes ko Suspense mein wrap kiya */}
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/rep-signup" element={<RepresentativeSignup />} />

            <Route path="/admin/*" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />

            <Route path="/buyer/*" element={
              <ProtectedRoute allowedRoles={['buyer']}>
                <BuyerDashboard />
              </ProtectedRoute>
            } />

            <Route path="/representative/*" element={
              <ProtectedRoute allowedRoles={['representative']}>
                <RepresentativeDashboard />
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        theme="dark"
        toastStyle={{
          background: '#1a1a2e',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          fontFamily: 'Inter, sans-serif'
        }}
      />
    </AuthProvider>
  );
}

export default App;
