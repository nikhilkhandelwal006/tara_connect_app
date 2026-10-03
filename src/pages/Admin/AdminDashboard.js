import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import api, { usersAPI, ordersAPI, medicinesAPI, outstandingAPI, representativesAPI } from '../../services/api';
import { toast } from 'react-toastify';
import BranchData from '../BranchData/BranchData';
import { NonMovingStockReport } from '../Representative/RepresentativeDashboard';
import { FiHome, FiUsers, FiPackage, FiShoppingCart, FiSearch, FiTrash2, FiToggleLeft, FiToggleRight, FiPlus, FiMessageSquare, FiDownload, FiX, FiList, FiShield, FiDollarSign, FiUploadCloud, FiChevronLeft, FiChevronRight, FiChevronDown, FiClock, FiSettings, FiSlash, FiCheckCircle, FiArchive, FiLayers, FiFileText } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const loadImage = (url) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
};
// Simple fallback for file saving (replaces file-saver dependency)
const saveAs = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const formatOrderStatus = (status) => (status === 'cancelled' ? 'hold' : status);

const getCustomerDisplayName = (buyer) => {
  if (!buyer) return '—';
  const company = (buyer.company || '').trim();
  const name = (buyer.name || '').trim();
  if (company) return company;
  return name || '—';
};

/* ── Minimal Confirm Modal ─────────────────────────────────────────── */
const ConfirmModal = ({ open, title, message, onConfirm, onCancel, confirmLabel = 'Confirm', danger = false }) => {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '28px 32px',
        maxWidth: '400px', width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
      }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-white)', marginBottom: '10px' }}>
          {title}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px', whiteSpace: 'pre-wrap' }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={onCancel}
            style={{ padding: '8px 18px' }}
          >Cancel</button>
          <button
            className="btn btn-sm"
            onClick={onConfirm}
            style={{
              padding: '8px 18px',
              background: danger ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'var(--primary)',
              color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer'
            }}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

const formatOrderNo = (orderNumber, buyer) => {
  if (!orderNumber) return '—';
  const clean = String(orderNumber).replace(/^ORD-/, '').replace(/^#/, '').trim();
  const code = buyer?.customerCode || '';
  return code ? `${code}_${clean}` : clean;
};

const isSchemeApplied = (sch, quantity) => {
  if (!sch || quantity <= 0) return false;
  const s = String(sch).trim();
  if (s.includes('+')) {
    const triggerQty = parseFloat(s.split('+')[0].trim());
    if (!isNaN(triggerQty) && triggerQty > 0) {
      return quantity % triggerQty === 0;
    }
  }
  if (s.includes('%')) {
    return true;
  }
  return false;
};

const itemHasAppliedScheme = (item) => {
  const quantity = item.quantity || 0;
  const schemes = [item.sch1, item.sch2, item.sch3].filter(Boolean);
  return schemes.some(sch => isSchemeApplied(sch, quantity));
};

const matchesOrderSearch = (order, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const buyer = order.buyer || {};
  return (
    (buyer.name && buyer.name.toLowerCase().includes(q)) ||
    (buyer.customerCode && String(buyer.customerCode).toLowerCase().includes(q)) ||
    (buyer.company && buyer.company.toLowerCase().includes(q)) ||
    (buyer.phone && String(buyer.phone).includes(q)) ||
    (order.orderNumber && order.orderNumber.toLowerCase().includes(q)) ||
    (order.items || []).some(i => i.medicineName && i.medicineName.toLowerCase().includes(q))
  );
};

const navItems = [
  { path: '/admin', label: 'Dashboard', icon: <FiHome />, exact: true },
  { path: '/admin/users', label: 'Users', icon: <FiUsers /> },
  { path: '/admin/medicines', label: 'Items', icon: <FiPackage /> },
  { path: '/admin/orders', label: 'Orders', icon: <FiShoppingCart /> },
  { path: '/admin/outstanding', label: 'Outstanding', icon: <FiDollarSign /> },
  { path: '/admin/representatives', label: 'Representatives', icon: <FiShield /> },
  { path: '/admin/branch-data', label: 'Branch Data', icon: <FiLayers /> },
];

// Simple Custom Chart Component
const SimpleTrendChart = ({ data }) => {
  if (!data || data.length === 0) return <div className="empty-state" style={{ minHeight: '200px' }}>No data available</div>;

  const maxVal = Math.max(...data.map(d => d.amount));
  
  return (
    <div style={{ height: '300px', display: 'flex', alignItems: 'flex-end', gap: '15px', padding: '20px 0', overflowX: 'auto' }}>
      {data.map((item, idx) => {
        const height = (item.amount / maxVal) * 200;
        return (
          <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '40px' }}>
            <div 
              style={{ 
                height: `${height}px`, 
                width: '100%', 
                background: 'linear-gradient(180deg, var(--accent) 0%, rgba(16, 185, 129, 0.4) 100%)',
                borderRadius: '6px 6px 0 0',
                transition: 'height 0.5s ease-out',
                position: 'relative'
              }}
              title={`₹${item.amount}`}
            >
               <span style={{ position: 'absolute', top: '-25px', left: '50%', transform: 'translateX(-50%)', fontSize: '11px', fontWeight: 600, color: 'var(--accent)' }}>
                ₹{item.amount > 1000 ? (item.amount/1000).toFixed(1)+'k' : item.amount}
               </span>
            </div>
            <span style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>{item.month}</span>
          </div>
        );
      })}
    </div>
  );
};

// Overview
// Overview
const AdminOverview = () => {
  const [stats, setStats] = useState({});
  const [repStats, setRepStats] = useState({ totalReps: 0, activeReps: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const [statsRes, repStatsRes] = await Promise.all([
        ordersAPI.getStats(),
        representativesAPI.getStats()
      ]);
      setStats(statsRes.data);
      setRepStats(repStatsRes.data || { totalReps: 0, activeReps: 0 });
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to fetch dashboard stats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const exportFilteredUsersExcel = async (isActive) => {
    try {
      toast.info(`Fetching ${isActive ? 'Active' : 'Inactive'} Buyers...`);
      const res = await usersAPI.getAll({ role: 'buyer', isActive, all: 'true' });
      const userList = res.data || [];
      if (userList.length === 0) {
        toast.warn(`No ${isActive ? 'Active' : 'Inactive'} Buyers found.`);
        return;
      }
      const rows = [];
      userList.forEach((u) => {
        rows.push({
          'Customer Code': u.customerCode || '',
          'Company Name': u.company || '',
          'Contact Person': u.name || '',
          'Email': u.email || '',
          'Phone': u.phone || '',
          'Address': u.address || '',
          'GST IN': u.gst || '',
          'PAN No': u.panNo || '',
          'Drug License': u.drugLicense || '',
          'Credit Limit': u.creditLimit || 0,
          'Credit Days': u.creditDays || 0,
          'Status': u.isActive ? 'Active' : 'Inactive',
        });
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, isActive ? 'Active Buyers' : 'Inactive Buyers');
      const fileName = isActive ? 'Active_Buyers.xlsx' : 'Inactive_Buyers.xlsx';
      XLSX.writeFile(wb, fileName);
      toast.success(`${isActive ? 'Active' : 'Inactive'} buyers list exported.`);
    } catch (err) {
      toast.error('Failed to export buyer details.');
      console.error(err);
    }
  };

  if (loading) return null;
  return (
    <div className="animate-slide-up" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="page-header page-header-flex" style={{ marginBottom: '28px', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-white)', fontFamily: "'Outfit', sans-serif" }}>Admin Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Platform analytics and overview</p>
        </div>
        <button 
          className="btn btn-outline btn-sm" 
          onClick={() => fetchData(true)}
          disabled={refreshing || loading}
          style={{
            borderRadius: '10px',
            borderColor: 'var(--border)',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            padding: '8px 18px',
            background: 'var(--bg-glass)',
            backdropFilter: 'blur(10px)',
            transition: 'var(--transition)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--primary-glow)';
            e.currentTarget.style.borderColor = 'var(--primary-light)';
            e.currentTarget.style.color = 'var(--primary-light)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-glass)';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          {refreshing ? '🔄 Refreshing...' : '🔄 Refresh Dashboard'}
        </button>
      </div>

      {/* Stats Cards Grid */}
      <div className="admin-stats-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
        gap: '20px', 
        marginBottom: '28px' 
      }}>
        {/* Buyers Registry Card - FIRST */}
        <div className="stat-card" style={{ 
          background: 'var(--bg-card)', 
          border: '1px solid var(--border)', 
          borderRadius: '14px',
          padding: '18px 22px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '125px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1.2px', color: '#10b981', fontWeight: 800 }}>Total Buyers</span>
              <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-white)', marginTop: '4px', fontFamily: "'Outfit', sans-serif" }}>
                {stats.totalBuyers || 0}
              </div>
            </div>
            <div style={{ fontSize: '32px' }}>👥</div>
          </div>
          <div className="admin-stats-breakdown" style={{ display: 'flex', gap: '15px', borderTop: '1px solid var(--border-light)', paddingTop: '12px', marginTop: '10px' }}>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Active</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#10b981' }}>{stats.activeBuyers || 0}</span>
                <button 
                  onClick={() => exportFilteredUsersExcel(true)}
                  title="Download Active Buyers Excel"
                  style={{
                    background: 'var(--bg-glass)', border: '1px solid var(--border)',
                    color: 'var(--text-secondary)', padding: '3px 6px', borderRadius: '4px',
                    cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center',
                    fontWeight: 700
                  }}
                >
                  <FiDownload size={10} />
                </button>
              </div>
            </div>
            <div className="admin-stats-breakdown-divider" style={{ width: '1px', background: 'var(--border-light)' }} />
            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Inactive</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#ef4444' }}>{stats.inactiveBuyers || 0}</span>
                <button 
                  onClick={() => exportFilteredUsersExcel(false)}
                  title="Download Inactive Buyers Excel"
                  style={{
                    background: 'var(--bg-glass)', border: '1px solid var(--border)',
                    color: 'var(--text-secondary)', padding: '3px 6px', borderRadius: '4px',
                    cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center',
                    fontWeight: 700
                  }}
                >
                  <FiDownload size={10} />
                </button>
              </div>
            </div>
            <div className="admin-stats-breakdown-divider" style={{ width: '1px', background: 'var(--border-light)' }} />
            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Blocked</span>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#f59e0b' }}>{stats.blockedBuyers || 0}</span>
            </div>
          </div>
        </div>

        {/* Representatives Registry Card - SECOND */}
        <div className="stat-card" style={{ 
          background: 'var(--bg-card)', 
          border: '1px solid var(--border)', 
          borderRadius: '14px',
          padding: '18px 22px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '125px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1.2px', color: '#10b981', fontWeight: 800 }}>Total Companies Division</span>
              <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-white)', marginTop: '4px', fontFamily: "'Outfit', sans-serif" }}>
                {repStats.totalReps || 0}
              </div>
            </div>
            <div style={{ fontSize: '32px' }}>🛡️</div>
          </div>
          <div className="admin-stats-breakdown" style={{ display: 'flex', gap: '20px', borderTop: '1px solid var(--border-light)', paddingTop: '12px', marginTop: '10px' }}>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Registered &amp; Active</span>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#10b981' }}>{repStats.activeReps || 0}</span>
            </div>
            <div className="admin-stats-breakdown-divider" style={{ width: '1px', background: 'var(--border-light)' }} />
            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Pending Registration</span>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#fbbf24' }}>
                {Math.max(0, (repStats.totalReps || 0) - (repStats.activeReps || 0))}
              </span>
            </div>
          </div>
        </div>

        {/* Item Master Count - THIRD */}
        <div className="stat-card" style={{ 
          background: 'var(--bg-card)', 
          border: '1px solid var(--border)', 
          borderRadius: '14px',
          padding: '18px 22px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '125px',
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1.2px', color: '#10b981', fontWeight: 800 }}>Total Item Master</span>
              <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-white)', marginTop: '4px', fontFamily: "'Outfit', sans-serif" }}>
                {stats.totalMedicines || 0}
              </div>
            </div>
            <div style={{ fontSize: '32px' }}>📋</div>
          </div>
          <div className="admin-stats-breakdown" style={{ display: 'flex', gap: '20px', borderTop: '1px solid var(--border-light)', paddingTop: '12px', marginTop: '10px' }}>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Active Items</span>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#10b981' }}>{stats.activeMedicines || 0}</span>
            </div>
            <div className="admin-stats-breakdown-divider" style={{ width: '1px', background: 'var(--border-light)' }} />
            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Inactive Items</span>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#ef4444' }}>{stats.inactiveMedicines || 0}</span>
            </div>
          </div>
        </div>

        {/* Outstanding Total Balance - FOURTH */}
        <div className="stat-card" style={{ 
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(220, 38, 38, 0.04) 100%)', 
          border: '1px solid rgba(239, 68, 68, 0.25)',
          boxShadow: '0 6px 20px rgba(239, 68, 68, 0.05)',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '110px'
        }}>
          <div style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '24px' }}>💰</div>
          <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1.2px', color: '#f87171', fontWeight: 800 }}>Total Outstanding Balance</span>
          <div style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-white)', marginTop: '6px', letterSpacing: '-0.02em', fontFamily: "'Outfit', sans-serif" }}>
            ₹{(stats.totalOutstandingBalance || 0).toLocaleString()}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px', fontWeight: 500 }}>Sum of all outstanding balances</p>
        </div>

        {/* Total Orders - FIFTH */}
        <div className="stat-card" style={{ 
          background: 'var(--bg-card)', 
          border: '1px solid var(--border)', 
          borderRadius: '14px',
          padding: '16px 20px',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: '110px',
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}>
          <div style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '24px' }}>📦</div>
          <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1.2px', color: '#10b981', fontWeight: 800 }}>Total Orders</span>
          <div style={{ fontSize: '28px', fontWeight: 850, color: 'var(--text-white)', marginTop: '6px', fontFamily: "'Outfit', sans-serif" }}>
            {stats.totalOrders || 0}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px', fontWeight: 500 }}>Total lifetime orders placed</p>
        </div>
      </div>
    </div>
  );
};


// Users Management
const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [permUser, setPermUser] = useState(null);
  const [savingPerms, setSavingPerms] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [blockedSearch, setBlockedSearch] = useState('');

  const fetchBlockedUsers = async () => {
    try {
      setLoadingBlocked(true);
      setShowBlockedModal(true);
      const res = await usersAPI.getAll({ all: 'true' });
      const allUsers = res.data || [];
      setBlockedUsers(allUsers.filter(u => u.isBlocked === true));
    } catch (err) {
      toast.error('Failed to fetch blocked parties');
    } finally {
      setLoadingBlocked(false);
    }
  };

  const toggleBlockUser = async (id, currentBlockStatus) => {
    try {
      await usersAPI.block(id, !currentBlockStatus);
      toast.success(`User ${!currentBlockStatus ? 'blocked' : 'unblocked'} successfully`);
      fetchUsers();
      // If modal is open, also refresh blocked list
      if (showBlockedModal) {
        const res = await usersAPI.getAll({ all: 'true' });
        const allUsers = res.data || [];
        setBlockedUsers(allUsers.filter(u => u.isBlocked === true));
      }
    } catch (error) {
      toast.error('Failed to update block status');
    }
  };

  const [confirmModal, setConfirmModal] = useState(null);
  const [allPrefixes, setAllPrefixes] = useState(['I', 'IA', 'IC', 'ID', 'MD', 'CR', 'RC']);
  const fileInputRef = useRef(null);
  const [importingMasterCustomer, setImportingMasterCustomer] = useState(false);
  const [importMasterProgress, setImportMasterProgress] = useState('');

  const handleUploadMasterCustomer = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (fileInputRef.current) fileInputRef.current.value = '';

    setImportingMasterCustomer(true);
    setImportMasterProgress('Reading Excel file...');

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet);

      if (!rows || rows.length === 0) {
        toast.error('Excel file is empty or unreadable');
        setImportingMasterCustomer(false);
        setImportMasterProgress('');
        return;
      }

      const importSessionId = 'session_' + Math.random().toString(36).substring(2, 15);
      const CHUNK_SIZE = 500;
      const totalChunks = Math.ceil(rows.length / CHUNK_SIZE);
      let created = 0;
      let updated = 0;
      let removed = 0;

      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const chunkIndex = Math.floor(i / CHUNK_SIZE);
        const pct = Math.round(((chunkIndex + 1) / totalChunks) * 100);
        
        setImportMasterProgress(`Uploading chunk ${chunkIndex + 1} of ${totalChunks} (${pct}%)...`);

        const res = await api.post('/users/import-master-customer', {
          rows: chunk,
          chunkIndex,
          totalChunks,
          importSessionId
        });

        created += res.data.created || 0;
        updated += res.data.updated || 0;
        removed += res.data.removed || 0;
      }

      toast.success(`Import complete! ✅ Created: ${created} | Updated: ${updated} | Removed (unlisted): ${removed}`);
      fetchUsers(false);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || 'Failed to import master customer');
    } finally {
      setImportingMasterCustomer(false);
      setImportMasterProgress('');
    }
  };
  const [tempPermissions, setTempPermissions] = useState({
    canPlaceOrder: true,
    canViewPrices: true,
    canViewSchemes: true,
    allowedPrefixes: []
  });
  const [tempUserDetails, setTempUserDetails] = useState({
    customerCode: '',
    creditLimit: 0,
    creditDays: 0,
    password: ''
  });

  useEffect(() => {
    outstandingAPI.getPrefixes()
      .then(res => {
        if (Array.isArray(res.data)) {
          setAllPrefixes(prev => Array.from(new Set([...prev, ...res.data])));
        }
      })
      .catch(console.error);
  }, []);

  const openPermissionsModal = (u) => {
    setPermUser(u);
    setTempPermissions({
      canPlaceOrder: u.permissions?.canPlaceOrder !== false,
      canViewPrices: u.permissions?.canViewPrices !== false,
      canViewSchemes: u.permissions?.canViewSchemes !== false,
      allowedPrefixes: u.permissions?.allowedPrefixes || []
    });
    setTempUserDetails({
      customerCode: u.customerCode || '',
      creditLimit: u.creditLimit || 0,
      creditDays: u.creditDays || 0,
      password: u.passwordText || ''
    });
  };

  const savePermissions = async () => {
    if (!permUser) return;
    setSavingPerms(true);
    try {
      await api.patch(`/users/${permUser._id}/permissions`, {
        permissions: tempPermissions,
        customerCode: tempUserDetails.customerCode,
        creditLimit: tempUserDetails.creditLimit,
        creditDays: tempUserDetails.creditDays,
        password: tempUserDetails.password
      });
      toast.success('Settings updated successfully');
      setPermUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update settings');
    } finally {
      setSavingPerms(false);
    }
  };

    const exportUsersExcel = (userList) => {
      const rows = [];
      userList.forEach((u) => {
        rows.push({
          'Code': u.customerCode || '',
          'Name': getCustomerDisplayName(u),
          'Email': u.email || '',
          'Phone': u.phone || '',
          'Password': u.passwordText || '',
          'Status': u.isActive ? 'Active' : 'Inactive',
        });
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Users');
      const fileName = 'Users.xlsx';
      XLSX.writeFile(wb, fileName);
    };
  const fetchUsers = async (isLoadMore = false) => {
    try {
      if (!isLoadMore) setLoading(true);
      const currentPage = isLoadMore ? page + 1 : 1;
      const params = { page: currentPage, limit: 20 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const res = await usersAPI.getAll(params);
      
      if (isLoadMore) {
        setUsers(prev => [...prev, ...res.data]);
        setPage(currentPage);
      } else {
        setUsers(res.data);
        setPage(1);
      }
      setHasMore(res.data.length === 20);
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { 
    const timer = setTimeout(() => fetchUsers(), 500);
    return () => clearTimeout(timer);
  }, [search, roleFilter]); // eslint-disable-line

  const toggleStatus = async (id, currentStatus) => {
    try {
      await usersAPI.updateStatus(id, { isActive: !currentStatus });
      toast.success('User status updated');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const deleteUser = async (id) => {
    setConfirmModal({
      title: 'Delete User',
      message: 'Are you sure you want to permanently delete this user?',
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await usersAPI.delete(id);
          toast.success('User deleted');
          fetchUsers();
        } catch (error) {
          toast.error('Failed to delete user');
        }
      }
    });
  };

  return (
    <div className="animate-slide-up">
      <div className="page-header page-header-flex">
        <div>
          <h1>Users</h1>
          <p>Manage users and active status</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1 }}>
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="form-select"
          style={{ maxWidth: '160px' }}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="buyer">Buyer</option>
        </select>
        <button className="btn btn-primary btn-sm" onClick={() => exportUsersExcel(users)}>
          <FiDownload style={{ marginRight: '4px' }} /> Export Excel
        </button>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".xlsx,.xls"
          onChange={handleUploadMasterCustomer}
        />
        <button
          className="btn btn-accent btn-sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={importingMasterCustomer}
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <FiUploadCloud /> {importingMasterCustomer ? (importMasterProgress || 'Uploading...') : 'Upload Master Customer'}
        </button>
        <button
          className="btn btn-sm"
          onClick={fetchBlockedUsers}
          style={{
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white',
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🚫 Blocked Parties / Customers
        </button>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner"></div></div>
      ) : (
        <div className="table-container">
          <table className="table scrollable" style={{ minWidth: '1000px' }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Customer Name</th>
                <th>Email / Phone</th>
                <th style={{ width: '140px' }}>Password</th>
                <th style={{ width: '180px' }}>Drug License</th>
                <th>Address & Credit</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{u.customerCode || '—'}</td>
                  <td style={{ color: 'var(--text-white)' }}>
                    <div style={{ fontWeight: 600 }}>{getCustomerDisplayName(u)}</div>
                    {u.gst && u.gst !== '0' && <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 500 }}>GST: {u.gst}</div>}
                    {u.panNo && u.panNo !== '0' && <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 500 }}>PAN: {u.panNo}</div>}
                  </td>
                  <td style={{ fontSize: '13px' }}>
                    <div>{u.email}</div>
                    <div style={{ color: 'var(--text-muted)' }}>{u.phone || '—'}</div>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-white)', maxWidth: '140px' }}>
                    {u.passwordText || '—'}
                  </td>
                  <td style={{ fontSize: '11px', color: 'var(--text-white)', maxWidth: '180px', lineHeight: '1.2' }}>
                    {u.drugLicense ? u.drugLicense.split('/').join(' | ') : '—'}
                  </td>
                  <td style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '150px' }}>
                    <div style={{ marginBottom: '4px', lineHeight: '1.2' }}>{u.address || '—'}</div>
                    <div style={{ color: 'var(--success)', fontWeight: 600 }}>Credit Limit: ₹{u.creditLimit?.toLocaleString() || 0}</div>
                    <div style={{ color: 'var(--accent)', fontWeight: 500 }}>Days: {u.creditDays || 0}</div>
                  </td>
                  <td>
                    <span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  <td>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => toggleStatus(u._id, u.isActive)}
                        title={u.isActive ? 'Deactivate' : 'Activate'}
                        style={{ color: u.isActive ? 'var(--accent)' : 'var(--danger)', fontSize: '16px' }}
                      >
                        {u.isActive ? <FiToggleRight /> : <FiToggleLeft />}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => openPermissionsModal(u)}
                        title="Permissions"
                        style={{ color: 'var(--primary-light)', fontSize: '16px' }}
                      >
                        <FiShield />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => deleteUser(u._id)}
                        title="Delete"
                        style={{ color: 'var(--danger)', fontSize: '16px' }}
                      >
                        <FiTrash2 />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => toggleBlockUser(u._id, u.isBlocked)}
                        title={u.isBlocked ? 'Unblock Party' : 'Block Party'}
                        style={{ color: u.isBlocked ? '#ef4444' : 'var(--text-muted)', fontSize: '16px' }}
                      >
                        <FiSlash style={{ strokeWidth: 3 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '20px', paddingBottom: '20px' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => { setLoadingMore(true); fetchUsers(true); }} 
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      )}

      {permUser && (
        <div className="modal-overlay" onClick={() => setPermUser(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2>Settings: {getCustomerDisplayName(permUser)}</h2>
              <button className="modal-close" onClick={() => setPermUser(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Customer Code (Party Code)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={tempUserDetails.customerCode}
                    onChange={e => setTempUserDetails({ ...tempUserDetails, customerCode: e.target.value })}
                    placeholder="e.g. 720481"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-glass)', color: 'var(--text-white)', fontSize: '14px' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Credit Limit (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={tempUserDetails.creditLimit}
                    onChange={e => setTempUserDetails({ ...tempUserDetails, creditLimit: Number(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-glass)', color: 'var(--text-white)', fontSize: '14px' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Credit Days</label>
                  <input
                    type="number"
                    className="form-input"
                    value={tempUserDetails.creditDays}
                    onChange={e => setTempUserDetails({ ...tempUserDetails, creditDays: Number(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-glass)', color: 'var(--text-white)', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Password</label>
                <input
                  type="text"
                  className="form-input"
                  value={tempUserDetails.password}
                  onChange={e => setTempUserDetails({ ...tempUserDetails, password: e.target.value })}
                  placeholder="Enter new password"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-glass)', color: 'var(--text-white)', fontSize: '14px' }}
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-glass)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>Can Place Orders</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Allow buyer to checkout cart items</div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={tempPermissions.canPlaceOrder} 
                    onChange={e => setTempPermissions({ ...tempPermissions, canPlaceOrder: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-glass)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>Can View Prices</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Allow buyer to see item prices</div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={tempPermissions.canViewPrices} 
                    onChange={e => setTempPermissions({ ...tempPermissions, canViewPrices: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-glass)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>Can View Schemes</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Allow buyer to see item schemes/offers</div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={tempPermissions.canViewSchemes} 
                    onChange={e => setTempPermissions({ ...tempPermissions, canViewSchemes: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </div>

                <div style={{ padding: '12px', background: 'var(--bg-glass)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-white)', marginBottom: '4px' }}>Additional Allowed Prefixes</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    By default, buyers see I, IA, IC, ID. Select any extra prefixes this user is allowed to see (e.g. CR).
                  </div>
                  <CustomMultiSelect 
                    options={allPrefixes}
                    selected={tempPermissions.allowedPrefixes}
                    onChange={(selected) => setTempPermissions({ ...tempPermissions, allowedPrefixes: selected })}
                    placeholder="Select extra prefixes"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setPermUser(null)} disabled={savingPerms}>
                  Cancel
                </button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={savePermissions} disabled={savingPerms}>
                  {savingPerms ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────── Blocked Customers Modal ────── */}
      {showBlockedModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10050,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: '28px 32px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            position: 'relative'
          }}>
            <button 
              onClick={() => setShowBlockedModal(false)}
              style={{
                position: 'absolute', top: '20px', right: '20px',
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <FiX size={20} />
            </button>

            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ color: 'var(--text-white)', fontSize: '20px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>🚫 Blocked Parties / Customers</span>
                <span style={{ fontSize: '12px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                  {blockedUsers.length} Blocked
                </span>
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                Blocked customers who are restricted from logging in and placing orders
              </p>
            </div>

            {/* Filter Search */}
            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Filter blocked customers by code, name, company..."
                value={blockedSearch}
                onChange={e => setBlockedSearch(e.target.value)}
                style={{ width: '100%', padding: '10px 14px' }}
              />
            </div>

            {/* Content Table */}
            <div style={{ flex: 1, overflowY: 'auto', borderRadius: '10px', border: '1px solid var(--border)' }}>
              {loadingBlocked ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading blocked customers...
                </div>
              ) : blockedUsers.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No blocked customers found.
                </div>
              ) : (
                <table className="table scrollable" style={{ width: '100%', fontSize: '13px' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: '12px 16px' }}>Code</th>
                      <th style={{ padding: '12px 16px' }}>Customer Name</th>
                      <th style={{ padding: '12px 16px' }}>Company</th>
                      <th style={{ padding: '12px 16px' }}>Email / Phone</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockedUsers
                      .filter(u => {
                        if (!blockedSearch.trim()) return true;
                        const q = blockedSearch.trim().toLowerCase();
                        return (
                          (u.customerCode || '').toLowerCase().includes(q) ||
                          (u.name || '').toLowerCase().includes(q) ||
                          (u.company || '').toLowerCase().includes(q) ||
                          (u.phone || '').toLowerCase().includes(q)
                        );
                      })
                      .map(u => (
                        <tr key={u._id}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                            <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px' }}>
                              {u.customerCode || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-white)' }}>{u.name}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{u.company || '—'}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                            <div>{u.email}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.phone || '—'}</div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => toggleBlockUser(u._id, u.isBlocked)}
                              style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <FiCheckCircle size={12} /> Unblock
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button 
                className="btn btn-outline"
                onClick={() => setShowBlockedModal(false)}
                style={{ padding: '8px 20px', borderRadius: '10px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmModal}
        title={confirmModal?.title || ''}
        message={confirmModal?.message || ''}
        danger={confirmModal?.danger}
        onConfirm={confirmModal?.onConfirm || (() => {})}
        onCancel={confirmModal?.onCancel || (() => setConfirmModal(null))}
      />
    </div>
  );
};



// Admin Medicines View
const AdminMedicines = () => {
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMed, setNewMed] = useState({
    name: '', genericName: '', manufacturer: '', price: '', mrp: '', stock: '', unit: 'box', tax: 12, sch1: '', sch2: '', sch3: ''
  });
  
  const [stockUploading, setStockUploading] = useState(false);
  const [itemMasterUploading, setItemMasterUploading] = useState(false);
  const [itemMasterUploadStatus, setItemMasterUploadStatus] = useState('');

  const handleItemsStockUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setStockUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await representativesAPI.uploadStock(formData);
      toast.success(res.data.message || 'Stock & Scheme updated successfully');
      fetchMedicines();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload stock file');
    } finally {
      setStockUploading(false);
      e.target.value = '';
    }
  };

  const handleItemMasterUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileRef = e.target;

    try {
      setItemMasterUploading(true);
      setItemMasterUploadStatus('Reading Excel file...');

      // --- Parse Excel in browser (no server-side XLSX blocking) ---
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (!rows || rows.length === 0) {
        toast.error('Excel file is empty or unreadable');
        return;
      }

      // Detect header row (same logic as backend)
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(rows.length, 5); i++) {
        const flat = rows[i].map(v => String(v ?? '').trim().toLowerCase());
        if (flat.some(v =>
          v.includes('c_code') || v.includes('item code') || v.includes('item_name') ||
          v.includes('c_name') || v.includes('pack') || v.includes('manufacturer') || v.includes('mfac')
        )) {
          headerRowIndex = i;
          break;
        }
      }

      const headerRow = headerRowIndex >= 0 ? rows[headerRowIndex] : [];
      const dataRows  = headerRowIndex >= 0 ? rows.slice(headerRowIndex + 1) : rows.slice(1);

      // Find all column indices matching a candidate list (exact matches prioritized)
      const findIndices = (candidates) => {
        const normalized = headerRow.map(v => String(v ?? '').trim().toLowerCase());
        const indices = [];
        // First try exact match
        candidates.forEach(c => {
          normalized.forEach((val, idx) => {
            if (val === c && !indices.includes(idx)) indices.push(idx);
          });
        });
        // Then try partial match
        candidates.forEach(c => {
          normalized.forEach((val, idx) => {
            if (val.includes(c) && !indices.includes(idx)) indices.push(idx);
          });
        });
        return indices;
      };

      const codeIdxs = findIndices(['c_code', 'item code', 'item_code', 'code', 'itemcode']);
      const nameIdxs = findIndices(['c_name', 'item name', 'item_name', 'name', 'medicine name']);
      const packIdxs = findIndices(['pack size', 'pack_size', 'packsize', 'pack', 'pack name']);
      const mfacIdxs = findIndices(['mfac name', 'manufacturer', 'mfac_name', 'mfr', 'company']);
      const discontinuedIdxs = findIndices(['item_status', 'item status', 'status', 'discontinued', 'notes', 'remarks', 'discontinue', 'packing change', 'packing_change', 'active']);

      const codeIdx = codeIdxs[0] ?? 0;
      const nameIdx = nameIdxs[0] ?? 1;
      const packIdx = packIdxs[0] ?? (nameIdxs[1] ?? 2);
      const mfacIdx = mfacIdxs[0] ?? (nameIdxs[2] ?? 3);
      const discontinuedIdx = discontinuedIdxs[0] ?? -1;

      // Parse all rows into clean records
      const allCodes = [];
      const records = dataRows
        .map(row => {
          const code = String(row[codeIdx] ?? '').trim();
          const name = String(row[nameIdx] ?? '').trim();
          const pack = String(row[packIdx] ?? '').trim();
          const mfac = String(row[mfacIdx] ?? '').trim();
          const discontinued = discontinuedIdx >= 0 ? String(row[discontinuedIdx] ?? '').trim() : '';

          if (!code) return null;
          allCodes.push(code);

          // Determine active/inactive status strictly based on item_status cell containing discontinued/packing change keywords
          const lowerDisc = discontinued.toLowerCase();
          const isDiscontinued = lowerDisc.includes('discontinued') || lowerDisc.includes('packing change') || lowerDisc.includes('packing changed') || lowerDisc.includes('pack change');

          const isActive = !isDiscontinued;

          return { 
            code, 
            name, 
            description: pack, 
            manufacturer: mfac, 
            discontinued: isDiscontinued ? discontinued : '', 
            isActive 
          };
        })
        .filter(Boolean);

      if (records.length === 0) {
        toast.error('No valid item master records found in the Excel file');
        return;
      }

      setItemMasterUploadStatus(`Parsed ${records.length.toLocaleString()} records. Uploading...`);

      // --- Send in chunks of 1000 ---
      const CHUNK_SIZE = 1000;
      const totalChunks = Math.ceil(records.length / CHUNK_SIZE);
      let totalCreated = 0;
      let totalUpdated = 0;

      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE);
        const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
        setItemMasterUploadStatus(`Uploading chunk ${chunkNum} of ${totalChunks}...`);
        const res = await medicinesAPI.importItemMasterChunk(chunk);
        totalCreated += res.data.created || 0;
        totalUpdated += res.data.updated || 0;
      }

      // --- Finalize: set stock=0 for medicines NOT in this upload ---
      setItemMasterUploadStatus('Finalizing — resetting unlisted item stock...');
      const finalRes = await medicinesAPI.finalizeItemMaster(allCodes);
      const resetCount = finalRes.data.unlistedResetCount || 0;

      toast.success(
        `Item master updated! ✅ Created: ${totalCreated} | Updated: ${totalUpdated} | Stock reset (unlisted): ${resetCount}`
      );
      fetchMedicines();
    } catch (error) {
      console.error('Item master upload error:', error);
      toast.error(error.response?.data?.message || 'Failed to upload item master');
    } finally {
      setItemMasterUploading(false);
      setItemMasterUploadStatus('');
      fileRef.value = '';
    }
  };

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchMedicines = async (isLoadMore = false) => {
    try {
      const currentPage = isLoadMore ? page + 1 : 1;
      const params = { page: currentPage, limit: 25, sort: 'name' };
      if (search) params.search = search;
      const res = await medicinesAPI.getAll(params);
      
      const fetchedMedicines = res.data.map(m => ({
        ...m,
        unit: m.unit === 'strip' ? 'box' : (m.unit || 'box')
      }));

      const startsWithSpecial = (name) => {
        if (!name) return false;
        const firstChar = name.trim().charAt(0);
        return !/[a-zA-Z0-9]/.test(firstChar);
      };

      let processed = [];
      if (search && search.trim()) {
        processed = fetchedMedicines;
      } else {
        processed = fetchedMedicines.filter(m => !startsWithSpecial(m.name));
      }

      const sortMeds = (list) => {
        return list.sort((a, b) => {
          const aSpecial = startsWithSpecial(a.name);
          const bSpecial = startsWithSpecial(b.name);
          if (aSpecial && !bSpecial) return 1;
          if (!aSpecial && bSpecial) return -1;
          return (a.name || '').trim().toLowerCase().localeCompare((b.name || '').trim().toLowerCase());
        });
      };

      if (isLoadMore) {
        const combined = [...medicines, ...processed];
        setMedicines(sortMeds(combined));
        setPage(currentPage);
      } else {
        setMedicines(sortMeds(processed));
        setPage(1);
      }
      setHasMore(res.data.length === 25);
    } catch (error) {
      toast.error('Failed to fetch medicines');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchMedicines(), 500);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line

  const handleAddMedicine = async (e) => {
    e.preventDefault();
    try {
      await medicinesAPI.create(newMed);
      toast.success('Medicine added successfully');
      setShowAddModal(false);
      setNewMed({ name: '', genericName: '', manufacturer: '', price: '', mrp: '', stock: '', unit: 'box', tax: 12, sch1: '', sch2: '', sch3: '' });
      fetchMedicines();
    } catch (error) {
      toast.error('Failed to add medicine');
    }
  };

  return (
    <div className="animate-slide-up">
      <div className="page-header page-header-flex">
        <div>
          <h1>All Items</h1>
          <p>View and manage all items</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <label className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: itemMasterUploading ? 'not-allowed' : 'pointer', opacity: itemMasterUploading ? 0.7 : 1, margin: 0 }}>
            <FiUploadCloud />
            <span>{itemMasterUploading ? (itemMasterUploadStatus || 'Uploading...') : 'Upload Item Master'}</span>
            <input type="file" accept=".xlsx,.xls" onChange={handleItemMasterUpload} style={{ display: 'none' }} disabled={itemMasterUploading} />
          </label>
          <label className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0 }}>
            <FiUploadCloud /> {stockUploading ? 'Uploading...' : 'Upload Stock & Scheme'}
            <input type="file" accept=".xlsx,.xls" onChange={handleItemsStockUpload} style={{ display: 'none' }} disabled={stockUploading} />
          </label>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <div className="search-bar">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner"></div></div>
      ) : medicines.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💊</div>
          <h3>Search Items</h3>
          {/* <p>No items have been listed yet</p> */}
        </div>
      ) : (
        <div className="table-container">
          <table className="table scrollable" style={{ minWidth: '900px' }}>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Price / MRP</th>
                <th>Stock</th>
                <th>Manufacturer</th>
                <th>Schemes</th>
                <th>Tax</th>
              </tr>
            </thead>
            <tbody>
              {medicines.map(med => (
                <tr key={med._id}>
                  <td data-label="Item Name">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 600 }}>{med.name}</div>
                      {med.code && (
                        <span style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          {med.code}
                        </span>
                      )}
                    </div>
                    {med.genericName && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{med.genericName}</div>}
                    {(med.description || med.unit) && <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 500, marginTop: '2px' }}>Pack: {med.description || med.unit}</div>}
                  </td>
                  <td data-label="Price / MRP">
                    <div style={{ fontWeight: 600 }}>₹{med.price}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MRP: ₹{med.mrp}</div>
                  </td>
                  <td data-label="Stock">
                    <span className={`badge ${med.stock > 10 ? 'badge-success' : med.stock > 0 ? 'badge-warning' : 'badge-danger'}`}>
                      {med.stock ?? 0}
                    </span>
                  </td>
                  <td data-label="Manufacturer" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{med.manufacturer || med.seller?.name || '—'}</td>
                  <td data-label="Schemes">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {med.sch1 && <span className="badge" style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px' }}>{med.sch1}</span>}
                      {med.sch2 && <span className="badge" style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px' }}>{med.sch2}</span>}
                      {med.sch3 && <span className="badge" style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px' }}>{med.sch3}</span>}
                      {(!med.sch1 && !med.sch2 && !med.sch3) && <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>}
                    </div>
                  </td>
                  <td data-label="Tax" style={{ fontSize: '13px' }}>{med.tax || 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '20px', paddingBottom: '20px' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => { setLoadingMore(true); fetchMedicines(true); }} 
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add Medicine Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Add New Item</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddMedicine} className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Item Name</label>
                  <input type="text" className="form-input" required value={newMed.name} onChange={e => setNewMed({...newMed, name: e.target.value})} placeholder="e.g., O2 Tablets" />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Generic Name (Salt)</label>
                  <input type="text" className="form-input" value={newMed.genericName} onChange={e => setNewMed({...newMed, genericName: e.target.value})} placeholder="e.g., Ofloxacin & Ornidazole" />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Manufacturer</label>
                  <input type="text" className="form-input" required value={newMed.manufacturer} onChange={e => setNewMed({...newMed, manufacturer: e.target.value})} placeholder="e.g., Medley Pharmaceuticals" />
                </div>
                <div className="form-group">
                  <label>Sale Price (₹)</label>
                  <input type="number" className="form-input" required value={newMed.price} onChange={e => setNewMed({...newMed, price: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>MRP (₹)</label>
                  <input type="number" className="form-input" required value={newMed.mrp} onChange={e => setNewMed({...newMed, mrp: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Current Stock</label>
                  <input type="number" className="form-input" required value={newMed.stock} onChange={e => setNewMed({...newMed, stock: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Pack</label>
                  <input type="text" className="form-input" required value={newMed.unit} onChange={e => setNewMed({...newMed, unit: e.target.value})} />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Tax (%)</label>
                  <input type="number" className="form-input" value={newMed.tax} onChange={e => setNewMed({...newMed, tax: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Scheme 1 (e.g., 10+1)</label>
                  <input type="text" className="form-input" value={newMed.sch1} onChange={e => setNewMed({...newMed, sch1: e.target.value})} placeholder="10 + 1" />
                </div>
                <div className="form-group">
                  <label>Scheme 2 (e.g., 2% Off)</label>
                  <input type="text" className="form-input" value={newMed.sch2} onChange={e => setNewMed({...newMed, sch2: e.target.value})} placeholder="2% OFF" />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Scheme 3 (Seasonal)</label>
                  <input type="text" className="form-input" value={newMed.sch3} onChange={e => setNewMed({...newMed, sch3: e.target.value})} placeholder="Seasonal Offer" />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '20px' }}>
                Save Item
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Admin Orders View
const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [itemsOrder, setItemsOrder] = useState(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);

  const fetchOrders = async (searchQuery = search) => {
    try {
      setLoading(true);
      const params = {};
      const trimmed = searchQuery.trim();
      if (trimmed) params.search = trimmed;
      if (statusFilter) params.status = statusFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await ordersAPI.getAll(params);
      let data = res.data || [];
      if (trimmed) {
        data = data.filter(o => matchesOrderSearch(o, trimmed));
      }
      setOrders(data);
    } catch (error) {
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchOrders(search), 400);
    return () => clearTimeout(timer);
  }, [search, statusFilter, startDate, endDate]); // eslint-disable-line

  const toggleSelect = (id) => {
    setSelectedOrderIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const updateStatus = async (id, status) => {
    try {
      await ordersAPI.updateStatus(id, { status });
      toast.success(`Order ${status}`);
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  const downloadExcel = (orderList) => {
    const rows = [];
    orderList.forEach((order) => {
      const d = new Date(order.createdAt);
      const base = {
        'Order No': formatOrderNo(order.orderNumber, order.buyer),
        'Date': d.toLocaleDateString('en-IN'),
        'Time': d.toLocaleTimeString('en-IN'),
        'Party Code': order.buyer?.customerCode || '',
        'Customer Name': getCustomerDisplayName(order.buyer),
        'Status': formatOrderStatus(order.status),
        'Total Amount': order.totalAmount,
      };
      const items = order.items || [];
      if (items.length === 0) {
        rows.push({ ...base, 'Item Name': '', 'Qty': '' });
      } else {
        items.forEach((item) => {
          rows.push({
            ...base,
            'Item Code': item.medicine?.code || item.medicineCode || item.code || item.itemCode || '-',
            'Item Name': item.medicineName,
            'Pack': item.medicine?.description || item.medicine?.unit || item.unit || '-',
            'Qty': item.quantity,
          });
        });
      }
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    const fileName = orderList.length === 1
      ? `${formatOrderNo(orderList[0].orderNumber, orderList[0].buyer).replace(/\s/g, '_')}.xlsx`
      : 'Orders.xlsx';
    XLSX.writeFile(wb, fileName);
  };
  
  const downloadSelected = async () => {
    if (selectedOrderIds.length === 0) return;
    const selectedOrders = orders.filter(o => selectedOrderIds.includes(o._id));
    selectedOrders.forEach((order) => {
      downloadExcel([order]);
    });
  };

  return (
    <div className="animate-slide-up">
      <div className="page-header">
        <h1>All Orders</h1>
        <p>Manage all platform orders</p>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: search ? 0 : 0 }}>
          <div className="search-bar" style={{ flex: '1 1 280px', maxWidth: 'none', minWidth: '220px' }}>
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Party name, code, order no, item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingRight: search ? '40px' : undefined }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                title="Clear search"
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <FiX size={16} />
              </button>
            )}
          </div>
          <select
            className="form-select"
            style={{ flex: '0 1 160px', minWidth: '130px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="hold">Hold</option>
            <option value="confirmed">Confirmed</option>
            <option value="delivered">Delivered</option>
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>From</label>
            <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '8px 10px', width: '140px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>To</label>
            <input type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '8px 10px', width: '140px' }} />
          </div>
          <button className="btn btn-outline btn-sm" onClick={downloadSelected} disabled={selectedOrderIds.length === 0} style={{ marginRight: '8px' }}>
            <FiDownload /> Download Selected
          </button>
        </div>
        {(search.trim() || !loading) && (
          <p style={{ margin: '12px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            {loading ? 'Searching...' : (
              <>
                <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{orders.length}</span>
                {' '}order{orders.length !== 1 ? 's' : ''}
                {search.trim() ? ` for "${search.trim()}"` : ' found'}
              </>
            )}
          </p>
        )}
      </div>

      {loading && orders.length === 0 ? (
        <div className="loading-container"><div className="spinner"></div></div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h3>No orders found</h3>
          <p>{search.trim() ? 'No orders match your search' : 'No orders have been placed yet'}</p>
        </div>
      ) : (
        <div className="table-container" style={{ opacity: loading ? 0.55 : 1, pointerEvents: loading ? 'none' : 'auto', position: 'relative' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
              <div className="spinner"></div>
            </div>
          )}
          <table className="table scrollable" style={{ minWidth: '950px' }}>
            <thead>
              <tr>
                <th><input type="checkbox" checked={selectedOrderIds.length === orders.length && orders.length > 0} onChange={(e) => {
                if (e.target.checked) {
                  setSelectedOrderIds(orders.map(o => o._id));
                } else {
                  setSelectedOrderIds([]);
                }
              }} /></th>
                <th>Order No</th>
                <th>Party Code</th>
                <th>Customer Name</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th>Time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const orderDate = new Date(order.createdAt);
                const itemCount = order.items?.length || 0;
                return (
                <tr key={order._id}>
                  <td><input type="checkbox" checked={selectedOrderIds.includes(order._id)} onChange={() => toggleSelect(order._id)} /></td>
                  <td style={{ fontWeight: 600, color: 'var(--primary-light)' }}>{formatOrderNo(order.orderNumber, order.buyer)}</td>
                  <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{order.buyer?.customerCode || '—'}</td>
                  <td style={{ fontWeight: 500, maxWidth: '200px' }}>{getCustomerDisplayName(order.buyer)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setItemsOrder(order)}
                      style={{ fontSize: '12px', padding: '4px 10px', whiteSpace: 'nowrap' }}
                    >
                      <FiList style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                      View ({itemCount})
                    </button>
                  </td>
                  <td style={{ fontWeight: 600 }}>₹{order.totalAmount?.toLocaleString()}</td>
                  <td><span className={`badge status-${formatOrderStatus(order.status)}`}>{formatOrderStatus(order.status)}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {orderDate.toLocaleDateString('en-IN')}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {orderDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      className="form-select"
                      style={{ padding: '6px 10px', fontSize: '12px', minWidth: '120px' }}
                      value={order.status === 'cancelled' ? 'hold' : order.status}
                      onChange={(e) => updateStatus(order._id, e.target.value)}
                    >
                      <option value="hold">Hold</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="delivered">Delivered</option>
                    </select>
                    <button className="btn btn-ghost btn-sm" title="Download Excel" onClick={() => downloadExcel([order])}>
                      <FiDownload />
                    </button>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      )}

      {itemsOrder && (
        <div className="modal-overlay" onClick={() => setItemsOrder(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '420px', width: '92%' }}
          >
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '16px', marginBottom: '4px' }}>Order Items</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  {formatOrderNo(itemsOrder.orderNumber, itemsOrder.buyer)} · {getCustomerDisplayName(itemsOrder.buyer)}
                  {itemsOrder.buyer?.customerCode ? ` · ${itemsOrder.buyer.customerCode}` : ''}
                </p>
              </div>
              <button className="modal-close" type="button" onClick={() => setItemsOrder(null)}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '320px', overflowY: 'auto', paddingTop: '8px' }}>
              {(itemsOrder.items || []).length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No items</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {itemsOrder.items.map((item, i) => (
                    <li
                      key={i}
                      style={{
                        padding: '10px 12px',
                        marginBottom: '8px',
                        background: 'var(--bg-glass)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-light)',
                        fontSize: '13px',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--text-white)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {item.medicineName}
                        {item.medicine?.code && (
                          <span style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            {item.medicine.code}
                          </span>
                        )}
                        {itemHasAppliedScheme(item) && (
                          <span className="badge" style={{ fontSize: '9px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            Scheme Applied
                          </span>
                        )}
                      </div>
                      <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Qty: {item.quantity}</div>
                      <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>Pack Size: {item.medicine?.description || item.medicine?.unit || item.unit || '-'}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CustomMultiSelect = ({ options, selected, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (opt) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(i => i !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  return (
    <div className="multiselect-container" ref={containerRef}>
      <button type="button" className="multiselect-trigger" onClick={() => setIsOpen(!isOpen)}>
        <span>{selected.length === 0 ? placeholder : `${selected.length} Selected`}</span>
        <FiChevronDown />
      </button>
      {isOpen && (
        <div className="multiselect-dropdown">
          {options.map(opt => (
            <label key={opt} className="multiselect-option">
              <input 
                type="checkbox" 
                className="multiselect-checkbox"
                checked={selected.includes(opt)} 
                onChange={() => toggleOption(opt)} 
              />
              {opt}
            </label>
          ))}
          {options.length === 0 && <div style={{ padding: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>No options</div>}
        </div>
      )}
    </div>
  );
};

// Admin Outstanding View — Premium Glass UI
const AdminOutstanding = () => {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [stats, setStats] = useState({ totalRecords: 0, totalParties: 0, totalAmount: 0, totalBalance: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [prefixes, setPrefixes] = useState([]);
  const [activePrefixes, setActivePrefixes] = useState([]);
  const [confirmModal, setConfirmModal] = useState(null);
  const limit = 50;
  const fetchStats = async () => {
    try {
      const res = await outstandingAPI.getStats();
      setStats(res.data);
    } catch (error) {
      console.error('Failed to fetch outstanding stats:', error);
    }
  };

  const fetchPrefixes = async () => {
    try {
      const pRes = await outstandingAPI.getPrefixes();
      setPrefixes(pRes.data);
    } catch (error) {
      console.error('Failed to fetch prefixes:', error);
    }
  };

  const fetchRecords = async (pg = page, searchQuery = search, prefixesList = activePrefixes) => {
    try {
      setLoading(true);
      const params = { page: pg, limit };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (prefixesList && prefixesList.length > 0) params.prefix = prefixesList.join(',');
      const res = await outstandingAPI.getAll(params);
      setRecords(res.data.data);
      setTotalPages(res.data.totalPages);
      setTotalCount(res.data.total);
      setPage(res.data.page);
    } catch (error) {
      toast.error('Failed to fetch outstanding data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchPrefixes();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchRecords(1, search, activePrefixes), 400);
    return () => clearTimeout(timer);
  }, [search, activePrefixes]); // eslint-disable-line

  const handleImportDefault = async () => {
    setConfirmModal({
      title: 'Import Outstanding Data',
      message: 'Import outstanding data from Downloads/outstanding.XLSX?\n\nThis will replace all existing outstanding data.',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          setImporting(true);
          const res = await outstandingAPI.importDefault();
          toast.success(`${res.data.totalRecords} records imported successfully!`);
          fetchStats();
          fetchRecords(1, search, activePrefixes);
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to import outstanding data');
        } finally {
          setImporting(false);
        }
      }
    });
  };

  const formatExportDate = (value) => {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fileRef = e.target;
    setConfirmModal({
      title: 'Import Outstanding Data',
      message: `Import outstanding data from "${file.name}"?\n\nThis will replace all existing outstanding data.`,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          setImporting(true);
          const formData = new FormData();
          formData.append('file', file);
          const res = await outstandingAPI.importFile(formData);
          toast.success(`${res.data.totalRecords} records imported successfully!`);
          fetchStats();
          fetchRecords(1, search, activePrefixes);
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to import file');
        } finally {
          setImporting(false);
          fileRef.value = '';
        }
      },
      onCancel: () => { setConfirmModal(null); fileRef.value = ''; }
    });
  };

  const downloadOutstandingExcel = async () => {
    try {
      toast.info('Preparing export, please wait...');
      // Fetch all records — no pagination limit
      const params = {
        page: 1,
        limit: 999999,
      };

      if (search.trim()) {
        params.search = search.trim();
      }
      if (activePrefixes && activePrefixes.length > 0) {
        params.prefix = activePrefixes.join(',');
      }

      const res = await outstandingAPI.getAll(params);
      const allRecords = res.data?.data || [];

      if (allRecords.length === 0) {
        toast.warn('No records to export');
        return;
      }

      const exportRows = allRecords.map(r => ({
        'Party Code': r.partyCode,
        'Party Name': r.partyName,
        'Prefix': r.prefix || '',
        'Doc No': r.docNo || '',
        'Doc Date': formatExportDate(r.docDate),
        'Amount Total': r.amountTotal,
        'Balance Amount': r.balanceAmount,
        'Due Days': r.dueDays,
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Outstanding');
      XLSX.writeFile(wb, 'Outstanding_Report.xlsx');
      toast.success(`Exported ${allRecords.length.toLocaleString()} records successfully!`);
    } catch (error) {
      console.error('Failed to export outstanding data:', error);
      toast.error('Failed to export outstanding data');
    }
  };

  const handlePrefixClick = (p) => {
    setActivePrefixes(prev => {
      if (prev.includes(p)) {
        return prev.filter(x => x !== p);
      } else {
        return [...prev, p];
      }
    });
  };

  // Glassmorphism inline styles
  const glassCard = {
    background: 'var(--bg-card)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '24px',
    transition: 'all 0.3s ease',
  };

  const statGlassCard = (gradientColor, iconBg) => ({
    ...glassCard,
    position: 'relative',
    overflow: 'hidden',
    cursor: 'default',
  });

  return (
    <div className="animate-slide-up">
      {/* Page Header */}
      <div className="page-header page-header-flex">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Outstanding</span>
            <span style={{ fontSize: '14px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '4px 12px', borderRadius: '20px', fontWeight: 600, WebkitTextFillColor: '#818cf8' }}>
              💰 Live
            </span>
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Outstanding balance report — track and manage party dues</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label
            className="btn btn-primary btn-sm"
            style={{ cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: '6px', margin: 0 }}
          >
            <FiUploadCloud />
            {importing ? 'Importing...' : 'Upload Excel'}
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              disabled={importing}
              style={{ display: 'none' }}
            />
          </label>
          <button className="btn btn-outline btn-sm" onClick={downloadOutstandingExcel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FiDownload /> Export
          </button>
        </div>
      </div>

      {/* Stats Cards with Glass Effect */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '24px' }}>
        <div className="stat-card" style={statGlassCard()}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}></div>
          <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' }}>📄</div>
          <div className="stat-value">{stats.totalRecords.toLocaleString()}</div>
          <div className="stat-label">Total Records</div>
        </div>
        <div className="stat-card" style={statGlassCard()}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #10b981, #34d399)' }}></div>
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>👥</div>
          <div className="stat-value">{stats.totalParties}</div>
          <div className="stat-label">Total Parties</div>
        </div>
        <div className="stat-card" style={statGlassCard()}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }}></div>
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>💰</div>
          <div className="stat-value">₹{(stats.totalAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          <div className="stat-label">Total Amount</div>
        </div>
        <div className="stat-card" style={statGlassCard()}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #ef4444, #f87171)' }}></div>
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>📊</div>
          <div className="stat-value">₹{(stats.totalBalance || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          <div className="stat-label">Total Balance</div>
        </div>
      </div>

      {/* Prefix Filter Badges */}
      <div style={{
        ...glassCard,
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '8px' }}>
          Prefix Filter:
        </span>
        <button
          onClick={() => setActivePrefixes([])}
          style={{
            padding: '5px 14px',
            borderRadius: '20px',
            border: activePrefixes.length === 0 ? '1.5px solid #6366f1' : '1px solid var(--border)',
            background: activePrefixes.length === 0 ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-glass)',
            color: activePrefixes.length === 0 ? '#818cf8' : 'var(--text-secondary)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          All
        </button>
        {prefixes.map(p => (
          <button
            key={p}
            onClick={() => handlePrefixClick(p)}
            style={{
              padding: '5px 14px',
              borderRadius: '20px',
              border: activePrefixes.includes(p) ? '1.5px solid #6366f1' : '1px solid var(--border)',
              background: activePrefixes.includes(p) ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-glass)',
              color: activePrefixes.includes(p) ? '#818cf8' : 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              transform: activePrefixes.includes(p) ? 'scale(1.05)' : 'scale(1)',
            }}
            onMouseEnter={(e) => {
              if (!activePrefixes.includes(p)) {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (!activePrefixes.includes(p)) {
                e.currentTarget.style.background = 'var(--bg-glass)';
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '220px' }}>
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search by party code, name, doc no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              title="Clear search"
              style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center'
              }}
            >
              <FiX size={16} />
            </button>
          )}
        </div>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{totalCount.toLocaleString()}</span> record{totalCount !== 1 ? 's' : ''}
          {search.trim() ? ` for "${search.trim()}"` : ''}
          {activePrefixes.length > 0 ? ` · Prefixes: ${activePrefixes.join(', ')}` : ''}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-container"><div className="spinner"></div></div>
      ) : records.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h3>No outstanding records</h3>
          <p>{stats.totalRecords === 0 ? 'Import outstanding data using the buttons above' : 'No records match your search'}</p>
        </div>
      ) : (
        <>
          <div className="table-container" style={{ borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table className="table scrollable" style={{ minWidth: '950px' }}>
              <thead>
                <tr>
                  <th>Party Code</th>
                  <th>Party Name</th>
                  <th>Prefix</th>
                  <th>Doc No</th>
                  <th>Doc Date</th>
                  <th style={{ textAlign: 'right' }}>Amount Total</th>
                  <th style={{ textAlign: 'right' }}>Balance Amount</th>
                  <th style={{ textAlign: 'center' }}>Due Days</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec, idx) => (
                  <tr key={rec._id || idx} style={{ transition: 'background 0.2s ease' }}>
                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{rec.partyCode || '—'}</td>
                    <td style={{ fontWeight: 500, color: 'var(--text-white)', maxWidth: '200px' }}>
                      {rec.partyName || '—'}
                    </td>
                    <td>
                      {rec.prefix ? (
                        <span
                          onClick={() => handlePrefixClick(rec.prefix)}
                          style={{
                            fontSize: '10px',
                            background: activePrefixes.includes(rec.prefix) ? 'rgba(99, 102, 241, 0.2)' : 'rgba(56, 189, 248, 0.15)',
                            color: activePrefixes.includes(rec.prefix) ? '#818cf8' : '#38bdf8',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            transition: 'all 0.2s ease',
                            border: activePrefixes.includes(rec.prefix) ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                          }}
                        >
                          {rec.prefix}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{rec.docNo || '—'}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {rec.docDate ? formatExportDate(rec.docDate) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      <span style={{ color: rec.amountTotal < 0 ? '#ef4444' : 'var(--text-white)' }}>
                        {rec.amountTotal < 0 ? '-' : ''}₹{Math.abs(rec.amountTotal).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      <span style={{ color: rec.balanceAmount < 0 ? '#ef4444' : rec.balanceAmount > 0 ? '#fbbf24' : 'var(--text-muted)' }}>
                        {rec.balanceAmount < 0 ? '-' : ''}₹{Math.abs(rec.balanceAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className="badge"
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 10px',
                          background: rec.dueDays > 90 ? 'rgba(239, 68, 68, 0.15)' : rec.dueDays > 30 ? 'rgba(251, 191, 36, 0.15)' : rec.dueDays > 0 ? 'rgba(56, 189, 248, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: rec.dueDays > 90 ? '#ef4444' : rec.dueDays > 30 ? '#fbbf24' : rec.dueDays > 0 ? '#38bdf8' : '#10b981',
                        }}
                      >
                        {rec.dueDays} days
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px', paddingBottom: '20px'
            }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => fetchRecords(page - 1)}
                disabled={page <= 1}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <FiChevronLeft /> Prev
              </button>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Page <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{page}</span> of <span style={{ fontWeight: 600 }}>{totalPages}</span>
              </span>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => fetchRecords(page + 1)}
                disabled={page >= totalPages}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Next <FiChevronRight />
              </button>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        open={!!confirmModal}
        title={confirmModal?.title || ''}
        message={confirmModal?.message || ''}
        danger={confirmModal?.danger}
        onConfirm={confirmModal?.onConfirm || (() => {})}
        onCancel={confirmModal?.onCancel || (() => setConfirmModal(null))}
      />
    </div>
  );
};

// Main Admin Dashboard
const AdminRepresentatives = () => {
  const [reps, setReps] = useState([]);
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Debounce representative search
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(search);
    }, 450);
    return () => clearTimeout(handler);
  }, [search]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [confirmModal, setConfirmModal] = useState(null);
  
  // For Editing Phone
  const [editingRep, setEditingRep] = useState(null);
  const [newPhone, setNewPhone] = useState('');
  const [newRepName, setNewRepName] = useState('');
  const [newPhone2, setNewPhone2] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [newSsLimit, setNewSsLimit] = useState(1);
  const [newCwLimit, setNewCwLimit] = useState(1);
  const [savingPhone, setSavingPhone] = useState(false);
  const [dupWarningModal, setDupWarningModal] = useState(null); // { message: string }
  const [permModalRep, setPermModalRep] = useState(null); // Representative currently being managed in permissions modal

  // Company linking modal state
  const [companyModalRep, setCompanyModalRep] = useState(null);
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [linkedCompanies, setLinkedCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [removingCompany, setRemovingCompany] = useState('');
  const [uploadProgress, setUploadProgress] = useState(null);

  // Add Representative modal state
  const [showAddRepModal, setShowAddRepModal] = useState(false);
  const [ssCompanies, setSsCompanies] = useState([]);
  const [ssSearch, setSsSearch] = useState('');
  const [selectedSsCompany, setSelectedSsCompany] = useState('');
  const [loadingSsCompanies, setLoadingSsCompanies] = useState(false);
  const [savingNewRep, setSavingNewRep] = useState(false);

  // SubTab state ('reps', 'statement' or 'customerwise')
  const [subTab, setSubTab] = useState('reps');

  // Customer Wise Upload Period Modal States
  const [showCwUploadModal, setShowCwUploadModal] = useState(false);
  const [cwUploadFile, setCwUploadFile] = useState(null);
  const [cwUploadMonth, setCwUploadMonth] = useState([
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ][new Date().getMonth()]);
  const [cwUploadYear, setCwUploadYear] = useState(String(new Date().getFullYear()));
  const cwUploadMfacCode = '';
  const cwUploadMfacName = '';

  // Purchase Order Upload & View States
  const [showPoUploadModal, setShowPoUploadModal] = useState(false);
  const [poUploadFile, setPoUploadFile] = useState(null);
  const [poOrderType, setPoOrderType] = useState('starting');
  const [poUploading, setPoUploading] = useState(false);
  const [poData, setPoData] = useState([]);
  const [poTotal, setPoTotal] = useState(0);
  const [poLoading, setPoLoading] = useState(false);
  const [poSearch, setPoSearch] = useState('');
  const [poPage, setPoPage] = useState(1);
  const [allPoEnabled, setAllPoEnabled] = useState(false);
  const [bulkPoLoading, setBulkPoLoading] = useState(false);
  const [poTotalPages, setPoTotalPages] = useState(1);

  // Field Permissions Modal
  const [showFieldPermissionsModal, setShowFieldPermissionsModal] = useState(false);
  const [fpSelectedMfac, setFpSelectedMfac] = useState('');
  const [fpSelectedFields, setFpSelectedFields] = useState([]);
  const [fpSaving, setFpSaving] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);

  const allCwFields = [
    { key: 'mfacCode', label: 'Mfac Code' },
    { key: 'companyDivision', label: 'Company Division' },
    { key: 'itemCode', label: 'Item Code' },
    { key: 'itemName', label: 'Item Name' },
    { key: 'packName', label: 'Pack Size' },
    { key: 'qty', label: 'Quantity' },
    { key: 'schemeQty', label: 'Scheme Quantity' },
    { key: 'saleRate', label: 'Sale Rate' },
    { key: 'amount', label: 'Amount' },
    { key: 'discount', label: 'Discount' },
    { key: 'customerCode', label: 'Customer Code' },
    { key: 'customerName', label: 'Customer Name' },
    { key: 'customerAddress', label: 'Customer Address' },
    { key: 'customerCity', label: 'Customer City' },
    { key: 'customerPin', label: 'Customer PIN' },
    { key: 'customerMobile', label: 'Customer Mobile' },
    { key: 'customerEmail', label: 'Customer Email' },
    { key: 'gst', label: 'GST' },
    { key: 'routeName', label: 'Route Name' },
    { key: 'dmanName', label: 'Delivery Man Name' },
    { key: 'areaName', label: 'Area Name' }
  ];
  const [showOldCwModal, setShowOldCwModal] = useState(false);
  const [oldCwFile, setOldCwFile] = useState(null);
  const [oldCwMonth, setOldCwMonth] = useState([
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ][new Date().getMonth()]);
  const [oldCwYear, setOldCwYear] = useState(String(new Date().getFullYear()));
  const [oldCwUploading, setOldCwUploading] = useState(false);

  // S&S Statement Upload Period Modal States
  const [showStmtUploadModal, setShowStmtUploadModal] = useState(false);
  const [stmtUploadFile, setStmtUploadFile] = useState(null);
  const [stmtUploadMonth, setStmtUploadMonth] = useState([
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ][new Date().getMonth()]);
  const [stmtUploadYear, setStmtUploadYear] = useState(String(new Date().getFullYear()));
  
  const getFormattedDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getFormattedCwPeriod = (monthName, year) => {
    if (!monthName || !year) return '';
    const monthMap = {
      'january': '01', 'february': '02', 'march': '03', 'april': '04', 'may': '05', 'june': '06',
      'july': '07', 'august': '08', 'september': '09', 'october': '10', 'november': '11', 'december': '12',
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'jun': '06',
      'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };
    const normMonth = String(monthName).trim().toLowerCase();
    const mm = monthMap[normMonth] || '01';
    const yyyy = String(year).trim();
    
    // Calculate total days in that month
    const monthIndex = parseInt(mm, 10) - 1;
    const yearInt = parseInt(yyyy, 10) || new Date().getFullYear();
    const totalDays = new Date(yearInt, monthIndex + 1, 0).getDate();
    const formattedTotalDays = String(totalDays).padStart(2, '0');
    
    return `(01-${mm}-${yyyy} to ${formattedTotalDays}-${mm}-${yyyy})`;
  };

  const [stmtUploadStartDate, setStmtUploadStartDate] = useState(getFormattedDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [stmtUploadEndDate, setStmtUploadEndDate] = useState(getFormattedDate(new Date(Date.now() - 86400000)));

  const fetchReps = async (p = 1, searchTerm = search) => {
    try {
      setLoading(true);
      // console.log('Fetching reps with search:', searchTerm);
      // console.log('Current search state:', search);
      // console.log('Search term passed:', searchTerm);
      const res = await representativesAPI.getAll({ search: searchTerm, page: p, limit: 50 });
      // console.log('Reps response:', res.data);
      setReps(res.data.data || []);
      setPage(res.data.page);
      setTotalPages(res.data.totalPages);
      setTotalCount(res.data.totalCount);
    } catch (error) {
      console.error('Fetch representatives error:', error);
      toast.error('Failed to load representatives');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'reps') {
      fetchReps(1, searchQuery);
    }
  }, [searchQuery, subTab]); // eslint-disable-line

  // S&S Statement state
  const [stmtSearch, setStmtSearch] = useState('');
  const [stmtSearchQuery, setStmtSearchQuery] = useState('');

  // Debounce S&S Statement search
  useEffect(() => {
    const handler = setTimeout(() => {
      setStmtSearchQuery(stmtSearch);
    }, 450);
    return () => clearTimeout(handler);
  }, [stmtSearch]);

  const [stmtPage, setStmtPage] = useState(1);
  const [stmtTotalPages, setStmtTotalPages] = useState(1);
  const [stmtTotalCount, setStmtTotalCount] = useState(0);
  const [stmtData, setStmtData] = useState([]);
  const [stmtLoading, setStmtLoading] = useState(false);
  const [stmtUploading, setStmtUploading] = useState(false);
  const [stmtSelectedMfac, setStmtSelectedMfac] = useState('');
  const [stmtManufacturers, setStmtManufacturers] = useState([]);
  const [stmtMfacSearch, setStmtMfacSearch] = useState('');
  const [showStmtMfacDropdown, setShowStmtMfacDropdown] = useState(false);
  const stmtMfacDropdownRef = useRef(null);
  const [stmtPeriods, setStmtPeriods] = useState([]);
  const [stmtSelectedPeriod, setStmtSelectedPeriod] = useState(''); // 'Month|Year|isHistorical'
  const [stmtReportStartDate, setStmtReportStartDate] = useState('');
  const [stmtReportEndDate, setStmtReportEndDate] = useState('');

  // S&S Archive States
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveSelectedPeriod, setArchiveSelectedPeriod] = useState(''); // 'Month|Year'
  const [isArchiving, setIsArchiving] = useState(false);

  // Close stmt mfac dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (stmtMfacDropdownRef.current && !stmtMfacDropdownRef.current.contains(event.target)) {
        setShowStmtMfacDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch available S&S periods on subTab switch
  useEffect(() => {
    if (subTab === 'statement') {
      representativesAPI.getStatementPeriods().then(res => {
        const periods = res.data.periods || [];
        setStmtPeriods(periods);
        if (periods.length > 0) {
          // Default to current month
          const now = new Date();
          const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
          const curMonth = monthNames[now.getMonth()];
          const curYear = String(now.getFullYear());
          const matchCurrent = periods.find(p => p.reportMonth === curMonth && p.reportYear === curYear);
          const defaultP = matchCurrent || periods[0];
          setStmtSelectedPeriod(`${defaultP.reportMonth}|${defaultP.reportYear}|${defaultP.isHistorical}`);
        }
      }).catch(() => {});
    }
  }, [subTab]); // eslint-disable-line

  const getStmtPeriodParams = () => {
    if (!stmtSelectedPeriod) return {};
    const [month, year, isHist] = stmtSelectedPeriod.split('|');
    return { reportMonth: month, reportYear: year, isHistorical: isHist };
  };

  const fetchStmtData = async (p = 1) => {
    try {
      setStmtLoading(true);
      const res = await representativesAPI.getStatement({
        search: stmtSearchQuery,
        page: p,
        limit: 50,
        mfacCodeFilter: stmtSelectedMfac,
        ...getStmtPeriodParams()
      });
      setStmtData(res.data.data || []);
      setStmtPage(res.data.page);
      setStmtTotalPages(res.data.totalPages);
      setStmtTotalCount(res.data.totalCount);
      setStmtReportStartDate(res.data.reportStartDate || '');
      setStmtReportEndDate(res.data.reportEndDate || '');
      if (res.data.manufacturers) {
        setStmtManufacturers(res.data.manufacturers || []);
      }
    } catch (error) {
      console.error('Fetch statement error:', error);
      toast.error('Failed to load statement records');
    } finally {
      setStmtLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'statement') {
      fetchStmtData(1);
    }
  }, [stmtSearchQuery, stmtSelectedMfac, stmtSelectedPeriod, subTab]); // eslint-disable-line

  const [isOldStmtUpload, setIsOldStmtUpload] = useState(false);


  const handleStmtUpload = (e, isOld = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStmtUploadFile(file);
    setIsOldStmtUpload(isOld);
    setShowStmtUploadModal(true);
    e.target.value = '';
  };

  const executeStmtUpload = async () => {
    if (!stmtUploadFile) return;
    let processingInterval = null;
    let pollInterval = null;
    try {
      setStmtUploading(true);
      setUploadProgress(0);
      toast.info(isOldStmtUpload ? 'Uploading Old/Historical S&S Statement...' : 'Uploading S&S Statement...');
      const formData = new FormData();
      formData.append('file', stmtUploadFile);
      formData.append('reportMonth', stmtUploadMonth);
      formData.append('reportYear', stmtUploadYear);

      if (isOldStmtUpload) {
        const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthIndex = monthOrder.indexOf(stmtUploadMonth);
        const year = parseInt(stmtUploadYear);
        const lastDay = new Date(year, monthIndex + 1, 0);
        const startDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
        formData.append('reportStartDate', startDate);
        formData.append('reportEndDate', endDate);
      } else {
        formData.append('reportStartDate', stmtUploadStartDate);
        formData.append('reportEndDate', stmtUploadEndDate);
      }

      const config = {
        onUploadProgress: (progressEvent) => {
          // HTTP file transfer = 0% to 40%
          const httpPercent = Math.round((progressEvent.loaded / progressEvent.total) * 40);
          setUploadProgress(httpPercent);
        }
      };

      // Step 1: Send file — server responds immediately with jobId
      const res = isOldStmtUpload
        ? await representativesAPI.uploadOldStatement(formData, config)
        : await representativesAPI.uploadStatement(formData, config);

      // If old upload (no background job), handle directly
      if (!res.data.jobId) {
        if (processingInterval) clearInterval(processingInterval);
        setUploadProgress(null);
        toast.success(res.data.message || 'Statement uploaded successfully');
        fetchStmtData(1);
        setShowStmtUploadModal(false);
        setStmtUploadFile(null);
        setStmtUploading(false);
        return;
      }

      // Step 2: Got jobId — server is processing in background
      const { jobId, totalRecords } = res.data;
      setUploadProgress(45);
      toast.info(`File received (${totalRecords.toLocaleString()} records). Processing in background...`);

      // Step 3: Poll status every 3 seconds
      await new Promise((resolve, reject) => {
        let dots = 0;
        let currentProgress = 45;
        pollInterval = setInterval(async () => {
          try {
            const statusRes = await representativesAPI.getUploadStatus(jobId);
            const job = statusRes.data;

            if (job.status === 'processing') {
              // Animate progress 45% → 95% based on inserted count
              if (job.inserted && job.totalRecords) {
                const dbProgress = Math.round(45 + (job.inserted / job.totalRecords) * 50);
                currentProgress = Math.max(currentProgress, dbProgress);
              } else {
                currentProgress = Math.min(currentProgress + 2, 95);
              }
              setUploadProgress(currentProgress);
              dots = (dots + 1) % 4;
            } else if (job.status === 'done') {
              clearInterval(pollInterval);
              setUploadProgress(100);
              resolve(job);
            } else if (job.status === 'error' || job.status === 'not_found') {
              clearInterval(pollInterval);
              reject(new Error(job.message || 'Upload failed'));
            }
          } catch (pollErr) {
            // Network hiccup — keep polling, don't stop
            console.warn('Poll error (retrying):', pollErr.message);
          }
        }, 3000);
      });

      // Step 4: Success
      setUploadProgress(null);
      toast.success(`S&S Statement for ${stmtUploadMonth} ${stmtUploadYear} uploaded successfully!`);
      fetchStmtData(1);
      setShowStmtUploadModal(false);
      setStmtUploadFile(null);
    } catch (error) {
      if (processingInterval) clearInterval(processingInterval);
      if (pollInterval) clearInterval(pollInterval);
      toast.error(error.response?.data?.message || error.message || 'Failed to upload statement file');
    } finally {
      setStmtUploading(false);
      setUploadProgress(null);
    }
  };

  const executeArchive = async () => {
    if (!archiveSelectedPeriod) {
      toast.error('Please select a period to archive');
      return;
    }
    const [month, year] = archiveSelectedPeriod.split('|');
    try {
      setIsArchiving(true);
      toast.info(`Archiving current data for ${month} ${year}...`);
      const res = await representativesAPI.archiveCurrentStatement({ reportMonth: month, reportYear: year });
      toast.success(res.data?.message || `Archived ${month} ${year} successfully`);
      
      // Refresh periods for both S&S and Customer Wise
      const stmtRes = await representativesAPI.getStatementPeriods();
      const sPeriods = stmtRes.data.periods || [];
      setStmtPeriods(sPeriods);
      if (sPeriods.length > 0) {
        const currentSelectedStillExists = sPeriods.some(p => `${p.reportMonth}|${p.reportYear}|${p.isHistorical}` === stmtSelectedPeriod);
        if (!currentSelectedStillExists) {
          const firstP = sPeriods[0];
          setStmtSelectedPeriod(`${firstP.reportMonth}|${firstP.reportYear}|${firstP.isHistorical}`);
        }
      } else {
        setStmtSelectedPeriod('');
      }

      const cwRes = await representativesAPI.getCWPeriods();
      const cPeriods = cwRes.data.periods || [];
      setCwPeriods(cPeriods);
      if (cPeriods.length > 0) {
        const currentCwSelectedStillExists = cPeriods.some(p => `${p.reportMonth}|${p.reportYear}|${p.isHistorical}` === cwSelectedPeriod);
        if (!currentCwSelectedStillExists) {
          const firstP = cPeriods[0];
          setCwSelectedPeriod(`${firstP.reportMonth}|${firstP.reportYear}|${firstP.isHistorical}`);
        }
      } else {
        setCwSelectedPeriod('');
      }

      // Refresh data
      fetchStmtData(1);
      setShowArchiveModal(false);
      setArchiveSelectedPeriod('');
    } catch (error) {
      console.error('Failed to archive period:', error);
      toast.error(error.response?.data?.message || 'Failed to archive period');
    } finally {
      setIsArchiving(false);
    }
  };

  // --- S&S Summary State & Handlers for Admin ---
  const [summaryData, setSummaryData] = useState([]);
  const [summarySearch, setSummarySearch] = useState('');
  const [summarySearchQuery, setSummarySearchQuery] = useState('');
  const [summaryPage, setSummaryPage] = useState(1);
  const [summaryTotalPages, setSummaryTotalPages] = useState(1);
  const [summaryTotalCount, setSummaryTotalCount] = useState(0);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryDownloading, setSummaryDownloading] = useState(false);
  const [summarySelectedMfac, setSummarySelectedMfac] = useState('');
  const [summaryMfacSearch, setSummaryMfacSearch] = useState('');
  const [showSummaryMfacDropdown, setShowSummaryMfacDropdown] = useState(false);
  const [summarySelectedPeriod, setSummarySelectedPeriod] = useState('');
  const summaryMfacDropdownRef = useRef(null);

  // Debounce S&S Summary search
  useEffect(() => {
    const handler = setTimeout(() => {
      setSummarySearchQuery(summarySearch);
    }, 450);
    return () => clearTimeout(handler);
  }, [summarySearch]);

  // Click outside listener for Summary Mfac Dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (summaryMfacDropdownRef.current && !summaryMfacDropdownRef.current.contains(event.target)) {
        setShowSummaryMfacDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync summary period with statement periods
  useEffect(() => {
    if (stmtPeriods.length > 0 && !summarySelectedPeriod) {
      const p = stmtPeriods[0];
      setSummarySelectedPeriod(`${p.reportMonth}|${p.reportYear}|${p.isHistorical}`);
    }
  }, [stmtPeriods, summarySelectedPeriod]);

  const getSummaryPeriodParams = () => {
    const targetPeriod = summarySelectedPeriod || stmtSelectedPeriod;
    if (!targetPeriod) return {};
    const [month, year, isHist] = targetPeriod.split('|');
    return { reportMonth: month, reportYear: year, isHistorical: isHist };
  };

  const fetchSummaryData = async (p = 1) => {
    try {
      setSummaryLoading(true);
      const res = await representativesAPI.getStatement({
        search: summarySearchQuery,
        page: p,
        limit: 50,
        mfacCodeFilter: summarySelectedMfac,
        ...getSummaryPeriodParams()
      });
      setSummaryData(res.data.data || []);
      setSummaryPage(res.data.page);
      setSummaryTotalPages(res.data.totalPages);
      setSummaryTotalCount(res.data.totalCount);
      if (res.data.manufacturers && res.data.manufacturers.length > 0) {
        setStmtManufacturers(res.data.manufacturers);
      }
    } catch (error) {
      console.error('Fetch summary error:', error);
      toast.error('Failed to load S&S summary records');
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'summary') {
      fetchSummaryData(1);
    }
  }, [summarySearchQuery, summarySelectedMfac, summarySelectedPeriod, subTab]); // eslint-disable-line

  // Excess Qty calculation helper: Bal Qty - (Current Month Sale + PM1 Sale + PM2 Sale)
  const calcAdminExcessQty = (item) => {
    const currSaleQ = (Number(item.saleQty) || 0) + (Number(item.freeQty) || 0) + (Number(item.brQty) || 0) - (Number(item.crQty) || 0) + (Number(item.adjQty) || 0);
    const rate = Number(item.saleRate) || 0;
    const pm1Q = rate > 0 ? Math.round((Number(item.preMon1SaleValue) || 0) / rate) : 0;
    const pm2Q = rate > 0 ? Math.round((Number(item.preMon2SaleValue) || 0) / rate) : 0;
    const total3MonSales = currSaleQ + pm1Q + pm2Q;
    const diff = (Number(item.balQty) || 0) - total3MonSales;
    return diff > 0 ? diff : 0;
  };

  const handleDownloadAdminSummaryExcel = async () => {
    try {
      setSummaryDownloading(true);
      toast.info('Fetching S&S summary data for export...');
      const params = {
        mfacCodeFilter: summarySelectedMfac,
        ...getSummaryPeriodParams()
      };

      const res = await representativesAPI.getStatementAll(params);
      const allData = res.data.data || [];
      if (allData.length === 0) {
        toast.warn('No S&S summary data available for this company/period');
        return;
      }

      const today = new Date();
      const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const [month, year] = (summarySelectedPeriod || stmtSelectedPeriod || '').split('|');
      const mfacLabel = stmtManufacturers.find(m => m.code === summarySelectedMfac)?.name || 'All Companies';

      const headerRows = [
        [' Tara Medicos Pvt Ltd, Jaipur'],
        [`Date: ${dateStr} `],
        [`Stock and Sales Summary: ${month || ''} ${year || ''}`],
        [mfacLabel ? `Company: ${mfacLabel}` : ''],
        [],
        ['Item Name', 'Pack', 'Op Qty', 'Pur Qty', 'Total Qty', 'Sale Qty', 'Bal Qty', 'Company / Manufacturer']
      ];

      const dataRows = allData.map(item => {
        return [
          item.itemName || '',
          item.pack || '',
          Number(item.opBalance) || 0,
          Number(item.purQty || 0) + Number(item.purSchQty || 0),
          Number(item.opBalance || 0) + Number(item.purQty || 0) + Number(item.purSchQty || 0),
          Number(item.saleQty || 0) + Number(item.freeQty || 0) + Number(item.brQty || 0) - Number(item.crQty || 0) + Number(item.adjQty || 0),
          Number(item.balQty) || 0,
          item.mfacName || item.mfacCode || ''
        ];
      });

      const totalOpQty = allData.reduce((sum, item) => sum + (Number(item.opBalance) || 0), 0);
      const totalOpValue = allData.reduce((sum, item) => sum + (Number(item.opValue) || 0), 0);
      const totalPurQty = allData.reduce((sum, item) => sum + (Number(item.purQty) || 0) + (Number(item.purSchQty) || 0), 0);
      const totalPurValue = allData.reduce((sum, item) => sum + (Number(item.purValue) || 0), 0);
      const totalTotalQty = totalOpQty + totalPurQty;
      const totalSaleQty = allData.reduce((sum, item) => sum + (Number(item.saleQty) || 0) + (Number(item.freeQty) || 0) + (Number(item.brQty) || 0) - (Number(item.crQty) || 0) + (Number(item.adjQty) || 0), 0);
      const totalSaleValue = allData.reduce((sum, item) => sum + (Number(item.saleValue) || 0) + (Number(item.brValue) || 0) - (Number(item.crValue) || 0) + (Number(item.adjValue) || 0), 0);
      const totalBalQty = allData.reduce((sum, item) => sum + (Number(item.balQty) || 0), 0);
      const totalBalValue = allData.reduce((sum, item) => sum + (Number(item.balValue) || 0), 0);

      const totalRow = ['Total', '', totalOpQty, totalPurQty, totalTotalQty, totalSaleQty, totalBalQty, ''];
      const valueRow = ['(values)', '', totalOpValue.toFixed(2), totalPurValue.toFixed(2), (totalOpValue + totalPurValue).toFixed(2), totalSaleValue.toFixed(2), totalBalValue.toFixed(2), ''];

      const allRows = [...headerRows, ...dataRows, totalRow, valueRow];
      const ws = XLSX.utils.aoa_to_sheet(allRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'SS_Summary');
      const fileName = `SS_Summary_${mfacLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${month || 'All'}_${year || new Date().getFullYear()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('S&S Summary exported successfully');
    } catch (error) {
      console.error('Failed to export S&S Summary Excel:', error);
      toast.error('Failed to export S&S Summary Excel');
    } finally {
      setSummaryDownloading(false);
    }
  };

  const handleDownloadAdminSummaryPdf = async () => {
    try {
      setSummaryDownloading(true);
      toast.info('Generating S&S Summary PDF...');
      const params = {
        mfacCodeFilter: summarySelectedMfac,
        ...getSummaryPeriodParams()
      };

      const res = await representativesAPI.getStatementAll(params);
      const allData = res.data.data || [];
      if (allData.length === 0) {
        toast.warn('No S&S summary data available to download');
        return;
      }

      const img = await loadImage('/a.png');
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const [month, year] = (summarySelectedPeriod || stmtSelectedPeriod || '').split('|');
      const mfacLabel = stmtManufacturers.find(m => m.code === summarySelectedMfac)?.name || 'All Companies';

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const totalPagesExp = '{total_pages_count_string}';
      const logoWidth = 15;
      const logoHeight = img ? (img.height / img.width) * logoWidth : 0;
      if (img) {
        doc.addImage(img, 'PNG', 14, 10, logoWidth, logoHeight);
      }
      const textX = img ? 14 + logoWidth + 4 : 14;

      doc.setFontSize(13); doc.setFont('helvetica', 'bold');
      doc.text('Tara Medicos Pvt Ltd, Jaipur', textX, 15);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${dateStr}`, textX, 20);
      doc.text(`Stock and Sales Summary: ${month || ''} ${year || ''}`, textX, 25);
      doc.text(`Company: ${mfacLabel}`, textX, 30);

      const totalOpQty = allData.reduce((s, i) => s + (i.opBalance || 0), 0);
      const totalOpValue = allData.reduce((s, i) => s + (i.opValue || 0), 0);
      const totalPurQty = allData.reduce((s, i) => s + (i.purQty || 0) + (i.purSchQty || 0), 0);
      const totalPurValue = allData.reduce((s, i) => s + (i.purValue || 0), 0);
      const totalTotalQty = totalOpQty + totalPurQty;
      const totalSaleQty = allData.reduce((s, i) => s + (i.saleQty || 0) + (i.freeQty || 0) + (i.brQty || 0) - (i.crQty || 0) + (i.adjQty || 0), 0);
      const totalSaleValue = allData.reduce((s, i) => s + (i.saleValue || 0) + (i.brValue || 0) - (i.crValue || 0) + (i.adjValue || 0), 0);
      const totalBalQty = allData.reduce((s, i) => s + (i.balQty || 0), 0);

      autoTable(doc, {
        startY: 37,
        head: [['Item Name', 'Pack', 'Op Qty', 'Pur Qty', 'Total Qty', 'Sale Qty', 'Bal. Qty']],
        body: [
          ...allData.map(item => {
            const purQ = (item.purQty || 0) + (item.purSchQty || 0);
            const saleQ = (item.saleQty || 0) + (item.freeQty || 0) + (item.brQty || 0) - (item.crQty || 0) + (item.adjQty || 0);
            return [
              item.itemName || '',
              item.pack || '',
              item.opBalance || 0,
              purQ,
              (item.opBalance || 0) + purQ,
              saleQ,
              item.balQty || 0
            ];
          }),
          ['Total (Qty)', '', totalOpQty, totalPurQty, totalTotalQty, totalSaleQty, totalBalQty],
          ['Total (Val)', '', totalOpValue.toFixed(2), totalPurValue.toFixed(2), (totalOpValue + totalPurValue).toFixed(2), totalSaleValue.toFixed(2), allData.reduce((s,i)=>s+(i.balValue||0),0).toFixed(2)]
        ],
        styles: { fontSize: 8.5, cellPadding: 2.5, valign: 'middle' },
        margin: { top: 35, bottom: 20, left: 14, right: 14 },
        headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold' },
        foot: [],
        didParseCell: (data) => {
          if (data.column.index >= 2) {
            data.cell.styles.halign = 'right';
          } else {
            data.cell.styles.halign = 'left';
          }
          if (data.row.index === allData.length) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 240, 255];
          }
          if (data.row.index === allData.length + 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [230, 245, 255];
            data.cell.styles.textColor = [30, 100, 200];
          }
        },
        columnStyles: { 
          0: { cellWidth: 'auto' }, 
          1: { cellWidth: 22, overflow: 'visible' },
          2: { cellWidth: 16 },
          3: { cellWidth: 16 },
          4: { cellWidth: 16 },
          5: { cellWidth: 16 },
          6: { cellWidth: 16 },
          7: { cellWidth: 18 }
        },
        didDrawPage: (data) => {
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text(
            `Page ${data.pageNumber} of ` + totalPagesExp,
            doc.internal.pageSize.width - 20,
            doc.internal.pageSize.height - 10
          );
        }
      });

      if (typeof doc.putTotalPages === 'function') {
        doc.putTotalPages(totalPagesExp);
      }

      const divLabel = mfacLabel || 'SS_Summary';
      doc.save(`S&S_Summary_${divLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr.replace(/\//g, '-')}.pdf`);
      toast.success('S&S Summary PDF downloaded successfully');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setSummaryDownloading(false);
    }
  };

  const [cwData, setCwData] = useState([]);
  const [cwSearch, setCwSearch] = useState('');
  const [cwSearchQuery, setCwSearchQuery] = useState('');

  // Debounce Customer Wise search
  useEffect(() => {
    const handler = setTimeout(() => {
      setCwSearchQuery(cwSearch);
    }, 450);
    return () => clearTimeout(handler);
  }, [cwSearch]);
  const [cwPage, setCwPage] = useState(1);
  const [cwTotalPages, setCwTotalPages] = useState(1);
  const [cwTotalCount, setCwTotalCount] = useState(0);
  const [cwLoading, setCwLoading] = useState(false);
  const [cwUploading, setCwUploading] = useState(false);
  const [cwUploadProgress, setCwUploadProgress] = useState(0);
  const [cwUploadStatus, setCwUploadStatus] = useState('');
  const [cwSelectedMfac, setCwSelectedMfac] = useState('');
  const [cwMfacSearch, setCwMfacSearch] = useState('');
  const [showMfacDropdown, setShowMfacDropdown] = useState(false);
  const mfacDropdownRef = useRef(null);
  const [cwManufacturers, setCwManufacturers] = useState([]);
  const [cwPeriods, setCwPeriods] = useState([]);
  const [cwSelectedPeriod, setCwSelectedPeriod] = useState('');

  // Close company dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (mfacDropdownRef.current && !mfacDropdownRef.current.contains(event.target)) {
        setShowMfacDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch available CW periods on subTab switch
  useEffect(() => {
    if (subTab === 'customerwise') {
      representativesAPI.getCWPeriods().then(res => {
        const periods = res.data.periods || [];
        setCwPeriods(periods);
        if (periods.length > 0) {
          const p = periods[0];
          setCwSelectedPeriod(`${p.reportMonth}|${p.reportYear}|${p.isHistorical}`);
        }
      }).catch(() => {});
    }
  }, [subTab]); // eslint-disable-line

  const getCwPeriodParams = () => {
    if (!cwSelectedPeriod) return {};
    const [month, year, isHist] = cwSelectedPeriod.split('|');
    return { reportMonth: month, reportYear: year, isHistorical: isHist };
  };

  const fetchCwData = async (p = 1) => {
    try {
      setCwLoading(true);
      const res = await representativesAPI.getCustomerWise({
        search: cwSearchQuery,
        page: p,
        limit: 50,
        mfacCodeFilter: cwSelectedMfac,
        ...getCwPeriodParams()
      });
      setCwData(res.data.data || []);
      setCwPage(res.data.page);
      setCwTotalPages(res.data.totalPages);
      setCwTotalCount(res.data.totalCount);
      if (res.data.manufacturers) {
        setCwManufacturers(res.data.manufacturers || []);
      }
    } catch (error) {
      console.error('Fetch customer wise error:', error);
      toast.error('Failed to load customer wise records');
    } finally {
      setCwLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'customerwise') {
      fetchCwData(1);
    }
  }, [cwSearchQuery, cwSelectedMfac, cwSelectedPeriod, subTab]); // eslint-disable-line

  const handleCwUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCwUploadFile(file);
    setShowCwUploadModal(true);
    e.target.value = '';
  };

  const handleDownloadCwExcel = async () => {
    try {
      toast.info('Fetching customer wise data for export...');
      const params = {
        mfacCodeFilter: cwSelectedMfac,
        ...getCwPeriodParams(),
        downloadType: 'cw_excel'
      };
      
      const res = await representativesAPI.getCustomerWiseAll(params);
      const allData = res.data.data || [];
      if (allData.length === 0) {
        toast.warn('No customer wise data available for this company/period');
        return;
      }

      const today = new Date();
      const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      
      const [month, year] = (cwSelectedPeriod || '').split('|');
      const companyName = res.data.companyName || res.data.divisionName || cwManufacturers.find(m => m.code === cwSelectedMfac)?.name || 'All Companies';
      
      const headerRows = [
        [' Tara Medicos Pvt Ltd, Jaipur'],
        [` Date: ${dateStr}  `],
        [`Customer Wise Sales: ${month || ''} ${year || ''}`],
        [`Company: ${companyName} (${cwSelectedMfac || 'All'})`],
        [],
        [
          'Mfac Code', 'Company Division', 'Item Code', 'Item Name', 'Pack Size',
          'Qty', 'Scheme Qty', 'Sale Rate', 'Amount', 'Discount',
          'Customer Code', 'Customer Name', 'Address', 'City', 'PIN',
          'Mobile', 'Email', 'GST', 'Route', 'Dman', 'Area'
        ]
      ];

      const dataRows = allData.map(item => [
        item.mfacCode || '',
        item.companyDivision || '',
        item.itemCode || '',
        item.itemName || '',
        item.packName || '',
        Number(item.qty) || 0,
        Number(item.schemeQty) || 0,
        Number(item.saleRate) || 0,
        Number(item.amount || (item.qty || 0) * (item.saleRate || 0)) || 0,
        Number(item.discount) || 0,
        item.customerCode || '',
        item.customerName || '',
        item.customerAddress || '',
        item.customerCity || '',
        item.customerPin || '',
        item.customerMobile || '',
        item.customerEmail || '',
        item.gst || '',
        item.routeName || '',
        item.dmanName || '',
        item.areaName || ''
      ]);

      const totalQty = allData.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
      const totalSchemeQty = allData.reduce((sum, item) => sum + (Number(item.schemeQty) || 0), 0);
      const totalAmount = allData.reduce((sum, item) => sum + (Number(item.amount || (item.qty || 0) * (item.saleRate || 0)) || 0), 0);
      const totalDiscount = allData.reduce((sum, item) => sum + (Number(item.discount) || 0), 0);

      const totalRow = [
        'Total', '', '', '', '',
        totalQty,
        totalSchemeQty,
        '',
        { v: totalAmount, t: 'n', z: '0.00' },
        { v: totalDiscount, t: 'n', z: '0.00' },
        '', '', '', '', '', '', '', '', '', '', ''
      ];

      const allRows = [...headerRows, ...dataRows, totalRow];
      const ws = XLSX.utils.aoa_to_sheet(allRows);

      ws['!cols'] = [
        { wch: 10 }, { wch: 25 }, { wch: 12 }, { wch: 30 }, { wch: 10 },
        { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
        { wch: 15 }, { wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 10 },
        { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
      ];

      const wb = XLSX.utils.book_new();
      const sheetName = (cwSelectedMfac || 'CW_Report').substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      
      const fileName = `Customer_Wise_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${month}_${year}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Customer Wise Report exported successfully');
    } catch (error) {
      console.error('Failed to export Customer Wise Excel:', error);
      toast.error('Failed to export customer wise data to Excel');
    }
  };

  // S&S Statement Export to Excel (Matches Representative Dashboard S&S Format)
  const handleDownloadStmtExcel = async () => {
    try {
      toast.info('Fetching S&S statement data for export...');
      const periodParams = getStmtPeriodParams();
      const params = {
        mfacCodeFilter: stmtSelectedMfac,
        ...periodParams
      };

      const res = await representativesAPI.getStatementAll(params);
      const allData = res.data.data || [];
      if (allData.length === 0) {
        toast.warn('No S&S statement data available for this company/period');
        return;
      }

      const today = new Date();
      const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

      const [month, year] = (stmtSelectedPeriod || '').split('|');
      const mfacLabel = stmtManufacturers.find(m => m.code === stmtSelectedMfac)?.name || 'All Companies';

      let reportPeriodStr = '';
      if (month || year) {
        reportPeriodStr = `Stock and Sales From: ${month || ''} ${year || ''}`;
      }

      const headerRows = [
        ['Tara Medicos Pvt Ltd, Jaipur'],
        [`Date: ${dateStr} `],
        [reportPeriodStr],
        [mfacLabel ? `Company: ${mfacLabel}` : ''],
        [],
        ['Item Name', 'Pack', 'Op. Bal', 'Op. Value', 'Pur Qty', 'Pur Value', 'Pur Sch. Qty', 'Sale Qty', 'Sale Value', 'Free Qty', 'Br. Qty', 'Br. Value', 'CR Qty', 'CR Value', 'DB Qty', 'DB Value', 'Adj. Qty', 'Adj. Value', 'Closing Qty', 'Closing Value']
      ];

      // Helper: format value columns to 2 decimal places; 0 shows as 0
      const formatDetailedVal = (val) => {
        const num = Number(val);
        if (isNaN(num)) return val || 0;
        return { v: num, t: 'n', z: '0.00;-0.00;0' };
      };

      const dataRows = allData.map(item => [
        item.itemName || '',
        item.pack || '',
        Number(item.opBalance) || 0,
        formatDetailedVal(item.opValue),
        Number(item.purQty) || 0,
        formatDetailedVal(item.purValue),
        Number(item.purSchQty) || 0,
        Number(item.saleQty) || 0,
        formatDetailedVal(item.saleValue),
        Number(item.freeQty) || 0,
        Number(item.brQty) || 0,
        formatDetailedVal(item.brValue),
        Number(item.crQty) || 0,
        formatDetailedVal(item.crValue),
        Number(item.dbQty) || 0,
        formatDetailedVal(item.dbValue),
        Number(item.adjQty) || 0,
        formatDetailedVal(item.adjValue),
        Number(item.balQty) || 0,
        formatDetailedVal(item.balValue)
      ]);

      const totalOpQty = allData.reduce((sum, item) => sum + (Number(item.opBalance) || 0), 0);
      const totalPurQty = allData.reduce((sum, item) => sum + (Number(item.purQty) || 0), 0);
      const totalPurSchQty = allData.reduce((sum, item) => sum + (Number(item.purSchQty) || 0), 0);
      const totalSaleQty = allData.reduce((sum, item) => sum + (Number(item.saleQty) || 0), 0);
      const totalFreeQty = allData.reduce((sum, item) => sum + (Number(item.freeQty) || 0), 0);
      const totalBrQty = allData.reduce((sum, item) => sum + (Number(item.brQty) || 0), 0);
      const totalCrQty = allData.reduce((sum, item) => sum + (Number(item.crQty) || 0), 0);
      const totalDbQty = allData.reduce((sum, item) => sum + (Number(item.dbQty) || 0), 0);
      const totalAdjQty = allData.reduce((sum, item) => sum + (Number(item.adjQty) || 0), 0);
      const totalBalQty = allData.reduce((sum, item) => sum + (Number(item.balQty) || 0), 0);

      // Value totals
      const totalSaleValue = allData.reduce((sum, item) => sum + (Number(item.saleValue) || 0), 0);
      const totalBrValue = allData.reduce((sum, item) => sum + (Number(item.brValue) || 0), 0);
      const totalCrValue = allData.reduce((sum, item) => sum + (Number(item.crValue) || 0), 0);
      const totalDbValue = allData.reduce((sum, item) => sum + (Number(item.dbValue) || 0), 0);
      const totalAdjValue = allData.reduce((sum, item) => sum + (Number(item.adjValue) || 0), 0);
      const totalBalValue = allData.reduce((sum, item) => sum + (Number(item.balValue) || 0), 0);

      const totalRow = [
        'Total',
        '',
        totalOpQty,
        formatDetailedVal(allData.reduce((s, i) => s + (Number(i.opValue) || 0), 0)),
        totalPurQty,
        formatDetailedVal(allData.reduce((s, i) => s + (Number(i.purValue) || 0), 0)),
        totalPurSchQty,
        totalSaleQty,
        formatDetailedVal(totalSaleValue),
        totalFreeQty,
        totalBrQty,
        formatDetailedVal(totalBrValue),
        totalCrQty,
        formatDetailedVal(totalCrValue),
        totalDbQty,
        formatDetailedVal(totalDbValue),
        totalAdjQty,
        formatDetailedVal(totalAdjValue),
        totalBalQty,
        formatDetailedVal(totalBalValue)
      ];

      const allRows = [...headerRows, ...dataRows, totalRow];
      const ws = XLSX.utils.aoa_to_sheet(allRows);

      ws['!cols'] = [
        { wch: 30 }, { wch: 10 },
        { wch: 10 }, { wch: 12 },
        { wch: 10 }, { wch: 12 }, { wch: 12 },
        { wch: 10 }, { wch: 12 }, { wch: 10 },
        { wch: 8 }, { wch: 12 },
        { wch: 8 }, { wch: 12 },
        { wch: 8 }, { wch: 12 },
        { wch: 8 }, { wch: 12 },
        { wch: 12 }, { wch: 14 }
      ];

      const wb = XLSX.utils.book_new();
      const sheetName = (stmtSelectedMfac || 'SS_Statement').substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const fileName = `SS_Statement_${mfacLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${month || 'All'}_${year || new Date().getFullYear()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('S&S Statement exported successfully');
    } catch (error) {
      console.error('Failed to export S&S Statement Excel:', error);
      toast.error('Failed to export S&S statement data to Excel');
    }
  };

  const handleOldCwUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOldCwFile(file);
    setShowOldCwModal(true);
    e.target.value = '';
  };

  const executeOldCwUpload = async () => {
    if (!oldCwFile) return;
    try {
      setOldCwUploading(true);
      setUploadProgress(0);
      const formData = new FormData();
      formData.append('file', oldCwFile);
      formData.append('reportMonth', oldCwMonth);
      formData.append('reportYear', oldCwYear);
      
      const config = {
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        }
      };

      const res = await representativesAPI.uploadOldCustomerWise(formData, config);
      toast.success(res.data.message || `Uploaded ${res.data.totalRecords} records for ${oldCwMonth} ${oldCwYear}`);
      setShowOldCwModal(false);
      setOldCwFile(null);
      fetchCwData(1);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to upload old Customer Wise data');
    } finally {
      setOldCwUploading(false);
      setUploadProgress(null);
    }
  };

  const executeCwUpload = async () => {
    if (!cwUploadFile) return;
    try {
      setCwUploading(true);
      toast.info('Reading Excel file in browser...');

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

          if (rows.length < 3) {
            toast.error('Excel sheet is empty or invalid');
            setCwUploading(false);
            return;
          }

          toast.info('Parsing customer-wise data...');
          const toNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
          const toStr = (v) => (v === undefined || v === null ? '' : String(v).trim());

          const records = [];
          let isNewFormat = false;
          let headerRowIndex = -1;

          for (let r = 0; r < Math.min(3, rows.length); r++) {
            const row = rows[r] || [];
            const rowLower = row.map(v => String(v || '').trim().toLowerCase());
            if (rowLower.includes('cust_code') && rowLower.includes('item_code') && rowLower.includes('item_name')) {
              isNewFormat = true;
              headerRowIndex = r;
              break;
            }
          }

          if (isNewFormat && headerRowIndex !== -1) {
            const headers = rows[headerRowIndex] || [];
            const colIdx = {};
            headers.forEach((h, i) => {
              if (h) {
                const lower = String(h).trim().toLowerCase();
                colIdx[lower] = i;
                // Also store normalized (no spaces/underscores) for flexible lookup
                colIdx[lower.replace(/[\s_]+/g, '')] = i;
              }
            });

            const dataRows = rows.slice(headerRowIndex + 1);
            let seqNo = 0;

            const getVal = (row, headerName) => {
              const idx = colIdx[headerName];
              return idx !== undefined ? toStr(row[idx]) : '';
            };
            const getNumVal = (row, headerName) => {
              const idx = colIdx[headerName];
              return idx !== undefined ? toNum(row[idx]) : 0;
            };

            for (const row of dataRows) {
              const itemCode = getVal(row, 'item_code');
              const itemName = getVal(row, 'item_name');
              const custCode = getVal(row, 'cust_code');
              const custName = getVal(row, 'cust_name');

              if (!itemCode && !itemName && !custName) continue;

              // Use mfacCode from modal if Excel doesn't have it
              const getValMulti = (...names) => {
                for (const n of names) {
                  const v = getVal(row, n);
                  if (v) return v;
                }
                return '';
              };
              let mfacCode = getValMulti('mfac_code', 'mfaccode', 'comp_code', 'mfac code', 'division_code', 'manufacturer_code') || cwUploadMfacCode;
              if (/^\d+$/.test(mfacCode)) {
                mfacCode = mfacCode.padStart(3, '0');
              }

              // Combine add_1, add_2, add_3 into full address
              const add1 = getValMulti('add_1', 'add1', 'add 1', 'address1');
              const add2 = getValMulti('add_2', 'add2', 'add 2', 'address2');
              const add3 = getValMulti('add_3', 'add3', 'add 3', 'address3');
              const customerAddress = [add1, add2, add3].filter(a => a).join(', ');

              records.push({
                seqNo: seqNo++,
                itemCode,
                itemName,
                customerCode: custCode,
                customerName: custName,
                qty: getNumVal(row, 'n_qty'),
                schemeQty: getNumVal(row, 'n_scch_qty') || getNumVal(row, 'schqty'),
                saleRate: getNumVal(row, 'n_sale_rate'),
                amount: getNumVal(row, 'amount'),
                discount: getNumVal(row, 'discount'),
                mfacCode,
                companyDivision: getValMulti('mfac_name', 'mfacname', 'comp_name', 'mfac name', 'division', 'division_name', 'manufacturer_name') || cwUploadMfacName,
                packName: getVal(row, 'pack_name'),
                routeName: getVal(row, 'route_name'),
                dmanName: getVal(row, 'dman_name'),
                areaName: getVal(row, 'area_name'),
                // All customer info fields
                customerCity: getValMulti('c_city', 'ccity', 'city', 'cust_city'),
                customerPhone1: getValMulti('phone1', 'phone_no1', 'cust_phone1'),
                customerPhone2: getValMulti('phone2', 'phone_no2', 'cust_phone2'),
                customerMobile: getValMulti('c_mobile', 'cmobile', 'mobile', 'cust_mobile', 'mobile_no'),
                customerEmail: getValMulti('c_email_id', 'cemailid', 'email', 'customer_email'),
                customerPin: getValMulti('c_pin', 'cpin', 'pin', 'customer_pin'),
                gst: getValMulti('gst', 'c_permanent_gstn_no', 'cpermanentgstnno', 'gstn', 'gst_no'),
                customerAddress,
                reportMonth: cwUploadMonth,
                reportYear: cwUploadYear,
                isHistorical: false
              });
            }
          } else {
            const dataRows = rows.slice(1);
            let seqNo = 0;
            for (const row of dataRows) {
              const itemName = toStr(row[0]);
              const customerName = toStr(row[2]);
              if (!itemName && !customerName) continue;

              let mfacCode = toStr(row[10]) || cwUploadMfacCode;
              if (/^\d+$/.test(mfacCode)) mfacCode = mfacCode.padStart(3, '0');

              records.push({
                seqNo: seqNo++,
                itemName,
                itemCode: toStr(row[1]),
                customerName,
                customerCity: toStr(row[3]),
                customerPhone1: toStr(row[4]),
                customerPhone2: toStr(row[5]),
                customerMobile: toStr(row[6]),
                qty: toNum(row[7]),
                schemeQty: toNum(row[8]),
                companyDivision: toStr(row[9]) || cwUploadMfacName,
                mfacCode,
                saleRate: toNum(row[11]),
                customerAddress: toStr(row[12]),
                customerCode: toStr(row[13]),
                reportMonth: cwUploadMonth,
                reportYear: cwUploadYear,
                isHistorical: false
              });
            }
          }

          if (records.length === 0) {
            toast.error('No valid records found in the Excel file');
            setCwUploading(false);
            return;
          }

          setCwUploadStatus(`Uploading ${records.length} records...`);
          setCwUploadProgress(0);
          setUploadProgress(0);

          const totalChunks = Math.ceil(records.length / 1000);
          const chunkSize = 1000;
          for (let i = 0; i < records.length; i += chunkSize) {
            const chunk = records.slice(i, i + chunkSize);
            const isFirstChunk = (i === 0);
            const chunkIndex = Math.floor(i / chunkSize) + 1;
            const progress = Math.round((chunkIndex / totalChunks) * 100);

            setCwUploadProgress(progress);
            setCwUploadStatus(`Uploading chunk ${chunkIndex} of ${totalChunks}...`);

            await representativesAPI.uploadCustomerWiseChunk({
              records: chunk,
              isFirstChunk
            });
          }

          setCwUploadProgress(100);
          setCwUploadStatus('Upload complete!');
          toast.success(`Customer Wise Report uploaded successfully! Total: ${records.length} records`);
          fetchCwData(1);
          setShowCwUploadModal(false);
          setCwUploadFile(null);
          setTimeout(() => { setCwUploadProgress(0); setCwUploadStatus(''); }, 800);
        } catch (err) {
          console.error(err);
          toast.error(err.response?.data?.message || err.message || 'Failed to upload customer wise data chunks');
          setCwUploadProgress(0);
          setCwUploadStatus('');
        } finally {
          setCwUploading(false);
        }
      };
      reader.readAsArrayBuffer(cwUploadFile);
    } catch (error) {
      console.error(error);
      toast.error('Failed to read file');
      setCwUploading(false);
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      await representativesAPI.toggleStatus(id);
      toast.success('Representative status updated');
      fetchReps(page);
    } catch (error) {
      toast.error('Failed to update representative status');
    }
  };

  const handleRemoveRep = async (rep) => {
    setConfirmModal({
      title: 'Remove Representative',
      message: `Remove "${rep.name}" (${rep.customerCode}) from the representative list?\n\nThis will permanently delete this representative. They will appear back in the "Add Representative" dropdown.`,
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const res = await representativesAPI.deleteRep(rep._id);
          toast.success(res.data.message || 'Representative removed');
          fetchReps(page);
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to remove representative');
        }
      }
    });
  };

  const handleToggleCwPermission = async (id) => {
    try {
      const res = await representativesAPI.toggleCustomerWisePermission(id);
      toast.success(res.data.message || 'Permission updated');
      fetchReps(page);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update permission');
    }
  };

  const handleTogglePoPermission = async (id) => {
    try {
      const res = await representativesAPI.togglePoPermission(id);
      toast.success(res.data.message || 'PO Permission updated');
      fetchReps(page);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update PO permission');
    }
  };

  const handleToggleBranchSsPermission = async (id) => {
    try {
      const res = await representativesAPI.toggleBranchSsPermission(id);
      toast.success(res.data.message || 'Branch S&S Permission updated');
      fetchReps(page);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update Branch S&S permission');
    }
  };

  const handleToggleBranchCwPermission = async (id) => {
    try {
      const res = await representativesAPI.toggleBranchCwPermission(id);
      toast.success(res.data.message || 'Branch CW Permission updated');
      fetchReps(page);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update Branch CW permission');
    }
  };

  const fetchPoData = async (pageNum = 1) => {
    try {
      setPoLoading(true);
      const res = await representativesAPI.getPurchaseOrder({
        page: pageNum,
        limit: 50,
        search: poSearch
      });
      setPoData(res.data.data || []);
      setPoTotal(res.data.total || 0);
      setPoPage(res.data.page || 1);
      setPoTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error('Fetch Purchase Orders error:', err);
    } finally {
      setPoLoading(false);
    }
  };

  const handlePoUploadSubmit = async () => {
    if (!poUploadFile) {
      toast.warning('Please select an Excel file to upload');
      return;
    }
    const formData = new FormData();
    formData.append('file', poUploadFile);
    formData.append('orderType', poOrderType);

    let processingInterval = null;
    try {
      setPoUploading(true);
      setUploadProgress(0);

      const config = {
        onUploadProgress: (progressEvent) => {
          const httpPercent = Math.round((progressEvent.loaded / progressEvent.total) * 90);
          setUploadProgress(httpPercent);

          if (progressEvent.loaded >= progressEvent.total) {
            let serverProgress = 90;
            processingInterval = setInterval(() => {
              serverProgress = Math.min(serverProgress + 1, 99);
              setUploadProgress(serverProgress);
              if (serverProgress >= 99) clearInterval(processingInterval);
            }, 400);
          }
        }
      };

      const res = await representativesAPI.uploadPurchaseOrder(formData, config);
      if (processingInterval) clearInterval(processingInterval);
      setUploadProgress(null);

      toast.success(res.data.message || 'Purchase Order uploaded successfully!');
      setShowPoUploadModal(false);
      setPoUploadFile(null);
      fetchPoData(1);
    } catch (err) {
      if (processingInterval) clearInterval(processingInterval);
      setUploadProgress(null);
      toast.error(err.response?.data?.message || err.message || 'Failed to upload Purchase Order');
    } finally {
      setPoUploading(false);
      setUploadProgress(null);
    }
  };

  const handleBulkPoPermission = async (e) => {
    const enable = e.target.checked;
    setBulkPoLoading(true);
    try {
      const res = await representativesAPI.bulkPoPermission(enable);
      setAllPoEnabled(enable);
      toast.success(res.data.message || `PO ${enable ? 'enabled' : 'disabled'} for all representatives`);
      fetchReps(page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update PO permissions');
    } finally {
      setBulkPoLoading(false);
    }
  };

  const loadFieldPermissions = async (mfacCode) => {
    try {
      setFpLoading(true);
      const res = await representativesAPI.getCWFieldPermissions(mfacCode);
      setFpSelectedFields(res.data.fields || []);
    } catch (error) {
      console.error('Failed to load field permissions:', error);
      toast.error('Failed to load field permissions');
    } finally {
      setFpLoading(false);
    }
  };

  const handleSaveFieldPermissions = async () => {
    try {
      setFpSaving(true);
      await representativesAPI.updateCWFieldPermissions(fpSelectedMfac, fpSelectedFields);
      toast.success('Field permissions updated successfully');
      setShowFieldPermissionsModal(false);
    } catch (error) {
      console.error('Failed to save field permissions:', error);
      toast.error('Failed to save field permissions');
    } finally {
      setFpSaving(false);
    }
  };

  const toggleFieldSelection = (fieldKey) => {
    if (fpSelectedFields.includes(fieldKey)) {
      setFpSelectedFields(fpSelectedFields.filter(f => f !== fieldKey));
    } else {
      setFpSelectedFields([...fpSelectedFields, fieldKey]);
    }
  };

  const handleImportDefault = async () => {
    try {
      setImporting(true);
      toast.info('Importing representatives from Downloads...');
      const res = await representativesAPI.importDefault();
      toast.success(res.data.message || 'Imported successfully');
      fetchReps(1);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to import. Make sure file exists in Downloads.');
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setImporting(true);
      setUploadProgress(0);
      const formData = new FormData();
      formData.append('file', file);
      
      const config = {
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        }
      };

      const res = await representativesAPI.importFile(formData, config);
      toast.success(res.data.message || 'Imported successfully');
      fetchReps(1);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to import file');
    } finally {
      setImporting(false);
      setUploadProgress(null);
      e.target.value = ''; // clear
    }
  };


  const openEditModal = (rep) => {
    setEditingRep(rep);
    setCompanyName(rep.name || '');
    setNewPhone(rep.phone || '');
    setNewRepName(rep.repName || '');
    setNewPhone2(rep.phone2 || '');
    setNewPassword(rep.passwordText || '123456');
    setNewEmail(rep.email || '');
    setNewSsLimit(rep.permissions?.ssDownloadLimit !== undefined ? rep.permissions.ssDownloadLimit : 1);
    setNewCwLimit(rep.permissions?.cwDownloadLimit !== undefined ? rep.permissions.cwDownloadLimit : 1);
  };

  const closeEditModal = () => {
    setEditingRep(null);
    setCompanyName('');
    setNewPhone('');
    setNewRepName('');
    setNewPhone2('');
    setNewPassword('');
    setNewEmail('');
    setNewSsLimit(1);
    setNewCwLimit(1);
  };

  const handleSavePhone = async (forceUpdate = false) => {
    // Ensure forceUpdate is strictly a boolean (it can be React Click Event if called directly by onClick)
    const isForce = forceUpdate === true;

    if (!newPhone.trim()) {
      toast.error('Primary phone number cannot be empty');
      return;
    }

    const cleanPhone = newPhone.replace(/\D/g, '');
    const cleanPhone2 = newPhone2 ? newPhone2.replace(/\D/g, '') : '';

    if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      toast.error('Primary mobile number must be a valid 10-digit number starting with 6-9');
      return;
    }

    if (newPhone2 && (cleanPhone2.length !== 10 || !/^[6-9]/.test(cleanPhone2))) {
      toast.error('Secondary mobile number must be a valid 10-digit number starting with 6-9');
      return;
    }

    if (newPassword && (newPassword.length < 6 || newPassword.length > 10)) {
      toast.error('Representative password must be between 6 and 10 characters long');
      return;
    }

    setSavingPhone(true);
    try {
      const res = await representativesAPI.updatePhone(editingRep._id, cleanPhone, newRepName, cleanPhone2, newPassword, newEmail, isForce, companyName, newSsLimit, newCwLimit);

      if (res.data?.warning) {
        // Show custom modal instead of browser confirm
        setSavingPhone(false);
        setDupWarningModal({ message: res.data.message });
        return; // Wait for user action in modal
      }

      toast.success('Representative details updated successfully');
      closeEditModal();
      fetchReps(page);
    } catch (error) {
      console.error("Representative update failed:", error);
      const serverMsg = error?.response?.data?.message;
      const statusText = error?.response?.status ? ` (Status: ${error.response.status})` : '';
      const errMsg = serverMsg || error.message || 'Unknown network error';
      toast.error(`Update failed: ${errMsg}${statusText}`);
    } finally {
      setSavingPhone(false);
    }
  };

  // --- Company Linking Handlers ---
  const openCompanyModal = async (rep) => {
    setCompanyModalRep(rep);
    setSelectedCompany('');
    setLoadingCompanies(true);
    try {
      const res = await representativesAPI.getAvailableCompanies(rep._id);
      setAvailableCompanies(res.data.available || []);
      setLinkedCompanies(res.data.linked || []);
    } catch (error) {
      toast.error('Failed to load companies');
    } finally {
      setLoadingCompanies(false);
    }
  };

  const closeCompanyModal = () => {
    setCompanyModalRep(null);
    setAvailableCompanies([]);
    setLinkedCompanies([]);
    setSelectedCompany('');
  };

  const handleAddCompany = async () => {
    if (!selectedCompany) {
      toast.error('Please select a company');
      return;
    }
    const found = availableCompanies.find(c => c.mfacCode === selectedCompany);
    if (!found) return;
    try {
      setSavingCompany(true);
      const res = await representativesAPI.addCompany(companyModalRep._id, found.mfacCode, found.mfacName);
      setLinkedCompanies(res.data.linkedCompanies || []);
      setAvailableCompanies(prev => prev.filter(c => c.mfacCode !== found.mfacCode));
      setSelectedCompany('');
      toast.success(`${found.mfacName} linked successfully`);
      fetchReps(page);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to link company');
    } finally {
      setSavingCompany(false);
    }
  };

  const handleRemoveCompany = async (mfacCode, mfacName) => {
    try {
      setRemovingCompany(mfacCode);
      const res = await representativesAPI.removeCompany(companyModalRep._id, mfacCode);
      setLinkedCompanies(res.data.linkedCompanies || []);
      setAvailableCompanies(prev => [...prev, { mfacCode, mfacName }].sort((a, b) => a.mfacName.localeCompare(b.mfacName)));
      toast.success(`${mfacName} removed`);
      fetchReps(page);
    } catch (error) {
      toast.error('Failed to remove company');
    } finally {
      setRemovingCompany('');
    }
  };

  const openAddRepModal = async () => {
    setShowAddRepModal(true);
    setSelectedSsCompany('');
    setSsSearch('');
    setLoadingSsCompanies(true);
    try {
      const res = await representativesAPI.getSsCompaniesNotInReps();
      setSsCompanies(res.data.available || []);
    } catch (error) {
      toast.error('Failed to load S&S companies');
    } finally {
      setLoadingSsCompanies(false);
    }
  };

  const handleCreateRep = async () => {
    if (!selectedSsCompany) { toast.error('Please select a company'); return; }
    const found = ssCompanies.find(c => c.mfacCode === selectedSsCompany);
    if (!found) return;
    try {
      setSavingNewRep(true);
      const res = await representativesAPI.createRep({
        name: found.mfacName,
        mfacCode: found.mfacCode
      });
      toast.success(res.data.message || 'Representative added');
    setShowAddRepModal(false);
    setSsCompanies([]);
    setSsSearch('');
    setSelectedSsCompany('');
      fetchReps(1);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add representative');
    } finally {
      setSavingNewRep(false);
    }
  };

  const downloadRepsExcel = async () => {
    try {
      toast.info('Preparing export...');
      // Fetch ALL reps (not just current page)
      const res = await representativesAPI.getAll({ page: 1, limit: 99999 });
      const allReps = res.data.data || [];
      if (allReps.length === 0) {
        toast.warn('No records to export');
        return;
      }
      const rows = allReps.map(r => ({
        'ID': r._id || '',
        'Mafc Code': r.customerCode || '',
        'Name': r.name || '',
        'Email': r.email || '',
        'Primary Phone': r.phone || '',
        'Rep Name': r.repName || '',
        'Secondary Phone': r.phone2 || '',
        'Password': r.passwordText || '123456',
        'Status': r.isActive ? 'Active' : 'Inactive',
        'CW Permission': r.permissions?.canViewCustomerWise ? 'Yes' : 'No',
        'PO Permission': r.permissions?.canViewPurchaseOrder ? 'Yes' : 'No',
        'Br-S&S Permission': r.permissions?.canViewBranchStatement ? 'Yes' : 'No',
        'Br-CW Permission': r.permissions?.canViewBranchCustomerWise ? 'Yes' : 'No',
        'Linked Companies': (r.linkedCompanies || []).map(c => `${c.mfacName || ''} (${c.mfacCode || ''})`).filter(s => s.trim() !== '()').join(', ') || 'None',
        'Created At': r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : ''
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Representatives');
      // Use Blob-based download for reliable cross-browser file saving
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Representatives_Report.xlsx';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
      toast.success('Representatives report exported!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export representatives');
    }
  };

  return (
    <div className="animate-slide-up">
      <div className="page-header page-header-flex">
        <div>
          <h1>Representatives 🛡️</h1>
          <p>
            {subTab === 'reps' && 'Import and manage active sales representatives'}
            {subTab === 'statement' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                Upload and view S&S (Stock & Sales) monthly statements
                {stmtReportStartDate && stmtReportEndDate && (
                  <span style={{ padding: '3px 10px', background: 'rgba(99, 102, 241, 0.15)', color: '#000000', borderRadius: '12px', fontSize: '13px', fontWeight: 700, border: '1px solid rgba(99,102,241,0.3)', marginLeft: '8px' }}>
                    Period: {formatDate(stmtReportStartDate)} to {formatDate(stmtReportEndDate)}
                  </span>
                )}
              </span>
            )}
            {subTab === 'summary' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                View and export S&S (Stock & Sales) Summary with Excess/Non-Moving analysis
                {summarySelectedPeriod && (() => {
                  const [month, year] = summarySelectedPeriod.split('|');
                  if (month && year) {
                    return (
                      <span style={{ padding: '3px 10px', background: 'rgba(99, 102, 241, 0.15)', color: '#000000', borderRadius: '12px', fontSize: '13px', fontWeight: 700, border: '1px solid rgba(99,102,241,0.3)', marginLeft: '8px' }}>
                        Period: {month} {year}
                      </span>
                    );
                  }
                  return null;
                })()}
              </span>
            )}
            {subTab === 'customerwise' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                Upload and view Customer Wise sales report
                {cwSelectedPeriod && (() => {
                  const [month, year] = cwSelectedPeriod.split('|');
                  if (month && year) {
                    return (
                      <span style={{ padding: '3px 10px', background: 'rgba(99, 102, 241, 0.15)', color: '#000000', borderRadius: '12px', fontSize: '13px', fontWeight: 700, border: '1px solid rgba(99,102,241,0.3)', marginLeft: '8px' }}>
                        Period: {month} {year} {getFormattedCwPeriod(month, year)}
                      </span>
                    );
                  }
                  return null;
                })()}
              </span>
            )}
            {subTab === 'purchaseorder' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                Upload and view Purchase Orders
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {subTab === 'reps' ? (
            <>
              <button
                className="btn btn-primary btn-sm"
                onClick={openAddRepModal}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                + Add Representative
              </button>
              <label className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0 }}>
                <FiUploadCloud /> {importing ? 'Importing...' : 'Upload Excel'}
                <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ display: 'none' }} disabled={importing} />
              </label>
              <button className="btn btn-outline btn-sm" onClick={downloadRepsExcel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiDownload /> Export
              </button>
            </>
          ) : subTab === 'summary' ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleDownloadAdminSummaryExcel}
                disabled={summaryDownloading || summaryLoading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
              >
                <FiDownload size={15} />
                {summaryDownloading ? 'Exporting...' : 'Export to Excel'}
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={handleDownloadAdminSummaryPdf}
                disabled={summaryDownloading || summaryLoading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)' }}
              >
                <FiFileText size={15} />
                {summaryDownloading ? '...' : 'Export to PDF'}
              </button>
            </div>
          ) : subTab === 'customerwise' ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <label className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0 }}>
                <FiUploadCloud /> {cwUploading ? 'Uploading...' : 'Upload CW by Month'}
                <input type="file" accept=".xlsx,.xls" onChange={handleCwUpload} style={{ display: 'none' }} disabled={cwUploading} />
              </label>
              <button
                className="btn btn-outline btn-sm"
                onClick={handleDownloadCwExcel}
                disabled={cwData.length === 0}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', borderColor: '#10b981' }}
              >
                <FiDownload /> Export Selected to Excel
              </button>
            </div>
          ) : subTab === 'purchaseorder' ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowPoUploadModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <FiUploadCloud /> {poUploading ? 'Uploading...' : 'Upload Purchase Order Excel'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <label className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0 }}>
                <FiUploadCloud /> {stmtUploading && !isOldStmtUpload ? 'Uploading...' : 'Upload Current Statement'}
                <input type="file" accept=".xlsx,.xls" onChange={(e) => handleStmtUpload(e, false)} style={{ display: 'none' }} disabled={stmtUploading} />
              </label>
              <label className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0, color: '#818cf8', borderColor: '#818cf8' }}>
                <FiClock /> {stmtUploading && isOldStmtUpload ? 'Uploading...' : 'Upload Old Statement'}
                <input type="file" accept=".xlsx,.xls" onChange={(e) => handleStmtUpload(e, true)} style={{ display: 'none' }} disabled={stmtUploading} />
              </label>
              <button
                className="btn btn-outline btn-sm"
                onClick={handleDownloadStmtExcel}
                disabled={stmtData.length === 0}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', borderColor: '#10b981' }}
              >
                <FiDownload /> Export to Excel
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  const currentPs = stmtPeriods.filter(p => !p.isHistorical);
                  if (currentPs.length > 0) {
                    setArchiveSelectedPeriod(`${currentPs[0].reportMonth}|${currentPs[0].reportYear}`);
                  } else {
                    setArchiveSelectedPeriod('');
                  }
                  setShowArchiveModal(true);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#f59e0b', borderColor: '#f59e0b' }}
              >
                <FiArchive /> Archive to History
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="subtabs-bar">
        <button 
          onClick={() => setSubTab('reps')} 
          style={{
            background: 'none',
            border: 'none',
            borderBottom: subTab === 'reps' ? '2px solid var(--accent)' : '2px solid transparent',
            color: subTab === 'reps' ? 'var(--text-white)' : 'var(--text-muted)',
            padding: '8px 16px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
        >
          Representatives List
        </button>
        <button 
          onClick={() => setSubTab('statement')} 
          style={{
            background: 'none',
            border: 'none',
            borderBottom: subTab === 'statement' ? '2px solid var(--accent)' : '2px solid transparent',
            color: subTab === 'statement' ? 'var(--text-white)' : 'var(--text-muted)',
            padding: '8px 16px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
        >
          S&S Statement
        </button>
        <button 
          onClick={() => { setSubTab('summary'); fetchSummaryData(1); }} 
          style={{
            background: 'none',
            border: 'none',
            borderBottom: subTab === 'summary' ? '2px solid var(--accent)' : '2px solid transparent',
            color: subTab === 'summary' ? 'var(--text-white)' : 'var(--text-muted)',
            padding: '8px 16px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
        >
          S&S Summary 📊
        </button>
        <button 
          onClick={() => setSubTab('nonmoving')} 
          style={{
            background: 'none',
            border: 'none',
            borderBottom: subTab === 'nonmoving' ? '2px solid var(--accent)' : '2px solid transparent',
            color: subTab === 'nonmoving' ? 'var(--text-white)' : 'var(--text-muted)',
            padding: '8px 16px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            transition: 'all 0.2s',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          Non-Moving Stock 📦
        </button>
        <button 
          onClick={() => setSubTab('customerwise')} 
          style={{
            background: 'none',
            border: 'none',
            borderBottom: subTab === 'customerwise' ? '2px solid var(--accent)' : '2px solid transparent',
            color: subTab === 'customerwise' ? 'var(--text-white)' : 'var(--text-muted)',
            padding: '8px 16px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
        >
          Customer Wise
        </button>
        <button 
          onClick={() => { setSubTab('purchaseorder'); fetchPoData(1); }} 
          style={{
            background: 'none',
            border: 'none',
            borderBottom: subTab === 'purchaseorder' ? '2px solid var(--accent)' : '2px solid transparent',
            color: subTab === 'purchaseorder' ? 'var(--text-white)' : 'var(--text-muted)',
            padding: '8px 16px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
        >
          Purchase Order
        </button>
      </div>

      <div className="card">
        {subTab === 'reps' && (
          <>
            {/* Search & Stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: '400px' }}>
                <FiSearch className="search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '36px', width: '100%' }}
                  placeholder="Search by Mafc Code, Name, Primary Phone, Rep Name, Secondary Phone..."
                  value={search}
                  onChange={(e) => {
                    console.log('Search input changed:', e.target.value);
                    setSearch(e.target.value);
                  }}
                />
                {search.trim() && (
                  <button 
                    onClick={() => setSearch('')}
                    title="Clear search"
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <FiX size={16} />
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                  Total Representatives: <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{totalCount}</span>
                </div>
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  fontSize: '13px', fontWeight: 600, cursor: bulkPoLoading ? 'not-allowed' : 'pointer',
                  background: allPoEnabled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(99, 102, 241, 0.1)',
                  color: allPoEnabled ? '#10b981' : 'var(--text-white)',
                  padding: '6px 14px', borderRadius: '8px',
                  border: `1px solid ${allPoEnabled ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.2)'}`,
                  opacity: bulkPoLoading ? 0.6 : 1,
                  transition: 'all 0.2s'
                }}>
                  <input
                    type="checkbox"
                    checked={allPoEnabled}
                    onChange={handleBulkPoPermission}
                    disabled={bulkPoLoading}
                    style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#10b981' }}
                  />
                  {bulkPoLoading ? 'Updating...' : 'Enable PO for ALL'}
                </label>
              </div>
            </div>

            {loading ? (
              <div className="loading-container" style={{ minHeight: '200px' }}><div className="spinner"></div></div>
            ) : reps.length === 0 ? (
              <div className="empty-state" style={{ minHeight: '200px' }}>
                <p>No representatives found. Try importing the report or adjust search.</p>
              </div>
            ) : (
              <>
                <div className="table-container">
                  <table className="table scrollable" style={{ minWidth: '1100px' }}>
                    <thead>
                      <tr>
                        <th>Mafc Code</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Primary Phone</th>
                        <th>Rep Name</th>
                        <th>Secondary Phone</th>
                        <th>Password</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                        <th style={{ textAlign: 'center' }}>Permissions</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reps.map((rep) => {
                        const activeCount = [
                          rep.permissions?.canViewCustomerWise,
                          rep.permissions?.canViewPurchaseOrder,
                          rep.permissions?.canViewBranchStatement,
                          rep.permissions?.canViewBranchCustomerWise
                        ].filter(Boolean).length;

                        return (
                        <tr key={rep._id}>
                          <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{rep.customerCode || '—'}</td>
                          <td style={{ color: 'var(--text-white)', fontWeight: 500 }}>{rep.name || '—'}</td>
                          <td>{rep.email || '—'}</td>
                          <td>
                            <span>{rep.phone || '—'}</span>
                          </td>
                          <td>
                            <span>{rep.repName || '—'}</span>
                          </td>
                          <td>
                            <span>{rep.phone2 || '—'}</span>
                          </td>
                          <td>
                            <span style={{ fontFamily: 'monospace', color: 'var(--text-white)' }}>{rep.passwordText || '123456'}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span 
                              onClick={() => handleToggleStatus(rep._id)}
                              style={{ cursor: 'pointer', fontSize: '20px', display: 'inline-flex', alignItems: 'center' }}
                              title={rep.isActive ? 'Click to Deactivate' : 'Click to Activate'}
                            >
                              {rep.isActive ? (
                                <FiToggleRight style={{ color: '#10b981' }} size={24} />
                              ) : (
                                <FiToggleLeft style={{ color: 'var(--text-muted)' }} size={24} />
                              )}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => setPermModalRep(rep)}
                              style={{
                                padding: '4px 10px',
                                fontSize: '12px',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                color: activeCount > 0 ? '#10b981' : 'var(--text-muted)',
                                borderColor: activeCount > 0 ? 'rgba(16, 185, 129, 0.4)' : 'var(--border)',
                                background: activeCount > 0 ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                                fontWeight: 600
                              }}
                              title="Click to view & edit permissions (CW, PO, Br-S&S, Br-CW)"
                            >
                              <FiShield size={14} />
                              Permissions ({activeCount}/4)
                            </button>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button 
                                className="btn btn-outline btn-sm" 
                                onClick={() => openEditModal(rep)}
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                              >
                                Modify
                              </button>
                              <button
                                onClick={() => handleRemoveRep(rep)}
                                style={{
                                  padding: '6px 10px', fontSize: '12px',
                                  background: 'rgba(239,68,68,0.1)',
                                  border: '1px solid rgba(239,68,68,0.3)',
                                  color: '#ef4444', borderRadius: '6px',
                                  cursor: 'pointer', fontWeight: 600
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => fetchReps(page - 1)}
                      disabled={page <= 1}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <FiChevronLeft /> Prev
                    </button>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      Page <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{page}</span> of <span style={{ fontWeight: 600 }}>{totalPages}</span>
                    </span>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => fetchReps(page + 1)}
                      disabled={page >= totalPages}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      Next <FiChevronRight />
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}


        {subTab === 'statement' && (
          <>
            {/* S&S Statement View */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', flex: '1 1 auto', flexWrap: 'wrap', width: '100%', maxWidth: '100%' }}>
                <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: '350px' }}>
                  <FiSearch className="search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="form-input"
                    style={{ paddingLeft: '36px', width: '100%' }}
                    placeholder="Search by code, item, manufacturer..." 
                    value={stmtSearch}
                    onChange={(e) => setStmtSearch(e.target.value)}
                  />
                  {stmtSearch.trim() && (
                    <button 
                      onClick={() => setStmtSearch('')}
                      title="Clear search"
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <FiX size={16} />
                    </button>
                  )}
                </div>
                
                {/* Searchable Custom Manufacturer Dropdown - same as CW */}
                <div ref={stmtMfacDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
                  <div
                    onClick={() => setShowStmtMfacDropdown(!showStmtMfacDropdown)}
                    className="form-select"
                    style={{
                      width: '240px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'var(--bg-card)',
                      color: 'var(--text-white)',
                      border: '1px solid var(--border-color)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      height: '38px',
                      userSelect: 'none'
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                      {stmtSelectedMfac
                        ? (stmtManufacturers.find(m => m.code === stmtSelectedMfac)?.name || stmtSelectedMfac)
                        : 'All Manufacturers'
                      }
                    </span>
                    <FiChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </div>

                  {showStmtMfacDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      zIndex: 1000,
                      width: '300px',
                      marginTop: '6px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          className="form-input"
                          style={{ width: '100%', padding: '6px 10px', paddingRight: '28px', fontSize: '13px', height: '32px' }}
                          placeholder="Search company or code..."
                          value={stmtMfacSearch}
                          onChange={(e) => setStmtMfacSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        {stmtMfacSearch && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setStmtMfacSearch(''); }}
                            style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                          >
                            <FiX size={12} />
                          </button>
                        )}
                      </div>

                      <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', paddingRight: '4px' }}>
                        <div
                          onClick={() => { setStmtSelectedMfac(''); setShowStmtMfacDropdown(false); setStmtMfacSearch(''); }}
                          style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: '4px', fontSize: '13px', background: stmtSelectedMfac === '' ? 'rgba(99, 102, 241, 0.15)' : 'transparent', color: stmtSelectedMfac === '' ? 'var(--accent)' : 'var(--text-white)', transition: 'background 0.2s' }}
                          onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                          onMouseLeave={(e) => e.target.style.background = stmtSelectedMfac === '' ? 'rgba(99,102,241,0.15)' : 'transparent'}
                        >
                          All Manufacturers
                        </div>

                        {(() => {
                          const filtered = stmtManufacturers.filter(m =>
                            m.name.toLowerCase().includes(stmtMfacSearch.toLowerCase()) ||
                            m.code.toLowerCase().includes(stmtMfacSearch.toLowerCase())
                          );
                          if (filtered.length === 0) {
                            return <div style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>No manufacturers found</div>;
                          }
                          return filtered.map((m) => {
                            const isSelected = stmtSelectedMfac === m.code;
                            return (
                              <div
                                key={m.code}
                                onClick={() => { setStmtSelectedMfac(m.code); setShowStmtMfacDropdown(false); setStmtMfacSearch(''); }}
                                style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: '4px', fontSize: '13px', background: isSelected ? 'rgba(99,102,241,0.2)' : 'transparent', color: isSelected ? 'var(--accent)' : 'var(--text-white)', transition: 'background 0.2s' }}
                                onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                                onMouseLeave={(e) => e.target.style.background = isSelected ? 'rgba(99,102,241,0.2)' : 'transparent'}
                              >
                                {m.name} ({m.code})
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Period filter - no All Periods option */}
                {stmtPeriods.length > 0 && (
                  <select
                    className="form-select"
                    style={{ width: '210px', borderColor: 'var(--primary)' }}
                    value={stmtSelectedPeriod}
                    onChange={(e) => setStmtSelectedPeriod(e.target.value)}
                  >
                    {stmtPeriods.map((p, i) => (
                      <option key={i} value={`${p.reportMonth}|${p.reportYear}|${p.isHistorical}`}>
                        {p.isHistorical ? '📋 ' : '📋 '}{p.reportMonth} {p.reportYear}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                Total Records: <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{stmtTotalCount}</span>
              </div>
            </div>

            {stmtLoading ? (
              <div className="loading-container" style={{ minHeight: '200px' }}><div className="spinner"></div></div>
            ) : stmtData.length === 0 ? (
              <div className="empty-state" style={{ minHeight: '200px' }}>
                <p>No S&S statement records found. Try uploading an "S&S statement" Excel file.</p>
              </div>
            ) : (
              <>
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="table scrollable" style={{ width: '100%', minWidth: '1800px' }}>
                    <thead>
                      <tr>
                        <th>Item Code</th>
                        <th>Item Name</th>
                        <th style={{ whiteSpace: 'nowrap', minWidth: '60px' }}>Pack</th>
                        <th style={{ textAlign: 'right' }}>Op. Bal</th>
                        <th style={{ textAlign: 'right' }}>Op. Value</th>
                        <th style={{ textAlign: 'right' }}>Pur Qty</th>
                        <th style={{ textAlign: 'right' }}>Pur Value</th>
                        <th style={{ textAlign: 'right' }}>Pur Sch. Qty</th>
                        <th style={{ textAlign: 'right' }}>Sale Qty</th>
                        <th style={{ textAlign: 'right' }}>Sale Value</th>
                        <th style={{ textAlign: 'right' }}>Free Qty</th>
                        <th style={{ textAlign: 'right' }}>Br. Qty</th>
                        <th style={{ textAlign: 'right' }}>Br. Value</th>
                        <th style={{ textAlign: 'right' }}>CR Qty</th>
                        <th style={{ textAlign: 'right' }}>CR Value</th>
                        <th style={{ textAlign: 'right' }}>DB Qty</th>
                        <th style={{ textAlign: 'right' }}>DB Value</th>
                        <th style={{ textAlign: 'right' }}>Adj. Qty</th>
                        <th style={{ textAlign: 'right' }}>Adj. Value</th>
                        <th style={{ textAlign: 'right' }}>Closing Qty</th>
                        <th style={{ textAlign: 'right' }}>Closing Value</th>
                        <th style={{ textAlign: 'right' }}>Sale Rate</th>
                        <th>Manufacturer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stmtData.map((item, idx) => (
                        <tr key={item._id || idx}>
                          <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{item.itemCode || '—'}</td>
                          <td style={{ color: 'var(--text-white)', fontWeight: 500 }}>{item.itemName || '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{item.pack || '—'}</td>
                          <td style={{ textAlign: 'right' }}>{item.opBalance || '0'}</td>
                          <td style={{ textAlign: 'right' }}>{item.opValue?.toFixed(2) || '0.00'}</td>
                          <td style={{ textAlign: 'right' }}>{item.purQty || '0'}</td>
                          <td style={{ textAlign: 'right' }}>{item.purValue?.toFixed(2) || '0.00'}</td>
                          <td style={{ textAlign: 'right' }}>{item.purSchQty || '0'}</td>
                          <td style={{ textAlign: 'right' }}>{item.saleQty || '0'}</td>
                          <td style={{ textAlign: 'right' }}>{item.saleValue?.toFixed(2) || '0.00'}</td>
                          <td style={{ textAlign: 'right' }}>{item.freeQty || '0'}</td>
                          <td style={{ textAlign: 'right' }}>{item.brQty || '0'}</td>
                          <td style={{ textAlign: 'right' }}>{item.brValue?.toFixed(2) || '0.00'}</td>
                          <td style={{ textAlign: 'right' }}>{item.crQty || '0'}</td>
                          <td style={{ textAlign: 'right' }}>{item.crValue?.toFixed(2) || '0.00'}</td>
                          <td style={{ textAlign: 'right' }}>{item.dbQty || '0'}</td>
                          <td style={{ textAlign: 'right' }}>{item.dbValue?.toFixed(2) || '0.00'}</td>
                          <td style={{ textAlign: 'right' }}>{item.adjQty || '0'}</td>
                          <td style={{ textAlign: 'right' }}>{item.adjValue?.toFixed(2) || '0.00'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.balQty || '0'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.balValue?.toFixed(2) || '0.00'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 500 }}>{item.saleRate?.toFixed(2) || '0.00'}</td>
                          <td style={{ fontSize: '12px' }}>
                            <div style={{ color: 'var(--text-white)' }}>{item.mfacName || '—'}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Code: {item.mfacCode}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {stmtTotalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => fetchStmtData(stmtPage - 1)}
                      disabled={stmtPage <= 1}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <FiChevronLeft /> Prev
                    </button>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      Page <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{stmtPage}</span> of <span style={{ fontWeight: 600 }}>{stmtTotalPages}</span>
                    </span>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => fetchStmtData(stmtPage + 1)}
                      disabled={stmtPage >= stmtTotalPages}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      Next <FiChevronRight />
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {subTab === 'summary' && (
          <>
            {/* S&S Summary View for Admin */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', flex: '1 1 auto', flexWrap: 'wrap', width: '100%', maxWidth: '100%' }}>
                <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: '350px' }}>
                  <FiSearch className="search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="form-input"
                    style={{ paddingLeft: '36px', width: '100%' }}
                    placeholder="Search by item name or code..." 
                    value={summarySearch}
                    onChange={(e) => setSummarySearch(e.target.value)}
                  />
                  {summarySearch.trim() && (
                    <button 
                      onClick={() => setSummarySearch('')}
                      title="Clear search"
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <FiX size={16} />
                    </button>
                  )}
                </div>
                
                {/* Searchable Custom Manufacturer Dropdown */}
                <div ref={summaryMfacDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
                  <div
                    onClick={() => setShowSummaryMfacDropdown(!showSummaryMfacDropdown)}
                    className="form-select"
                    style={{
                      width: '240px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'var(--bg-card)',
                      color: 'var(--text-white)',
                      border: '1px solid var(--border-color)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      height: '38px',
                      userSelect: 'none'
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                      {summarySelectedMfac
                        ? (stmtManufacturers.find(m => m.code === summarySelectedMfac)?.name || summarySelectedMfac)
                        : 'All Companies / Divisions'
                      }
                    </span>
                    <FiChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </div>

                  {showSummaryMfacDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      zIndex: 1000,
                      width: '300px',
                      marginTop: '6px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ position: 'relative' }}>
                        <FiSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={13} />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Search company/division..."
                          value={summaryMfacSearch}
                          onChange={(e) => setSummaryMfacSearch(e.target.value)}
                          autoFocus
                          style={{ paddingLeft: '30px', fontSize: '12px', height: '32px', width: '100%' }}
                        />
                      </div>
                      <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div
                          onClick={() => {
                            setSummarySelectedMfac('');
                            setShowSummaryMfacDropdown(false);
                            setSummaryMfacSearch('');
                          }}
                          style={{
                            padding: '6px 10px',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            fontSize: '13px',
                            fontWeight: !summarySelectedMfac ? 700 : 400,
                            color: !summarySelectedMfac ? 'var(--accent)' : 'var(--text-white)',
                            background: !summarySelectedMfac ? 'rgba(99, 102, 241, 0.1)' : 'transparent'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = !summarySelectedMfac ? 'rgba(99, 102, 241, 0.1)' : 'transparent'}
                        >
                          All Companies / Divisions
                        </div>
                        {stmtManufacturers
                          .filter(m => !summaryMfacSearch || (m.name || '').toLowerCase().includes(summaryMfacSearch.toLowerCase()) || (m.code || '').includes(summaryMfacSearch))
                          .map((m) => (
                            <div
                              key={m.code}
                              onClick={() => {
                                setSummarySelectedMfac(m.code);
                                setShowSummaryMfacDropdown(false);
                                setSummaryMfacSearch('');
                              }}
                              style={{
                                padding: '6px 10px',
                                cursor: 'pointer',
                                borderRadius: '4px',
                                fontSize: '13px',
                                fontWeight: summarySelectedMfac === m.code ? 700 : 400,
                                color: summarySelectedMfac === m.code ? 'var(--accent)' : 'var(--text-white)',
                                background: summarySelectedMfac === m.code ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = summarySelectedMfac === m.code ? 'rgba(99, 102, 241, 0.1)' : 'transparent'}
                            >
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '210px' }}>
                                {m.name}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({m.code})</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* S&S Statement Period Selector */}
                {stmtPeriods.length > 0 && (
                  <select
                    className="form-select"
                    style={{ width: '210px', borderColor: 'var(--primary)' }}
                    value={summarySelectedPeriod || stmtSelectedPeriod}
                    onChange={(e) => setSummarySelectedPeriod(e.target.value)}
                  >
                    {stmtPeriods.map((p, i) => (
                      <option key={i} value={`${p.reportMonth}|${p.reportYear}|${p.isHistorical}`}>
                        {p.isHistorical ? '📜 ' : '📋 '}{p.reportMonth} {p.reportYear}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                Total Records: <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{summaryTotalCount}</span>
              </div>
            </div>

            {summaryLoading ? (
              <div className="loading-container" style={{ minHeight: '200px' }}><div className="spinner"></div></div>
            ) : summaryData.length === 0 ? (
              <div className="empty-state" style={{ minHeight: '200px' }}>
                <p>No S&S summary records found for this period/company.</p>
              </div>
            ) : (
              <>
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="table scrollable" style={{ width: '100%', minWidth: '1150px' }}>
                    <thead>
                      <tr>
                        <th>Item Code</th>
                        <th>Item Name</th>
                        <th style={{ whiteSpace: 'nowrap', minWidth: '60px' }}>Pack</th>
                        <th style={{ textAlign: 'right' }}>Op. Qty</th>
                        <th style={{ textAlign: 'right' }}>Pur Qty</th>
                        <th style={{ textAlign: 'right' }}>Total Qty</th>
                        <th style={{ textAlign: 'right' }}>Sale Qty</th>
                        <th style={{ textAlign: 'right' }}>Bal. Qty</th>
                        <th>Company / Division</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryData.map((item, idx) => {
                        const purQ = (Number(item.purQty) || 0) + (Number(item.purSchQty) || 0);
                        const saleQ = (Number(item.saleQty) || 0) + (Number(item.freeQty) || 0) + (Number(item.brQty) || 0) - (Number(item.crQty) || 0) + (Number(item.adjQty) || 0);
                        return (
                          <tr key={item._id || idx}>
                            <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{item.itemCode || '—'}</td>
                            <td style={{ color: 'var(--text-white)', fontWeight: 500 }}>{item.itemName || '—'}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{item.pack || '—'}</td>
                            <td style={{ textAlign: 'right' }}>{item.opBalance || 0}</td>
                            <td style={{ textAlign: 'right' }}>{purQ}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{(item.opBalance || 0) + purQ}</td>
                            <td style={{ textAlign: 'right' }}>{saleQ}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.balQty || 0}</td>
                            <td style={{ fontSize: '12px' }}>
                              <div style={{ color: 'var(--text-white)' }}>{item.mfacName || '—'}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Code: {item.mfacCode}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {summaryTotalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => fetchSummaryData(summaryPage - 1)}
                      disabled={summaryPage <= 1}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <FiChevronLeft /> Prev
                    </button>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      Page <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{summaryPage}</span> of <span style={{ fontWeight: 600 }}>{summaryTotalPages}</span>
                    </span>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => fetchSummaryData(summaryPage + 1)}
                      disabled={summaryPage >= summaryTotalPages}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      Next <FiChevronRight />
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {subTab === 'nonmoving' && (
          <NonMovingStockReport isAdmin={true} />
        )}

        {subTab === 'customerwise' && (
          <>
            <style>{`
              @media (max-width: 768px) {
                .cw-admin-filters-wrap {
                  flex-direction: column !important;
                  align-items: stretch !important;
                  gap: 10px !important;
                }
                .cw-admin-filter-inner {
                  flex-direction: column !important;
                  align-items: stretch !important;
                  width: 100% !important;
                  gap: 10px !important;
                }
                .cw-admin-filter-input {
                  flex: 1 1 100% !important;
                  max-width: none !important;
                  width: 100% !important;
                }
                .cw-admin-desktop-table {
                  display: none !important;
                }
                .cw-admin-mobile-cards {
                  display: block !important;
                }
              }
              @media (min-width: 769px) {
                .cw-admin-desktop-table {
                  display: block !important;
                }
                .cw-admin-mobile-cards {
                  display: none !important;
                }
              }
            `}</style>
            {/* Customer Wise Report View */}
            <div className="cw-admin-filters-wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <div className="cw-admin-filter-inner" style={{ display: 'flex', gap: '12px', flex: '1 1 auto', flexWrap: 'wrap', width: '100%', maxWidth: '100%' }}>
                <div className="cw-admin-filter-input" style={{ position: 'relative', flex: '1 1 250px', maxWidth: '350px' }}>
                  <FiSearch className="search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="form-input"
                    style={{ paddingLeft: '36px', width: '100%' }}
                    placeholder="Search by item, customer name or code..." 
                    value={cwSearch}
                    onChange={(e) => setCwSearch(e.target.value)}
                  />
                  {cwSearch.trim() && (
                    <button 
                      onClick={() => setCwSearch('')}
                      title="Clear search"
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <FiX size={16} />
                    </button>
                  )}
                </div>

                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    if (cwSelectedMfac) {
                      setFpSelectedMfac(cwSelectedMfac);
                      setShowFieldPermissionsModal(true);
                      loadFieldPermissions(cwSelectedMfac);
                    } else {
                      toast.warning('Please select a company first');
                    }
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FiSettings size={14} /> Field Permissions
                </button>

                {/* Searchable Custom Company Dropdown */}
                <div ref={mfacDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
                  <div
                    onClick={() => setShowMfacDropdown(!showMfacDropdown)}
                    className="form-select"
                    style={{
                      width: '240px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'var(--bg-card)',
                      color: 'var(--text-white)',
                      border: '1px solid var(--border-color)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      height: '38px',
                      userSelect: 'none'
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                      {cwSelectedMfac 
                        ? (cwManufacturers.find(m => m.code === cwSelectedMfac)?.name || cwSelectedMfac) 
                        : 'All Companies / Divisions'
                      }
                    </span>
                    <FiChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </div>

                  {showMfacDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      zIndex: 1000,
                      width: '300px',
                      marginTop: '6px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          className="form-input"
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            paddingRight: '28px',
                            fontSize: '13px',
                            height: '32px'
                          }}
                          placeholder="Search company or code..."
                          value={cwMfacSearch}
                          onChange={(e) => setCwMfacSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()} // Prevent dropdown from closing
                        />
                        {cwMfacSearch && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCwMfacSearch('');
                            }}
                            style={{
                              position: 'absolute',
                              right: '8px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="Clear"
                          >
                            <FiX size={12} />
                          </button>
                        )}
                      </div>

                      <div style={{
                        maxHeight: '180px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        paddingRight: '4px'
                      }}>
                        <div
                          onClick={() => {
                            setCwSelectedMfac('');
                            setShowMfacDropdown(false);
                            setCwMfacSearch('');
                          }}
                          style={{
                            padding: '6px 8px',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            fontSize: '13px',
                            background: cwSelectedMfac === '' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                            color: cwSelectedMfac === '' ? 'var(--accent)' : 'var(--text-white)',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
                          onMouseLeave={(e) => e.target.style.background = cwSelectedMfac === '' ? 'rgba(99, 102, 241, 0.15)' : 'transparent'}
                        >
                          All Companies / Divisions
                        </div>

                        {(() => {
                          const filtered = cwManufacturers.filter(m => 
                            m.name.toLowerCase().includes(cwMfacSearch.toLowerCase()) || 
                            m.code.toLowerCase().includes(cwMfacSearch.toLowerCase())
                          );

                          if (filtered.length === 0) {
                            return (
                              <div style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                No companies found
                              </div>
                            );
                          }

                          return filtered.map((m) => {
                            const isSelected = cwSelectedMfac === m.code;
                            return (
                              <div
                                key={m.code}
                                onClick={() => {
                                  setCwSelectedMfac(m.code);
                                  setShowMfacDropdown(false);
                                  setCwMfacSearch('');
                                }}
                                style={{
                                  padding: '6px 8px',
                                  cursor: 'pointer',
                                  borderRadius: '4px',
                                  fontSize: '13px',
                                  background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                                  color: isSelected ? 'var(--accent)' : 'var(--text-white)',
                                  transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
                                onMouseLeave={(e) => e.target.style.background = isSelected ? 'rgba(99, 102, 241, 0.2)' : 'transparent'}
                              >
                                {m.name} ({m.code})
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Period filter - no All Periods option */}
                {cwPeriods.length > 0 && (
                  <select
                    className="form-select"
                    style={{ width: '210px', borderColor: 'var(--primary)' }}
                    value={cwSelectedPeriod}
                    onChange={(e) => setCwSelectedPeriod(e.target.value)}
                  >
                    {cwPeriods.map((p, i) => (
                      <option key={i} value={`${p.reportMonth}|${p.reportYear}|${p.isHistorical}`}>
                        {p.isHistorical ? '🗂 ' : '📋 '}{p.reportMonth} {p.reportYear}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                Total Records: <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{cwTotalCount}</span>
              </div>
            </div>

            {/* Upload Progress Bar */}
            {cwUploading && (
              <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 600 }}>{cwUploadStatus}</span>
                  <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 600 }}>{cwUploadProgress}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${cwUploadProgress}%`, height: '100%', background: '#10b981', transition: 'width 0.3s ease' }}></div>
                </div>
              </div>
            )}

            {cwLoading ? (
              <div className="loading-container" style={{ minHeight: '200px' }}><div className="spinner"></div></div>
            ) : cwData.length === 0 ? (
              <div className="empty-state" style={{ minHeight: '200px' }}>
                <p>No customer wise records found. Try uploading a "Customer Wise Report" Excel file.</p>
              </div>
            ) : (
              <>
                <div className="table-container cw-admin-desktop-table" style={{ overflowX: 'auto' }}>
                  <table className="table scrollable" style={{ width: '100%', minWidth: '2500px' }}>
                    <thead>
                      <tr>
                        <th>(1) mfac code</th>
                        <th>(2) mfac name</th>
                        <th>(3) item code</th>
                        <th>(4) item name</th>
                        <th style={{ whiteSpace: 'nowrap', minWidth: '60px' }}>(5) pack size</th>
                        <th style={{ textAlign: 'right' }}>(6) qty</th>
                        <th style={{ textAlign: 'right' }}>(7) scheme qty</th>
                        <th style={{ textAlign: 'right' }}>(8) sale rate</th>
                        <th style={{ textAlign: 'right' }}>(9) amount</th>
                        <th style={{ textAlign: 'right' }}>(10) discount</th>
                        <th>(11) customer code</th>
                        <th>(12) customer name</th>
                        <th>(13) address</th>
                        <th>(14) city</th>
                        <th>(15) pin</th>
                        <th>(16) mobile</th>
                        <th>(17) email</th>
                        <th>(18) gst</th>
                        <th>(19) route</th>
                        <th>(20) dman</th>
                        <th>(21) area</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cwData.map((item, idx) => (
                        <tr key={item._id || idx}>
                          <td style={{ color: 'var(--accent)', fontWeight: 500, fontSize: '12px' }}>{item.mfacCode || '—'}</td>
                          <td>{item.companyDivision || '—'}</td>
                          <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{item.itemCode || '—'}</td>
                          <td style={{ color: 'var(--text-white)', fontWeight: 500 }}>{item.itemName || '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{item.packName || '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{(item.qty || 0).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', color: item.schemeQty > 0 ? '#10b981' : 'var(--text-muted)' }}>{(item.schemeQty || 0).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{(item.saleRate || 0).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{(item.amount || (item.qty || 0) * (item.saleRate || 0)).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{(item.discount || 0).toFixed(2)}</td>
                          <td style={{ color: 'var(--accent)', fontWeight: 500, fontSize: '12px' }}>{item.customerCode || '—'}</td>
                          <td style={{ color: 'var(--text-white)', fontWeight: 500 }}>{item.customerName || '—'}</td>
                          <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.customerAddress || '—'}</td>
                          <td>{item.customerCity || '—'}</td>
                          <td>{item.customerPin || '—'}</td>
                          <td>{item.customerMobile || '—'}</td>
                          <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.customerEmail || '—'}</td>
                          <td style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.gst || '—'}</td>
                          <td>{item.routeName || '—'}</td>
                          <td>{item.dmanName || '—'}</td>
                          <td>{item.areaName || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="cw-admin-mobile-cards">
                  {cwData.map((item, idx) => (
                    <div key={item._id || idx} style={{
                      background: 'var(--bg-glass)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '12px',
                      padding: '14px 14px 12px',
                      marginBottom: '10px'
                    }}>
                      {/* Header — Customer */}
                      <div style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-white)', lineHeight: 1.3 }}>
                          {item.customerName || '—'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600, marginTop: '2px' }}>
                          {item.customerCode || ''}{item.customerCity ? ` · ${item.customerCity}` : ''}
                        </div>
                      </div>
                      {/* Sub-header — Item */}
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        {item.itemName || '—'}{item.packName ? ` · ${item.packName}` : ''}
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '6px' }}>
                          {item.itemCode || ''}
                        </span>
                      </div>
                      {/* Badges — Qty + Amount */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <span style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
                          Qty: {(item.qty || 0).toFixed(2)}
                        </span>
                        <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
                          ₹{(item.amount || (item.qty || 0) * (item.saleRate || 0)).toFixed(2)}
                        </span>
                        {item.schemeQty > 0 && (
                          <span style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
                            Sch Qty: {(item.schemeQty || 0).toFixed(2)}
                          </span>
                        )}
                      </div>
                      {/* Other fields */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '12px' }}>
                        {item.companyDivision && <div><span style={{ color: 'var(--text-muted)' }}>Company: </span><span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{item.companyDivision}</span></div>}
                        {item.mfacCode && <div><span style={{ color: 'var(--text-muted)' }}>Code: </span><span style={{ color: 'var(--accent)', fontWeight: 600 }}>{item.mfacCode}</span></div>}
                        {item.saleRate > 0 && <div><span style={{ color: 'var(--text-muted)' }}>Sale Rate: </span><span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>₹{(item.saleRate || 0).toFixed(2)}</span></div>}
                        {item.discount > 0 && <div><span style={{ color: 'var(--text-muted)' }}>Discount: </span><span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{(item.discount || 0).toFixed(2)}</span></div>}
                        {item.customerMobile && <div><span style={{ color: 'var(--text-muted)' }}>Mobile: </span><span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{item.customerMobile}</span></div>}
                        {item.routeName && <div><span style={{ color: 'var(--text-muted)' }}>Route: </span><span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{item.routeName}</span></div>}
                        {item.dmanName && <div><span style={{ color: 'var(--text-muted)' }}>Dman: </span><span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{item.dmanName}</span></div>}
                        {item.areaName && <div><span style={{ color: 'var(--text-muted)' }}>Area: </span><span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{item.areaName}</span></div>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {cwTotalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => fetchCwData(cwPage - 1)}
                      disabled={cwPage <= 1}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <FiChevronLeft /> Prev
                    </button>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      Page <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{cwPage}</span> of <span style={{ fontWeight: 600 }}>{cwTotalPages}</span>
                    </span>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => fetchCwData(cwPage + 1)}
                      disabled={cwPage >= cwTotalPages}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      Next <FiChevronRight />
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {subTab === 'purchaseorder' && (
          <>
            {/* Purchase Order View */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: '350px' }}>
                <FiSearch className="search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="form-input"
                  style={{ paddingLeft: '36px', width: '100%' }}
                  placeholder="Search item name, PO number..." 
                  value={poSearch}
                  onChange={(e) => setPoSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') fetchPoData(1); }}
                />
                {poSearch.trim() && (
                  <button 
                    onClick={() => { setPoSearch(''); fetchPoData(1); }}
                    title="Clear search"
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                  >
                    <FiX size={16} />
                  </button>
                )}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                Total PO Records: <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{poTotal}</span>
              </div>
            </div>

            {poLoading ? (
              <div className="loading-container" style={{ minHeight: '200px' }}><div className="spinner"></div></div>
            ) : poData.length === 0 ? (
              <div className="empty-state" style={{ minHeight: '200px' }}>
                <p>No Purchase Orders uploaded yet. Click "Upload Purchase Order Excel" to import orders.</p>
              </div>
            ) : (
              <>
                <div className="table-container">
                  <table className="table scrollable" style={{ minWidth: '950px' }}>
                    <thead>
                      <tr>
                        <th>PO Number</th>
                        <th>Date</th>
                        <th>Supplier Name</th>
                        <th>Division / Mfac Name</th>
                        <th>Item Code</th>
                        <th>Item Name</th>
                        <th>Pack</th>
                        <th style={{ textAlign: 'right' }}>Total Qty</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poData.map((item, idx) => {
                        const formattedDate = item.poDate && /^\d{4}-\d{2}-\d{2}$/.test(item.poDate.trim())
                          ? item.poDate.trim().split('-').reverse().join('/')
                          : (item.poDate || '—');
                        return (
                          <tr key={item._id || idx}>
                            <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{item.poNumber || '—'}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{formattedDate}</td>
                            <td style={{ color: 'var(--text-white)', fontWeight: 500 }}>{item.suppName || item.mfacName || '—'}</td>
                            <td>{item.companyDivision || item.mfacName || '—'}</td>
                            <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{item.itemCode || '—'}</td>
                            <td style={{ color: 'var(--text-white)', fontWeight: 500 }}>{item.itemName || '—'}</td>
                            <td>{item.packName || '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.qty || 0}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>₹{Number(item.amount || 0).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {poTotalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => fetchPoData(poPage - 1)}
                      disabled={poPage <= 1}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <FiChevronLeft /> Prev
                    </button>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      Page <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{poPage}</span> of <span style={{ fontWeight: 600 }}>{poTotalPages}</span>
                    </span>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => fetchPoData(poPage + 1)}
                      disabled={poPage >= poTotalPages}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      Next <FiChevronRight />
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Add Representative Modal */}
      {showAddRepModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '460px', maxWidth: '95vw', margin: '20px', padding: '28px', position: 'relative' }}>
            <button
              onClick={() => { setShowAddRepModal(false); setSsCompanies([]); setSelectedSsCompany(''); }}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <FiX size={20} />
            </button>

            <h3 style={{ color: 'var(--text-white)', marginBottom: '6px', fontSize: '18px', fontWeight: 700 }}>
              Add Representative
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Select a company from S&amp;S data that is not yet in the representative list
            </p>

            {loadingSsCompanies ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
                Loading S&amp;S companies...
              </div>
            ) : ssCompanies.length === 0 ? (
              <div style={{
                padding: '16px', background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px',
                color: '#10b981', fontSize: '13px', textAlign: 'center', marginBottom: '20px'
              }}>
                ✅ All S&amp;S companies are already in the representative list.
              </div>
            ) : (
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
                  Select Company ({ssCompanies.length} available)
                </label>
                {/* Search box */}
                <div style={{ position: 'relative', marginBottom: '8px' }}>
                  <FiSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} size={14} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search company name or code..."
                    value={ssSearch}
                    onChange={e => setSsSearch(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px 8px 32px', fontSize: '13px' }}
                  />
                </div>
                {/* Scrollable filtered list */}
                <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  {ssCompanies
                    .filter(c => !ssSearch || c.mfacName.toLowerCase().includes(ssSearch.toLowerCase()) || c.mfacCode.toLowerCase().includes(ssSearch.toLowerCase()))
                    .map(c => (
                      <div
                        key={c.mfacCode}
                        onClick={() => setSelectedSsCompany(c.mfacCode)}
                        style={{
                          padding: '10px 14px', cursor: 'pointer', fontSize: '13px',
                          background: selectedSsCompany === c.mfacCode ? 'rgba(99,102,241,0.15)' : 'transparent',
                          borderBottom: '1px solid var(--border)',
                          display: 'flex', gap: '10px', alignItems: 'center',
                          transition: 'background 0.15s'
                        }}
                      >
                        <span style={{ color: '#818cf8', fontWeight: 700, minWidth: '36px', fontSize: '12px' }}>{c.mfacCode}</span>
                        <span style={{ color: 'var(--text-white)' }}>{c.mfacName}</span>
                        {selectedSsCompany === c.mfacCode && <span style={{ marginLeft: 'auto', color: '#10b981', fontSize: '16px' }}>✓</span>}
                      </div>
                    ))
                  }
                  {ssCompanies.filter(c => !ssSearch || c.mfacName.toLowerCase().includes(ssSearch.toLowerCase()) || c.mfacCode.toLowerCase().includes(ssSearch.toLowerCase())).length === 0 && (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No results for "{ssSearch}"</div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                className="btn btn-outline"
                onClick={() => { setShowAddRepModal(false); setSsCompanies([]); setSelectedSsCompany(''); }}
                disabled={savingNewRep}
              >
                Cancel
              </button>
              {ssCompanies.length > 0 && (
                <button
                  className="btn btn-primary"
                  onClick={handleCreateRep}
                  disabled={savingNewRep || !selectedSsCompany}
                >
                  {savingNewRep ? 'Adding...' : 'Add Representative'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Representative Permissions Modal */}
      {permModalRep && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '480px', maxWidth: '95vw', padding: '24px', position: 'relative', borderRadius: '12px' }}>
            <button
              onClick={() => setPermModalRep(null)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <FiX size={20} />
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <FiShield size={20} style={{ color: 'var(--accent)' }} />
              <h3 style={{ color: 'var(--text-white)', margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Representative Permissions
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Configure report permissions for <strong style={{ color: 'var(--text-white)' }}>{permModalRep.name}</strong> ({permModalRep.customerCode})
            </p>

            {/* Permission Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              
              {/* CW Toggle */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: '10px',
                border: '1px solid var(--border)'
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-white)', fontSize: '14px' }}>Customer Wise (CW)</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Customer Wise report viewing access</div>
                </div>
                <span 
                  onClick={async () => {
                    const newVal = !permModalRep.permissions?.canViewCustomerWise;
                    await handleToggleCwPermission(permModalRep._id);
                    setPermModalRep(prev => prev ? {
                      ...prev,
                      permissions: { ...prev.permissions, canViewCustomerWise: newVal }
                    } : null);
                  }}
                  style={{ cursor: 'pointer', fontSize: '24px', display: 'inline-flex', alignItems: 'center' }}
                  title={permModalRep.permissions?.canViewCustomerWise ? 'Disable CW' : 'Enable CW'}
                >
                  {permModalRep.permissions?.canViewCustomerWise ? (
                    <FiToggleRight style={{ color: '#10b981' }} size={28} />
                  ) : (
                    <FiToggleLeft style={{ color: 'var(--text-muted)' }} size={28} />
                  )}
                </span>
              </div>

              {/* PO Toggle */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: '10px',
                border: '1px solid var(--border)'
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-white)', fontSize: '14px' }}>Purchase Order (PO)</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Purchase Order report viewing access</div>
                </div>
                <span 
                  onClick={async () => {
                    const newVal = !permModalRep.permissions?.canViewPurchaseOrder;
                    await handleTogglePoPermission(permModalRep._id);
                    setPermModalRep(prev => prev ? {
                      ...prev,
                      permissions: { ...prev.permissions, canViewPurchaseOrder: newVal }
                    } : null);
                  }}
                  style={{ cursor: 'pointer', fontSize: '24px', display: 'inline-flex', alignItems: 'center' }}
                  title={permModalRep.permissions?.canViewPurchaseOrder ? 'Disable PO' : 'Enable PO'}
                >
                  {permModalRep.permissions?.canViewPurchaseOrder ? (
                    <FiToggleRight style={{ color: '#10b981' }} size={28} />
                  ) : (
                    <FiToggleLeft style={{ color: 'var(--text-muted)' }} size={28} />
                  )}
                </span>
              </div>

              {/* Br-S&S Toggle */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: '10px',
                border: '1px solid var(--border)'
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-white)', fontSize: '14px' }}>Branch S&amp;S (Br-S&amp;S)</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Branch S&amp;S monthly statement viewing access</div>
                </div>
                <span 
                  onClick={async () => {
                    const newVal = !permModalRep.permissions?.canViewBranchStatement;
                    await handleToggleBranchSsPermission(permModalRep._id);
                    setPermModalRep(prev => prev ? {
                      ...prev,
                      permissions: { ...prev.permissions, canViewBranchStatement: newVal }
                    } : null);
                  }}
                  style={{ cursor: 'pointer', fontSize: '24px', display: 'inline-flex', alignItems: 'center' }}
                  title={permModalRep.permissions?.canViewBranchStatement ? 'Disable Branch S&S' : 'Enable Branch S&S'}
                >
                  {permModalRep.permissions?.canViewBranchStatement ? (
                    <FiToggleRight style={{ color: '#10b981' }} size={28} />
                  ) : (
                    <FiToggleLeft style={{ color: 'var(--text-muted)' }} size={28} />
                  )}
                </span>
              </div>

              {/* Br-CW Toggle */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: '10px',
                border: '1px solid var(--border)'
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-white)', fontSize: '14px' }}>Branch CW (Br-CW)</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Branch Customer Wise report viewing access</div>
                </div>
                <span 
                  onClick={async () => {
                    const newVal = !permModalRep.permissions?.canViewBranchCustomerWise;
                    await handleToggleBranchCwPermission(permModalRep._id);
                    setPermModalRep(prev => prev ? {
                      ...prev,
                      permissions: { ...prev.permissions, canViewBranchCustomerWise: newVal }
                    } : null);
                  }}
                  style={{ cursor: 'pointer', fontSize: '24px', display: 'inline-flex', alignItems: 'center' }}
                  title={permModalRep.permissions?.canViewBranchCustomerWise ? 'Disable Branch CW' : 'Enable Branch CW'}
                >
                  {permModalRep.permissions?.canViewBranchCustomerWise ? (
                    <FiToggleRight style={{ color: '#10b981' }} size={28} />
                  ) : (
                    <FiToggleLeft style={{ color: 'var(--text-muted)' }} size={28} />
                  )}
                </span>
              </div>

            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary"
                onClick={() => setPermModalRep(null)}
                style={{ padding: '8px 24px' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Company Management Modal */}
      {companyModalRep && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '500px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', margin: '20px', padding: '24px', position: 'relative' }}>
            <button
              onClick={closeCompanyModal}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <FiX size={20} />
            </button>
            <h3 style={{ color: 'var(--text-white)', marginBottom: '4px', fontSize: '18px', fontWeight: 700 }}>
              Manage Companies
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              <strong>{companyModalRep.name}</strong> ({companyModalRep.customerCode}) — link S&amp;S manufacturers
            </p>

            {/* Add New Company */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
                Add Company from S&amp;S Data
              </label>
              {loadingCompanies ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px 0' }}>Loading manufacturers...</div>
              ) : availableCompanies.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px 0' }}>
                  {linkedCompanies.length > 0 ? '✅ All available companies are already linked.' : 'No S&S manufacturer data found. Upload S&S data first.'}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    className="form-input"
                    value={selectedCompany}
                    onChange={e => setSelectedCompany(e.target.value)}
                    style={{ flex: 1, padding: '8px 10px' }}
                  >
                    <option value="">— Select manufacturer —</option>
                    {availableCompanies.map(c => (
                      <option key={c.mfacCode} value={c.mfacCode}>
                        [{c.mfacCode}] {c.mfacName}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleAddCompany}
                    disabled={savingCompany || !selectedCompany}
                    style={{ whiteSpace: 'nowrap', padding: '8px 16px' }}
                  >
                    {savingCompany ? 'Adding...' : '+ Add'}
                  </button>
                </div>
              )}
            </div>

            {/* Linked Companies List */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: 600 }}>
                Linked Companies ({linkedCompanies.length})
              </label>
              {linkedCompanies.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No companies linked yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {linkedCompanies.map(c => (
                    <div key={c.mfacCode} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'rgba(99,102,241,0.08)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      borderRadius: '8px'
                    }}>
                      <div>
                        <span style={{ color: '#818cf8', fontWeight: 700, fontSize: '12px', marginRight: '8px' }}>{c.mfacCode}</span>
                        <span style={{ color: 'var(--text-white)', fontSize: '14px' }}>{c.mfacName}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveCompany(c.mfacCode, c.mfacName)}
                        disabled={removingCompany === c.mfacCode}
                        style={{
                          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                          color: '#ef4444', borderRadius: '6px', padding: '4px 10px',
                          cursor: 'pointer', fontSize: '12px', fontWeight: 600
                        }}
                      >
                        {removingCompany === c.mfacCode ? '...' : '✕ Remove'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn btn-outline" onClick={closeCompanyModal}>Close</button>
            </div>
          </div>
        </div>
      )}
      {/* ────── Duplicate Phone Warning Modal ────── */}
      {dupWarningModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10050,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 60%, #0f1629 100%)',
            border: '1px solid rgba(239,68,68,0.35)',
            borderRadius: '20px',
            padding: '36px 40px',
            maxWidth: '480px',
            width: '90%',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(239,68,68,0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
            position: 'relative',
            animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)'
          }}>
            {/* Glow effect */}
            <div style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: '200px', height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.6), transparent)'
            }} />

            {/* Icon */}
            <div style={{
              width: '60px', height: '60px', borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.08))',
              border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px', marginBottom: '20px',
              boxShadow: '0 4px 20px rgba(239,68,68,0.15)'
            }}>⚠️</div>

            {/* Title */}
            <h3 style={{
              color: '#fff', fontSize: '20px', fontWeight: 800,
              marginBottom: '12px', letterSpacing: '-0.02em',
              fontFamily: "'Outfit', sans-serif"
            }}>Duplicate Number Detected</h3>

            {/* Message */}
            <p style={{
              color: 'rgba(255,255,255,0.65)', fontSize: '14px',
              lineHeight: '1.6', marginBottom: '28px', fontWeight: 500
            }}>{dupWarningModal.message}</p>

            <p style={{
              color: '#fbbf24', fontSize: '13px', fontWeight: 700,
              marginBottom: '28px',
              background: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.2)',
              borderRadius: '10px', padding: '10px 14px'
            }}>
              📋 Do you want to proceed and assign this number anyway?
            </p>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setDupWarningModal(null)}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.7)', fontWeight: 700,
                  fontSize: '14px', cursor: 'pointer',
                  transition: 'all 0.2s ease', fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDupWarningModal(null);
                  await handleSavePhone(true);
                }}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: '12px',
                  border: '1px solid rgba(239,68,68,0.4)',
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.25), rgba(239,68,68,0.15))',
                  color: '#f87171', fontWeight: 800,
                  fontSize: '14px', cursor: 'pointer',
                  transition: 'all 0.2s ease', fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239,68,68,0.4), rgba(239,68,68,0.25))'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239,68,68,0.25), rgba(239,68,68,0.15))'; e.currentTarget.style.color = '#f87171'; }}
              >
                Yes, Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {editingRep && (
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
              onClick={closeEditModal}
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
            <h3 style={{ color: 'var(--text-white)', marginBottom: '16px', fontSize: '18px', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Edit Representative Details</span>
              <span style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600 }}>online.taramed.in</span>
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Update details for representative <strong>{editingRep.name}</strong> (MFAC Code: {editingRep.customerCode})
            </p>
             <div className="form-group" style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Company / Mfac Name
              </label>
              <input 
                type="text" 
                className="form-input" 
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', fontWeight: 600 }}
                placeholder="Enter company/manufacturer name..."
              />
            </div>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Primary Mobile Number
              </label>
              <input 
                type="text" 
                className="form-input" 
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))}
                maxLength={10}
                style={{ width: '100%', padding: '8px 10px' }}
                placeholder="Enter primary phone number..."
              />
            </div>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Password (Plain Text)
              </label>
              <input 
                type="text" 
                className="form-input" 
                value={newPassword}
                onChange={(e) => {
                  if (e.target.value.length > 10) {
                    toast.warning('Representative password cannot exceed 10 characters');
                  }
                  setNewPassword(e.target.value.slice(0, 10));
                }}
                style={{ width: '100%', padding: '8px 10px', fontFamily: 'monospace' }}
                placeholder="Enter password..."
              />
            </div>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Representative Name (Salesperson)
              </label>
              <input 
                type="text" 
                className="form-input" 
                value={newRepName}
                onChange={(e) => setNewRepName(e.target.value)}
                style={{ width: '100%', padding: '8px 10px' }}
                placeholder="Enter representative/salesperson name..."
              />
            </div>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Email Address
              </label>
              <input 
                type="email" 
                className="form-input" 
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                style={{ width: '100%', padding: '8px 10px' }}
                placeholder="Enter email address..."
              />
            </div>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Secondary Mobile Number (Phone 2)
              </label>
              <input 
                type="text" 
                className="form-input" 
                value={newPhone2}
                onChange={(e) => setNewPhone2(e.target.value.replace(/\D/g, ''))}
                maxLength={10}
                style={{ width: '100%', padding: '8px 10px' }}
                placeholder="Enter secondary phone number..."
              />
            </div>

            {/* Download Limits */}
            <div style={{ background: 'rgba(99,102,241,0.07)', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px', border: '1px solid rgba(99,102,241,0.18)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#818cf8', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📥 Daily Download Limits</div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px' }}>S&S Statement (per day)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newSsLimit}
                    min={0}
                    max={99}
                    onChange={(e) => setNewSsLimit(Math.max(0, Math.min(99, parseInt(e.target.value) || 0)))}
                    style={{ width: '100%', padding: '7px 10px', textAlign: 'center', fontWeight: 700, fontSize: '16px' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px' }}>Customer Wise (per day)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newCwLimit}
                    min={0}
                    max={99}
                    onChange={(e) => setNewCwLimit(Math.max(0, Math.min(99, parseInt(e.target.value) || 0)))}
                    style={{ width: '100%', padding: '7px 10px', textAlign: 'center', fontWeight: 700, fontSize: '16px' }}
                  />
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>0 = no downloads allowed &nbsp;|&nbsp; Default: 1 per day</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-outline" onClick={closeEditModal} disabled={savingPhone}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => handleSavePhone(false)} disabled={savingPhone}>
                {savingPhone ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload CW Period Modal */}
      {showCwUploadModal && (
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
              onClick={() => { setShowCwUploadModal(false); setCwUploadFile(null); }}
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
              Select Report Period
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Specify the month and year for this Customer Wise sales report upload.
            </p>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Select Month
              </label>
              <select 
                className="form-select"
                value={cwUploadMonth}
                onChange={(e) => setCwUploadMonth(e.target.value)}
                style={{ width: '100%', padding: '8px 10px' }}
              >
                {[
                  'January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'
                ].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Select Year
              </label>
              <select 
                className="form-select"
                value={cwUploadYear}
                onChange={(e) => setCwUploadYear(e.target.value)}
                style={{ width: '100%', padding: '8px 10px' }}
              >
                {[
                  String(new Date().getFullYear() - 1),
                  String(new Date().getFullYear()),
                  String(new Date().getFullYear() + 1)
                ].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => { setShowCwUploadModal(false); setCwUploadFile(null); }} 
                disabled={cwUploading}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={executeCwUpload} 
                disabled={cwUploading}
              >
                {cwUploading ? 'Uploading...' : 'Confirm Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Old Customer Wise Period Modal */}
      {showOldCwModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: '400px', maxWidth: '90vw', padding: '28px' }}>
            <h3 style={{ marginBottom: '8px', fontWeight: 700 }}>📜 Upload Old Customer Wise</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Select the month & year of the historical Customer Wise report you want to upload.<br />
              <span style={{ color: '#818cf8' }}>File: {oldCwFile?.name}</span>
            </p>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>Select Month</label>
              <select
                className="form-select"
                value={oldCwMonth}
                onChange={(e) => setOldCwMonth(e.target.value)}
                style={{ width: '100%', padding: '8px 10px' }}
              >
                {['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>Select Year</label>
              <select
                className="form-select"
                value={oldCwYear}
                onChange={(e) => setOldCwYear(e.target.value)}
                style={{ width: '100%', padding: '8px 10px' }}
              >
                {[String(new Date().getFullYear()-2), String(new Date().getFullYear()-1), String(new Date().getFullYear())].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-outline" onClick={() => { setShowOldCwModal(false); setOldCwFile(null); }} disabled={oldCwUploading}>Cancel</button>
              <button className="btn btn-primary" onClick={executeOldCwUpload} disabled={oldCwUploading}>
                {oldCwUploading ? 'Uploading...' : 'Confirm Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Field Permissions Modal */}
      {showFieldPermissionsModal && (
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
          <div className="card" style={{ width: '500px', margin: '20px', padding: '24px', position: 'relative', maxHeight: '80vh', overflowY: 'auto' }}>
            <button
              onClick={() => setShowFieldPermissionsModal(false)}
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
              Customer Wise Field Permissions
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Select which fields representatives for <strong>{fpSelectedMfac}</strong> can view in Customer Wise reports.
            </p>

            {fpLoading ? (
              <div className="loading-container" style={{ minHeight: '100px' }}><div className="spinner"></div></div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                {allCwFields.map((field) => (
                  <label key={field.key} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px',
                    background: fpSelectedFields.includes(field.key) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                    border: fpSelectedFields.includes(field.key) ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: 'var(--text-white)'
                  }}>
                    <input
                      type="checkbox"
                      checked={fpSelectedFields.includes(field.key)}
                      onChange={() => toggleFieldSelection(field.key)}
                      style={{ accentColor: '#10b981' }}
                    />
                    {field.label}
                  </label>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-outline" onClick={() => setShowFieldPermissionsModal(false)} disabled={fpSaving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveFieldPermissions} disabled={fpSaving || fpLoading}>
                {fpSaving ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload S&S Statement Period Modal */}
      {showStmtUploadModal && (
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
              onClick={() => { setShowStmtUploadModal(false); setStmtUploadFile(null); }}
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
              {isOldStmtUpload ? 'Upload Old / Historical Statement' : 'Select S&S Statement Period'}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              {isOldStmtUpload 
                ? 'Specify the past month and year for this historical statement upload.' 
                : 'Specify the month, year, and date range for this active S&S Statement upload.'}
            </p>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Select Month
              </label>
              <select 
                className="form-select"
                value={stmtUploadMonth}
                onChange={(e) => setStmtUploadMonth(e.target.value)}
                style={{ width: '100%', padding: '8px 10px' }}
              >
                {[
                  'January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'
                ].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Select Year
              </label>
              <select 
                className="form-select"
                value={stmtUploadYear}
                onChange={(e) => setStmtUploadYear(e.target.value)}
                style={{ width: '100%', padding: '8px 10px' }}
              >
                {[
                  String(new Date().getFullYear() - 1),
                  String(new Date().getFullYear()),
                  String(new Date().getFullYear() + 1)
                ].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            {!isOldStmtUpload && (
              <>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    From Date
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={stmtUploadStartDate}
                    onChange={(e) => setStmtUploadStartDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    To Date
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={stmtUploadEndDate}
                    onChange={(e) => setStmtUploadEndDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px' }}
                  />
                </div>
              </>
            )}
            {isOldStmtUpload && (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px', fontStyle: 'italic' }}>
                Date range will be automatically calculated from 1st to last day of selected month.
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => { setShowStmtUploadModal(false); setStmtUploadFile(null); }} 
                disabled={stmtUploading}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={executeStmtUpload} 
                disabled={stmtUploading}
              >
                {stmtUploading ? 'Uploading...' : 'Confirm Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Statement Period Modal */}
      {showArchiveModal && (
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
              onClick={() => { setShowArchiveModal(false); setArchiveSelectedPeriod(''); }}
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
              Archive Current Statement to History
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5' }}>
              Select a period that is currently in "Active/Current" status to archive. 
              This will move both <strong>S&S Statement</strong> and <strong>Customer Wise</strong> records for the selected month to the history tab.
            </p>
            
            {(() => {
              // Get unique list of current periods
              const currentPs = [];
              const seen = new Set();
              
              stmtPeriods.forEach(p => {
                if (!p.isHistorical) {
                  const key = `${p.reportMonth}|${p.reportYear}`;
                  if (!seen.has(key)) {
                    seen.add(key);
                    currentPs.push(p);
                  }
                }
              });

              cwPeriods.forEach(p => {
                if (!p.isHistorical) {
                  const key = `${p.reportMonth}|${p.reportYear}`;
                  if (!seen.has(key)) {
                    seen.add(key);
                    currentPs.push(p);
                  }
                }
              });

              if (currentPs.length === 0) {
                return (
                  <p style={{ fontSize: '13px', color: '#f59e0b', marginBottom: '24px', fontWeight: 600 }}>
                    ⚠️ No active/current statements found to archive.
                  </p>
                );
              }

              return (
                <>
                  <div className="form-group" style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Select Period to Archive
                    </label>
                    <select 
                      className="form-select"
                      value={archiveSelectedPeriod}
                      onChange={(e) => setArchiveSelectedPeriod(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px' }}
                    >
                      <option value="">-- Choose Period --</option>
                      {currentPs.map((p, i) => (
                        <option key={i} value={`${p.reportMonth}|${p.reportYear}`}>
                          {p.reportMonth} {p.reportYear}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => { setShowArchiveModal(false); setArchiveSelectedPeriod(''); }} 
                disabled={isArchiving}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={executeArchive} 
                disabled={isArchiving || !archiveSelectedPeriod}
                style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b', color: '#fff' }}
              >
                {isArchiving ? 'Archiving...' : 'Archive Period'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Purchase Order Modal */}
      {showPoUploadModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '440px', margin: '20px', padding: '24px', position: 'relative' }}>
            <button 
              onClick={() => { setShowPoUploadModal(false); setPoUploadFile(null); }}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <FiX size={20} />
            </button>
            <h3 style={{ color: 'var(--text-white)', marginBottom: '8px', fontSize: '18px', fontWeight: 700 }}>
              Upload Purchase Order Excel
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Choose the Purchase Order Excel file to import. This will overwrite any existing purchase order data.
            </p>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-white)', fontWeight: 600, marginBottom: '8px' }}>
                Select Excel File (.xlsx, .xls)
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setPoUploadFile(e.target.files[0])}
                style={{ width: '100%', padding: '8px', fontSize: '13px', color: 'var(--text-white)', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}
              />
              {poUploadFile && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#10b981', fontWeight: 600 }}>
                  Selected: {poUploadFile.name}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => { setShowPoUploadModal(false); setPoUploadFile(null); }} 
                disabled={poUploading}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handlePoUploadSubmit} 
                disabled={poUploading || !poUploadFile}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {poUploading ? 'Uploading...' : 'Upload Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmModal}
        title={confirmModal?.title || ''}
        message={confirmModal?.message || ''}
        danger={confirmModal?.danger}
        onConfirm={confirmModal?.onConfirm || (() => {})}
        onCancel={confirmModal?.onCancel || (() => setConfirmModal(null))}
      />

      {uploadProgress !== null && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        }}>
          <div className="card" style={{ width: '420px', padding: '28px', textAlign: 'center' }}>
            <h3 style={{ color: 'var(--text-white)', marginBottom: '8px', fontWeight: 700 }}>
              {uploadProgress >= 90 ? '⚙️ Server Processing...' : '📤 Uploading File...'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
              {uploadProgress >= 90
                ? 'File received. Server is saving data, please wait...'
                : 'Sending file to server...'}
            </p>
            <div style={{
              width: '100%',
              height: '12px',
              background: '#2d3748',
              borderRadius: '6px',
              overflow: 'hidden',
              marginBottom: '12px',
              position: 'relative'
            }}>
              <div style={{
                width: `${uploadProgress}%`,
                height: '100%',
                background: uploadProgress >= 90
                  ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                  : 'linear-gradient(90deg, #3b82f6, #10b981)',
                transition: 'width 0.3s ease-out'
              }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
              <span>{uploadProgress}% Completed</span>
              <span>Please wait...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminDashboard = () => {
  return (
    <DashboardLayout navItems={navItems}>
      <Routes>
        <Route index element={<AdminOverview />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="medicines" element={<AdminMedicines />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="outstanding" element={<AdminOutstanding />} />
        <Route path="representatives" element={<AdminRepresentatives />} />
        <Route path="branch-data" element={<BranchData isAdmin={true} />} />
      </Routes>
    </DashboardLayout>
  );
};

export default AdminDashboard;
