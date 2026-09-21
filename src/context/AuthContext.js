import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';
import { toast } from 'react-toastify';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  // const [loading, setLoading] = useState(true);
  const [loading, setLoading] = useState(!!token);

  // Auto logout on inactivity (for representatives and admins)
  useEffect(() => {
    if (!token || !user) return;
    if (user.role !== 'representative' && user.role !== 'admin') return;

    let logoutTimer;

    const resetTimer = () => {
      if (logoutTimer) clearTimeout(logoutTimer);
      
      logoutTimer = setTimeout(() => {
        logout();
        toast.warning('Logged out due to 30 minutes of inactivity.', {
          toastId: 'inactivity-logout-toast'
        });
      }, 30 * 60 * 1000); // 30 minutes
    };

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    activityEvents.forEach(evt => {
      document.addEventListener(evt, resetTimer);
    });

    resetTimer(); // Initialize timer

    return () => {
      if (logoutTimer) clearTimeout(logoutTimer);
      activityEvents.forEach(evt => {
        document.removeEventListener(evt, resetTimer);
      });
    };
  }, [token, user]); // eslint-disable-line

  useEffect(() => {
    const verifyToken = async () => {
      if (token) {
        try {
          const res = await authAPI.getMe();
          setUser(res.data.user);
        } catch (error) {
          logout();
        }
      }
      setLoading(false);
    };
    verifyToken();
    // eslint-disable-next-line
  }, []);

  const login = async (email, password, selectedUserId = null) => {
    const res = await authAPI.login({ email, password, selectedUserId });
    if (res.data && res.data.requiresSelection) {
      return res.data;
    }
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const register = async (formData, autoLogin = true) => {
    const res = await authAPI.register(formData);
    const { token: newToken, user: userData } = res.data;
    
    if (autoLogin) {
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));
      setToken(newToken);
      setUser(userData);
      return userData;
    }
    
    return userData; // Just return for verification
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const switchAccount = async (targetUserId) => {
    const res = await authAPI.switchAccount(targetUserId);
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, switchAccount }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
