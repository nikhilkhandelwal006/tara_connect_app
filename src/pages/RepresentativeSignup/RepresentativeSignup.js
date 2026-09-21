import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';
import { FiPhone, FiUser, FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight, FiSun, FiMoon, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
import '../Login/Login.css'; // Reuse Login page styles for complete styling consistency
import './RepresentativeSignup.css';

const RepresentativeSignup = () => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [step, setStep] = useState(1); // 1 = Verify Phone, 2 = Fill Details
  const [loading, setLoading] = useState(false);

  // Form states
  const [phone, setPhone] = useState('');
  const [companies, setCompanies] = useState([]);
  const [formData, setFormData] = useState({
    representativeName: '',
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  // Inline error states
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState(false);

  // Sync theme
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Handle inputs for step 2
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (e.target.name === 'password') {
      const val = e.target.value;
      if (val.length < 6 || val.length > 10) {
        setPasswordError('Password must be between 6 and 10 characters');
      } else {
        setPasswordError('');
      }
    }
  };

  // Step 1: Verify Mobile Number
  const handleVerifyPhone = async (e) => {
    e.preventDefault();
    setPhoneError('');
    setGeneralError('');
    if (!phone.trim()) {
      setPhoneError('Mobile number is required');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.verifyRepPhone(phone);
      if (res.data.registered) {
        setCompanies(res.data.companies || []);
        setPhone(res.data.phone); // use normalized phone from server
        setStep(2);
      }
    } catch (error) {
      setPhoneError(error.response?.data?.message || 'Verification failed. This number might not be registered in our list.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Register Details
  const handleRegister = async (e) => {
    e.preventDefault();
    setGeneralError('');
    setPasswordError('');
    const { representativeName, email, password } = formData;

    if (!representativeName.trim()) {
      setGeneralError('Representative Name is required');
      return;
    }
    if (!email.trim()) {
      setGeneralError('Email Address is required');
      return;
    }
    if (!password || password.length < 6 || password.length > 10) {
      setPasswordError('Password must be between 6 and 10 characters');
      return;
    }

    setLoading(true);
    try {
      await authAPI.repSignup({
        phone,
        representativeName,
        email,
        password
      });
      setSignupSuccess(true);
    } catch (error) {
      setGeneralError(error.response?.data?.message || 'Failed to complete registration.');
    } finally {
      setLoading(false);
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
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
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
              REPRESENTATIVE REGISTRATION
            </div>
            <h1 className="brand-title">
              TARA<br />
              <span className="brand-highlight">CONNECT</span>
            </h1>
            <p className="brand-desc">
              Sales representatives can self-register using their registered primary mobile number to claim their account.
            </p>
            <div className="brand-features">
              <div className="feature-item">
                <div className="feature-dot"></div>
                <span>Verify registered primary mobile number</span>
              </div>
              <div className="feature-item">
                <div className="feature-dot"></div>
                <span>Auto-select company mappings</span>
              </div>
              <div className="feature-item">
                <div className="feature-dot"></div>
                <span>Set your own secure password</span>
              </div>
            </div>
          </div>
          <div className="brand-footer">
            <p>&copy; 2026 TARA CONNECT. All rights reserved.</p>
            {/* <p>Designed and Developed by - NIKHIL KHANDELWAL</p> */}
          </div>
        </div>

        {/* Right side - Form */}
        <div className="login-form-section">
          <div className="form-wrapper">
            
            {/* Step 3: Success Screen */}
            {signupSuccess ? (
              <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                <style>{`
                  @keyframes stroke {
                    100% { stroke-dashoffset: 0; }
                  }
                  @keyframes scale {
                    0%, 100% { transform: none; }
                    50% { transform: scale3d(1.1, 1.1, 1); }
                  }
                  @keyframes fill {
                    100% { box-shadow: inset 0px 0px 0px 40px var(--accent); }
                  }
                `}</style>
                <div style={{ margin: '0 auto 24px', display: 'flex', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    display: 'block',
                    strokeWidth: 2,
                    stroke: 'var(--accent)',
                    strokeMiterlimit: 10,
                    animation: 'scale .3s ease-in-out .9s both'
                  }}>
                    <circle cx="26" cy="26" r="25" fill="none" style={{
                      strokeDasharray: 166,
                      strokeDashoffset: 166,
                      strokeWidth: 2,
                      strokeMiterlimit: 10,
                      stroke: 'var(--accent)',
                      fill: 'none',
                      animation: 'stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards'
                    }}/>
                    <path fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" style={{
                      transformOrigin: '50% 50%',
                      strokeDasharray: 48,
                      strokeDashoffset: 48,
                      animation: 'stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards'
                    }}/>
                  </svg>
                </div>
                <h2 style={{ color: 'var(--text-white)', fontSize: '22px', fontWeight: 700, marginBottom: '10px' }}>
                  Account Created! 🎉
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: 1.6, marginBottom: '28px' }}>
                  Your representative account has been created successfully. You can now login.
                </p>
                <button 
                  onClick={() => navigate('/login')} 
                  className="submit-btn"
                  style={{ maxWidth: '200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  Go to Login
                  <FiArrowRight />
                </button>
              </div>
            ) : (
              <>
                {/* Step 1: Verify Mobile Number */}
                {step === 1 && (
                  <>
                    <div className="form-header">
                      <h2>Representative Signup</h2>
                      <p>Enter your primary registered mobile number to verify your details</p>
                    </div>

                    <form onSubmit={handleVerifyPhone} className="auth-form">
                      <div className="input-group" style={{ marginBottom: phoneError ? '6px' : '20px' }}>
                        <FiPhone className="input-icon" />
                        <input
                          type="text"
                          name="phone"
                          placeholder="Registered Primary Mobile Number"
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value.replace(/\D/g, ''));
                            setPhoneError('');
                          }}
                          required
                        />
                      </div>
                      
                      {phoneError && (
                        <div style={{ color: 'var(--danger)', fontSize: '12px', marginBottom: '16px', fontWeight: 500, paddingLeft: '4px' }}>
                          ⚠️ {phoneError}
                        </div>
                      )}

                      <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? (
                          <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></div>
                        ) : (
                          <>
                            Verify Number
                            <FiArrowRight />
                          </>
                        )}
                      </button>
                    </form>
                  </>
                )}

                {/* Step 2: Complete Profile details */}
                {step === 2 && (
                  <>
                    <div className="form-header">
                      <button onClick={() => { setStep(1); setGeneralError(''); setPasswordError(''); }} className="back-link-btn">
                        <FiArrowLeft /> Back to verification
                      </button>
                      <h2>Create Your Account</h2>
                      <p>Provide your details to complete representative sign up</p>
                    </div>

                    {/* Auto-detected Companies Badge */}
                    <div className="companies-container">
                      <div className="companies-title">
                        <FiCheckCircle className="check-icon" />
                        Verified Representative for:
                      </div>
                      <div className="companies-list">
                        {companies.length > 0 ? (
                          companies.map((c, i) => (
                            <span key={i} className="company-tag">{c}</span>
                          ))
                        ) : (
                          <span className="company-tag">TARA MED</span>
                        )}
                      </div>
                    </div>

                    <form onSubmit={handleRegister} className="auth-form">
                      {generalError && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', fontWeight: 500 }}>
                          ⚠️ {generalError}
                        </div>
                      )}

                      <div className="input-group">
                        <FiUser className="input-icon" />
                        <input
                          type="text"
                          name="representativeName"
                          placeholder="Representative Full Name"
                          value={formData.representativeName}
                          onChange={handleChange}
                          required
                        />
                      </div>

                      <div className="input-group">
                        <FiMail className="input-icon" />
                        <input
                          type="email"
                          name="email"
                          placeholder="Email Address"
                          value={formData.email}
                          onChange={handleChange}
                          required
                        />
                      </div>

                      <div className="input-group" style={{ marginBottom: passwordError ? '6px' : '20px' }}>
                        <FiLock className="input-icon" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          placeholder="Choose Password (6 to 10 characters)"
                          value={formData.password}
                          onChange={handleChange}
                          required
                          style={{ borderColor: passwordError ? 'var(--danger)' : '' }}
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>

                      {passwordError && (
                        <div style={{ color: 'var(--danger)', fontSize: '12px', marginBottom: '16px', fontWeight: 500, paddingLeft: '4px' }}>
                          ⚠️ {passwordError}
                        </div>
                      )}

                      <button type="submit" className="submit-btn" disabled={loading || !!passwordError}>
                        {loading ? (
                          <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></div>
                        ) : (
                          <>
                            Sign Up & Complete
                            <FiArrowRight />
                          </>
                        )}
                      </button>
                    </form>
                  </>
                )}

                <div className="form-footer" style={{ marginTop: '20px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                    Already registered?{' '}
                    <span 
                      onClick={() => navigate('/login')} 
                      style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: '600', textDecoration: 'underline' }}
                    >
                      Sign In
                    </span>
                  </p>
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default RepresentativeSignup;
