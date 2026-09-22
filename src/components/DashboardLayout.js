import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiLogOut, FiMenu, FiX, FiSun, FiMoon, FiKey, FiRefreshCw, FiChevronRight, FiUser } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { authAPI } from '../services/api';

const DashboardLayout = ({ children, navItems }) => {
  const { user, logout, switchAccount } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    const isMobile = window.innerWidth <= 768;
    const isAdmin = user?.role === 'admin';
    if (isMobile || isAdmin) {
      const toggled = sessionStorage.getItem('theme_toggled');
      if (!toggled) {
        localStorage.setItem('theme', 'light');
        return 'light';
      }
    }
    return localStorage.getItem('theme') || 'light';
  });

  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switching, setSwitching] = useState(false);

  React.useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  React.useEffect(() => {
    const fetchLinked = async () => {
      if (!user) return;
      try {
        const res = await authAPI.getLinkedAccounts();
        const others = (res.data?.accounts || []).filter(acc => acc._id !== user.id && acc._id !== user._id);
        setLinkedAccounts(others);
      } catch (err) {
        console.error('Error fetching linked accounts:', err);
      }
    };
    fetchLinked();
  }, [user]);

  const handleSwitchAccount = async (targetUserId) => {
    try {
      setSwitching(true);
      await switchAccount(targetUserId);
      toast.success('Switched account successfully');
      setShowSwitchModal(false);
      window.location.reload();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to switch account');
    } finally {
      setSwitching(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    sessionStorage.setItem('theme_toggled', 'true');
  };

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChanging, setIsChanging] = useState(false);

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error('All fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long');
      return;
    }
    if (user?.role === 'representative' && newPassword.length > 10) {
      toast.error('Representative password cannot exceed 10 characters');
      return;
    }

    try {
      setIsChanging(true);
      const res = await authAPI.changePassword({ oldPassword, newPassword });
      toast.success(res.data.message || 'Password changed successfully');
      setShowChangePassword(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setIsChanging(false);
    }
  };

  return (
  <>
    <div className="page-container">
      {/* Mobile Header */}
      <div className="mobile-header">
        <button className="menu-toggle" onClick={toggleSidebar}>
          <FiMenu />
        </button>
        <h1>TARA MEDICOS</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="menu-toggle" onClick={toggleTheme} style={{ border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Toggle Theme">
            {theme === 'dark' ? <FiSun style={{ fontSize: '18px', color: 'var(--warning)' }} /> : <FiMoon style={{ fontSize: '18px', color: 'var(--primary)' }} />}
          </button>
          <button className="menu-toggle" onClick={handleLogout} style={{ border: 'none', background: 'transparent', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Logout">
            <FiLogOut style={{ fontSize: '18px' }} />
          </button>
        </div>
      </div>
      
      {/* Sidebar Overlay */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} 
        onClick={closeSidebar}
      ></div>

      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div className="sidebar-brand-icon">
                <FiUser size={18} style={{ color: '#ffffff' }} />
              </div>
              <h1 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
                Tara Connect
              </h1>
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button 
                className="theme-toggle-btn"
                onClick={toggleTheme} 
                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
                style={{ padding: '6px 8px' }}
              >
                {theme === 'dark' ? (
                  <FiSun style={{ fontSize: '16px', color: '#f59e0b' }} />
                ) : (
                  <FiMoon style={{ fontSize: '16px', color: '#818cf8' }} />
                )}
              </button>
              <button className="btn-ghost" style={{ padding: '6px', color: '#ffffff', display: 'none' }} id="close-btn" onClick={closeSidebar}>
                <FiX size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* User Card */}
        <div className="sidebar-user-card">
          <div className="sidebar-user-avatar">
            {user?.role === 'admin' ? 'A' : (user?.name ? user.name.charAt(0).toUpperCase() : 'U')}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">
              {user?.role === 'admin' ? 'Admin' : user?.name}
            </div>
            <div className="sidebar-user-role">
              {user?.role === 'admin' ? 'Tara Medicos Pvt Ltd' : (user?.company || `${user?.role || 'User'} Account`)}
            </div>
          </div>
        </div>

        {/* Navigation Section Title */}
        <div className="sidebar-section-title">NAVIGATION</div>

        <nav className="sidebar-nav">
          {navItems.map((item, index) => (
            <NavLink
              key={index}
              to={item.path}
              end={item.exact}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={closeSidebar}
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="active-pill" />}
                  <span className="link-icon">{item.icon}</span>
                  <span className="nav-link-wrap">
                    <span>{item.label}</span>
                    {item.badge > 0 && <span className="nav-badge">{item.badge > 99 ? '99+' : item.badge}</span>}
                  </span>
                  {isActive && <FiChevronRight className="nav-chevron" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          {linkedAccounts.length > 0 && (
            <button onClick={() => setShowSwitchModal(true)} className="sidebar-link" style={{ color: '#38bdf8', marginTop: '2px', fontWeight: 600 }}>
              <span className="link-icon"><FiRefreshCw /></span>
              <span className="nav-link-wrap">Switch Account</span>
            </button>
          )}
          <button onClick={() => setShowChangePassword(true)} className="sidebar-link" style={{ color: '#cbd5e1', marginTop: '2px' }}>
            <span className="link-icon"><FiKey /></span>
            <span className="nav-link-wrap">Change Password</span>
          </button>
          <button onClick={handleLogout} className="sidebar-link logout-btn" style={{ color: '#f87171', marginTop: '4px' }}>
            <span className="link-icon"><FiLogOut /></span>
            <span className="nav-link-wrap">Log out</span>
          </button>
        </div>
      </aside>

      {/* Bottom Nav for Mobile */}
      <nav className="bottom-nav">
        {navItems.map((item, index) => (
          <NavLink
            key={index}
            to={item.path}
            end={item.exact}
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span style={{ fontSize: '11px', fontWeight: 600 }}>{item.shortLabel || item.label}</span>
            {item.badge > 0 && <span className="nav-badge">{item.badge > 99 ? '99+' : item.badge}</span>}
          </NavLink>
        ))}
      </nav>

      <main className="main-content animate-fade-in">
        {children}
      </main>

      <style>{`
        @media (max-width: 1024px) {
          #close-btn { display: flex !important; }
        }
      `}</style>
      {/* Change Password Modal */}
      {showChangePassword && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '400px', margin: '20px', padding: '24px', position: 'relative' }}>
            <button
              onClick={() => {
                setShowChangePassword(false);
                setOldPassword('');
                setNewPassword('');
                setConfirmPassword('');
              }}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <FiX size={20} />
            </button>
            <h3 style={{ color: 'var(--text-white)', marginBottom: '16px', fontSize: '18px', fontWeight: 700 }}>
              Change Password 🔑
            </h3>
            
            <form onSubmit={handleChangePasswordSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Old Password
                </label>
                <input
                  type="password"
                  className="form-input"
                  style={{ width: '100%' }}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter old password"
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  New Password
                </label>
                <input
                  type="password"
                  className="form-input"
                  style={{ width: '100%' }}
                  value={newPassword}
                  onChange={(e) => {
                    if (user?.role === 'representative' && e.target.value.length > 10) {
                      toast.warning('Representative password cannot exceed 10 characters');
                    }
                    setNewPassword(user?.role === 'representative' ? e.target.value.slice(0, 10) : e.target.value);
                  }}
                  placeholder={user?.role === 'representative' ? "Enter new password (6 to 10 characters)" : "Enter new password (min 6 chars)"}
                  required
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  className="form-input"
                  style={{ width: '100%' }}
                  value={confirmPassword}
                  onChange={(e) => {
                    if (user?.role === 'representative' && e.target.value.length > 10) {
                      toast.warning('Representative password cannot exceed 10 characters');
                    }
                    setConfirmPassword(user?.role === 'representative' ? e.target.value.slice(0, 10) : e.target.value);
                  }}
                  placeholder="Confirm new password"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setShowChangePassword(false);
                    setOldPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  disabled={isChanging}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isChanging}>
                  {isChanging ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Switch Account Modal */}
      {showSwitchModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '420px', margin: '20px', padding: '24px', position: 'relative' }}>
            <button
              onClick={() => setShowSwitchModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <FiX size={20} />
            </button>
            <h3 style={{ color: 'var(--text-white)', marginBottom: '16px', fontSize: '18px', fontWeight: 700 }}>
              Switch Account 👥
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
              Select a linked account associated with your registered phone number:
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto', marginBottom: '20px' }}>
              {linkedAccounts.map(acc => (
                <div 
                  key={acc._id}
                  onClick={() => !switching && handleSwitchAccount(acc._id)}
                  style={{
                    padding: '12px 16px',
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '8px',
                    cursor: switching ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                  onMouseEnter={(e) => {
                    if (!switching) {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!switching) {
                      e.currentTarget.style.borderColor = 'var(--border-light)';
                      e.currentTarget.style.background = 'var(--bg-glass)';
                    }
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-white)', fontSize: '14px' }}>
                      {acc.name}
                    </span>
                    {acc.customerCode && (
                      <span className="badge" style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 6px', fontWeight: 600 }}>
                        {acc.customerCode}
                      </span>
                    )}
                  </div>
                  {acc.company && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {acc.company}
                    </span>
                  )}
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {acc.role} Account
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowSwitchModal(false)}
                disabled={switching}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </>
  );
};

export default DashboardLayout;
