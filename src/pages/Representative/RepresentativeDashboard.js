import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { representativesAPI } from '../../services/api';
import { toast } from 'react-toastify';
import BranchData from '../BranchData/BranchData';
import { FiHome, FiUser, FiShield, FiPhone, FiPackage, FiSearch, FiX, FiChevronLeft, FiChevronRight, FiFileText, FiDownload, FiMail, FiUsers, FiList, FiShoppingCart, FiLayers } from 'react-icons/fi';
import * as XLSX from 'xlsx';
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

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
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

const SS_TYPES = ['ss_excel', 'ss_pdf', 'summary_excel', 'summary_pdf'];

const checkDownloadLimit = (userOrId, type, label) => {
  if (!userOrId) return true;
  
  let userId = '';
  let ssLimit = 2;
  let cwLimit = 2;
  
  if (typeof userOrId === 'object') {
    userId = userOrId.id || userOrId._id;
    ssLimit = Number(userOrId.permissions?.ssDownloadLimit) >= 0 ? Number(userOrId.permissions.ssDownloadLimit) : 2;
    cwLimit = Number(userOrId.permissions?.cwDownloadLimit) >= 0 ? Number(userOrId.permissions.cwDownloadLimit) : 2;
  } else {
    userId = userOrId;
  }
  
  if (!userId) return true;
  
  const today = new Date().toISOString().split('T')[0];
  const limit = type === 'cw_excel' ? cwLimit : ssLimit;

  let currentCount = 0;
  if (type === 'cw_excel') {
    // CW: count only cw_excel
    const val = localStorage.getItem(`dl_limit_${userId}_${today}_cw_excel`);
    currentCount = parseInt(val, 10) || 0;
  } else {
    // S&S: count ALL types combined (ss_excel + ss_pdf + summary_excel + summary_pdf)
    SS_TYPES.forEach(t => {
      const val = localStorage.getItem(`dl_limit_${userId}_${today}_${t}`);
      currentCount += parseInt(val, 10) || 0;
    });
  }

  if (currentCount >= limit) {
    toast.warning(`Daily download limit reached. You are allowed ${limit} S&S download(s) per day.`, {
      toastId: `dl-warning-ss`
    });
    return false;
  }
  return true;
};

const recordDownloadSuccess = (userId, type) => {
  if (!userId) return;
  const today = new Date().toISOString().split('T')[0];
  const key = `dl_limit_${userId}_${today}_${type}`;
  const val = localStorage.getItem(key);
  const currentCount = (parseInt(val, 10) || 0) + 1;
  localStorage.setItem(key, String(currentCount));
};

const downloadStyledExcel = (title, filename, headerRows, dataRows, totalRows, valueRow = null, boldRows = []) => {
  const wb = XLSX.utils.book_new();

  // Build all rows as 2D array
  const allRows = [];

  // Meta header rows (title, date, period, company)
  for (let i = 0; i < headerRows.length - 1; i++) {
    allRows.push([headerRows[i][0] || '']);
  }

  // Column headers row
  const colHeaders = headerRows[headerRows.length - 1];
  const colCount = colHeaders.length || 10;

  allRows.push(colHeaders);

  // Data rows
  dataRows.forEach(row => allRows.push(row));

  // Total row
  allRows.push(totalRows);

  // Optional value row
  if (valueRow) allRows.push(valueRow);

  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Column widths
  ws['!cols'] = Array.from({ length: colCount }, (_, i) => ({
    wch: i === 0 ? 35 : 14
  }));

  // Style: merge meta header rows across all columns
  const metaRowCount = headerRows.length - 1;
  ws['!merges'] = Array.from({ length: metaRowCount }, (_, i) => ({
    s: { r: i, c: 0 },
    e: { r: i, c: colCount - 1 }
  }));

  // Apply bold styling to specified row indices
  boldRows.forEach(rowIdx => {
    const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: 0 });
    if (ws[cellRef]) {
      ws[cellRef].s = { font: { bold: true, sz: rowIdx === 0 ? 14 : 11 } };
    }
  });

  XLSX.utils.book_append_sheet(wb, ws, title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 31));

  // Blob-based download (most reliable across browsers)
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : filename.replace(/\.[^.]+$/, '.xlsx');
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
};

const getNavItems = (user) => {
  const items = [
    { path: '/representative', label: 'Dashboard', shortLabel: 'Home', icon: <FiHome />, exact: true },
    { path: '/representative/statement', label: 'S&S-D Statement', shortLabel: 'S&S-D', icon: <FiFileText /> },
    { path: '/representative/ss-summary', label: 'S&S Summary', shortLabel: 'Summary', icon: <FiList /> },
    { path: '/representative/non-moving', label: 'Non-Moving Stock', shortLabel: 'Non-Moving', icon: <FiPackage /> },
  ];
  if (user?.permissions?.canViewCustomerWise) {
    items.push({ path: '/representative/customer-wise', label: 'Customer Wise', shortLabel: 'CW', icon: <FiUsers /> });
  }
  if (user?.permissions?.canViewPurchaseOrder) {
    items.push({ path: '/representative/purchase-order', label: 'Purchase Order', shortLabel: 'PO', icon: <FiShoppingCart /> });
  }
  if (user?.permissions?.canViewBranchStatement || user?.permissions?.canViewBranchCustomerWise) {
    items.push({ path: '/representative/branch-data', label: 'Branch Data', shortLabel: 'Branch', icon: <FiLayers /> });
  }
  return items;
};

const RepresentativeOverview = () => {
  const { user } = useAuth();
  // console.log(user);
  return (
    <div className="animate-slide-up">
      <div className="page-header">
        <h1>Representative Dashboard</h1>
        <p>Welcome to your representative portal</p>
      </div>

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ color: 'var(--text-white)', fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>
            {user?.name}
          </h2>
          <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}>
            Active Representative
          </span>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <FiShield style={{ color: 'var(--accent)', fontSize: '18px' }} />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Company</div>
              <div style={{ fontSize: '16px', color: 'var(--text-white)', fontWeight: 600 }}>{user?.company || user?.name || '—'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <FiPhone style={{ color: 'var(--accent)', fontSize: '18px' }} />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Logged In Mobile Number</div>
              <div style={{ fontSize: '16px', color: 'var(--text-white)', fontWeight: 600 }}>{user?.loggedInPhone || user?.phone || '—'}</div>
            </div>

          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <FiPhone style={{ color: 'var(--accent)', fontSize: '18px' }} />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Representative Name</div>
              <div style={{ fontSize: '16px', color: 'var(--text-white)', fontWeight: 600 }}>{user?.phone2 || user?.repName || '—'}</div>
            </div>
          </div>


          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FiUser style={{ color: 'var(--accent)', fontSize: '18px' }} />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Email</div>
              <div style={{ fontSize: '16px', color: 'var(--text-white)', fontWeight: 600 }}>{user?.email || '—'}</div>
            </div>
          </div>
        </div>

        {/* <div style={{
          marginTop: '30px',
          padding: '16px',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: 'var(--radius-md)',
          color: '#10b981',
          fontSize: '13px',
          textAlign: 'center'
        }}>
          ✅ Your account is active. You can log in securely using your mobile number.
        </div> */}
      </div>
    </div>
  );
};

const RepresentativeStock = () => {
  const [stock, setStock] = useState([]);
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Debounce stock search
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(search);
    }, 450);
    return () => clearTimeout(handler);
  }, [search]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedMfac, setSelectedMfac] = useState('');
  const [manufacturers, setManufacturers] = useState([]);

  const fetchStock = async (p = 1) => {
    try {
      setLoading(true);
      const res = await representativesAPI.getStock({ 
        search: searchQuery, 
        page: p, 
        limit: 50,
        mfacCodeFilter: selectedMfac
      });
      setStock(res.data.data || []);
      setPage(res.data.page);
      setTotalPages(res.data.totalPages);
      setTotalCount(res.data.totalCount);
      if (res.data.manufacturers) {
        setManufacturers(res.data.manufacturers || []);
      }
    } catch (error) {
      console.error('Fetch representative stock error:', error);
      toast.error('Failed to load stock records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock(1);
  }, [searchQuery, selectedMfac]); // eslint-disable-line

  return (
    <div className="animate-slide-up">
      <div className="page-header">
        <h1>Stock & Schemes 📦</h1>
        <p>View your catalog, prices, and active schemes</p>
      </div>

      <div className="card">
        {/* Search & Company Filter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '12px', flex: '1 1 auto', flexWrap: 'wrap', width: '100%', maxWidth: '100%' }}>
            <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: '350px' }}>
              <FiSearch className="search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="form-input"
                style={{ paddingLeft: '36px', width: '100%' }}
                placeholder="Search by code or item name..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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

            {/* Division/Company Filter */}
            {manufacturers.length > 1 && (
              <select
                className="form-select"
                style={{ width: '250px' }}
                value={selectedMfac}
                onChange={(e) => setSelectedMfac(e.target.value)}
              >
                <option value="">All Companies / Divisions</option>
                {manufacturers.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name} ({m.code})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Total Items: <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{totalCount}</span>
          </div>
        </div>

        {loading ? (
          <div className="loading-container" style={{ minHeight: '200px' }}><div className="spinner"></div></div>
        ) : stock.length === 0 ? (
          <div className="empty-state" style={{ minHeight: '200px' }}>
            <p>No items found in your catalog. Please contact the administrator.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table scrollable" style={{ minWidth: '900px' }}>
                <thead>
                  <tr>
                    <th>Item Code</th>
                    <th>Item Name</th>
                    <th style={{ whiteSpace: 'nowrap', minWidth: '60px' }}>Pack</th>
                    <th>MRP</th>
                    <th>Sale Rate</th>
                    <th>Stock Qty</th>
                    <th>Scheme 1</th>
                    <th>Scheme 2</th>
                    <th>Scheme 3</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((item, idx) => (
                    <tr key={item._id || idx}>
                      <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{item.itemCode || '—'}</td>
                      <td style={{ color: 'var(--text-white)', fontWeight: 500 }}>{item.name || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{item.pack || '—'}</td>
                      <td>₹{item.mrp?.toFixed(2) || '0.00'}</td>
                      <td style={{ color: '#10b981', fontWeight: 600 }}>₹{item.price?.toFixed(2) || '0.00'}</td>
                      <td style={{ color: item.stock > 0 ? 'var(--text-white)' : '#ef4444', fontWeight: item.stock > 0 ? 500 : 700 }}>
                        {item.stock || '0'}
                      </td>
                      <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{item.sch1 || '—'}</td>
                      <td>{item.sch2 || '—'}</td>
                      <td>{item.sch3 || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => fetchStock(page - 1)}
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
                  onClick={() => fetchStock(page + 1)}
                  disabled={page >= totalPages}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  Next <FiChevronRight />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const RepresentativeStatement = () => {
  const { user } = useAuth();
  const [statement, setStatement] = useState([]);
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Debounce statement search
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(search);
    }, 450);
    return () => clearTimeout(handler);
  }, [search]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedMfac, setSelectedMfac] = useState('');
  const [manufacturers, setManufacturers] = useState([]);
  const [reportMonth, setReportMonth] = useState('');
  const [reportYear, setReportYear] = useState('');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [historicalMonths, setHistoricalMonths] = useState([]);
  const [selectedStatementPeriod, setSelectedStatementPeriod] = useState('');

  useEffect(() => {
    const loadPeriods = async () => {
      try {
        const res = await representativesAPI.getStatementPeriods();
        const periods = res.data.periods || [];
        setHistoricalMonths(periods);
        if (periods.length > 0) {
          const latest = periods[periods.length - 1];
          setSelectedStatementPeriod(`${latest.reportMonth}|${latest.reportYear}|${latest.isHistorical}`);
        }
      } catch (e) {
        console.error('Failed to load statement periods', e);
      }
    };
    loadPeriods();
  }, []);

  const fetchStatement = async (p = 1) => {
    try {
      setLoading(true);
      let histMonth = '', histYear = '', isHist = false;
      if (selectedStatementPeriod) {
        const parts = selectedStatementPeriod.split('|');
        histMonth = parts[0] || '';
        histYear = parts[1] || '';
        isHist = parts[2] === 'true';
      }

      const res = await representativesAPI.getStatement({ 
        search: searchQuery, 
        page: p, 
        limit: 50,
        mfacCodeFilter: selectedMfac,
        isHistorical: isHist ? 'true' : 'false',
        reportMonth: histMonth,
        reportYear: histYear
      });
      setStatement(res.data.data || []);
      setPage(res.data.page);
      setTotalPages(res.data.totalPages);
      setTotalCount(res.data.totalCount);
      if (res.data.manufacturers) {
        setManufacturers(res.data.manufacturers || []);
      }
      setReportMonth(res.data.reportMonth || '');
      setReportYear(res.data.reportYear || '');
      setReportStartDate(res.data.reportStartDate || '');
      setReportEndDate(res.data.reportEndDate || '');
    } catch (error) {
      console.error('Fetch representative statement error:', error);
      toast.error('Failed to load statement records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatement(1);
  }, [searchQuery, selectedMfac, selectedStatementPeriod]); // eslint-disable-line

  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Helper to save blob as file
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

  const handleDownloadExcel = async () => {
    if (!checkDownloadLimit(user, 'ss_excel', 'S&S-D Excel')) return;
    let success = false;
    try {
      setDownloading(true);
      setDownloadSuccess(false);

      let histMonth = '', histYear = '', isHist = false;
      if (selectedStatementPeriod) {
        const parts = selectedStatementPeriod.split('|');
        histMonth = parts[0] || '';
        histYear = parts[1] || '';
        isHist = parts[2] === 'true';
      }

      // Fetch ALL data (no pagination)
      const res = await representativesAPI.getStatementAll({ 
        mfacCodeFilter: selectedMfac,
        isHistorical: isHist ? 'true' : 'false',
        reportMonth: histMonth,
        reportYear: histYear,
        downloadType: 'ss_excel'
      });

      const allData = res.data.data || [];
      const companyName = res.data.companyName || '';
      const reportMonth = res.data.reportMonth || '';
      const reportYear = res.data.reportYear || '';
      const startDate = formatDate(res.data.reportStartDate);
      const endDate = formatDate(res.data.reportEndDate);

      if (allData.length === 0) {
        toast.warning('No data to download');
        return;
      }

      // Build header info
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = today.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      // Create workbook
      const wb = XLSX.utils.book_new();

      let reportPeriodStr = '';
      if (reportMonth || reportYear) {
        reportPeriodStr = `Stock and Sales From: ${reportMonth} ${reportYear}`;
        if (startDate && endDate) {
          reportPeriodStr += ` (${startDate} to ${endDate})`;
        }
      }

      // Header rows - ensure exact column count
      const headerRows = [
        ['Tara Medicos Pvt Ltd, Jaipur'],
        [`Date: ${dateStr} `],
        [reportPeriodStr],
        [companyName ? `Company: ${companyName}` : ''],
        [],
        ['Item Name', 'Pack', 'Op. Bal', 'Op. Value', 'Pur Qty', 'Pur Value', 'Pur Sch. Qty', 'Sale Qty', 'Sale Value', 'Free Qty', 'Br. Qty', 'Br. Value', 'CR Qty', 'CR Value', 'DB Qty', 'DB Value', 'Adj. Qty', 'Adj. Value', 'Closing Qty', 'Closing Value']
      ];

      // Helper: format value columns to 2 decimal places; 0 shows as 0
      const formatDetailedVal = (val) => {
        const num = Number(val);
        if (isNaN(num)) return val || 0;
        return { v: num, t: 'n', z: '0.00;-0.00;0' };
      };

      // Data rows — no Item Code - ensure numeric values are numbers, not strings
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

      const divLabel = companyName || 'S&S';
      const fileName = `S&S_Statement_${divLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr.replace(/\//g, '-')}.xlsx`;

      downloadStyledExcel(divLabel, fileName, headerRows, dataRows, totalRow);

      success = true;
      setDownloadSuccess(true);
      recordDownloadSuccess(user?.id || user?._id, 'ss_excel');
      setTimeout(() => {
        setDownloading(false);
        setDownloadSuccess(false);
      }, 1500);
    } catch (error) {
      console.error('Download error:', error);
      const errMsg = error.response?.data?.message || 'Failed to download S&S statement';
      toast.error(errMsg);
    } finally {
      if (!success) {
        setDownloading(false);
      }
    }
  };

  const handleDownloadPdf = async () => {
    if (!checkDownloadLimit(user, 'ss_pdf', 'S&S-D PDF')) return;
    let success = false;
    try {
      setDownloading(true);
      setDownloadSuccess(false);

      const img = await loadImage('/a.png');

      let histMonth = '', histYear = '', isHist = false;
      if (selectedStatementPeriod) {
        const parts = selectedStatementPeriod.split('|');
        histMonth = parts[0] || '';
        histYear = parts[1] || '';
        isHist = parts[2] === 'true';
      }

      // Fetch all statement records (same data as Excel)
      const res = await representativesAPI.getStatementAll({ 
        mfacCodeFilter: selectedMfac,
        isHistorical: isHist ? 'true' : 'false',
        reportMonth: histMonth,
        reportYear: histYear,
        downloadType: 'ss_pdf'
      });

      const allData = res.data.data || [];
      const companyName = res.data.companyName || '';
      const divisionName = res.data.divisionName || '';
      const reportMonth = res.data.reportMonth || '';
      const reportYear = res.data.reportYear || '';
      const startDate = formatDate(res.data.reportStartDate);
      const endDate = formatDate(res.data.reportEndDate);

      if (allData.length === 0) {
        toast.warning('No statement records to download');
        return;
      }

      const today = new Date();
      const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = today.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      // Create PDF in landscape orientation
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const logoWidth = 15;
      const logoHeight = img ? (img.height / img.width) * logoWidth : 0;
      if (img) {
        doc.addImage(img, 'PNG', 14, 10, logoWidth, logoHeight);
      }
      const textX = img ? 14 + logoWidth + 4 : 14;

      // 1. Header Information
      let headerY = 14;
      doc.setFontSize(13);
      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'bold');
      doc.text('Tara Medicos Pvt Ltd, Jaipur', textX, headerY);

      headerY += 5;
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(90, 90, 90);
      doc.text(`Date: ${dateStr}  `, textX, headerY);

      if (companyName || divisionName) {
        headerY += 4.5;
        doc.text(`Company: ${companyName || '—'}`, textX, headerY);
      }

      if (reportMonth && reportYear) {
        headerY += 4.5;
        doc.text(`Stock and Sales From: ${startDate && endDate ? ` (${startDate} to ${endDate})` : ''}`, textX, headerY);
      }

      // 2. Columns and rows for jsPDF autoTable (20 columns matching Excel/UI)
      const headers = [
        [
          'Item Name', 'Pack', 
          'Op. Bal', 'Op. Val', 
          'Pur Qty', 'Pur Val', 'Pur Sch', 
          'Sale Qty', 'Sale Val', 'Free Qty', 
          'Br. Qty', 'Br. Val', 
          'CR Qty', 'CR Val', 
          'DB Qty', 'DB Val', 
          'Adj Qty', 'Adj Val', 
          'Closing Qty', 'Closing Val'
        ]
      ];

      const rows = allData.map(item => [
        item.itemName || '',
        item.pack || '',
        item.opBalance || 0,
        parseFloat(item.opValue || 0).toFixed(2),
        item.purQty || 0,
        parseFloat(item.purValue || 0).toFixed(2),
        item.purSchQty || 0,
        item.saleQty || 0,
        parseFloat(item.saleValue || 0).toFixed(2),
        item.freeQty || 0,
        item.brQty || 0,
        parseFloat(item.brValue || 0).toFixed(2),
        item.crQty || 0,
        parseFloat(item.crValue || 0).toFixed(2),
        item.dbQty || 0,
        parseFloat(item.dbValue || 0).toFixed(2),
        item.adjQty || 0,
        parseFloat(item.adjValue || 0).toFixed(2),
        item.balQty || 0,
        parseFloat(item.balValue || 0).toFixed(2)
      ]);

      // Calculate totals
      const totalOpQty = allData.reduce((sum, item) => sum + (item.opBalance || 0), 0);
      const totalOpValue = allData.reduce((sum, item) => sum + (item.opValue || 0), 0);
      const totalPurQty = allData.reduce((sum, item) => sum + (item.purQty || 0), 0);
      const totalPurValue = allData.reduce((sum, item) => sum + (item.purValue || 0), 0);
      const totalPurSchQty = allData.reduce((sum, item) => sum + (item.purSchQty || 0), 0);
      const totalSaleQty = allData.reduce((sum, item) => sum + (item.saleQty || 0), 0);
      const totalSaleValue = allData.reduce((sum, item) => sum + (item.saleValue || 0), 0);
      const totalFreeQty = allData.reduce((sum, item) => sum + (item.freeQty || 0), 0);
      const totalBrQty = allData.reduce((sum, item) => sum + (item.brQty || 0), 0);
      const totalBrValue = allData.reduce((sum, item) => sum + (item.brValue || 0), 0);
      const totalCrQty = allData.reduce((sum, item) => sum + (item.crQty || 0), 0);
      const totalCrValue = allData.reduce((sum, item) => sum + (item.crValue || 0), 0);
      const totalDbQty = allData.reduce((sum, item) => sum + (item.dbQty || 0), 0);
      const totalDbValue = allData.reduce((sum, item) => sum + (item.dbValue || 0), 0);
      const totalAdjQty = allData.reduce((sum, item) => sum + (item.adjQty || 0), 0);
      const totalAdjValue = allData.reduce((sum, item) => sum + (item.adjValue || 0), 0);
      const totalClosingQty = allData.reduce((sum, item) => sum + (item.balQty || 0), 0);
      const totalClosingValue = allData.reduce((sum, item) => sum + (item.balValue || 0), 0);

      rows.push([
        'Total', '',
        totalOpQty, totalOpValue.toFixed(2),
        totalPurQty, totalPurValue.toFixed(2),
        totalPurSchQty,
        totalSaleQty, totalSaleValue.toFixed(2),
        totalFreeQty,
        totalBrQty, totalBrValue.toFixed(2),
        totalCrQty, totalCrValue.toFixed(2),
        totalDbQty, totalDbValue.toFixed(2),
        totalAdjQty, totalAdjValue.toFixed(2),
        totalClosingQty, totalClosingValue.toFixed(2)
      ]);

      // 3. Generate table in PDF
      const totalPagesExp = '{total_pages_count_string}';
      autoTable(doc, {
        head: headers,
        body: rows,
        startY: headerY + 4,
        margin: { top: 35, bottom: 20, left: 14, right: 14 },
        theme: 'striped',
        styles: {
          fontSize: 5.2,
          cellPadding: 0.8,
          valign: 'middle',
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [99, 102, 241],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          valign: 'middle'
        },
        columnStyles: {
          0: { cellWidth: 'auto', halign: 'left' }, // Item Name
          1: { cellWidth: 18, halign: 'left', overflow: 'ellipsis' }, // Pack - wider so "1*10" stays on one line
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'right' },
          8: { halign: 'right' },
          9: { halign: 'right' },
          10: { halign: 'right' },
          11: { halign: 'right' },
          12: { halign: 'right' },
          13: { halign: 'right' },
          14: { halign: 'right' },
          15: { halign: 'right' },
          16: { halign: 'right' },
          17: { halign: 'right' },
          18: { halign: 'right' },
          19: { halign: 'right' }
        },
        didParseCell: (data) => {
          if (data.column.index >= 2) {
            data.cell.styles.halign = 'right';
          } else {
            data.cell.styles.halign = 'left';
          }
          if (data.row.section === 'body' && data.row.index === allData.length) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 240, 255];
          }
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

      const divLabel = companyName || 'S&S_Statement';
      doc.save(`S&S_Statement_${divLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr.replace(/\//g, '-')}.pdf`);
      success = true;
      setDownloadSuccess(true);
      recordDownloadSuccess(user?.id || user?._id, 'ss_pdf');
      setTimeout(() => {
        setDownloading(false);
        setDownloadSuccess(false);
      }, 1500);
    } catch (error) {
      console.error('PDF download error:', error);
      const errMsg = error.response?.data?.message || 'Failed to generate PDF';
      toast.error(errMsg);
    } finally {
      if (!success) {
        setDownloading(false);
      }
    }
  };

  return (
    <div className="animate-slide-up">
      <div className="page-header page-header-flex">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            S&S Statement 📊
          </h1>
          <p style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            View your opening balance, purchase, sales, and closing balance statements
            {reportMonth && reportYear && (
              <span style={{ padding: '3px 10px', background: 'rgba(99, 102, 241, 0.15)', color: '#000000', borderRadius: '12px', fontSize: '13px', fontWeight: 700, border: '1px solid rgba(99,102,241,0.3)' }}>
                Period: {reportMonth} {reportYear} {reportStartDate && reportEndDate && `(${formatDate(reportStartDate)} to ${formatDate(reportEndDate)})`}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-primary btn-sm"
            onClick={handleDownloadExcel}
            disabled={downloading || loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
          >
            <FiDownload size={15} />
            {downloading ? 'Downloading...' : 'Excel'}
          </button>
          <button 
            className="btn btn-outline btn-sm"
            onClick={handleDownloadPdf}
            disabled={downloading || loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)' }}
          >
            <FiFileText size={15} />
            {downloading ? '...' : 'PDF'}
          </button>
        </div>
      </div>

      <div className="card">
        {/* Search & Company Filter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '12px', flex: '1 1 auto', flexWrap: 'wrap', width: '100%', maxWidth: '100%' }}>
            <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: '350px' }}>
              <FiSearch className="search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="form-input"
                style={{ paddingLeft: '36px', width: '100%' }}
                placeholder="Search statement by item name or code..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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

            {/* Statement Period Selector */}
            <select
              className="form-select"
              style={{ width: '220px', borderColor: 'var(--primary)' }}
              value={selectedStatementPeriod}
              onChange={(e) => setSelectedStatementPeriod(e.target.value)}
            >
              {historicalMonths.map((p, i) => (
                <option key={i} value={`${p.reportMonth}|${p.reportYear}|${p.isHistorical}`}>
                  {p.isHistorical ? '📜 ' : '📋 '}{p.reportMonth} {p.reportYear}
                </option>
              ))}
            </select>

            {/* Division/Company Filter */}
            {manufacturers.length > 1 && (
              <select
                className="form-select"
                style={{ width: '250px' }}
                value={selectedMfac}
                onChange={(e) => setSelectedMfac(e.target.value)}
              >
                <option value="">All Companies / Divisions</option>
                {manufacturers.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name} ({m.code})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Total Items: <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{totalCount}</span>
          </div>
        </div>

        {loading ? (
          <div className="loading-container" style={{ minHeight: '200px' }}><div className="spinner"></div></div>
        ) : statement.length === 0 ? (
          <div className="empty-state" style={{ minHeight: '200px' }}>
            <p>No statement records found for your catalog. Please contact the administrator.</p>
          </div>
        ) : (
          <>
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table className="table scrollable" style={{ width: '100%', minWidth: '1700px' }}>
                <thead>
                  <tr>
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
                  </tr>
                </thead>
                <tbody>
                  {statement.map((item, idx) => (
                    <tr key={item._id || idx}>
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
                    </tr>
                  ))}
                  <tr style={{ background: 'rgba(99,102,241,0.10)', fontWeight: 700, borderTop: '2px solid var(--border)', fontSize: '12px' }}>
                    <td style={{ color: 'var(--text-white)' }}>Total</td>
                    <td></td>
                    <td style={{ textAlign: 'right' }}>{statement.reduce((s,i)=>s+(i.opBalance||0),0)}</td>
                    <td style={{ textAlign: 'right' }}>{statement.reduce((s,i)=>s+(i.opValue||0),0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>{statement.reduce((s,i)=>s+(i.purQty||0),0)}</td>
                    <td style={{ textAlign: 'right' }}>{statement.reduce((s,i)=>s+(i.purValue||0),0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>{statement.reduce((s,i)=>s+(i.purSchQty||0),0)}</td>
                    <td style={{ textAlign: 'right' }}>{statement.reduce((s,i)=>s+(i.saleQty||0),0)}</td>
                    <td style={{ textAlign: 'right' }}>{statement.reduce((s,i)=>s+(i.saleValue||0),0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>{statement.reduce((s,i)=>s+(i.freeQty||0),0)}</td>
                    <td style={{ textAlign: 'right' }}>{statement.reduce((s,i)=>s+(i.brQty||0),0)}</td>
                    <td style={{ textAlign: 'right' }}>{statement.reduce((s,i)=>s+(i.brValue||0),0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>{statement.reduce((s,i)=>s+(i.crQty||0),0)}</td>
                    <td style={{ textAlign: 'right' }}>{statement.reduce((s,i)=>s+(i.crValue||0),0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>{statement.reduce((s,i)=>s+(i.dbQty||0),0)}</td>
                    <td style={{ textAlign: 'right' }}>{statement.reduce((s,i)=>s+(i.dbValue||0),0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>{statement.reduce((s,i)=>s+(i.adjQty||0),0)}</td>
                    <td style={{ textAlign: 'right' }}>{statement.reduce((s,i)=>s+(i.adjValue||0),0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent)' }}>{statement.reduce((s,i)=>s+(i.balQty||0),0)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent)' }}>{statement.reduce((s,i)=>s+(i.balValue||0),0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => fetchStatement(page - 1)}
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
                  onClick={() => fetchStatement(page + 1)}
                  disabled={page >= totalPages}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  Next <FiChevronRight />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Download Loading Overlay */}
      {downloading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '32px 40px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)', minWidth: '280px', textAlign: 'center'
          }}>
            {!downloadSuccess ? (
              <>
                <div style={{
                  width: '44px', height: '44px',
                  border: '3px solid rgba(99,102,241,0.2)',
                  borderTop: '3px solid #6366f1',
                  borderRadius: '50%', animation: 'spin 0.8s linear infinite'
                }} />
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-white)', marginBottom: '6px' }}>
                    Preparing Document
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Please wait, generating your file…
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{
                  width: '44px', height: '44px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  border: '2px solid #10b981',
                  animation: 'pulse 1s ease'
                }}>
                  ✓
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-white)', marginBottom: '6px' }}>
                    Download Ready!
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Your file has been downloaded.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const CustomerWiseReport = () => {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Debounce customer wise search
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(search);
    }, 450);
    return () => clearTimeout(handler);
  }, [search]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedMfac, setSelectedMfac] = useState('');
  const [manufacturers, setManufacturers] = useState([]);
  const [reportMonth, setReportMonth] = useState('');
  const [reportYear, setReportYear] = useState('');
  const [selectedStatementPeriod, setSelectedStatementPeriod] = useState('');
  const [allowedFields, setAllowedFields] = useState([]);
  const [availablePeriods, setAvailablePeriods] = useState([]);

  // Helper function to get days in month
  const getDaysInMonth = (monthName, year) => {
    const monthMap = {
      'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
      'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11
    };
    const monthIndex = monthMap[monthName];
    if (monthIndex === undefined) return 30;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    return daysInMonth;
  };

  // Meta configuration for all 21 possible columns in Customer Wise report
  const CW_FIELDS_META = [
    { key: 'mfacCode', label: 'Mfac Code', type: 'accent-bold' },
    { key: 'companyDivision', label: 'Company Division', type: 'text' },
    { key: 'itemCode', label: 'Item Code', type: 'accent-bold' },
    { key: 'itemName', label: 'Item Name', type: 'white-bold' },
    { key: 'packName', label: 'Pack Size', type: 'text' },
    { key: 'qty', label: 'Qty', type: 'number', align: 'right' },
    { key: 'schemeQty', label: 'Scheme Qty', type: 'scheme-qty', align: 'right' },
    { key: 'saleRate', label: 'Sale Rate', type: 'decimal', align: 'right' },
    { key: 'amount', label: 'Amount', type: 'amount-calc', align: 'right' },
    { key: 'discount', label: 'Discount', type: 'decimal', align: 'right' },
    { key: 'customerCode', label: 'Customer Code', type: 'accent-bold' },
    { key: 'customerName', label: 'Customer Name', type: 'white-bold' },
    { key: 'customerAddress', label: 'Address', type: 'address' },
    { key: 'customerCity', label: 'City', type: 'text' },
    { key: 'customerPin', label: 'PIN', type: 'text' },
    { key: 'customerMobile', label: 'Mobile', type: 'text' },
    { key: 'customerEmail', label: 'Email', type: 'text' },
    { key: 'gst', label: 'GST', type: 'monospace' },
    { key: 'routeName', label: 'Route', type: 'text' },
    { key: 'dmanName', label: 'Dman', type: 'text' },
    { key: 'areaName', label: 'Area', type: 'text' }
  ];

  const defaultFields = ['itemName', 'packName', 'qty', 'schemeQty', 'saleRate', 'amount', 'customerCode', 'customerName', 'customerAddress', 'customerCity'];
  const currentAllowed = allowedFields.length > 0 ? allowedFields : defaultFields;
  const activeFields = CW_FIELDS_META.filter(field => currentAllowed.includes(field.key));

  useEffect(() => {
    representativesAPI.getCWHistoricalMonths()
      .then(r => {
        const periods = r.data.months || [];
        setAvailablePeriods(periods);
        if (periods.length > 0) {
          const latest = periods[periods.length - 1];
          setSelectedStatementPeriod(`${latest.reportMonth}|${latest.reportYear}|${latest.isHistorical}`);
        }
      })
      .catch(() => {});
  }, []);

  const fetchData = async (p = 1) => {
    try {
      setLoading(true);
      let histMonth = '', histYear = '', isHist = false;
      if (selectedStatementPeriod) {
        const parts = selectedStatementPeriod.split('|');
        histMonth = parts[0];
        histYear = parts[1];
        isHist = parts[2] === 'true';
      }
      const res = await representativesAPI.getCustomerWise({
        search: searchQuery,
        page: p,
        limit: 50,
        mfacCodeFilter: selectedMfac,
        isHistorical: isHist ? 'true' : 'false',
        reportMonth: histMonth,
        reportYear: histYear
      });
      setData(res.data.data || []);
      setPage(res.data.page);
      setTotalPages(res.data.totalPages);
      setTotalCount(res.data.totalCount);
      setAllowedFields(res.data.allowedFields || []);
      if (res.data.manufacturers) {
        setManufacturers(res.data.manufacturers || []);
      }
      setReportMonth(res.data.reportMonth || '');
      setReportYear(res.data.reportYear || '');
    } catch (error) {
      console.error('Fetch customer wise error:', error);
      toast.error('Failed to load customer wise data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
  }, [searchQuery, selectedMfac, selectedStatementPeriod]); // eslint-disable-line

  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

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

  const handleDownloadExcel = async () => {
    if (!checkDownloadLimit(user, 'cw_excel', 'Customer Wise Excel')) return;
    let success = false;
    try {
      setDownloading(true);
      setDownloadSuccess(false);

      let histMonth = '', histYear = '', isHist = false;
      if (selectedStatementPeriod) {
        const parts = selectedStatementPeriod.split('|');
        histMonth = parts[0] || '';
        histYear = parts[1] || '';
        isHist = parts[2] === 'true';
      }

      const res = await representativesAPI.getCustomerWiseAll({
        mfacCodeFilter: selectedMfac,
        isHistorical: isHist ? 'true' : 'false',
        reportMonth: histMonth,
        reportYear: histYear,
        downloadType: 'cw_excel'
      });

      const allData = res.data.data || [];
      const companyName = res.data.companyName || '';
      const divisionName = res.data.divisionName || '';
      const currentMonthName = new Date().toLocaleString('en-US', { month: 'long' });
      const currentYearNum = new Date().getFullYear();
      const month = histMonth || res.data.reportMonth || currentMonthName;
      const year = histYear || res.data.reportYear || currentYearNum;
      const dlAllowedFields = res.data.allowedFields || allowedFields || ['customerName', 'itemName', 'qty', 'schemeQty', 'saleRate', 'amount'];

      if (allData.length === 0) {
        toast.warning('No data to download');
        return;
      }

      const today = new Date();
      const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const displayCompany = companyName || user?.name || '';
      const activeFields = CW_FIELDS_META.filter(field => dlAllowedFields.includes(field.key));

      // Calculate date range dynamically in proper format
      const dateRange = `${month} ${year} ${getFormattedCwPeriod(month, year)}`;

      const headerRows = [
        [' Tara Medicos Pvt Ltd, Jaipur'],
        [` Date: ${dateStr}  `],
        [`Customer Wise Sales from : ${dateRange}`],
        [`Company: ${displayCompany}`],
        [],
        activeFields.map(field => field.label)
      ];

      const dataRows = allData.map(item => {
        return activeFields.map(field => {
          const val = item[field.key];
          const isBlank = val === undefined || val === null || String(val).trim() === '';
          if (isBlank) return '-';

          if (field.type === 'number' || field.type === 'scheme-qty') {
            // qty and schemeQty are integers
            const numVal = Number(val);
            return isNaN(numVal) ? 0 : Math.round(numVal);
          }
          if (field.type === 'decimal' || field.type === 'amount-calc') {
            let numVal = Number(val);
            if (field.type === 'amount-calc' && !numVal) {
              numVal = (Number(item.qty) || 0) * (Number(item.saleRate) || 0);
            }
            return isNaN(numVal) ? { v: 0.00, t: 'n', z: '0.00' } : { v: numVal, t: 'n', z: '0.00' };
          }
          return val;
        });
      });

      const totalRow = activeFields.map((field, idx) => {
        if (idx === 0) return 'Total';
        if (['qty', 'schemeQty'].includes(field.key)) {
          const total = allData.reduce((sum, item) => sum + (Number(item[field.key]) || 0), 0);
          return Math.round(total);
        }
        if (field.key === 'amount') {
          const total = allData.reduce((sum, item) => {
            let val = Number(item[field.key]);
            if (!val) val = (Number(item.qty) || 0) * (Number(item.saleRate) || 0);
            return sum + (val || 0);
          }, 0);
          return { v: total, t: 'n', z: '0.00' };
        }
        return '';
      });

      const divLabel = divisionName || companyName || 'CustomerWise';
      const fileName = `Customer_Wise_${divLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr.replace(/\//g, '-')}.xlsx`;

      downloadStyledExcel(divLabel, fileName, headerRows, dataRows, totalRow, null, [0, 1]);

      success = true;
      setDownloadSuccess(true);
      recordDownloadSuccess(user?.id || user?._id, 'cw_excel');
      setTimeout(() => {
        setDownloading(false);
        setDownloadSuccess(false);
      }, 1500);
    } catch (error) {
      console.error('Download error:', error);
      const errMsg = error.response?.data?.message || 'Failed to download customer wise report';
      toast.error(errMsg);
    } finally {
      if (!success) setDownloading(false);
    }
  };

  const handleDownloadCwPdf = async () => {
    if (!checkDownloadLimit(user, 'cw_pdf', 'Customer Wise PDF')) return;
    let success = false;
    try {
      setDownloading(true);
      setDownloadSuccess(false);

      let histMonth = '', histYear = '', isHist = false;
      if (selectedStatementPeriod) {
        const parts = selectedStatementPeriod.split('|');
        histMonth = parts[0] || '';
        histYear = parts[1] || '';
        isHist = parts[2] === 'true';
      }

      const res = await representativesAPI.getCustomerWiseAll({
        mfacCodeFilter: selectedMfac,
        isHistorical: isHist ? 'true' : 'false',
        reportMonth: histMonth,
        reportYear: histYear,
        downloadType: 'cw_pdf'
      });

      const allData = res.data.data || [];
      if (allData.length === 0) { toast.warning('No data to download'); return; }

      const companyName = res.data.companyName || selectedMfac || '';
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const rMonth = histMonth || res.data.reportMonth || '';
      const rYear = histYear || res.data.reportYear || '';

      // Group data by customer
      const customerMap = new Map();
      allData.forEach(item => {
        const key = item.customerCode || item.customerName || 'Unknown';
        if (!customerMap.has(key)) {
          customerMap.set(key, {
            customerCode: item.customerCode || '',
            customerName: item.customerName || '',
            customerAddress: item.customerAddress || '',
            customerCity: item.customerCity || '',
            items: []
          });
        }
        customerMap.get(key).items.push(item);
      });

      const img = await loadImage('/a.png');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const totalPagesExp = '{total_pages_count_string}';
      const pageW = doc.internal.pageSize.width;
      const pageH = doc.internal.pageSize.height;

      const drawHeader = () => {
        const logoW = 14;
        const logoH = img ? (img.height / img.width) * logoW : 0;
        if (img) doc.addImage(img, 'PNG', 14, 8, logoW, logoH);
        const tx = img ? 14 + logoW + 3 : 14;
        doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 80);
        doc.text('Tara Medicos Pvt Ltd, Jaipur', tx, 14);
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
        doc.text('Shop No. 15, Chandpole Bazar, Jaipur - 302001 | Ph: 0141-2318580', tx, 19);
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
        doc.text(`Customer Wise Sales Report  |  Period: ${rMonth} ${rYear}`, tx, 24);
        if (companyName) doc.text(`Company / Division: ${companyName}`, tx, 29);
        doc.setTextColor(180, 180, 180);
        doc.text(`Date: ${dateStr}`, pageW - 14, 14, { align: 'right' });
        doc.setDrawColor(99, 102, 241);
        doc.setLineWidth(0.5);
        doc.line(14, 32, pageW - 14, 32);
        doc.setTextColor(0, 0, 0);
      };

      drawHeader();
      let curY = 36;
      const customers = Array.from(customerMap.values());

      customers.forEach((cust, ci) => {
        if (curY > pageH - 40) {
          doc.addPage();
          drawHeader();
          curY = 36;
        }

        doc.setFillColor(237, 237, 255);
        doc.roundedRect(14, curY, pageW - 28, 10, 2, 2, 'F');
        doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 100);
        doc.text(`${ci + 1}. ${cust.customerName}`, 17, curY + 7);
        if (cust.customerCode) {
          doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 160);
          doc.text(`Code: ${cust.customerCode}`, pageW - 16, curY + 7, { align: 'right' });
        }
        curY += 12;

        if (cust.customerAddress || cust.customerCity) {
          doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
          const addrLine = [cust.customerAddress, cust.customerCity].filter(Boolean).join(', ');
          doc.text(`Addr: ${addrLine}`, 17, curY);
          curY += 5;
        }

        const tableHead = [['#', 'Item Name', 'Pack', 'Qty', 'Sch.Qty', 'Rate', 'Amount']];
        const tableBody = cust.items.map((item, idx) => {
          const amount = (Number(item.qty) || 0) * (Number(item.saleRate) || 0);
          return [
            idx + 1,
            item.itemName || '-',
            item.packName || '',
            Math.round(Number(item.qty) || 0),
            Math.round(Number(item.schemeQty) || 0),
            Number(item.saleRate || 0).toFixed(2),
            amount.toFixed(2)
          ];
        });

        const totalQty = cust.items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
        const totalSchQty = cust.items.reduce((s, i) => s + (Number(i.schemeQty) || 0), 0);
        const totalAmt = cust.items.reduce((s, i) => s + ((Number(i.qty) || 0) * (Number(i.saleRate) || 0)), 0);

        autoTable(doc, {
          startY: curY,
          head: tableHead,
          body: tableBody,
          foot: [['', 'Total', '', Math.round(totalQty), Math.round(totalSchQty), '', totalAmt.toFixed(2)]],
          margin: { left: 14, right: 14 },
          styles: { fontSize: 7.8, cellPadding: 2, valign: 'middle', overflow: 'linebreak' },
          headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
          footStyles: { fillColor: [220, 225, 255], textColor: [30, 30, 100], fontStyle: 'bold', fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 7, halign: 'center' },
            1: { cellWidth: 'auto', halign: 'left' },
            2: { cellWidth: 18, halign: 'center' },
            3: { cellWidth: 14, halign: 'right' },
            4: { cellWidth: 16, halign: 'right' },
            5: { cellWidth: 18, halign: 'right' },
            6: { cellWidth: 22, halign: 'right' }
          },
          didParseCell: (data) => {
            if (data.section === 'foot' && data.column.index === 6) {
              data.cell.styles.textColor = [20, 100, 20];
              data.cell.styles.fontStyle = 'bold';
            }
          },
          didDrawPage: (data) => {
            if (data.pageNumber > 1) drawHeader();
            doc.setFontSize(7.5); doc.setTextColor(160, 160, 160);
            doc.text(`Page ${data.pageNumber} of ${totalPagesExp}`, pageW - 14, pageH - 7, { align: 'right' });
            doc.text('Tara Medicos Pvt Ltd, Jaipur', 14, pageH - 7);
          }
        });

        curY = doc.lastAutoTable.finalY + 6;
        if (ci < customers.length - 1) {
          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.3);
          doc.line(14, curY - 2, pageW - 14, curY - 2);
        }
      });

      if (typeof doc.putTotalPages === 'function') doc.putTotalPages(totalPagesExp);
      const divLabel = companyName || 'CW';
      doc.save(`CW_CustomerWise_${divLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${rMonth}_${rYear}.pdf`);
      success = true;
      setDownloadSuccess(true);
      setTimeout(() => { setDownloading(false); setDownloadSuccess(false); }, 1500);
    } catch (error) {
      console.error('CW PDF error:', error);
      toast.error('Failed to generate Customer Wise PDF');
    } finally {
      if (!success) setDownloading(false);
    }
  };

  return (
    <div className="animate-slide-up">
      <style>{`
        @media (max-width: 768px) {
          .cw-filters-container {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .cw-filter-group {
            flex-direction: column !important;
            align-items: stretch !important;
            width: 100% !important;
            gap: 10px !important;
          }
          .cw-filter-item {
            width: 100% !important;
            max-width: none !important;
          }
          .cw-total-records {
            text-align: right !important;
            font-size: 13px !important;
            margin-top: 4px !important;
            width: 100% !important;
          }
          .cw-table-card {
            padding: 14px 12px !important;
            border-radius: 12px !important;
          }
          .cw-desktop-table {
            display: none !important;
          }
          .cw-mobile-cards {
            display: block !important;
          }
        }
        @media (min-width: 769px) {
          .cw-desktop-table {
            display: block !important;
          }
          .cw-mobile-cards {
            display: none !important;
          }
        }
      `}</style>
      <div className="page-header page-header-flex">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            Customer Wise Report 👥
          </h1>
          <p style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            View which items were sold to which customers
            {reportMonth && reportYear && (
              <span style={{ padding: '3px 10px', background: 'rgba(99, 102, 241, 0.15)', color: '#000000', borderRadius: '12px', fontSize: '13px', fontWeight: 700, border: '1px solid rgba(99,102,241,0.3)' }}>
                Period: {reportMonth} {reportYear} {getFormattedCwPeriod(reportMonth, reportYear)}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleDownloadExcel}
            disabled={downloading || loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
          >
            <FiDownload size={15} />
            {downloading ? 'Downloading...' : 'Download Excel'}
          </button>
          <button
            className="btn btn-sm"
            onClick={handleDownloadCwPdf}
            disabled={downloading || loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            <FiFileText size={15} />
            {downloading ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>

      <div className="card cw-table-card">
        <div className="cw-filters-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div className="cw-filter-group" style={{ display: 'flex', gap: '12px', flex: '1 1 auto', flexWrap: 'wrap', width: '100%', maxWidth: '100%' }}>
            <div className="cw-filter-item" style={{ position: 'relative', flex: '1 1 250px', maxWidth: '350px' }}>
              <FiSearch className="search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input cw-filter-item"
                style={{ paddingLeft: '36px', width: '100%' }}
                placeholder="Search by item, customer name or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search.trim() && (
                <button
                  onClick={() => setSearch('')}
                  title="Clear search"
                  style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                    padding: '4px', display: 'flex', alignItems: 'center'
                  }}
                >
                  <FiX size={16} />
                </button>
              )}
            </div>

            {availablePeriods.length > 0 && (
              <select
                className="form-select cw-filter-item"
                style={{ width: '220px', borderColor: 'var(--primary)' }}
                value={selectedStatementPeriod}
                onChange={(e) => setSelectedStatementPeriod(e.target.value)}
              >
                {availablePeriods.map((p, i) => (
                  <option key={i} value={`${p.reportMonth}|${p.reportYear}|${p.isHistorical}`}>
                    {p.isHistorical ? '📜 ' : '📋 '}{p.reportMonth} {p.reportYear}
                  </option>
                ))}
              </select>
            )}

            {manufacturers.length > 1 && (
              <select
                className="form-select cw-filter-item"
                style={{ width: '250px' }}
                value={selectedMfac}
                onChange={(e) => setSelectedMfac(e.target.value)}
              >
                <option value="">All Companies / Divisions</option>
                {manufacturers.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name} ({m.code})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="cw-total-records" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Total Records: <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{totalCount}</span>
          </div>
        </div>

        {loading ? (
          <div className="loading-container" style={{ minHeight: '200px' }}><div className="spinner"></div></div>
        ) : data.length === 0 ? (
          <div className="empty-state" style={{ minHeight: '200px' }}>
            <p>No customer wise records found. Please contact the administrator.</p>
          </div>
        ) : (
          <>
            <div className="table-container cw-desktop-table" style={{ overflowX: 'auto' }}>
              <table className="table scrollable" style={{ width: '100%', minWidth: activeFields.length * 120 + 'px' }}>
                <thead>
                  <tr>
                    {activeFields.map((field, idx) => (
                      <th key={field.key} style={{ textAlign: field.align || 'left' }}>
                        ({idx + 1}) {field.label.toLowerCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, idx) => (
                    <tr key={item._id || idx}>
                      {activeFields.map(field => {
                        const val = item[field.key];
                        const isBlank = val === undefined || val === null || String(val).trim() === '';

                        if (isBlank) {
                          return (
                            <td key={field.key} style={{ textAlign: field.align || 'left', color: 'var(--text-muted)' }}>-</td>
                          );
                        }

                        if (field.type === 'accent-bold') {
                          return (
                            <td key={field.key} style={{ color: 'var(--accent)', fontWeight: 500, fontSize: '12px' }}>{val}</td>
                          );
                        }
                        if (field.type === 'white-bold') {
                          return (
                            <td key={field.key} style={{ color: 'var(--text-white)', fontWeight: 500 }}>{val}</td>
                          );
                        }
                        if (['number', 'scheme-qty', 'decimal', 'amount-calc'].includes(field.type)) {
                          let numVal = Number(val);
                          if (field.type === 'amount-calc' && !numVal) numVal = (Number(item.qty) || 0) * (Number(item.saleRate) || 0);
                          // qty and schemeQty are integers — show without decimals
                          const isInt = field.type === 'number' || field.type === 'scheme-qty';
                          return (
                            <td key={field.key} style={{ textAlign: 'right', fontWeight: field.type === 'amount-calc' ? 600 : 'normal' }}>
                              {isInt ? Math.round(numVal || 0) : (numVal || 0).toFixed(2)}
                            </td>
                          );
                        }
                        if (field.type === 'address') {
                          return (
                            <td key={field.key} style={{ fontSize: '12px', maxWidth: '250px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{val}</td>
                          );
                        }
                        if (field.type === 'monospace') {
                          return (
                            <td key={field.key} style={{ fontSize: '12px', fontFamily: 'monospace' }}>{val}</td>
                          );
                        }

                        return (
                          <td key={field.key} style={{ textAlign: field.align || 'left', fontSize: '12px' }}>
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="cw-mobile-cards">
              {data.map((item, idx) => {
                // Extract key values for prominent display
                const custName = item.customerName || item['customerName'] || '';
                const custCode = item.customerCode || item['customerCode'] || '';
                const city = item.customerCity || item['customerCity'] || '';
                const itemName = item.itemName || item['itemName'] || '';
                const itemCode = item.itemCode || item['itemCode'] || '';
                const packName = item.packName || item['packName'] || '';
                const qty = item.qty !== undefined ? item.qty : '';
                const schemeQty = item.schemeQty !== undefined ? item.schemeQty : 0;
                const amount = item.amount !== undefined
                  ? item.amount
                  : (Number(item.qty) || 0) * (Number(item.saleRate) || 0);

                // Fields to skip from the generic key-value list (already shown as header/badge)
                const prominentKeys = new Set(['customerName', 'customerCode', 'customerCity', 'itemName', 'itemCode', 'packName', 'qty', 'schemeQty', 'amount', 'saleRate']);

                return (
                  <div key={item._id || idx} style={{
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '12px',
                    padding: '14px 14px 12px',
                    marginBottom: '10px'
                  }}>
                    {/* Header — Customer */}
                    {(custName || custCode) && (
                      <div style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--border-light)' }}>
                        {custName && (
                          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-white)', lineHeight: 1.3 }}>
                            {custName}
                          </div>
                        )}
                        <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600, marginTop: '2px' }}>
                          {custCode}{city ? ` · ${city}` : ''}
                        </div>
                      </div>
                    )}
                    {/* Sub-header — Item */}
                    {(itemName || itemCode) && (
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        {itemName}{packName ? ` · ${packName}` : ''}
                        {itemCode && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '6px' }}>
                            {itemCode}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Badges — Qty + Amount */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {qty !== '' && (
                        <span style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
                          Qty: {Math.round(Number(qty) || 0)}
                        </span>
                      )}
                      {amount > 0 && (
                        <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
                          ₹{Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                      {Number(schemeQty) > 0 && (
                        <span style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
                          Sch: {Math.round(Number(schemeQty))}
                        </span>
                      )}
                    </div>
                    {/* Remaining fields from activeFields */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {activeFields.filter(f => !prominentKeys.has(f.key)).map(field => {
                        const val = item[field.key];
                        const isBlank = val === undefined || val === null || String(val).trim() === '';
                        if (isBlank) return null;
                        let displayVal = val;
                        if (['number', 'scheme-qty', 'decimal', 'amount-calc'].includes(field.type)) {
                          let numVal = Number(val);
                          if (field.type === 'amount-calc' && !numVal) numVal = (Number(item.qty) || 0) * (Number(item.saleRate) || 0);
                          const isInt = field.type === 'number' || field.type === 'scheme-qty';
                          displayVal = isInt
                            ? Math.round(numVal || 0)
                            : `₹${(numVal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        }
                        return (
                          <div key={field.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '13px' }}>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>{field.label}</span>
                            <span style={{
                              color: field.type === 'white-bold' ? 'var(--text-white)' : (field.type === 'accent-bold' ? 'var(--accent)' : 'var(--text-secondary)'),
                              fontWeight: 600,
                              textAlign: 'right',
                              wordBreak: 'break-all'
                            }}>
                              {displayVal}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => fetchData(page - 1)}
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
                  onClick={() => fetchData(page + 1)}
                  disabled={page >= totalPages}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  Next <FiChevronRight />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Download Loading Overlay */}
      {downloading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '32px 40px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)', minWidth: '280px', textAlign: 'center'
          }}>
            {!downloadSuccess ? (
              <>
                <div style={{
                  width: '44px', height: '44px',
                  border: '3px solid rgba(99,102,241,0.2)',
                  borderTop: '3px solid #6366f1',
                  borderRadius: '50%', animation: 'spin 0.8s linear infinite'
                }} />
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-white)', marginBottom: '6px' }}>
                    Preparing Document
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Please wait, generating your file…
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{
                  width: '44px', height: '44px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  border: '2px solid #10b981',
                  animation: 'pulse 1s ease'
                }}>
                  ✓
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-white)', marginBottom: '6px' }}>
                    Download Ready!
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Your file has been downloaded.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const SsSummary = () => {
  const { user } = useAuth();
  const [statement, setStatement] = useState([]);
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Debounce summary search
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(search);
    }, 450);
    return () => clearTimeout(handler);
  }, [search]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedMfac, setSelectedMfac] = useState('');
  const [manufacturers, setManufacturers] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [reportMonth, setReportMonth] = useState('');
  const [reportYear, setReportYear] = useState('');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [historicalMonths, setHistoricalMonths] = useState([]);
  const [selectedStatementPeriod, setSelectedStatementPeriod] = useState('');

  useEffect(() => {
    const loadPeriods = async () => {
      try {
        const res = await representativesAPI.getStatementPeriods();
        const periods = res.data.periods || [];
        setHistoricalMonths(periods);
        if (periods.length > 0) {
          const latest = periods[periods.length - 1];
          setSelectedStatementPeriod(`${latest.reportMonth}|${latest.reportYear}|${latest.isHistorical}`);
        }
      } catch (e) {
        console.error('Failed to load statement periods', e);
      }
    };
    loadPeriods();
  }, []);

  const fetchStatement = async (p = 1) => {
    try {
      setLoading(true);
      let histMonth = '', histYear = '', isHist = false;
      if (selectedStatementPeriod) {
        const parts = selectedStatementPeriod.split('|');
        histMonth = parts[0] || '';
        histYear = parts[1] || '';
        isHist = parts[2] === 'true';
      }

      const res = await representativesAPI.getStatement({ 
        search: searchQuery, 
        page: p, 
        limit: 50,
        mfacCodeFilter: selectedMfac,
        isHistorical: isHist ? 'true' : 'false',
        reportMonth: histMonth,
        reportYear: histYear
      });
      setStatement(res.data.data || []);
      setPage(res.data.page);
      setTotalPages(res.data.totalPages);
      setTotalCount(res.data.totalCount);
      if (res.data.manufacturers) {
        setManufacturers(res.data.manufacturers || []);
      }
      setReportMonth(res.data.reportMonth || '');
      setReportYear(res.data.reportYear || '');
      setReportStartDate(res.data.reportStartDate || '');
      setReportEndDate(res.data.reportEndDate || '');
    } catch (error) {
      console.error('Fetch representative statement summary error:', error);
      toast.error('Failed to load statement records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatement(1);
  }, [searchQuery, selectedMfac, selectedStatementPeriod]); // eslint-disable-line

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

  const handleDownloadExcel = async () => {
    if (!checkDownloadLimit(user, 'summary_excel', 'Summary Excel')) return;
    let success = false;
    try {
      setDownloading(true);
      setDownloadSuccess(false);

      let histMonth = '', histYear = '', isHist = false;
      if (selectedStatementPeriod) {
        const parts = selectedStatementPeriod.split('|');
        histMonth = parts[0] || '';
        histYear = parts[1] || '';
        isHist = parts[2] === 'true';
      }

      const res = await representativesAPI.getStatementAll({ 
        mfacCodeFilter: selectedMfac,
        isHistorical: isHist ? 'true' : 'false',
        reportMonth: histMonth,
        reportYear: histYear,
        downloadType: 'summary_excel'
      });

      const allData = res.data.data || [];
      const companyName = res.data.companyName || '';
      const divisionName = res.data.divisionName || '';

      if (allData.length === 0) {
        toast.warning('No data to download');
        return;
      }

      const today = new Date();
      const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = today.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      const wb = XLSX.utils.book_new();

      const reportMonth = res.data.reportMonth || '';
      const reportYear = res.data.reportYear || '';
      const startDate = formatDate(res.data.reportStartDate);
      const endDate = formatDate(res.data.reportEndDate);

      let reportPeriodStr = '';
      if (reportMonth || reportYear) {
        reportPeriodStr = `Stock and Sales Summary From: ${reportMonth} ${reportYear}`;
        if (startDate && endDate) {
          reportPeriodStr += ` (${startDate} to ${endDate})`;
        }
      }

      const calcExcessQty = (item) => {
        const currSaleQ = (Number(item.saleQty) || 0) + (Number(item.freeQty) || 0) + (Number(item.brQty) || 0) - (Number(item.crQty) || 0) + (Number(item.adjQty) || 0);
        const rate = Number(item.saleRate) || 0;
        const pm1Q = rate > 0 ? Math.round((Number(item.preMon1SaleValue) || 0) / rate) : 0;
        const pm2Q = rate > 0 ? Math.round((Number(item.preMon2SaleValue) || 0) / rate) : 0;
        const total3MonSales = currSaleQ + pm1Q + pm2Q;
        const diff = (Number(item.balQty) || 0) - total3MonSales;
        return diff > 0 ? diff : 0;
      };

      const headerRows = [
        [' Tara Medicos Pvt Ltd, Jaipur'],
        [`Date: ${dateStr} `],
        [reportPeriodStr],
        [companyName ? `Company: ${companyName}` : ''],
        [],
        ['Item Name', 'Pack', 'Op Qty', 'Pur Qty ', 'Total Qty', 'Sale Qty', 'Bal Qty']
      ];

      // Per-item calculated values - ensure numeric values are numbers
      const dataRows = allData.map(item => {
        return [
          item.itemName || '',
          item.pack || '',
          Number(item.opBalance) || 0,
          Number(item.purQty || 0) + Number(item.purSchQty || 0),
          Number(item.opBalance || 0) + Number(item.purQty || 0) + Number(item.purSchQty || 0),
          Number(item.saleQty || 0) + Number(item.freeQty || 0) + Number(item.brQty || 0) - Number(item.crQty || 0) + Number(item.adjQty || 0),
          Number(item.balQty) || 0,
        ];
      });

      const totalOpQty = allData.reduce((sum, item) => sum + (Number(item.opBalance) || 0), 0);
      const totalOpValue = allData.reduce((sum, item) => sum + (Number(item.opValue) || 0), 0);
      const totalPurQty = allData.reduce((sum, item) => sum + (Number(item.purQty) || 0) + (Number(item.purSchQty) || 0), 0);
      const totalPurValue = allData.reduce((sum, item) => sum + (Number(item.purValue) || 0), 0);
      const totalTotalQty = totalOpQty + totalPurQty;
      const totalSaleQty = allData.reduce((sum, item) => sum + (Number(item.saleQty) || 0) + (Number(item.freeQty) || 0) + (Number(item.brQty) || 0) - (Number(item.crQty) || 0) + (Number(item.adjQty) || 0), 0);
      const totalSaleValue = allData.reduce((sum, item) => sum + (Number(item.saleValue) || 0) + (Number(item.brValue) || 0) - (Number(item.crValue) || 0) + (Number(item.adjValue) || 0), 0);
      const totalBalaQty = allData.reduce((sum, item) => sum + (Number(item.balQty) || 0), 0);
      const totalBalValue = allData.reduce((sum, item) => sum + (Number(item.balValue) || 0), 0);

      // Helper: format summary value columns to 2 decimal places; 0 shows as 0
      const formatSummaryVal = (val) => {
        const num = Number(val);
        if (isNaN(num)) return val || 0;
        return { v: num, t: 'n', z: '0.00;-0.00;0' };
      };

      // Qty totals row
      const totalRow = ['Total', '', totalOpQty, totalPurQty, totalTotalQty, totalSaleQty, totalBalaQty];
      // Value totals row (shown below qty totals) - formatted to 2 decimal places
      const valueRow = ['(values)', '', formatSummaryVal(totalOpValue), formatSummaryVal(totalPurValue), formatSummaryVal(totalOpValue + totalPurValue), formatSummaryVal(totalSaleValue), formatSummaryVal(totalBalValue), ''];

      const formattedDataRows = dataRows;
      const formattedTotalRow = totalRow;
      const formattedValueRow = valueRow;

      const divLabel = divisionName || companyName || 'SS_Summary';
      const fileName = `S&S_Summary_${divLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr.replace(/\//g, '-')}.xls`;

      downloadStyledExcel(divLabel, fileName, headerRows, formattedDataRows, formattedTotalRow, formattedValueRow);

      success = true;
      setDownloadSuccess(true);
      recordDownloadSuccess(user?.id || user?._id, 'summary_excel');
      setTimeout(() => {
        setDownloading(false);
        setDownloadSuccess(false);
      }, 1500);
    } catch (error) {
      console.error('Download error:', error);
      const errMsg = error.response?.data?.message || 'Failed to download S&S summary';
      toast.error(errMsg);
    } finally {
      if (!success) {
        setDownloading(false);
      }
    }
  };

  const handleDownloadPdf = async () => {
    if (!checkDownloadLimit(user, 'summary_pdf', 'Summary PDF')) return;
    let success = false;
    try {
      setDownloading(true);
      setDownloadSuccess(false);

      const img = await loadImage('/a.png');

      let histMonth = '', histYear = '', isHist = false;
      if (selectedStatementPeriod) {
        const parts = selectedStatementPeriod.split('|');
        histMonth = parts[0] || '';
        histYear = parts[1] || '';
        isHist = parts[2] === 'true';
      }

      const res = await representativesAPI.getStatementAll({ 
        mfacCodeFilter: selectedMfac,
        isHistorical: isHist,
        reportMonth: histMonth,
        reportYear: histYear,
        downloadType: 'summary_pdf'
      });
      const allData = res.data.data || [];
      if (allData.length === 0) { toast.warning('No data to download'); return; }

      const companyName = res.data.companyName || '';
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const rMonth = res.data.reportMonth || '';
      const rYear = res.data.reportYear || '';
      const startDate = formatDate(res.data.reportStartDate);
      const endDate = formatDate(res.data.reportEndDate);

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const totalPagesExp = '{total_pages_count_string}';

      const logoWidth = 15;
      const logoHeight = img ? (img.height / img.width) * logoWidth : 0;
      if (img) {
        doc.addImage(img, 'PNG', 14, 10, logoWidth, logoHeight);
      }
      const textX = img ? 14 + logoWidth + 4 : 14;

      // Header
      doc.setFontSize(13); doc.setFont('helvetica', 'bold');
      doc.text('Tara Medicos Pvt Ltd, Jaipur', textX, 15);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${dateStr}`, textX, 20);
      if (rMonth || rYear) doc.text(`Stock and Sales Summary From: ${rMonth} ${rYear}${startDate && endDate ? ` (${startDate} to ${endDate})` : ''}`, textX, 25);
      if (companyName) doc.text(`Company: ${companyName}`, textX, 30);

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
              item.balQty || 0,
            ];
          }),
          ['Total (Qty)', '', totalOpQty, totalPurQty, totalTotalQty, totalSaleQty, totalBalQty],
          ['Total (Val)', '', totalOpValue.toFixed(2), totalPurValue.toFixed(2), (totalOpValue + totalPurValue).toFixed(2), totalSaleValue.toFixed(2), allData.reduce((s,i)=>s+(i.balValue||0),0).toFixed(2), '']
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

      const divLabel = companyName || 'SS_Summary';
      doc.save(`S&S_Summary_${divLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr.replace(/\//g, '-')}.pdf`);
      success = true;
      setDownloadSuccess(true);
      recordDownloadSuccess(user?.id || user?._id, 'summary_pdf');
      setTimeout(() => {
        setDownloading(false);
        setDownloadSuccess(false);
      }, 1500);
    } catch (error) {
      console.error('PDF error:', error);
      const errMsg = error.response?.data?.message || 'Failed to generate PDF';
      toast.error(errMsg);
    } finally {
      if (!success) {
        setDownloading(false);
      }
    }
  };

  // Helper for excess qty calculation: Bal Qty - (Current Month Sale + PM1 Sale + PM2 Sale)
  const calcExcessQty = (item) => {
    const currSaleQ = (Number(item.saleQty) || 0) + (Number(item.freeQty) || 0) + (Number(item.brQty) || 0) - (Number(item.crQty) || 0) + (Number(item.adjQty) || 0);
    const rate = Number(item.saleRate) || 0;
    const pm1Q = rate > 0 ? Math.round((Number(item.preMon1SaleValue) || 0) / rate) : 0;
    const pm2Q = rate > 0 ? Math.round((Number(item.preMon2SaleValue) || 0) / rate) : 0;
    const total3MonSales = currSaleQ + pm1Q + pm2Q;
    const diff = (Number(item.balQty) || 0) - total3MonSales;
    return diff > 0 ? diff : 0;
  };

  // Calculate page totals for screen view (new formulas)
  const pageOpQty = statement.reduce((sum, item) => sum + (item.opBalance || 0), 0);
  const pageOpValue = statement.reduce((sum, item) => sum + (item.opValue || 0), 0);
  const pagePurQty = statement.reduce((sum, item) => sum + (item.purQty || 0) + (item.purSchQty || 0), 0);
  const pagePurValue = statement.reduce((sum, item) => sum + (item.purValue || 0), 0);
  const pageTotalQty = pageOpQty + pagePurQty;
  const pageSaleQty = statement.reduce((sum, item) => sum + (item.saleQty || 0) + (item.freeQty || 0) + (item.brQty || 0) - (item.crQty || 0) + (item.adjQty || 0), 0);
  const pageSaleValue = statement.reduce((sum, item) => sum + (item.saleValue || 0) + (item.brValue || 0) - (item.crValue || 0) + (item.adjValue || 0), 0);
  const pageBalaQty = statement.reduce((sum, item) => sum + (item.balQty || 0), 0);
  const pageClosingValue = statement.reduce((sum, item) => sum + (item.balValue || 0), 0);

  return (
    <div className="animate-slide-up">
      <div className="page-header page-header-flex">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            S&S Summary 📊
          </h1>
          <p style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            Summary of Stock & Sales Statement records
            {reportMonth && reportYear && (
              <span style={{ padding: '3px 10px', background: 'rgba(99, 102, 241, 0.15)', color: '#000000', borderRadius: '12px', fontSize: '13px', fontWeight: 700, border: '1px solid rgba(99,102,241,0.3)' }}>
                Period: {reportMonth} {reportYear} {reportStartDate && reportEndDate && `(${formatDate(reportStartDate)} to ${formatDate(reportEndDate)})`}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleDownloadExcel}
            disabled={downloading || loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
          >
            <FiDownload size={15} />
            {downloading ? 'Downloading...' : 'Excel'}
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={handleDownloadPdf}
            disabled={downloading || loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)' }}
          >
            <FiFileText size={15} />
            {downloading ? '...' : 'PDF'}
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '12px', flex: '1 1 auto', flexWrap: 'wrap', width: '100%', maxWidth: '100%' }}>
            <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: '350px' }}>
              <FiSearch className="search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '36px', width: '100%' }}
                placeholder="Search by item name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search.trim() && (
                <button
                  onClick={() => setSearch('')}
                  title="Clear search"
                  style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                    padding: '4px', display: 'flex', alignItems: 'center'
                  }}
                >
                  <FiX size={16} />
                </button>
              )}
            </div>

            {/* Statement Period Selector */}
            <select
              className="form-select"
              style={{ width: '220px', borderColor: 'var(--primary)' }}
              value={selectedStatementPeriod}
              onChange={(e) => setSelectedStatementPeriod(e.target.value)}
            >
              {historicalMonths.map((p, i) => (
                <option key={i} value={`${p.reportMonth}|${p.reportYear}|${p.isHistorical}`}>
                  {p.isHistorical ? '📜 ' : '📋 '}{p.reportMonth} {p.reportYear}
                </option>
              ))}
            </select>

            {manufacturers.length > 1 && (
              <select
                className="form-select"
                style={{ width: '250px' }}
                value={selectedMfac}
                onChange={(e) => setSelectedMfac(e.target.value)}
              >
                <option value="">All Companies / Divisions</option>
                {manufacturers.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name} ({m.code})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Total Items: <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{totalCount}</span>
          </div>
        </div>

        {loading ? (
          <div className="loading-container" style={{ minHeight: '200px' }}><div className="spinner"></div></div>
        ) : statement.length === 0 ? (
          <div className="empty-state" style={{ minHeight: '200px' }}>
            <p>No statement records found for your catalog. Please contact the administrator.</p>
          </div>
        ) : (
          <>
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table className="table scrollable" style={{ width: '100%', minWidth: '1050px' }}>
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Pack</th>
                    <th style={{ textAlign: 'right' }}>Op. Qty</th>
                    <th style={{ textAlign: 'right' }}>Pur Qty</th>
                    <th style={{ textAlign: 'right' }}>Total Qty</th>
                    <th style={{ textAlign: 'right' }}>Sale Qty</th>
                    <th style={{ textAlign: 'right' }}>Bal. Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.map((item, idx) => {
                    const purQ = (item.purQty || 0) + (item.purSchQty || 0);
                    const saleQ = (item.saleQty || 0) + (item.freeQty || 0) + (item.brQty || 0) - (item.crQty || 0) + (item.adjQty || 0);
                    return (
                      <tr key={item._id || idx}>
                        <td style={{ color: 'var(--text-white)', fontWeight: 500 }}>{item.itemName || '—'}</td>
                        <td>{item.pack || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{item.opBalance || 0}</td>
                        <td style={{ textAlign: 'right' }}>{purQ}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{(item.opBalance || 0) + purQ}</td>
                        <td style={{ textAlign: 'right' }}>{saleQ}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.balQty || 0}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: 'rgba(99, 102, 241, 0.08)', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                    <td style={{ color: 'var(--text-white)' }}>Total (Qty)</td>
                    <td></td>
                    <td style={{ textAlign: 'right' }}>{pageOpQty}</td>
                    <td style={{ textAlign: 'right' }}>{pagePurQty}</td>
                    <td style={{ textAlign: 'right' }}>{pageTotalQty}</td>
                    <td style={{ textAlign: 'right' }}>{pageSaleQty}</td>
                    <td style={{ textAlign: 'right' }}>{pageBalaQty}</td>
                  </tr>
                  <tr style={{ fontWeight: 600, borderTop: '1px solid var(--border)', fontSize: '12px' }}>
                    <td style={{ color: 'var(--text-muted)' }}>Total (Val)</td>
                    <td></td>
                    <td style={{ textAlign: 'right', color: 'var(--text-white)' }}>{pageOpValue.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-white)' }}>{pagePurValue.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-white)', fontWeight: 700 }}>{(pageOpValue + pagePurValue).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-white)' }}>{pageSaleValue.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-white)' }}>{pageClosingValue.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => fetchStatement(page - 1)}
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
                  onClick={() => fetchStatement(page + 1)}
                  disabled={page >= totalPages}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  Next <FiChevronRight />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Download Loading Overlay */}
      {downloading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '32px 40px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)', minWidth: '280px', textAlign: 'center'
          }}>
            {!downloadSuccess ? (
              <>
                <div style={{
                  width: '44px', height: '44px',
                  border: '3px solid rgba(99,102,241,0.2)',
                  borderTop: '3px solid #6366f1',
                  borderRadius: '50%', animation: 'spin 0.8s linear infinite'
                }} />
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-white)', marginBottom: '6px' }}>
                    Preparing Document
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Please wait, generating your file…
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{
                  width: '44px', height: '44px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  border: '2px solid #10b981',
                  animation: 'pulse 1s ease'
                }}>
                  ✓
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-white)', marginBottom: '6px' }}>
                    Download Ready!
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Your file has been downloaded.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const RepresentativePurchaseOrder = () => {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalQty, setTotalQty] = useState(0);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const fetchPoData = async (pageNum = 1) => {
    try {
      setLoading(true);
      const res = await representativesAPI.getPurchaseOrder({
        page: pageNum,
        limit: 50,
        search
      });
      setData(res.data.data || []);
      setTotalRecords(res.data.total || 0);
      setTotalAmount(res.data.totalAmount || 0);
      setTotalQty(res.data.totalQty || 0);
      setPage(res.data.page || 1);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error('Fetch PO error:', err);
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoData(1);
  }, [search]); // eslint-disable-line

  const handleDownloadPoPdf = async () => {
    let success = false;
    try {
      setDownloadingPdf(true);
      const img = await loadImage('/a.png');

      // Fetch all PO records (no pagination limit)
      const res = await representativesAPI.getPurchaseOrder({
        page: 1,
        limit: 10000,
        search
      });

      const allData = res.data.data || [];
      if (allData.length === 0) {
        toast.warning('No purchase order records to download');
        return;
      }

      const today = new Date();
      const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = today.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      const companyName = user?.name || user?.customerCode || allData[0]?.companyDivision || allData[0]?.mfacName || 'Representative';

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const logoWidth = 15;
      const logoHeight = img ? (img.height / img.width) * logoWidth : 0;
      if (img) {
        doc.addImage(img, 'PNG', 14, 10, logoWidth, logoHeight);
      }
      const textX = img ? 14 + logoWidth + 4 : 14;

      let headerY = 14;
      doc.setFontSize(13);
      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'bold');
      doc.text('Tara Medicos Pvt Ltd, Jaipur', textX, headerY);

      headerY += 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`Date: ${dateStr} ${timeStr}`, textX, headerY);

      headerY += 4.5;
      doc.setFont('helvetica', 'bold');
      doc.text(`Company / Division: ${companyName}`, textX, headerY);

      headerY += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.text(`Report: Purchase Order Summary`, textX, headerY);

      const headers = [
        ['PO Number', 'Date', 'Supplier Name', 'Division Name', 'Item Code', 'Item Name', 'Pack', 'Total Qty', 'Amount (Rs)']
      ];

      const rows = allData.map(item => {
        const formattedDate = item.poDate && /^\d{4}-\d{2}-\d{2}$/.test(item.poDate.trim())
          ? item.poDate.trim().split('-').reverse().join('/')
          : (item.poDate || '—');
        return [
          item.poNumber || '—',
          formattedDate,
          item.suppName || item.mfacName || '—',
          item.companyDivision || item.mfacName || '—',
          item.itemCode || '—',
          item.itemName || '—',
          item.packName || '—',
          Number(item.qty || 0),
          parseFloat(item.amount || 0).toFixed(2)
        ];
      });

      const totalQtySum = allData.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
      const totalAmountSum = allData.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

      rows.push([
        'Total', '', '', '', '', '', '',
        totalQtySum,
        totalAmountSum.toFixed(2)
      ]);

      autoTable(doc, {
        head: headers,
        body: rows,
        startY: headerY + 4,
        margin: { top: 35, bottom: 20, left: 14, right: 14 },
        styles: {
          fontSize: 8,
          cellPadding: 2,
          valign: 'middle'
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'left'
        },
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 24, halign: 'center' },
          2: { cellWidth: 40 },
          3: { cellWidth: 35 },
          4: { cellWidth: 24 },
          5: { cellWidth: 55 },
          6: { cellWidth: 18 },
          7: { cellWidth: 20, halign: 'right' },
          8: { cellWidth: 22, halign: 'right' }
        },
        didParseCell: function(cellData) {
          if (cellData.row.index === rows.length - 1) {
            cellData.cell.styles.fontStyle = 'bold';
            cellData.cell.styles.fillColor = [241, 245, 249];
            cellData.cell.styles.textColor = [15, 23, 42];
          }
        },
        didDrawPage: function(pageData) {
          doc.setFontSize(8);
          doc.setTextColor(150);
          const str = 'Page ' + doc.internal.getNumberOfPages();
          doc.text(str, pageData.settings.margin.left, doc.internal.pageSize.height - 10);
        }
      });

      const fileName = `Purchase_Order_${String(companyName).replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr.replace(/\//g, '-')}.pdf`;
      doc.save(fileName);
      toast.success('Purchase Order PDF downloaded successfully!');
    } catch (error) {
      console.error('Download PO PDF error:', error);
      toast.error('Failed to download Purchase Order PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="animate-slide-up">
      <div className="page-header page-header-flex">
        <div>
          <h1>Purchase Orders 📦</h1>
          <p>View purchase orders uploaded by company administrator</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: '350px' }}>
            <FiSearch className="search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-input"
              style={{ paddingLeft: '36px', width: '100%' }}
              placeholder="Search item name, PO number..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search.trim() && (
              <button 
                onClick={() => setSearch('')}
                title="Clear search"
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
              >
                <FiX size={16} />
              </button>
            )}
          </div>

          <button 
            className="btn btn-outline"
            onClick={handleDownloadPoPdf}
            disabled={downloadingPdf || data.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 16px', borderRadius: '8px', fontWeight: 600 }}
          >
            <FiDownload size={16} />
            {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-container" style={{ minHeight: '200px' }}><div className="spinner"></div></div>
      ) : data.length === 0 ? (
        <div className="empty-state" style={{ minHeight: '200px' }}>
          <p>No Purchase Order records found for your company.</p>
        </div>
      ) : (
        <div className="card">
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
                {data.map((item, idx) => {
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

          {/* Total Summary Footer below table */}
          <div style={{ marginTop: '20px', padding: '14px 18px', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Total Items: <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{totalRecords}</span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Total Quantity: <span style={{ color: '#10b981', fontWeight: 600, fontSize: '14px' }}>{totalQty}</span>
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              Grand Total Amount: <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '17px' }}>₹{Number(totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '20px' }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => fetchPoData(page - 1)}
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
                onClick={() => fetchPoData(page + 1)}
                disabled={page >= totalPages}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Next <FiChevronRight />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const NonMovingStockReport = ({ isAdmin = false }) => {
  const [data, setData] = useState([]);
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [selectedMfac, setSelectedMfac] = useState('');
  const [manufacturers, setManufacturers] = useState([]);
  const [periodDisplay, setPeriodDisplay] = useState('');
  const [reportMonth, setReportMonth] = useState('');
  const [reportYear, setReportYear] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(search);
    }, 450);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchData = async (p = 1) => {
    try {
      setLoading(true);
      const res = await representativesAPI.getNonMovingStock({
        search: searchQuery,
        page: p,
        limit: 50,
        mfacCodeFilter: selectedMfac
      });
      setData(res.data.data || []);
      setPage(res.data.page || 1);
      setTotalPages(res.data.totalPages || 1);
      setPeriodDisplay(res.data.periodDisplay || '');
      setReportMonth(res.data.reportMonth || '');
      setReportYear(res.data.reportYear || '');
      if (res.data.manufacturers) {
        setManufacturers(res.data.manufacturers);
      }
    } catch (error) {
      console.error('Fetch non-moving error:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch non-moving stock');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
  }, [searchQuery, selectedMfac]); // eslint-disable-line

  const handleDownloadExcel = async () => {
    try {
      setDownloading(true);
      toast.info('Exporting Non-Moving / Excess Stock...');
      const res = await representativesAPI.getNonMovingStock({
        search: searchQuery,
        mfacCodeFilter: selectedMfac,
        isDownload: 'true'
      });
      const allData = (res.data.data || []).filter(item => (Number(item.excessQty) || 0) > 0);
      if (allData.length === 0) {
        toast.warning('No excess/non-moving stock data to export');
        return;
      }
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const mfacLabel = manufacturers.find(m => m.code === selectedMfac)?.name || 'All Companies';

      const headerRows = [
        [' Tara Medicos Pvt Ltd, Jaipur'],
        [` Date: ${dateStr}`],
        [` Non-Moving / Excess Stock Report (Period: ${periodDisplay})`],
        [` Company: ${mfacLabel}`],
        [],
        ['Item Name', 'Pack', 'Op. Qty', 'Pur. Qty (3 Mon)', 'Total Qty (Op+Pur)', 'Total Sale Qty (3 Mon)', 'Bal. Qty (Total-Sale)', 'Excess / Non-Moving Qty', 'Company']
      ];

      const dataRows = allData.map(item => {
        const totQ = (Number(item.opBalance) || 0) + (Number(item.purQty) || 0);
        return [
          item.itemName || '',
          item.pack || '',
          item.opBalance || 0,
          item.purQty || 0,
          totQ,
          item.saleQty || 0,
          item.balQty || 0,
          item.excessQty > 0 ? item.excessQty : '-',
          item.mfacName || ''
        ];
      });

      const totalOp = allData.reduce((s, i) => s + (Number(i.opBalance) || 0), 0);
      const totalPur = allData.reduce((s, i) => s + (Number(i.purQty) || 0), 0);
      const totalTot = totalOp + totalPur;
      const totalSale = allData.reduce((s, i) => s + (Number(i.saleQty) || 0), 0);
      const totalBal = allData.reduce((s, i) => s + (Number(i.balQty) || 0), 0);
      const totalExcess = allData.reduce((s, i) => s + (Number(i.excessQty) || 0), 0);

      const totalRow = ['Total', '', totalOp, totalPur, totalTot, totalSale, totalBal, totalExcess, ''];

      const wb = XLSX.utils.book_new();
      const wsData = [...headerRows, ...dataRows, [], totalRow];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      ws['!cols'] = [
        { wch: 32 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 20 }, { wch: 24 }, { wch: 24 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Non-Moving Stock');
      XLSX.writeFile(wb, `NonMoving_Stock_${reportMonth}_${reportYear}.xlsx`);
      toast.success('Non-Moving Stock Excel exported!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export Non-Moving Stock Excel');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="animate-slide-up">
      <div className="page-header page-header-flex">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            Non-Moving / Excess Stock 📦
          </h1>
          <p style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            Items with excess 
            {periodDisplay && (
              <span style={{ padding: '3px 12px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderRadius: '12px', fontSize: '13px', fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)' }}>
                Period: {periodDisplay} (3 Months Cycle)
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleDownloadExcel}
            disabled={downloading || loading || data.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <FiDownload /> {downloading ? 'Exporting...' : 'Export to Excel'}
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <div style={{ position: 'relative', flex: '1 1 250px' }}>
            <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px', width: '100%' }}
              placeholder="Search non-moving item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)' }}>
                <FiX />
              </button>
            )}
          </div>
          {manufacturers.length > 0 && (
            <select
              className="form-select"
              value={selectedMfac}
              onChange={(e) => setSelectedMfac(e.target.value)}
              style={{ flex: '0 1 220px' }}
            >
              <option value="">All Companies</option>
              {manufacturers.map(m => (
                <option key={m.code} value={m.code}>{m.name}</option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="loading-container" style={{ minHeight: '200px' }}><div className="spinner"></div></div>
        ) : data.length === 0 ? (
          <div className="empty-state" style={{ minHeight: '200px' }}>
            <p>No non-moving stock records found for the current period.</p>
          </div>
        ) : (
          <>
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table className="table scrollable" style={{ width: '100%', minWidth: '1050px' }}>
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Pack</th>
                    <th style={{ textAlign: 'right' }}>Op. Qty</th>
                    <th style={{ textAlign: 'right' }}>Pur Qty (3 Mon)</th>
                    <th style={{ textAlign: 'right', color: 'var(--accent)' }}>Total Qty (Op + Pur)</th>
                    <th style={{ textAlign: 'right' }}>Total Sale Qty (3 Mon)</th>
                    <th style={{ textAlign: 'right', fontWeight: 700 }}>Bal. Qty (Total - Sale)</th>
                    <th style={{ textAlign: 'right', color: '#f59e0b' }}>Excess / Non-Moving Qty</th>
                    {isAdmin && <th>Company</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.filter(item => (Number(item.excessQty) || 0) > 0).map((item, idx) => {
                    const totQ = (Number(item.opBalance) || 0) + (Number(item.purQty) || 0);
                    return (
                      <tr key={item._id || idx}>
                        <td style={{ color: 'var(--text-white)', fontWeight: 500 }}>{item.itemName || '—'}</td>
                        <td>{item.pack || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{item.opBalance || 0}</td>
                        <td style={{ textAlign: 'right' }}>{item.purQty || 0}</td>
                        <td style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>{totQ}</td>
                        <td style={{ textAlign: 'right' }}>{item.saleQty || 0}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.balQty || 0}</td>
                        <td style={{ textAlign: 'right' }}>
                          {item.excessQty > 0 ? (
                            <span style={{ padding: '3px 10px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '6px', fontWeight: 700, fontSize: '12px' }}>
                              {item.excessQty}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        {isAdmin && <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.mfacName || '—'}</td>}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'rgba(245, 158, 11, 0.08)', fontWeight: 700, borderTop: '2px solid var(--border)', fontSize: '13px' }}>
                    <td style={{ color: 'var(--text-white)' }}>Total Excess Qty</td>
                    <td></td><td></td><td></td><td></td><td></td><td></td>
                    <td style={{ textAlign: 'right', color: '#f59e0b', fontWeight: 800, fontSize: '14px' }}>
                      {data.filter(item => (Number(item.excessQty) || 0) > 0).reduce((s, i) => s + (Number(i.excessQty) || 0), 0)}
                    </td>
                    {isAdmin && <td></td>}
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
                <button className="btn btn-outline btn-sm" onClick={() => fetchData(page - 1)} disabled={page <= 1}>
                  <FiChevronLeft /> Prev
                </button>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Page {page} of {totalPages}
                </span>
                <button className="btn btn-outline btn-sm" onClick={() => fetchData(page + 1)} disabled={page >= totalPages}>
                  Next <FiChevronRight />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const RepresentativeDashboard = () => {
  const { user } = useAuth();
  const navItems = getNavItems(user);
  return (
    <DashboardLayout navItems={navItems}>
      <Routes>
        <Route index element={<RepresentativeOverview />} />
        <Route path="statement" element={<RepresentativeStatement />} />
        <Route path="ss-summary" element={<SsSummary />} />
        <Route path="non-moving" element={<NonMovingStockReport isAdmin={false} />} />
        {user?.permissions?.canViewCustomerWise && (
          <Route path="customer-wise" element={<CustomerWiseReport />} />
        )}
        {user?.permissions?.canViewPurchaseOrder && (
          <Route path="purchase-order" element={<RepresentativePurchaseOrder />} />
        )}
        {(user?.permissions?.canViewBranchStatement || user?.permissions?.canViewBranchCustomerWise) && (
          <Route path="branch-data" element={<BranchData isAdmin={false} userPermissions={user?.permissions} />} />
        )}
      </Routes>
    </DashboardLayout>
  );
};

export { NonMovingStockReport };
export default RepresentativeDashboard;
