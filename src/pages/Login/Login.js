import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiPhone, FiLock, FiEye, FiEyeOff, FiArrowRight, FiSun, FiMoon, FiUser, FiMail, FiX, FiShield, FiKey } from 'react-icons/fi';
import { authAPI } from '../../services/api';
import { toast } from 'react-toastify';
import './Login.css';

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Representative Forgot Password Modal States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetStep, setResetStep] = useState(1); // 1: Verify 3-factors, 2: Set New Password
  const [resetData, setResetData] = useState({
    phone: '',
    repName: '',
    email: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [verifiedRepName, setVerifiedRepName] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [theme, setTheme] = useState(() => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      const toggled = sessionStorage.getItem('theme_toggled');
      if (!toggled) {
        localStorage.setItem('theme', 'light');
        return 'light';
      }
    }
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [accounts, setAccounts] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await login(formData.email, formData.password);
      
      if (result && result.requiresSelection) {
        setAccounts(result.accounts);
        return;
      }

      const userData = result;
      switch (userData.role) {
        case 'admin':
          navigate('/admin');
          break;
        case 'seller':
          navigate('/seller');
          break;
        case 'representative':
          navigate('/representative');
          break;
        case 'buyer':
        default:
          navigate('/buyer');
          break;
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid credentials or connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAccount = async (accountId) => {
    setLoading(true);
    try {
      const userData = await login(formData.email, formData.password, accountId);
      
      switch (userData.role) {
        case 'admin':
          navigate('/admin');
          break;
        case 'seller':
          navigate('/seller');
          break;
        case 'representative':
          navigate('/representative');
          break;
        case 'buyer':
        default:
          navigate('/buyer');
          break;
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid credentials or connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetInputChange = (e) => {
    setResetData({ ...resetData, [e.target.name]: e.target.value });
  };

  const handleOpenForgotModal = () => {
    setShowForgotModal(true);
    setResetStep(1);
    setResetData({ phone: '', repName: '', email: '', newPassword: '', confirmPassword: '' });
    setResetToken('');
    setVerifiedRepName('');
  };

  const handleVerifyDetailsSubmit = async (e) => {
    e.preventDefault();
    if (!resetData.phone || !resetData.repName || !resetData.email) {
      toast.warning('Please fill in all 3 fields');
      return;
    }
    setResetLoading(true);
    try {
      const res = await authAPI.verifyResetDetails({
        phone: resetData.phone,
        repName: resetData.repName,
        email: resetData.email
      });
      if (res.data.success) {
        setResetToken(res.data.resetToken);
        setVerifiedRepName(res.data.repName || resetData.repName);
        setResetStep(2);
        toast.success(res.data.message || 'Details verified! Set your new password.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed. Please check your details.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetData.newPassword || resetData.newPassword.length < 6) {
      toast.warning('Password must be at least 6 characters long');
      return;
    }
    if (resetData.newPassword !== resetData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setResetLoading(true);
    try {
      const res = await authAPI.resetPasswordDirect({
        resetToken,
        newPassword: resetData.newPassword
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Password reset successfully!');
        setShowForgotModal(false);
        setFormData({ ...formData, password: resetData.newPassword });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Animated background */}
      <div className="login-bg">
        <div className="bg-orb bg-orb-1"></div>
        <div className="bg-orb bg-orb-2"></div>
        <div className="bg-orb bg-orb-3"></div>
        <div className="bg-grid"></div>
      </div>

      {/* Floating Theme Toggle */}
      <button 
        className="login-theme-toggle" 
        onClick={() => {
          setTheme(theme === 'dark' ? 'light' : 'dark');
          sessionStorage.setItem('theme_toggled', 'true');
        }}
        title="Toggle Theme"
      >
        {theme === 'dark' ? <FiSun /> : <FiMoon />}
      </button>

      <div className="login-container">
        {/* Left side - Branding */}
        <div className="login-branding">
          <div className="brand-content">
            <div className="brand-badge">
              <span className="brand-dot"></span>
              Enterprise Portal
            </div>
            <h1 className="brand-title">
              TARA<br />
              <span className="brand-highlight">CONNECT</span>
            </h1>
            <p className="brand-desc">
              Access the secure enterprise portal for 
              stock & sales statements, Purchase order status and representative analytics.
            </p>
            <div className="brand-features">
              <div className="feature-item">
                <div className="feature-dot"></div>
                <span>Medicine Ordering Platform</span>
              </div>
              <div className="feature-item">
                <div className="feature-dot"></div>
                <span>Automated S&S Statements</span>
              </div>
              <div className="feature-item">
                <div className="feature-dot"></div>
                <span>Division Wise Access Control</span>
              </div>
            </div>
          </div>
          <div className="brand-footer">
            <p>&copy; 2026 TARA CONNECT. All rights reserved.</p>
            <p style={{ marginTop: '4px', fontWeight: 600 }}>Tara Medicos Pvt. Ltd.</p>
          </div>
        </div>

        {/* Right side - Sign In Form or Account Selection */}
        <div className="login-form-section">
          <div className="form-wrapper">
            {accounts && accounts.length > 0 ? (
              <>
                <div className="form-header" style={{ marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>Select Profile</h2>
                  <p style={{ color: 'var(--text-muted)', marginTop: '6px' }}>
                    Multiple customer profiles linked to this number:
                  </p>
                </div>

                <div 
                  className="accounts-selection-container" 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '14px', 
                    maxHeight: '320px', 
                    overflowY: 'auto', 
                    padding: '4px',
                    marginRight: '-4px'
                  }}
                >
                  {accounts.map((acc) => (
                    <button
                      key={acc.id}
                      disabled={loading}
                      onClick={() => handleSelectAccount(acc.id)}
                      className="account-selection-card"
                      style={{
                        width: '100%',
                        padding: '16px 20px',
                        borderRadius: 'var(--radius-lg, 12px)',
                        border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                        background: 'var(--bg-glass, rgba(255, 255, 255, 0.75))',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        textAlign: 'left',
                        boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
                        fontFamily: 'inherit',
                        outline: 'none'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.borderColor = 'var(--primary, #4f46e5)';
                        e.currentTarget.style.background = 'var(--bg-glass-hover, rgba(255, 255, 255, 0.95))';
                        e.currentTarget.style.boxShadow = 'var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.08))';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'var(--border, rgba(0, 0, 0, 0.08))';
                        e.currentTarget.style.background = 'var(--bg-glass, rgba(255, 255, 255, 0.75))';
                        e.currentTarget.style.boxShadow = 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '12px' }}>
                        <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-primary)', lineHeight: '1.3' }}>
                          {acc.company || acc.name || 'Unnamed Company'}
                        </span>
                        <span style={{ 
                          fontSize: '11px', 
                          padding: '4px 8px', 
                          borderRadius: 'var(--radius-sm, 8px)', 
                          background: 'var(--primary-glow, rgba(79, 70, 229, 0.1))', 
                          color: 'var(--primary, #4f46e5)', 
                          fontWeight: '700',
                          letterSpacing: '0.5px',
                          whiteSpace: 'nowrap'
                        }}>
                          {acc.customerCode || 'NO CODE'}
                        </span>
                      </div>
                      
                      {acc.company && acc.name && acc.name.trim() !== acc.company.trim() && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>
                          <span style={{ opacity: 0.8 }}>Contact:</span>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{acc.name}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={() => setAccounts(null)}
                  disabled={loading}
                  className="submit-btn" 
                  style={{ 
                    marginTop: '20px', 
                    background: 'transparent', 
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    boxShadow: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-glass-hover, rgba(0,0,0,0.02))';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  Back to sign in
                </button>
              </>
            ) : (
              <>
                <div className="form-header">
                  <h2>Welcome Back</h2>
                  <p>Sign in to your account to continue</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                  <div className="input-group">
                    <FiPhone className="input-icon" />
                    <input
                      type="text"
                      name="email"
                      placeholder="Mobile Number"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <FiLock className="input-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="Password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-6px', marginBottom: '16px' }}>
                    <button
                      type="button"
                      onClick={handleOpenForgotModal}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary, #4f46e5)',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        padding: '0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <FiKey size={13} />
                      Forgot Password?
                    </button>
                  </div>

                  <button type="submit" className="submit-btn" disabled={loading}>
                    {loading ? (
                      <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></div>
                    ) : (
                      <>
                        Sign In
                        <FiArrowRight />
                      </>
                    )}
                  </button>
                </form>

                {/* Representative Registration Card */}
                <div className="rep-register-card">
                  <div className="rep-register-info">
                    <span className="rep-register-title">Are you a Representative?</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => navigate('/rep-signup')} 
                    className="rep-register-btn"
                  >
                    <span>Register Here</span>
                    <FiArrowRight size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Representative Forgot Password Modal */}
      {showForgotModal && (
        <div className="forgot-modal-overlay">
          <div className="forgot-modal-card">
            <button
              onClick={() => setShowForgotModal(false)}
              disabled={resetLoading}
              style={{
                position: 'absolute', top: '18px', right: '18px',
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', padding: '4px'
              }}
            >
              <FiX size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: 'rgba(79, 70, 229, 0.12)', color: 'var(--primary, #4f46e5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <FiShield size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Representative Password Reset
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {resetStep === 1 ? 'Step 1: Verify your 3 account details' : 'Step 2: Set your new password'}
                </span>
              </div>
            </div>

            {resetStep === 1 ? (
              <form onSubmit={handleVerifyDetailsSubmit} style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', lineHeight: 1.5 }}>
                  Enter your registered <strong>Mobile Number</strong>, <strong>Representative Name</strong>, and <strong>Registered Email</strong> to verify your account:
                </p>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    1. Registered Mobile Number
                  </label>
                  <div className="input-group" style={{ margin: 0 }}>
                    <FiPhone className="input-icon" />
                    <input
                      type="text"
                      name="phone"
                      placeholder="10-digit Mobile Number"
                      value={resetData.phone}
                      onChange={handleResetInputChange}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    2. Representative Name
                  </label>
                  <div className="input-group" style={{ margin: 0 }}>
                    <FiUser className="input-icon" />
                    <input
                      type="text"
                      name="repName"
                      placeholder="Your Full Name / Rep Name"
                      value={resetData.repName}
                      onChange={handleResetInputChange}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    3. Registered Email
                  </label>
                  <div className="input-group" style={{ margin: 0 }}>
                    <FiMail className="input-icon" />
                    <input
                      type="email"
                      name="email"
                      placeholder="your.email@example.com"
                      value={resetData.email}
                      onChange={handleResetInputChange}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="submit-btn"
                    onClick={() => setShowForgotModal(false)}
                    disabled={resetLoading}
                    style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', boxShadow: 'none' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={resetLoading}
                    style={{ flex: 1 }}
                  >
                    {resetLoading ? 'Verifying Details...' : 'Verify Details'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{
                  padding: '10px 14px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '13px', fontWeight: 600
                }}>
                  ✅ Account Verified: <strong>{verifiedRepName}</strong>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    New Password
                  </label>
                  <div className="input-group" style={{ margin: 0 }}>
                    <FiLock className="input-icon" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      name="newPassword"
                      placeholder="Enter new password (min 6 chars)"
                      value={resetData.newPassword}
                      onChange={handleResetInputChange}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Confirm New Password
                  </label>
                  <div className="input-group" style={{ margin: 0 }}>
                    <FiLock className="input-icon" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      placeholder="Re-enter new password"
                      value={resetData.confirmPassword}
                      onChange={handleResetInputChange}
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="submit-btn"
                    onClick={() => setResetStep(1)}
                    disabled={resetLoading}
                    style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', boxShadow: 'none' }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={resetLoading}
                    style={{ flex: 1 }}
                  >
                    {resetLoading ? 'Resetting Password...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
