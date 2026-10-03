import React, { useState, useEffect, useRef } from 'react';
import { representativesAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { FiUploadCloud, FiDownload, FiSearch, FiX, FiChevronDown, FiChevronLeft, FiChevronRight, FiFileText } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const loadBranchImage = (url) => new Promise((resolve) => {
  const img = new Image();
  img.src = url;
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
});

const BranchData = ({ isAdmin = false, userPermissions = {} }) => {
  const canSs = isAdmin || userPermissions?.canViewBranchStatement;
  const canCw = isAdmin || userPermissions?.canViewBranchCustomerWise;

  const [activeTab, setActiveTab] = useState(canSs ? 'ss' : (canCw ? 'cw' : 'ss'));

  // --- BRANCH S&S STATES ---
  const [ssData, setSsData] = useState([]);
  const [ssSearch, setSsSearch] = useState('');
  const [ssSearchQuery, setSsSearchQuery] = useState('');
  const [ssPage, setSsPage] = useState(1);
  const [ssTotalPages, setSsTotalPages] = useState(1);
  const [ssTotalCount, setSsTotalCount] = useState(0);
  const [ssLoading, setSsLoading] = useState(false);
  const [ssUploading, setSsUploading] = useState(false);
  const [isOldSsUpload, setIsOldSsUpload] = useState(false);
  const [ssSelectedMfac, setSsSelectedMfac] = useState('');
  const [ssManufacturers, setSsManufacturers] = useState([]);
  const [ssMfacSearch, setSsMfacSearch] = useState('');
  const [showSsMfacDropdown, setShowSsMfacDropdown] = useState(false);
  const ssMfacRef = useRef(null);

  const [ssPeriods, setSsPeriods] = useState([]);
  const [ssSelectedPeriod, setSsSelectedPeriod] = useState('');
  const [showSsUploadModal, setShowSsUploadModal] = useState(false);
  const [ssUploadFile, setSsUploadFile] = useState(null);
  const [ssUploadMonth, setSsUploadMonth] = useState([
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ][new Date().getMonth()]);
  const [ssUploadYear, setSsUploadYear] = useState(String(new Date().getFullYear()));
  const [uploadProgress, setUploadProgress] = useState(null);

  // --- BRANCH CW STATES ---
  const [cwData, setCwData] = useState([]);
  const [cwSearch, setCwSearch] = useState('');
  const [cwSearchQuery, setCwSearchQuery] = useState('');
  const [cwPage, setCwPage] = useState(1);
  const [cwTotalPages, setCwTotalPages] = useState(1);
  const [cwTotalCount, setCwTotalCount] = useState(0);
  const [cwLoading, setCwLoading] = useState(false);
  const [cwUploading, setCwUploading] = useState(false);
  const [isOldCwUpload, setIsOldCwUpload] = useState(false);
  const [cwSelectedMfac, setCwSelectedMfac] = useState('');
  const [cwManufacturers, setCwManufacturers] = useState([]);
  const [cwMfacSearch, setCwMfacSearch] = useState('');
  const [showCwMfacDropdown, setShowCwMfacDropdown] = useState(false);
  const cwMfacRef = useRef(null);

  const [cwPeriods, setCwPeriods] = useState([]);
  const [cwSelectedPeriod, setCwSelectedPeriod] = useState('');
  const [showCwUploadModal, setShowCwUploadModal] = useState(false);
  const [cwUploadFile, setCwUploadFile] = useState(null);
  const [cwUploadMonth, setCwUploadMonth] = useState([
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ][new Date().getMonth()]);
  const [cwUploadYear, setCwUploadYear] = useState(String(new Date().getFullYear()));

  // Debouncing Search Inputs
  useEffect(() => {
    const handler = setTimeout(() => setSsSearchQuery(ssSearch), 450);
    return () => clearTimeout(handler);
  }, [ssSearch]);

  useEffect(() => {
    const handler = setTimeout(() => setCwSearchQuery(cwSearch), 450);
    return () => clearTimeout(handler);
  }, [cwSearch]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClick = (e) => {
      if (ssMfacRef.current && !ssMfacRef.current.contains(e.target)) setShowSsMfacDropdown(false);
      if (cwMfacRef.current && !cwMfacRef.current.contains(e.target)) setShowCwMfacDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch Available Periods
  useEffect(() => {
    if (canSs) {
      representativesAPI.getBranchStatementPeriods().then(res => {
        const periods = res.data.periods || [];
        setSsPeriods(periods);
        if (periods.length > 0 && !ssSelectedPeriod) {
          const p = periods[0];
          setSsSelectedPeriod(`${p.reportMonth}|${p.reportYear}|${p.isHistorical}`);
        }
      }).catch(() => {});
    }
  }, [canSs]);

  useEffect(() => {
    if (canCw) {
      representativesAPI.getBranchCWPeriods().then(res => {
        const periods = res.data.periods || [];
        setCwPeriods(periods);
        if (periods.length > 0 && !cwSelectedPeriod) {
          const p = periods[0];
          setCwSelectedPeriod(`${p.reportMonth}|${p.reportYear}|${p.isHistorical}`);
        }
      }).catch(() => {});
    }
  }, [canCw]);

  // Fetch Branch SS Data
  const fetchSsData = async (p = 1) => {
    if (!canSs) return;
    try {
      setSsLoading(true);
      let reportMonth = '', reportYear = '', isHistorical = '';
      if (ssSelectedPeriod) {
        const parts = ssSelectedPeriod.split('|');
        reportMonth = parts[0]; reportYear = parts[1]; isHistorical = parts[2];
      }
      const res = await representativesAPI.getBranchStatement({
        search: ssSearchQuery,
        page: p,
        limit: 50,
        mfacCodeFilter: ssSelectedMfac,
        reportMonth, reportYear, isHistorical
      });
      setSsData(res.data.data || []);
      setSsPage(res.data.page || 1);
      setSsTotalPages(res.data.totalPages || 1);
      setSsTotalCount(res.data.totalCount || 0);
      if (res.data.manufacturers) setSsManufacturers(res.data.manufacturers || []);
    } catch (err) {
      toast.error('Failed to load Branch S&S Statement');
    } finally {
      setSsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ss') fetchSsData(1);
  }, [activeTab, ssSearchQuery, ssSelectedMfac, ssSelectedPeriod]);

  // Fetch Branch CW Data
  const fetchCwData = async (p = 1) => {
    if (!canCw) return;
    try {
      setCwLoading(true);
      let reportMonth = '', reportYear = '', isHistorical = '';
      if (cwSelectedPeriod) {
        const parts = cwSelectedPeriod.split('|');
        reportMonth = parts[0]; reportYear = parts[1]; isHistorical = parts[2];
      }
      const res = await representativesAPI.getBranchCustomerWise({
        search: cwSearchQuery,
        page: p,
        limit: 50,
        mfacCodeFilter: cwSelectedMfac,
        reportMonth, reportYear, isHistorical
      });
      setCwData(res.data.data || []);
      setCwPage(res.data.page || 1);
      setCwTotalPages(res.data.totalPages || 1);
      setCwTotalCount(res.data.totalCount || 0);
      if (res.data.manufacturers) setCwManufacturers(res.data.manufacturers || []);
    } catch (err) {
      toast.error('Failed to load Branch Customer Wise');
    } finally {
      setCwLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'cw') fetchCwData(1);
  }, [activeTab, cwSearchQuery, cwSelectedMfac, cwSelectedPeriod]);

  // Handle Branch SS Upload Submit
  const handleSsUploadSubmit = async () => {
    if (!ssUploadFile) { toast.warning('Please select an Excel file'); return; }
    let processingInterval = null;
    try {
      setSsUploading(true);
      setUploadProgress(0);
      const formData = new FormData();
      formData.append('file', ssUploadFile);
      formData.append('reportMonth', ssUploadMonth);
      formData.append('reportYear', ssUploadYear);

      const config = {
        onUploadProgress: (e) => {
          const percent = Math.round((e.loaded / e.total) * 90);
          setUploadProgress(percent);
          if (e.loaded >= e.total) {
            let serverP = 90;
            processingInterval = setInterval(() => {
              serverP = Math.min(serverP + 1, 99);
              setUploadProgress(serverP);
              if (serverP >= 99) clearInterval(processingInterval);
            }, 400);
          }
        }
      };

      const res = isOldSsUpload
        ? await representativesAPI.uploadOldBranchStatement(formData, config)
        : await representativesAPI.uploadBranchStatement(formData, config);

      if (processingInterval) clearInterval(processingInterval);
      setUploadProgress(null);
      toast.success(res.data.message || 'Branch S&S uploaded successfully');
      setShowSsUploadModal(false);
      setSsUploadFile(null);
      
      const pRes = await representativesAPI.getBranchStatementPeriods();
      setSsPeriods(pRes.data.periods || []);
      fetchSsData(1);
    } catch (err) {
      if (processingInterval) clearInterval(processingInterval);
      setUploadProgress(null);
      toast.error(err.response?.data?.message || 'Failed to upload Branch S&S');
    } finally {
      setSsUploading(false);
      setUploadProgress(null);
    }
  };

  // Handle Branch CW Upload Submit
  const handleCwUploadSubmit = async () => {
    if (!cwUploadFile) { toast.warning('Please select an Excel file'); return; }
    let processingInterval = null;
    try {
      setCwUploading(true);
      setUploadProgress(0);
      const formData = new FormData();
      formData.append('file', cwUploadFile);
      formData.append('reportMonth', cwUploadMonth);
      formData.append('reportYear', cwUploadYear);

      const config = {
        onUploadProgress: (e) => {
          const percent = Math.round((e.loaded / e.total) * 90);
          setUploadProgress(percent);
          if (e.loaded >= e.total) {
            let serverP = 90;
            processingInterval = setInterval(() => {
              serverP = Math.min(serverP + 1, 99);
              setUploadProgress(serverP);
              if (serverP >= 99) clearInterval(processingInterval);
            }, 400);
          }
        }
      };

      const res = isOldCwUpload
        ? await representativesAPI.uploadOldBranchCustomerWise(formData, config)
        : await representativesAPI.uploadBranchCustomerWise(formData, config);

      if (processingInterval) clearInterval(processingInterval);
      setUploadProgress(null);
      toast.success(res.data.message || 'Branch CW uploaded successfully');
      setShowCwUploadModal(false);
      setCwUploadFile(null);

      const pRes = await representativesAPI.getBranchCWPeriods();
      setCwPeriods(pRes.data.periods || []);
      fetchCwData(1);
    } catch (err) {
      if (processingInterval) clearInterval(processingInterval);
      setUploadProgress(null);
      toast.error(err.response?.data?.message || 'Failed to upload Branch CW');
    } finally {
      setCwUploading(false);
      setUploadProgress(null);
    }
  };

  // Helper for styled Excel export with header metadata and totals
  const downloadStyledExcel = (title, filename, headerRows, dataRows, totalRow = null, valueRow = null) => {
    const wb = XLSX.utils.book_new();
    const allRows = [];

    // Meta header rows (Company name, date, report period, division)
    for (let i = 0; i < headerRows.length - 1; i++) {
      allRows.push([headerRows[i][0] || '']);
    }

    // Column headers row
    const colHeaders = headerRows[headerRows.length - 1];
    const colCount = colHeaders.length || 10;
    allRows.push(colHeaders);

    // Data rows
    dataRows.forEach(row => allRows.push(row));

    // Totals rows
    if (totalRow) allRows.push(totalRow);
    if (valueRow) allRows.push(valueRow);

    const ws = XLSX.utils.aoa_to_sheet(allRows);

    // Column widths
    ws['!cols'] = Array.from({ length: colCount }, (_, i) => ({
      wch: i === 0 ? 18 : (i === 1 ? 32 : 14)
    }));

    // Merge meta header rows across columns
    const metaRowCount = headerRows.length - 1;
    ws['!merges'] = Array.from({ length: metaRowCount }, (_, i) => ({
      s: { r: i, c: 0 },
      e: { r: i, c: colCount - 1 }
    }));

    XLSX.utils.book_append_sheet(wb, ws, title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 31));

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

  // Export Branch SS to Excel
  const handleDownloadSsExcel = async () => {
    try {
      toast.info('Preparing Branch S&S export...');
      let reportMonth = '', reportYear = '', isHistorical = '';
      if (ssSelectedPeriod) {
        const parts = ssSelectedPeriod.split('|');
        reportMonth = parts[0]; reportYear = parts[1]; isHistorical = parts[2];
      }
      const res = await representativesAPI.getBranchStatementAll({
        search: ssSearchQuery,
        mfacCodeFilter: ssSelectedMfac,
        reportMonth, reportYear, isHistorical
      });
      const allData = res.data.data || [];
      if (allData.length === 0) { toast.warn('No records to export'); return; }

      const today = new Date();
      const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const companyName = ssSelectedMfac ? (ssManufacturers.find(m => m.code === ssSelectedMfac)?.name || ssSelectedMfac) : 'All Companies';

      const headerRows = [
        [' Tara Medicos Pvt Ltd, Jaipur (Branch)'],
        [` Date: ${dateStr}  `],
        [`Branch Stock and Sales Summary From: ${reportMonth || ''} ${reportYear || ''}`],
        [`Company: ${companyName}`],
        [],
        ['Item Code', 'Item Name', 'Pack', 'Mfac Code', 'Mfac Name', 'Op Bal', 'Op Value', 'Pur Qty', 'Pur Value', 'Pur Sch Qty', 'Sale Qty', 'Sale Value', 'Free Qty', 'Bal Qty', 'Bal Value']
      ];

      const dataRows = allData.map(r => [
        r.itemCode || '',
        r.itemName || '',
        r.pack || '',
        r.mfacCode || '',
        r.mfacName || '',
        Number(r.opBalance) || 0,
        Number(r.opValue || 0),
        Number(r.purQty) || 0,
        Number(r.purValue || 0),
        Number(r.purSchQty) || 0,
        Number(r.saleQty) || 0,
        Number(r.saleValue || 0),
        Number(r.freeQty) || 0,
        Number(r.balQty) || 0,
        Number(r.balValue || 0)
      ]);

      const totalOpQty = allData.reduce((s, r) => s + (Number(r.opBalance) || 0), 0);
      const totalOpVal = allData.reduce((s, r) => s + (Number(r.opValue) || 0), 0);
      const totalPurQty = allData.reduce((s, r) => s + (Number(r.purQty) || 0) + (Number(r.purSchQty) || 0), 0);
      const totalPurVal = allData.reduce((s, r) => s + (Number(r.purValue) || 0), 0);
      const totalSaleQty = allData.reduce((s, r) => s + (Number(r.saleQty) || 0), 0);
      const totalSaleVal = allData.reduce((s, r) => s + (Number(r.saleValue) || 0), 0);
      const totalFreeQty = allData.reduce((s, r) => s + (Number(r.freeQty) || 0), 0);
      const totalBalQty = allData.reduce((s, r) => s + (Number(r.balQty) || 0), 0);
      const totalBalVal = allData.reduce((s, r) => s + (Number(r.balValue) || 0), 0);

      // Single combined Total row for both Qty and Value
      const totalRow = [
        'Total',
        '',
        '',
        '',
        '',
        totalOpQty,
        { v: Number(totalOpVal.toFixed(2)), t: 'n', z: '0.00' },
        totalPurQty,
        { v: Number(totalPurVal.toFixed(2)), t: 'n', z: '0.00' },
        '',
        totalSaleQty,
        { v: Number(totalSaleVal.toFixed(2)), t: 'n', z: '0.00' },
        totalFreeQty,
        totalBalQty,
        { v: Number(totalBalVal.toFixed(2)), t: 'n', z: '0.00' }
      ];

      const divLabel = companyName || 'Branch_SS';
      const fileName = `Branch_SS_Statement_${divLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr.replace(/\//g, '-')}.xlsx`;

      downloadStyledExcel(
        divLabel,
        fileName,
        headerRows,
        dataRows,
        totalRow,
        null
      );
      toast.success('Branch S&S Statement exported successfully!');
    } catch (err) {
      toast.error('Failed to export Branch S&S Statement');
    }
  };

  // Export Branch CW to Excel — Exactly matching simple CW format
  const handleDownloadCwExcel = async () => {
    try {
      toast.info('Preparing Branch Customer Wise export...');
      let reportMonth = '', reportYear = '', isHistorical = '';
      if (cwSelectedPeriod) {
        const parts = cwSelectedPeriod.split('|');
        reportMonth = parts[0]; reportYear = parts[1]; isHistorical = parts[2];
      }
      const res = await representativesAPI.getBranchCustomerWiseAll({
        search: cwSearchQuery,
        mfacCodeFilter: cwSelectedMfac,
        reportMonth, reportYear, isHistorical
      });
      const allData = res.data.data || [];
      if (allData.length === 0) { toast.warn('No records to export'); return; }

      const today = new Date();
      const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const companyName = cwSelectedMfac ? (cwManufacturers.find(m => m.code === cwSelectedMfac)?.name || cwSelectedMfac) : 'All Companies';

      const headerRows = [
        [' Tara Medicos Pvt Ltd, Jaipur (Branch)'],
        [` Date: ${dateStr}  `],
        [`Branch Customer Wise Sales from : ${reportMonth || ''} ${reportYear || ''}`],
        [`Company: ${companyName}`],
        [],
        ['Item Name', 'Pack Size', 'Qty', 'Scheme Qty', 'Sale Rate', 'Amount', 'Customer Code', 'Customer Name', 'Address', 'City']
      ];

      const dataRows = allData.map(r => [
        r.itemName || '',
        r.packName || r.pack || '',
        Math.round(Number(r.qty) || 0),
        Math.round(Number(r.schemeQty) || 0),
        Number(r.saleRate) ? { v: Number(r.saleRate), t: 'n', z: '0.00' } : 0.00,
        { v: Number(r.amount || ((Number(r.qty) || 0) * (Number(r.saleRate) || 0))), t: 'n', z: '0.00' },
        r.customerCode || '',
        r.customerName || '',
        r.customerAddress || '',
        r.customerCity || ''
      ]);

      const totalQty = allData.reduce((s, r) => s + (Number(r.qty) || 0), 0);
      const totalSchemeQty = allData.reduce((s, r) => s + (Number(r.schemeQty) || 0), 0);
      const totalAmount = allData.reduce((s, r) => s + (Number(r.amount || ((Number(r.qty) || 0) * (Number(r.saleRate) || 0))) || 0), 0);

      const totalRow = [
        'Total',
        '',
        Math.round(totalQty),
        Math.round(totalSchemeQty),
        '',
        { v: Number(totalAmount.toFixed(2)), t: 'n', z: '0.00' },
        '',
        '',
        '',
        ''
      ];

      const divLabel = companyName || 'Branch_CustomerWise';
      const fileName = `Branch_Customer_Wise_${divLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr.replace(/\//g, '-')}.xlsx`;

      downloadStyledExcel(
        divLabel,
        fileName,
        headerRows,
        dataRows,
        totalRow,
        null,
        [0, 1]
      );
      toast.success('Branch Customer Wise exported successfully!');
    } catch (err) {
      toast.error('Failed to export Branch Customer Wise');
    }
  };

  // Download Branch CW as grouped PDF (representative only)
  const handleDownloadCwPdf = async () => {
    try {
      toast.info('Preparing Branch CW PDF...');
      let reportMonth = '', reportYear = '', isHistorical = '';
      if (cwSelectedPeriod) {
        const parts = cwSelectedPeriod.split('|');
        reportMonth = parts[0]; reportYear = parts[1]; isHistorical = parts[2];
      }
      const res = await representativesAPI.getBranchCustomerWiseAll({
        mfacCodeFilter: cwSelectedMfac,
        reportMonth, reportYear, isHistorical
      });
      const allData = res.data.data || [];
      if (allData.length === 0) { toast.warn('No records to export'); return; }

      const today = new Date();
      const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const displayPeriod = `${reportMonth} ${reportYear}`.trim() || 'Current';

      let displayCompany = '';
      if (cwSelectedMfac) {
        const found = cwManufacturers.find(m => m.code === cwSelectedMfac);
        displayCompany = found ? `${found.name} (${found.code})` : cwSelectedMfac;
      } else if (allData[0]?.companyDivision) {
        displayCompany = allData[0].companyDivision;
      } else if (cwManufacturers.length === 1 && cwManufacturers[0]?.name) {
        displayCompany = cwManufacturers[0].name;
      } else if (cwManufacturers[0]?.name) {
        displayCompany = cwManufacturers[0].name;
      } else {
        displayCompany = 'All Divisions';
      }

      // Group data by customer code
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

      const img = await loadBranchImage('/a.png');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const totalPagesExp = '{total_pages_count_string}';
      const pageW = doc.internal.pageSize.width;
      const pageH = doc.internal.pageSize.height;

      // Draw Main Header ONLY on page 1
      const drawMainHeader = () => {
        const logoW = 14;
        const logoH = img ? (img.height / img.width) * logoW : 0;
        if (img) doc.addImage(img, 'PNG', 12, 8, logoW, logoH);
        const tx = img ? 12 + logoW + 4 : 12;

        doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 80);
        doc.text('Tara Medicos Pvt Ltd, Jaipur (Branch)', tx, 13);

        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
        doc.text('G- 5/6/21/20A, Mayur Tower, Nehru Bazar, Jaipur - 302003 | Ph: 0141-2314253', tx, 18);

        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
        doc.text(`Branch Customer Wise Sales Report  |  Period: ${displayPeriod}`, tx, 23);

        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(70, 70, 130);
        doc.text(`Company / Division: ${displayCompany}`, tx, 28);

        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(140, 140, 140);
        doc.text(`Date: ${dateStr}`, pageW - 12, 13, { align: 'right' });

        // Divider line
        doc.setDrawColor(99, 102, 241);
        doc.setLineWidth(0.5);
        doc.line(12, 31, pageW - 12, 31);
        doc.setTextColor(0, 0, 0);
      };

      // Draw Page 1 header
      drawMainHeader();
      let curY = 35;
      const customers = Array.from(customerMap.values());

      customers.forEach((cust, ci) => {
        // Break page if remaining vertical space is too small
        if (curY > pageH - 45) {
          doc.addPage();
          curY = 16;
        }

        // Customer banner bar
        doc.setFillColor(243, 244, 254);
        doc.roundedRect(12, curY, pageW - 24, 8.5, 1.5, 1.5, 'F');

        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 90);
        doc.text(`${ci + 1}. ${cust.customerName}`, 15, curY + 5.8);

        if (cust.customerCode) {
          doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(99, 102, 241);
          doc.text(`Code: ${cust.customerCode}`, pageW - 15, curY + 5.8, { align: 'right' });
        }
        curY += 10.5;

        if (cust.customerAddress || cust.customerCity) {
          const addrLine = [cust.customerAddress, cust.customerCity].filter(Boolean).join(', ');
          doc.setFontSize(7.2); doc.setFont('helvetica', 'normal'); doc.setTextColor(110, 110, 110);
          doc.text(`Address: ${addrLine}`, 15, curY);
          curY += 4.5;
        }

        const tableHead = [['#', 'Item Name', 'Pack', 'Qty', 'Sch.Qty', 'Rate', 'Amount']];
        const tableBody = cust.items.map((item, idx) => {
          const qty = Math.round(Number(item.qty) || 0);
          const schQty = Math.round(Number(item.schemeQty) || 0);
          const rate = Number(item.saleRate || 0);
          const amount = (Number(item.qty) || 0) * (Number(item.saleRate) || 0);
          return [
            idx + 1,
            item.itemName || '-',
            item.packName || item.pack || '',
            qty,
            schQty,
            rate > 0 ? rate.toFixed(2) : '0.00',
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
          foot: [['', `Total (${cust.items.length} ${cust.items.length === 1 ? 'item' : 'items'})`, '', Math.round(totalQty), Math.round(totalSchQty), '', totalAmt.toFixed(2)]],
          margin: { top: 16, bottom: 14, left: 12, right: 12 },
          styles: { fontSize: 7.5, cellPadding: 1.8, valign: 'middle', overflow: 'linebreak' },
          headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.8 },
          footStyles: { fillColor: [240, 243, 255], textColor: [30, 30, 90], fontStyle: 'bold', fontSize: 7.8 },
          columnStyles: {
            0: { cellWidth: 8, halign: 'center' },
            1: { cellWidth: 'auto', halign: 'left' },
            2: { cellWidth: 18, halign: 'center' },
            3: { cellWidth: 18, halign: 'right' },
            4: { cellWidth: 18, halign: 'right' },
            5: { cellWidth: 24, halign: 'right' },
            6: { cellWidth: 28, halign: 'right' }
          },
          didParseCell: (data) => {
            if ([3, 4, 5, 6].includes(data.column.index)) {
              data.cell.styles.halign = 'right';
            } else if ([0, 2].includes(data.column.index)) {
              data.cell.styles.halign = 'center';
            } else {
              data.cell.styles.halign = 'left';
            }
            if (data.section === 'foot') {
              data.cell.styles.fontStyle = 'bold';
              if (data.column.index === 6) {
                data.cell.styles.textColor = [16, 120, 60];
              }
            }
          },
          didDrawPage: (data) => {
            if (data.pageNumber > 1) {
              doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(130, 130, 130);
              doc.text(`Branch Customer Wise Sales Report - ${displayCompany} (${displayPeriod})`, 12, 10);
              doc.setDrawColor(220, 220, 230);
              doc.setLineWidth(0.3);
              doc.line(12, 12, pageW - 12, 12);
            }
            doc.setFontSize(7.5); doc.setTextColor(150, 150, 150);
            doc.text('Tara Medicos Pvt Ltd, Jaipur (Branch)', 12, pageH - 7);
            doc.text(`Page ${data.pageNumber} of ${totalPagesExp}`, pageW - 12, pageH - 7, { align: 'right' });
          }
        });

        curY = doc.lastAutoTable.finalY + 6;
        if (ci < customers.length - 1 && curY < pageH - 25) {
          doc.setDrawColor(225, 225, 235);
          doc.setLineWidth(0.3);
          doc.line(12, curY - 2, pageW - 12, curY - 2);
        }
      });

      if (typeof doc.putTotalPages === 'function') doc.putTotalPages(totalPagesExp);
      const divLabel = displayCompany || 'Branch_CW';
      doc.save(`Branch_CW_${divLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${displayPeriod.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
      toast.success('Branch CW PDF downloaded successfully!');
    } catch (err) {
      console.error('Branch CW PDF error:', err);
      toast.error('Failed to generate Branch CW PDF');
    }
  };

  if (!canSs && !canCw) {
    return (
      <div className="animate-slide-up" style={{ padding: '40px', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '500px', margin: '0 auto', padding: '30px' }}>
          <h2 style={{ color: 'var(--danger)', marginBottom: '10px' }}>Access Denied 🔒</h2>
          <p style={{ color: 'var(--text-muted)' }}>You do not have permission to view Branch Data reports. Please contact Admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      <style>{`
        @media (max-width: 768px) {
          .cw-branch-desktop-table {
            display: none !important;
          }
          .cw-branch-mobile-cards {
            display: block !important;
          }
        }
        @media (min-width: 769px) {
          .cw-branch-desktop-table {
            display: block !important;
          }
          .cw-branch-mobile-cards {
            display: none !important;
          }
        }
      `}</style>
      <div className="page-header page-header-flex">
        <div>
          <h1>Branch Data 🏢</h1>
          <p>Upload and view Branch S&S Monthly Statements & Customer Wise Reports</p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {activeTab === 'ss' ? (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setIsOldSsUpload(true); setShowSsUploadModal(true); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <FiUploadCloud /> Upload Branch S&amp;S
              </button>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setIsOldCwUpload(true); setShowCwUploadModal(true); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <FiUploadCloud /> Upload Branch CW
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="subtabs-bar">
        {canSs && (
          <button
            onClick={() => setActiveTab('ss')}
            style={{
              background: 'none', border: 'none',
              borderBottom: activeTab === 'ss' ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === 'ss' ? 'var(--text-white)' : 'var(--text-muted)',
              padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '14px'
            }}
          >
            Branch S&S Statement
          </button>
        )}
        {canCw && (
          <button
            onClick={() => setActiveTab('cw')}
            style={{
              background: 'none', border: 'none',
              borderBottom: activeTab === 'cw' ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === 'cw' ? 'var(--text-white)' : 'var(--text-muted)',
              padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '14px'
            }}
          >
            Branch Customer Wise
          </button>
        )}
      </div>

      {/* Tab Content: Branch SS */}
      {activeTab === 'ss' && canSs && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', flex: '1 1 300px' }}>
              <div style={{ position: 'relative', width: '280px' }}>
                <FiSearch className="search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '36px', width: '100%' }}
                  placeholder="Search item code, name, mfac..."
                  value={ssSearch}
                  onChange={(e) => setSsSearch(e.target.value)}
                />
                {ssSearch && (
                  <button onClick={() => setSsSearch('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <FiX size={16} />
                  </button>
                )}
              </div>

              {/* Manufacturer Filter */}
              <div ref={ssMfacRef} style={{ position: 'relative' }}>
                <div onClick={() => setShowSsMfacDropdown(!showSsMfacDropdown)} className="form-select" style={{ width: '220px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ssSelectedMfac ? (ssManufacturers.find(m => m.code === ssSelectedMfac)?.name || ssSelectedMfac) : 'All Manufacturers'}
                  </span>
                  <FiChevronDown size={14} />
                </div>
                {showSsMfacDropdown && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 1000, width: '280px', marginTop: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.4)' }}>
                    <input
                      type="text" className="form-input" style={{ width: '100%', marginBottom: '8px', fontSize: '12px' }}
                      placeholder="Search company..." value={ssMfacSearch} onChange={(e) => setSsMfacSearch(e.target.value)}
                    />
                    <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      <div onClick={() => { setSsSelectedMfac(''); setShowSsMfacDropdown(false); }} style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: '4px', fontSize: '13px', background: !ssSelectedMfac ? 'rgba(99,102,241,0.15)' : 'transparent' }}>
                        All Manufacturers
                      </div>
                      {ssManufacturers.filter(m => m.name.toLowerCase().includes(ssMfacSearch.toLowerCase()) || m.code.toLowerCase().includes(ssMfacSearch.toLowerCase())).map(m => (
                        <div key={m.code} onClick={() => { setSsSelectedMfac(m.code); setShowSsMfacDropdown(false); }} style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: '4px', fontSize: '13px', background: ssSelectedMfac === m.code ? 'rgba(99,102,241,0.2)' : 'transparent' }}>
                          {m.name} ({m.code})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Period Selector */}
              {ssPeriods.length > 0 && (
                <select className="form-select" style={{ width: '200px' }} value={ssSelectedPeriod} onChange={(e) => setSsSelectedPeriod(e.target.value)}>
                  {ssPeriods.map((p, i) => (
                    <option key={i} value={`${p.reportMonth}|${p.reportYear}|${p.isHistorical}`}>
                      📋 {p.reportMonth} {p.reportYear}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button className="btn btn-outline btn-sm" onClick={handleDownloadSsExcel} disabled={ssData.length === 0} style={{ color: '#10b981', borderColor: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <FiDownload /> Download Excel
            </button>
          </div>

          {/* Table */}
          {ssLoading ? (
            <div className="loading-container" style={{ minHeight: '200px' }}><div className="spinner"></div></div>
          ) : ssData.length === 0 ? (
            <div className="empty-state" style={{ minHeight: '200px' }}><p>No Branch S&S statement records found.</p></div>
          ) : (
            <>
              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table className="table scrollable" style={{ width: '100%', minWidth: '1500px' }}>
                  <thead>
                    <tr>
                      <th>Item Code</th>
                      <th>Item Name</th>
                      <th>Pack</th>
                      <th>Mfac Name</th>
                      <th style={{ textAlign: 'right' }}>Op. Bal</th>
                      <th style={{ textAlign: 'right' }}>Op. Value</th>
                      <th style={{ textAlign: 'right' }}>Pur Qty</th>
                      <th style={{ textAlign: 'right' }}>Pur Value</th>
                      <th style={{ textAlign: 'right' }}>Sale Qty</th>
                      <th style={{ textAlign: 'right' }}>Sale Value</th>
                      <th style={{ textAlign: 'right' }}>Bal Qty</th>
                      <th style={{ textAlign: 'right' }}>Bal Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ssData.map((item, idx) => (
                      <tr key={item._id || idx}>
                        <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{item.itemCode || '—'}</td>
                        <td style={{ color: 'var(--text-white)', fontWeight: 500 }}>{item.itemName || '—'}</td>
                        <td>{item.pack || '—'}</td>
                        <td>{item.mfacName || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{item.opBalance || 0}</td>
                        <td style={{ textAlign: 'right' }}>₹{Number(item.opValue || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{item.purQty || 0}</td>
                        <td style={{ textAlign: 'right' }}>₹{Number(item.purValue || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{item.saleQty || 0}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#10b981' }}>₹{Number(item.saleValue || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.balQty || 0}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>₹{Number(item.balValue || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                   {!isAdmin && ssPage >= ssTotalPages && (
                     <tfoot>
                       <tr style={{ background: 'rgba(99,102,241,0.1)', fontWeight: 700, borderTop: '2px solid var(--border)', fontSize: '13px' }}>
                         <td style={{ color: 'var(--text-white)' }}>Total (Qty)</td>
                         <td></td><td></td><td></td>
                         <td style={{ textAlign: 'right', color: 'var(--text-white)' }}>
                           {ssData.reduce((s, i) => s + (Number(i.opBalance) || 0), 0)}
                         </td>
                         <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-</td>
                         <td style={{ textAlign: 'right', color: 'var(--text-white)' }}>
                           {ssData.reduce((s, i) => s + (Number(i.purQty) || 0) + (Number(i.purSchQty) || 0), 0)}
                         </td>
                         <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-</td>
                         <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                           {ssData.reduce((s, i) => s + (Number(i.saleQty) || 0), 0)}
                         </td>
                         <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-</td>
                         <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                           {ssData.reduce((s, i) => s + (Number(i.balQty) || 0), 0)}
                         </td>
                         <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-</td>
                       </tr>
                       <tr style={{ background: 'rgba(99,102,241,0.05)', fontWeight: 700, borderTop: '1px solid var(--border)', fontSize: '13px' }}>
                         <td style={{ color: 'var(--accent)' }}>Total (Val)</td>
                         <td></td><td></td><td></td>
                         <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-</td>
                         <td style={{ textAlign: 'right', color: 'var(--text-white)' }}>
                           {'\u20b9'}{ssData.reduce((s, i) => s + (Number(i.opValue) || 0), 0).toFixed(2)}
                         </td>
                         <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-</td>
                         <td style={{ textAlign: 'right', color: 'var(--text-white)' }}>
                           {'\u20b9'}{ssData.reduce((s, i) => s + (Number(i.purValue) || 0), 0).toFixed(2)}
                         </td>
                         <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-</td>
                         <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                           {'\u20b9'}{ssData.reduce((s, i) => s + (Number(i.saleValue) || 0), 0).toFixed(2)}
                         </td>
                         <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-</td>
                         <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                           {'\u20b9'}{ssData.reduce((s, i) => s + (Number(i.balValue) || 0), 0).toFixed(2)}
                         </td>
                       </tr>
                     </tfoot>
                   )}
                </table>
              </div>

              {/* Pagination */}
              {ssTotalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '20px' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => fetchSsData(ssPage - 1)} disabled={ssPage <= 1}><FiChevronLeft /> Prev</button>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Page {ssPage} of {ssTotalPages}</span>
                  <button className="btn btn-outline btn-sm" onClick={() => fetchSsData(ssPage + 1)} disabled={ssPage >= ssTotalPages}>Next <FiChevronRight /></button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab Content: Branch CW */}
      {activeTab === 'cw' && canCw && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', flex: '1 1 300px' }}>
              <div style={{ position: 'relative', width: '280px' }}>
                <FiSearch className="search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '36px', width: '100%' }}
                  placeholder="Search customer, code, item..."
                  value={cwSearch}
                  onChange={(e) => setCwSearch(e.target.value)}
                />
                {cwSearch && (
                  <button onClick={() => setCwSearch('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <FiX size={16} />
                  </button>
                )}
              </div>

              {/* Manufacturer Filter */}
              <div ref={cwMfacRef} style={{ position: 'relative' }}>
                <div onClick={() => setShowCwMfacDropdown(!showCwMfacDropdown)} className="form-select" style={{ width: '220px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cwSelectedMfac ? (cwManufacturers.find(m => m.code === cwSelectedMfac)?.name || cwSelectedMfac) : 'All Manufacturers'}
                  </span>
                  <FiChevronDown size={14} />
                </div>
                {showCwMfacDropdown && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 1000, width: '280px', marginTop: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.4)' }}>
                    <input
                      type="text" className="form-input" style={{ width: '100%', marginBottom: '8px', fontSize: '12px' }}
                      placeholder="Search company..." value={cwMfacSearch} onChange={(e) => setCwMfacSearch(e.target.value)}
                    />
                    <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      <div onClick={() => { setCwSelectedMfac(''); setShowCwMfacDropdown(false); }} style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: '4px', fontSize: '13px', background: !cwSelectedMfac ? 'rgba(99,102,241,0.15)' : 'transparent' }}>
                        All Manufacturers
                      </div>
                      {cwManufacturers.filter(m => m.name.toLowerCase().includes(cwMfacSearch.toLowerCase()) || m.code.toLowerCase().includes(cwMfacSearch.toLowerCase())).map(m => (
                        <div key={m.code} onClick={() => { setCwSelectedMfac(m.code); setShowCwMfacDropdown(false); }} style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: '4px', fontSize: '13px', background: cwSelectedMfac === m.code ? 'rgba(99,102,241,0.2)' : 'transparent' }}>
                          {m.name} ({m.code})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Period Selector */}
              {cwPeriods.length > 0 && (
                <select className="form-select" style={{ width: '200px' }} value={cwSelectedPeriod} onChange={(e) => setCwSelectedPeriod(e.target.value)}>
                  {cwPeriods.map((p, i) => (
                    <option key={i} value={`${p.reportMonth}|${p.reportYear}|${p.isHistorical}`}>
                      📋 {p.reportMonth} {p.reportYear}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-outline btn-sm" onClick={handleDownloadCwExcel} disabled={cwData.length === 0} style={{ color: '#10b981', borderColor: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <FiDownload /> Download Excel
              </button>
              {!isAdmin && (
                <button className="btn btn-sm" onClick={handleDownloadCwPdf} disabled={cwData.length === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  <FiFileText size={14} /> Download PDF
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          {cwLoading ? (
            <div className="loading-container" style={{ minHeight: '200px' }}><div className="spinner"></div></div>
          ) : cwData.length === 0 ? (
            <div className="empty-state" style={{ minHeight: '200px' }}><p>No Branch Customer Wise records found.</p></div>
          ) : (
            <>
              <div className="table-container cw-branch-desktop-table" style={{ overflowX: 'auto' }}>
                <table className="table scrollable" style={{ width: '100%', minWidth: '1600px' }}>
                  <thead>
                    <tr>
                      <th>Division</th>
                      <th>Customer Code</th>
                      <th>Customer Name</th>
                      <th>City</th>
                      <th>Item Code</th>
                      <th>Item Name</th>
                      <th>Pack</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Sch Qty</th>
                      <th style={{ textAlign: 'right' }}>Sale Rate</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cwData.map((item, idx) => (
                      <tr key={item._id || idx}>
                        <td>{item.companyDivision || item.mfacCode || '—'}</td>
                        <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{item.customerCode || '—'}</td>
                        <td style={{ color: 'var(--text-white)', fontWeight: 500 }}>{item.customerName || '—'}</td>
                        <td>{item.customerCity || '—'}</td>
                        <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{item.itemCode || '—'}</td>
                        <td style={{ color: 'var(--text-white)', fontWeight: 500 }}>{item.itemName || '—'}</td>
                        <td>{item.packName || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.qty || 0}</td>
                        <td style={{ textAlign: 'right' }}>{item.schemeQty || 0}</td>
                        <td style={{ textAlign: 'right' }}>₹{Number(item.saleRate || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>₹{Number(item.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="cw-branch-mobile-cards">
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
                    {/* Badges */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      <span style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
                        Qty: {item.qty || 0}
                      </span>
                      <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
                        ₹{Number(item.amount || 0).toFixed(2)}
                      </span>
                      {(item.schemeQty || 0) > 0 && (
                        <span style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
                          Sch: {item.schemeQty}
                        </span>
                      )}
                    </div>
                    {/* Other fields */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '12px' }}>
                      {(item.companyDivision || item.mfacCode) && <div><span style={{ color: 'var(--text-muted)' }}>Division: </span><span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{item.companyDivision || item.mfacCode}</span></div>}
                      {item.saleRate > 0 && <div><span style={{ color: 'var(--text-muted)' }}>Sale Rate: </span><span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>₹{Number(item.saleRate || 0).toFixed(2)}</span></div>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {cwTotalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '20px' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => fetchCwData(cwPage - 1)} disabled={cwPage <= 1}><FiChevronLeft /> Prev</button>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Page {cwPage} of {cwTotalPages}</span>
                  <button className="btn btn-outline btn-sm" onClick={() => fetchCwData(cwPage + 1)} disabled={cwPage >= cwTotalPages}>Next <FiChevronRight /></button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Upload Branch SS Modal */}
      {showSsUploadModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '440px', padding: '24px', position: 'relative' }}>
            <button onClick={() => setShowSsUploadModal(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><FiX size={20} /></button>
            <h3 style={{ color: 'var(--text-white)', marginBottom: '8px', fontSize: '18px', fontWeight: 700 }}>
              {isOldSsUpload ? 'Upload Branch S&S Statement' : 'Upload Branch S&S Statement'}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>Select month & year and choose Excel file to upload.</p>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Month</label>
                <select className="form-select" value={ssUploadMonth} onChange={(e) => setSsUploadMonth(e.target.value)} style={{ width: '100%' }}>
                  {['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Year</label>
                <input type="text" className="form-input" value={ssUploadYear} onChange={(e) => setSsUploadYear(e.target.value)} style={{ width: '100%' }} />
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <input type="file" accept=".xlsx,.xls" onChange={(e) => setSsUploadFile(e.target.files[0])} style={{ width: '100%', padding: '8px', fontSize: '13px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--text-white)' }} />
              {ssUploadFile && <div style={{ marginTop: '6px', fontSize: '12px', color: '#10b981' }}>Selected: {ssUploadFile.name}</div>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-outline" onClick={() => setShowSsUploadModal(false)} disabled={ssUploading}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSsUploadSubmit} disabled={ssUploading || !ssUploadFile}>{ssUploading ? 'Uploading...' : 'Upload File'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Branch CW Modal */}
      {showCwUploadModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '440px', padding: '24px', position: 'relative' }}>
            <button onClick={() => setShowCwUploadModal(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><FiX size={20} /></button>
            <h3 style={{ color: 'var(--text-white)', marginBottom: '8px', fontSize: '18px', fontWeight: 700 }}>
              {isOldCwUpload ? 'Upload Branch Customer Wise' : 'Upload Branch Customer Wise'}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>Select month & year and choose Excel file to upload.</p>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Month</label>
                <select className="form-select" value={cwUploadMonth} onChange={(e) => setCwUploadMonth(e.target.value)} style={{ width: '100%' }}>
                  {['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Year</label>
                <input type="text" className="form-input" value={cwUploadYear} onChange={(e) => setCwUploadYear(e.target.value)} style={{ width: '100%' }} />
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <input type="file" accept=".xlsx,.xls" onChange={(e) => setCwUploadFile(e.target.files[0])} style={{ width: '100%', padding: '8px', fontSize: '13px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--text-white)' }} />
              {cwUploadFile && <div style={{ marginTop: '6px', fontSize: '12px', color: '#10b981' }}>Selected: {cwUploadFile.name}</div>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-outline" onClick={() => setShowCwUploadModal(false)} disabled={cwUploading}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCwUploadSubmit} disabled={cwUploading || !cwUploadFile}>{cwUploading ? 'Uploading...' : 'Upload File'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress Overlay */}
      {uploadProgress !== null && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div className="card" style={{ width: '420px', padding: '28px', textAlign: 'center' }}>
            <h3 style={{ color: 'var(--text-white)', marginBottom: '8px', fontWeight: 700 }}>
              {uploadProgress >= 90 ? '⚙️ Server Processing...' : '📤 Uploading File...'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
              {uploadProgress >= 90 ? 'File received. Server is saving data...' : 'Sending file to server...'}
            </p>
            <div style={{ width: '100%', height: '12px', background: '#2d3748', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ width: `${uploadProgress}%`, height: '100%', background: uploadProgress >= 90 ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'linear-gradient(90deg, #3b82f6, #10b981)', transition: 'width 0.3s ease-out' }}></div>
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

export default BranchData;
