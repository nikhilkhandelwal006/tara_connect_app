import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { medicinesAPI, ordersAPI, outstandingAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { FiHome, FiPackage, FiShoppingCart, FiSearch, FiPlus, FiMinus, FiTrash2, FiShoppingBag, FiX, FiList, FiDownload } from 'react-icons/fi';

const navItems = [
  { path: '/buyer', label: 'Dashboard', icon: <FiHome />, exact: true },
  { path: '/buyer/browse', label: 'Add Items', icon: <FiPackage /> },
  { path: '/buyer/outstanding', label: 'Outstanding', icon: <FiList /> },
  { path: '/buyer/cart', label: 'Cart', icon: <FiShoppingCart /> },
  { path: '/buyer/orders', label: 'My Orders', icon: <FiShoppingBag /> },
];

// Helper to get user-specific cart key
const getCartKey = (userId) => `cart_${userId}`;
const getWishlistKey = (userId) => `wishlist_${userId}`;

const formatStockDisplay = (stock) => {
  const n = typeof stock === 'number' ? stock : parseInt(stock, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const notifyCartUpdate = () => {
  window.dispatchEvent(new Event('tara-cart-update'));
};

const getCartLineCount = (userId) => {
  if (!userId) return 0;
  try {
    const items = JSON.parse(localStorage.getItem(getCartKey(userId)) || '[]');
    return items.length;
  } catch {
    return 0;
  }
};

const getItemSchemes = (item) =>
  [item?.sch1, item?.sch2, item?.sch3].filter((s) => s && String(s).trim());

const SchemeBadges = ({ item, size = '10px' }) => {
  const schemes = getItemSchemes(item);
  if (!schemes.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
      {schemes.map((sch, idx) => (
        <span
          key={idx}
          className="badge"
          style={{
            fontSize: size,
            padding: '2px 6px',
            background: 'rgba(56, 189, 248, 0.15)',
            color: '#38bdf8',
            fontWeight: 600,
          }}
        >
          {sch}
        </span>
      ))}
    </div>
  );
};

// Buyer Overview
const BuyerOverview = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        // Fetch only recent 10 orders for the dashboard summary card
        const res = await ordersAPI.getAll({ limit: 10, page: 1 });
        setOrders(res.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    
    // Get cart count for this specific user
    const userId = user?.id || user?._id;
    if (userId) {
      const items = JSON.parse(localStorage.getItem(getCartKey(userId)) || '[]');
      setCartCount(items.length);
    }
    
    fetchOrders();
  }, [user]);

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  const totalSpent = orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;

  return (
    <div className="animate-slide-up">
      <div className="page-header">
        <h1>Welcome, {user?.name} {user?.customerCode ? `(${user.customerCode})` : ''} 👋</h1>
        <p>Your item ordering dashboard</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-value">{orders.length}</div>
          <div className="stat-label">Total Orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24' }}>⏳</div>
          <div className="stat-value">{activeOrders}</div>
          <div className="stat-label">Active Orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(6, 214, 160, 0.12)', color: '#06d6a0' }}>💰</div>
          <div className="stat-value">₹{totalSpent.toLocaleString()}</div>
          <div className="stat-label">Total Spent</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--primary-glow)', color: 'var(--primary-light)' }}>🛒</div>
          <div className="stat-value">{cartCount}</div>
          <div className="stat-label">Items in Cart</div>
        </div>
      </div>

      {orders.length > 0 && (
        <div className="card">
          <h3 style={{ color: 'var(--text-white)', marginBottom: '16px', fontSize: '16px', fontWeight: 700 }}>
            📋 Recent Orders
          </h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Order No</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 5).map(order => (
                  <tr key={order._id}>
                    <td data-label="Order No" style={{ fontWeight: 600, color: 'var(--primary-light)' }}>{String(order.orderNumber || '').replace(/^#/, '')}</td>
                    <td data-label="Items">{order.items?.length} items</td>
                    <td data-label="Total" style={{ fontWeight: 600 }}>₹{order.totalAmount?.toLocaleString()}</td>
                    <td data-label="Status"><span className={`badge status-${order.status}`}>{order.status}</span></td>
                    <td data-label="Date" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Browse Medicines
const BrowseMedicines = () => {
  const { user } = useAuth();
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [manualQty, setManualQty] = useState(1);
  const qtyInputRef = useRef(null);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    // Load this specific user's cart
    const userId = user?.id || user?._id;
    if (userId) {
      setCart(JSON.parse(localStorage.getItem(getCartKey(userId)) || '[]'));
      setWishlist(JSON.parse(localStorage.getItem(getWishlistKey(userId)) || '[]'));
    }

    const fetchMedicines = async () => {
      // Don't fetch unless there is a search term of at least 2 characters
      if (search.trim().length < 2) {
        setMedicines([]);
        setLoading(false);
        setHasMore(false);
        return;
      }

      try {
        setLoading(true);
        setPage(1);
        setHasMore(true);
        const params = { page: 1, limit: 50, sort: 'name' };
        if (search) params.search = search;
        const res = await medicinesAPI.getAll(params);
        const normalized = res.data.map(m => ({ ...m, unit: m.unit === 'strip' ? 'box' : (m.unit || 'box') }));
        setMedicines(normalized.sort((a,b) => (a.name||'').trim().toLowerCase().localeCompare((b.name||'').trim().toLowerCase())));
        if (res.data.length < 50) setHasMore(false);
      } catch (error) {
        toast.error('Failed to load medicines');
      } finally {
        setLoading(false);
      }
    };
    
    // Add debounce to search
    const timer = setTimeout(() => {
        fetchMedicines();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [search, user]);

  useEffect(() => {
    setManualQty(1);
    if (selectedMedicine && qtyInputRef.current) {
      qtyInputRef.current.focus();
      qtyInputRef.current.select();
    }
  }, [selectedMedicine]);

  const handleAddAndClose = () => {
    if (!selectedMedicine || selectedMedicine.stock <= 0) return;
    addToCart(selectedMedicine, manualQty);
    setSelectedMedicine(null);
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const params = { page: nextPage, limit: 50 };
      if (search) params.search = search;
      
      const res = await medicinesAPI.getAll(params);
      const combined = [...medicines, ...res.data].map(m => ({ ...m, unit: m.unit === 'strip' ? 'box' : (m.unit || 'box') }));
      setMedicines(combined.sort((a,b) => (a.name||'').trim().toLowerCase().localeCompare((b.name||'').trim().toLowerCase())));
      setPage(nextPage);
      if (res.data.length < 50) setHasMore(false);
    } catch (error) {
       toast.error('Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  };

  const addToCart = (medicine, qty = 1) => {
    try {
      const buyQty = parseInt(qty) || 1;
      if (buyQty <= 0) {
        toast.error('Quantity must be greater than 0');
        return;
      }

      const userId = user?.id || user?._id;
      if (!userId) {
        toast.error('Authentication Error: Missing User ID. Please re-login.');
        return;
      }
      
      const cartKey = getCartKey(userId);
      const existingItems = JSON.parse(localStorage.getItem(cartKey) || '[]');
      const existingIndex = existingItems.findIndex(item => item.medicine === (medicine._id || medicine.id));
      
      if (!medicine._id && !medicine.id) {
        toast.error('Medicine ID is missing!');
        return;
      }

      let updatedCart = [...existingItems];
      let currentInCart = existingIndex > -1 ? updatedCart[existingIndex].quantity : 0;

      // Validation check
      if (typeof medicine.stock === 'number' && (currentInCart + buyQty) > medicine.stock) {
        toast.warning(`Insufficient stock! Only ${medicine.stock - currentInCart} more items can be added.`);
        return;
      }
      
      if (existingIndex > -1) {
        updatedCart[existingIndex].quantity += buyQty;
      } else {
        updatedCart.push({
          medicine: medicine._id || medicine.id,
          name: medicine.name || 'Unknown',
          price: medicine.price || 0,
          quantity: buyQty,
          maxStock: medicine.stock,
          seller: medicine.seller?.name || 'Unknown',
          unit: medicine.unit || 'box',
          tax: medicine.tax !== undefined ? medicine.tax : 12,
          sch1: medicine.sch1 || '',
          sch2: medicine.sch2 || '',
          sch3: medicine.sch3 || ''
        });
      }
      
      localStorage.setItem(cartKey, JSON.stringify(updatedCart));
      setCart(updatedCart);
      notifyCartUpdate();
      toast.success(`${buyQty} × ${medicine.name} added to cart`);
    } catch (err) {
      console.error(err);
      toast.error('System error while adding to cart: ' + err.message);
    }
  };

  const getCartQty = (medId) => {
    const item = cart.find(i => i.medicine === medId);
    return item ? item.quantity : 0;
  };

  const isWishlisted = (medId) => {
    return wishlist.some(item => (item._id || item.id) === medId);
  };

  const toggleWishlist = (medicine) => {
    try {
      const userId = user?.id || user?._id;
      if (!userId) return;
      const key = getWishlistKey(userId);
      let existing = JSON.parse(localStorage.getItem(key) || '[]');
      const medId = medicine._id || medicine.id;
      const index = existing.findIndex(item => (item._id || item.id) === medId);
      if (index > -1) {
        existing.splice(index, 1);
        toast.info(`${medicine.name} removed from wishlist`);
      } else {
        existing.push(medicine);
        toast.success(`${medicine.name} added to wishlist`);
      }
      localStorage.setItem(key, JSON.stringify(existing));
      setWishlist(existing);
    } catch(err) { console.error(err); }
  };

  return (
    <div className="animate-slide-up">
      <div className="page-header">
        <h1>Add Items</h1>
        <p>Search items and add to your cart</p>
      </div>

      <div style={{ marginBottom: '24px', position: 'relative' }}>
        <div className="search-bar">
          <FiSearch className="search-icon" />
          <input type="text" placeholder="Search items by name, generic name, or manufacturer..."
            value={search} 
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedMedicine(null);
            }} 
          />
        </div>

        {/* Search Dropdown */}
        {!selectedMedicine && search.trim().length >= 2 && !loading && medicines.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '8px',
            background: 'var(--bg-glass)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            maxHeight: '400px',
            overflowY: 'auto',
            zIndex: 50,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}>
            <div className="search-results-header buyer-search-grid" style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'rgba(255, 255, 255, 0.02)',
              color: 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              <div>Item Name</div>
              <div className="hide-mobile">Manufacturer</div>
              <div className="hide-mobile">Pack</div>
              <div className="hide-mobile">MRP</div>
              <div>Rate</div>
              <div style={{ textAlign: 'right' }}>Stock</div>
            </div>
            {medicines.map(med => (
              <div 
                key={med._id} 
                onClick={() => setSelectedMedicine(med)}
                className="search-result-item buyer-search-grid"
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-light)',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-white)', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {med.name}
                    </div>
                    {med.code && (
                      <span style={{ fontSize: '9px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                        {med.code}
                      </span>
                    )}
                  </div>
                  {med.genericName && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                      {med.genericName}
                    </div>
                  )}
                  <div className="show-mobile" style={{ fontSize: '11px', color: 'var(--primary-light)', marginTop: '2px' }}>
                    {med.manufacturer} • {med.unit || 'box'}
                  </div>
                  {(med.sch1 || med.sch2 || med.sch3) && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {med.sch1 && <span className="badge-primary" style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>{med.sch1}</span>}
                      {med.sch2 && <span className="badge-primary" style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>{med.sch2}</span>}
                      {med.sch3 && <span className="badge-primary" style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>{med.sch3}</span>}
                    </div>
                  )}
                </div>
                <div className="hide-mobile" style={{ minWidth: 0, fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {med.manufacturer || 'Unknown'}
                </div>
                <div className="hide-mobile" style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {med.description || med.unit || 'N/A'}
                </div>
                <div className="hide-mobile" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                  ₹{med.mrp || 0}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)' }}>
                  ₹{med.price}
                  <div className="show-mobile" style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>₹{med.mrp}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: 600, color: med.stock > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                  {formatStockDisplay(med.stock)}
                </div>
              </div>
            ))}
            {hasMore && (
              <div 
                onClick={loadMore} 
                style={{
                  padding: '16px', 
                  textAlign: 'center', 
                  color: 'var(--primary)', 
                  cursor: 'pointer', 
                  fontSize: '14px', 
                  fontWeight: 600,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {loadingMore ? 'Loading...' : 'Load More Results'}
              </div>
            )}
          </div>
        )}
      </div>

      {loading && search.trim().length >= 2 ? (
        <div className="loading-container"><div className="spinner"></div></div>
      ) : search.trim().length >= 2 && medicines.length > 0 ? (
        <div className="empty-state" style={{ opacity: 0.7 }}>
          <div className="empty-icon">📋</div>
          <h3>{medicines.length} results found</h3>
          <p>Click an item, set qty, press Enter to add to cart</p>
        </div>
      ) : search.trim().length >= 2 && medicines.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h3>No items found</h3>
          <p>Try a different search term</p>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3>Ready to search</h3>
          <p>Search by item name, generic name, or manufacturer</p>
        </div>
      )}

      {selectedMedicine && (
        <div className="modal-overlay" onClick={() => setSelectedMedicine(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px', width: '92%' }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSelectedMedicine(null);
            }}
          >
            <div className="modal-header">
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 style={{ fontSize: '18px', marginBottom: '4px', wordBreak: 'break-word' }}>{selectedMedicine.name}</h2>
                {selectedMedicine.genericName && (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{selectedMedicine.genericName}</p>
                )}
              </div>
              <button type="button" className="modal-close" onClick={() => setSelectedMedicine(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '12px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '26px', fontWeight: 800, color: 'var(--accent)' }}>₹{selectedMedicine.price}</span>
                <span className={`badge ${selectedMedicine.stock > 10 ? 'badge-success' : selectedMedicine.stock > 0 ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '13px', padding: '5px 10px' }}>
                  Stock: {formatStockDisplay(selectedMedicine.stock)}
                </span>
              </div>

              {(selectedMedicine.sch1 || selectedMedicine.sch2 || selectedMedicine.sch3) && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {selectedMedicine.sch1 && <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '11px' }}>{selectedMedicine.sch1}</span>}
                  {selectedMedicine.sch2 && <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '11px' }}>{selectedMedicine.sch2}</span>}
                  {selectedMedicine.sch3 && <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '11px' }}>{selectedMedicine.sch3}</span>}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px', fontSize: '12px' }}>
                {selectedMedicine.manufacturer && (
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Manufacturer</span>
                    <p style={{ margin: '2px 0 0', fontWeight: 600, color: 'var(--text-white)' }}>{selectedMedicine.manufacturer}</p>
                  </div>
                )}
                {selectedMedicine.code && (
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Item Code</span>
                    <p style={{ margin: '2px 0 0', fontWeight: 600, color: 'var(--accent)' }}>{selectedMedicine.code}</p>
                  </div>
                )}
                {selectedMedicine.mrp > 0 && (
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>MRP</span>
                    <p style={{ margin: '2px 0 0', fontWeight: 600 }}>₹{selectedMedicine.mrp}</p>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Qty</span>
                <input
                  ref={qtyInputRef}
                  type="number"
                  min="1"
                  max={Math.max(selectedMedicine.stock, 1)}
                  value={manualQty}
                  onChange={(e) => setManualQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAndClose();
                    }
                  }}
                  className="form-input"
                  style={{ width: '100px', textAlign: 'center', fontWeight: 700 }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={handleAddAndClose}
                  disabled={selectedMedicine.stock <= 0}
                >
                  <FiPlus /> Add to Cart
                </button>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 12px', textAlign: 'center' }}>
                Press Enter to add and close
              </p>

              {getCartQty(selectedMedicine._id) > 0 && (
                <p style={{ fontSize: '12px', color: 'var(--success)', textAlign: 'center', marginBottom: '8px' }}>
                  ✓ {getCartQty(selectedMedicine._id)} already in cart
                </p>
              )}


            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Cart
const Cart = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    const userId = user?.id || user?._id;
    if (userId) {
      setItems(JSON.parse(localStorage.getItem(getCartKey(userId)) || '[]'));
    }
  }, [user]);

  const updateQty = (index, delta) => {
    const updated = [...items];
    updated[index].quantity += delta;
    if (updated[index].quantity <= 0) {
      updated.splice(index, 1);
    }
    setItems(updated);
    const userId = user?.id || user?._id;
    if (userId) {
      localStorage.setItem(getCartKey(userId), JSON.stringify(updated));
      notifyCartUpdate();
    }
  };

  const removeItem = (index) => {
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
    const userId = user?.id || user?._id;
    if (userId) {
      localStorage.setItem(getCartKey(userId), JSON.stringify(updated));
      notifyCartUpdate();
    }
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

  const calculateItemSubtotal = (item) => {
    let total = item.price * item.quantity;
    const schemes = [item.sch1, item.sch2, item.sch3].filter(Boolean);
    
    schemes.forEach(sch => {
      const s = String(sch).trim();
      
      // Case 1: Percentage scheme with trigger, e.g. "2+44.00%"
      if (s.includes('%') && s.includes('+')) {
        const parts = s.split('+');
        const triggerQty = parseFloat(parts[0]);
        const percent = parseFloat(parts[1].replace('%', '').trim());
        if (!isNaN(triggerQty) && !isNaN(percent) && triggerQty > 0) {
          if (item.quantity % triggerQty === 0) {
            const discountPercent = percent / triggerQty;
            const discountedPrice = item.price * (1 - (discountPercent / 100));
            total = item.quantity * discountedPrice;
          } else {
            total = item.quantity * item.price;
          }
        }
      }
      // Case 2: Free item scheme, e.g. "10+1"
      else if (s.includes('+') && !s.includes('%')) {
        const parts = s.split('+').map(p => parseFloat(p.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          const buyNeeded = parts[0];
          const freeGiven = parts[1];
          const cycleSize = buyNeeded + freeGiven;
          const cycles = Math.floor(item.quantity / cycleSize);
          const remainder = item.quantity % cycleSize;
          const paidQty = (cycles * buyNeeded) + remainder;
          total = paidQty * item.price;
        }
      } 
      // Case 3: Flat percentage scheme, e.g. "10%"
      else if (s.includes('%') && !s.includes('+')) {
        const percent = parseFloat(s.replace('%', '').trim());
        if (!isNaN(percent)) {
          total = total * (1 - (percent / 100));
        }
      }
    });
    return total;
  };

  const subtotal = items.reduce((sum, item) => sum + calculateItemSubtotal(item), 0);
  const taxAmount = items.reduce((sum, item) => {
    const itemSub = calculateItemSubtotal(item);
    return sum + (itemSub * ((item.tax !== undefined ? item.tax : 12) / 100));
  }, 0);
  const total = subtotal + taxAmount;

  const placeOrder = async () => {
    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    if (user?.permissions?.canPlaceOrder === false) {
      toast.error('You do not have permission to place orders. Please contact admin.');
      return;
    }

    setPlacing(true);
    try {
      await ordersAPI.create({
        items: items.map(i => ({ medicine: i.medicine, quantity: i.quantity })),
        notes
      });
      toast.success('🎉 Order placed successfully!');
      const userId = user?.id || user?._id;
      if (userId) {
        localStorage.removeItem(getCartKey(userId));
        notifyCartUpdate();
      }
      setItems([]);
      setNotes('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="animate-slide-up">
      <div className="page-header">
        <h1>Shopping Cart</h1>
        <p>{items.length} items in your cart</p>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🛒</div>
          <h3>Your cart is empty</h3>
          <p>Browse all items and add to your cart</p>
        </div>
      ) : (
        <div className="buyer-cart-layout">
          <div>
            {items.map((item, index) => (
              <div className="card buyer-cart-card" key={item.medicine}>
                <div className="buyer-cart-card-info">
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-white)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {item.name}
                    {itemHasAppliedScheme(item) && (
                      <span className="badge" style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                        Scheme Applied
                      </span>
                    )}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    ₹{item.price} × {item.quantity} = <span style={{ color: 'var(--accent)', fontWeight: 600 }}>₹{calculateItemSubtotal(item).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </p>
                  <SchemeBadges item={item} size="10px" />
                </div>
                <div className="buyer-cart-card-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => updateQty(index, -1)}>
                    <FiMinus />
                  </button>
                  <span style={{ fontWeight: 700, minWidth: '30px', textAlign: 'center', fontSize: '16px' }}>{item.quantity}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => updateQty(index, 1)}
                    disabled={item.quantity >= item.maxStock}>
                    <FiPlus />
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeItem(index)}>
                    <FiTrash2 style={{ color: 'var(--danger)' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ position: 'sticky', top: '32px' }}>
            <h3 style={{ color: 'var(--text-white)', fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>
              Order Summary
            </h3>
            
            <div style={{ marginBottom: '16px' }}>
              {items.map(item => (
                <div key={item.medicine} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <span>{item.name} × {item.quantity}</span>
                  <span>₹{calculateItemSubtotal(item).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                <span>Subtotal</span>
                <span>₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                <span>Estimated Tax</span>
                <span>₹{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-white)' }}>Estimated Total</span>
              <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent)' }}>₹{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>

            <div className="form-group">
              <label className="form-label">Notes (Optional)</label>
              <input className="form-input" type="text" value={notes}
                onChange={(e) => setNotes(e.target.value)} placeholder="Any special instructions..." />
            </div>

            <button className="btn btn-accent btn-lg" style={{ width: '100%' }}
              onClick={placeOrder} disabled={placing || user?.permissions?.canPlaceOrder === false}>
              {user?.permissions?.canPlaceOrder === false ? 'Ordering Restricted' : placing ? 'Placing Order...' : '🎉 Place Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// My Orders
const MyOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        // Cap at 150 orders — covers any reasonable buyer order history
        const res = await ordersAPI.getAll({ limit: 150 });
        setOrders(res.data);
      } catch (error) {
        toast.error('Failed to load orders');
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  return (
    <div className="animate-slide-up">
      <div className="page-header">
        <h1>My Orders</h1>
        <p>Track all your orders</p>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner"></div></div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h3>No orders yet</h3>
          <p>Place your first order from the browse page</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {orders.map(order => {
              const orderDate = new Date(order.createdAt);
              const orderNo = String(order.orderNumber || '').replace(/^#/, '');
              const isOpen = expandedOrderId === order._id;
              return (
                <div key={order._id} className="card" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 16px', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--primary-light)', fontSize: '15px' }}>{orderNo}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {orderDate.toLocaleDateString('en-IN')} · {orderDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span className={`badge status-${order.status}`}>{order.status}</span>
                    <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--accent)' }}>₹{order.totalAmount?.toLocaleString()}</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setInvoiceOrder(order)}
                        style={{ fontSize: '12px', padding: '4px 14px' }}
                      >
                        View
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {order.items?.map((item, i) => (
                          <li
                            key={i}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              gap: '8px',
                              padding: '8px 10px',
                              background: 'var(--bg-glass)',
                              borderRadius: '6px',
                              fontSize: '12px',
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ color: 'var(--text-white)', fontWeight: 500, lineHeight: 1.35, display: 'block' }}>
                                {item.medicineName || item.name || `Item ${i + 1}`}
                              </span>
                              <SchemeBadges item={item} size="10px" />
                            </div>
                            <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>×{item.quantity}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {invoiceOrder && (
            <div className="modal-overlay" onClick={() => setInvoiceOrder(null)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '92%' }}>
                <div className="modal-header">
                  <h2 style={{ fontSize: '16px' }}>Order Details: {String(invoiceOrder.orderNumber || '').replace(/^#/, '')}</h2>
                  <button type="button" className="modal-close" onClick={() => setInvoiceOrder(null)}>×</button>
                </div>
                <div className="modal-body" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                  <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={`badge status-${invoiceOrder.status}`} style={{ fontSize: '12px', padding: '4px 12px' }}>
                      {invoiceOrder.status}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Date: {new Date(invoiceOrder.createdAt).toLocaleDateString('en-IN')}
                    </span>
                  </div>

                  <ul style={{ listStyle: 'none', margin: '0 0 14px', padding: 0 }}>
                    {invoiceOrder.items?.map((item, i) => {
                      const base = (item.price || 0) * item.quantity;
                      const tax = item.taxAmount || (base * (item.taxRate || 12) / 100);
                      const packSize = item.medicine?.description || item.medicine?.unit || item.unit || '-';
                      return (
                        <li key={i} style={{ padding: '10px 12px', marginBottom: '8px', background: 'var(--bg-glass)', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '13px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                                {item.medicineName || item.name || `Item ${i + 1}`}
                                {item.medicine?.code && (
                                  <span style={{ fontSize: '9px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '1px 5px', borderRadius: '4px', marginLeft: '6px', fontWeight: 600 }}>
                                    {item.medicine.code}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Pack Size: {packSize} | Qty: {item.quantity}
                              </div>
                              <SchemeBadges item={item} size="9px" />
                            </div>
                            <span style={{ fontWeight: 600, color: 'var(--text-white)' }}>₹{(base + tax).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {(() => {
                    const subT = invoiceOrder.items?.reduce((s, it) => s + (it.price || 0) * it.quantity, 0) || 0;
                    const taxT = invoiceOrder.items?.reduce((s, it) => s + (it.taxAmount || ((it.price * it.quantity) * (it.taxRate || 12) / 100)), 0) || 0;
                    const grandTotal = subT + taxT;
                    return (
                      <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                          <span>₹{subT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>GST</span>
                          <span>+ ₹{taxT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '15px', color: 'var(--accent)' }}>
                          <span>Total</span>
                          <span>₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {invoiceOrder.notes && (
                    <div style={{ marginTop: '12px', padding: '10px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', fontSize: '12px' }}>
                      <strong style={{ color: 'var(--text-muted)' }}>Notes: </strong>{invoiceOrder.notes}
                    </div>
                  )}

                  <button className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }} onClick={() => setInvoiceOrder(null)}>
                    Close Details
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const Outstanding = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ totalAmount: 0, totalBalance: 0 });

  const customerCode = user?.customerCode || '';
  const creditLimit = user?.creditLimit || 0;
  const creditDays = user?.creditDays || 0;

  useEffect(() => {
    const fetchOutstanding = async () => {
      try {
        setLoading(true);
        // Fetch records for this specific buyer using outstandingAPI
        const res = await outstandingAPI.getAll({ partyCode: customerCode, limit: 200 });
        const recs = res.data?.data || [];
        setRecords(recs);
        const totalAmt = recs.reduce((s, r) => s + (r.amountTotal || 0), 0);
        const totalBal = recs.reduce((s, r) => s + (r.balanceAmount || 0), 0);
        setSummary({ totalAmount: totalAmt, totalBalance: totalBal });
      } catch (error) {
        console.error('Outstanding fetch error:', error);
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };

    if (customerCode) {
      fetchOutstanding();
    } else {
      setLoading(false);
    }
  }, [customerCode]);

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  const remainingCredit = creditLimit - Math.abs(summary.totalBalance);

  return (
    <div className="animate-slide-up">
      <div className="page-header">
        <h1>Outstanding 💳</h1>
        <p>Your outstanding balance and credit details</p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: '1fr', maxWidth: '320px', marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>💰</div>
          <div className="stat-value">₹{Math.abs(summary.totalBalance).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          <div className="stat-label">Total Outstanding</div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <h3 style={{ color: 'var(--text-white)', marginBottom: '16px', fontSize: '16px', fontWeight: 700 }}>
          📋 Outstanding Details
        </h3>

        {!customerCode ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>
            Party code not linked to your account. Please contact admin.
          </p>
        ) : records.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>
            ✅ No outstanding records found. Your account is clear!
          </p>
        ) : (
          <>
            <div className="table-container buyer-outstanding-desktop-table">
              <table className="table">
                <thead>
                  <tr>
                    <th>Party Code</th>
                    <th>Prefix</th>
                    <th>Doc No</th>
                    <th>Doc Date</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'right' }}>Balance</th>
                    <th style={{ textAlign: 'center' }}>Due Days</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec, idx) => (
                    <tr key={rec._id || idx}>
                      <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{rec.partyCode || '—'}</td>
                      <td>
                        {rec.prefix ? (
                          <span className="badge" style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px' }}>{rec.prefix}</span>
                        ) : '—'}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{rec.docNo || '—'}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {rec.docDate ? new Date(rec.docDate).toLocaleDateString('en-IN') : '—'}
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
                            background: rec.dueDays > 90 ? 'rgba(239, 68, 68, 0.15)' : rec.dueDays > 30 ? 'rgba(251, 191, 36, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: rec.dueDays > 90 ? '#ef4444' : rec.dueDays > 30 ? '#fbbf24' : '#10b981',
                          }}
                        >
                          {rec.dueDays} days
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <td colSpan={4} style={{ fontWeight: 700, color: 'var(--text-white)', padding: '10px 12px' }}>Total</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-white)' }}>
                      ₹{Math.abs(summary.totalAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#fbbf24' }}>
                      ₹{Math.abs(summary.totalBalance).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="buyer-outstanding-mobile-cards">
              {records.map((rec, idx) => (
                <div key={rec._id || idx} style={{
                  background: 'var(--bg-glass)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '12px',
                  padding: '14px',
                  marginBottom: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{rec.docNo || '—'}</span>
                    {rec.prefix && (
                      <span className="badge" style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px' }}>
                        {rec.prefix}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <span>Date:</span>
                    <span>{rec.docDate ? new Date(rec.docDate).toLocaleDateString('en-IN') : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Amount Total:</span>
                    <span style={{ fontWeight: 600, color: rec.amountTotal < 0 ? '#ef4444' : 'var(--text-white)' }}>
                      {rec.amountTotal < 0 ? '-' : ''}₹{Math.abs(rec.amountTotal).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Balance Due:</span>
                    <span style={{ fontWeight: 700, color: rec.balanceAmount < 0 ? '#ef4444' : rec.balanceAmount > 0 ? '#fbbf24' : 'var(--text-muted)' }}>
                      {rec.balanceAmount < 0 ? '-' : ''}₹{Math.abs(rec.balanceAmount).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', borderTop: '1px solid var(--border-light)', paddingTop: '6px', marginTop: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Due Days:</span>
                    <span
                      className="badge"
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        background: rec.dueDays > 90 ? 'rgba(239, 68, 68, 0.15)' : rec.dueDays > 30 ? 'rgba(251, 191, 36, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: rec.dueDays > 90 ? '#ef4444' : rec.dueDays > 30 ? '#fbbf24' : '#10b981',
                      }}
                    >
                      {rec.dueDays} days
                    </span>
                  </div>
                </div>
              ))}
              {/* Mobile Total Row */}
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px dashed var(--border)',
                borderRadius: '12px',
                padding: '14px',
                marginTop: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700 }}>
                  <span style={{ color: 'var(--text-white)' }}>Total Amount:</span>
                  <span style={{ color: 'var(--text-white)' }}>₹{Math.abs(summary.totalAmount).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700 }}>
                  <span style={{ color: 'var(--text-white)' }}>Total Balance:</span>
                  <span style={{ color: '#fbbf24' }}>₹{Math.abs(summary.totalBalance).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};


const BuyerDashboard = () => {
  const { user } = useAuth();
  const [cartBadge, setCartBadge] = useState(0);

  const refreshCartBadge = useCallback(() => {
    const userId = user?.id || user?._id;
    setCartBadge(getCartLineCount(userId));
  }, [user]);

  useEffect(() => {
    refreshCartBadge();
    window.addEventListener('tara-cart-update', refreshCartBadge);
    return () => window.removeEventListener('tara-cart-update', refreshCartBadge);
  }, [refreshCartBadge]);

  const navWithBadges = navItems.map((item) =>
    item.path === '/buyer/cart' ? { ...item, badge: cartBadge } : item
  );

  return (
    <DashboardLayout navItems={navWithBadges}>
      <style>{`
        /* Custom responsive classes for Buyer Dashboard */
        .buyer-search-grid {
          display: grid;
          grid-template-columns: 3fr 2fr 1fr 1fr 1fr 1fr;
          gap: 12px;
          align-items: center;
        }
        .buyer-cart-layout {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 24px;
          align-items: flex-start;
        }
        .buyer-cart-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          gap: 16px;
        }
        .buyer-cart-card-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        @media (max-width: 991px) {
          .buyer-cart-layout {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
        }
        @media (max-width: 768px) {
          .buyer-search-grid {
            grid-template-columns: 3fr 1fr 1.2fr !important;
            gap: 8px !important;
          }
          .buyer-outstanding-desktop-table {
            display: none !important;
          }
          .buyer-outstanding-mobile-cards {
            display: block !important;
          }
        }
        @media (min-width: 769px) {
          .buyer-outstanding-desktop-table {
            display: block !important;
          }
          .buyer-outstanding-mobile-cards {
            display: none !important;
          }
        }
        @media (max-width: 576px) {
          .buyer-cart-card {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
            padding: 16px !important;
          }
          .buyer-cart-card-actions {
            justify-content: space-between !important;
            border-top: 1px solid var(--border-light) !important;
            padding-top: 10px !important;
            width: 100% !important;
          }
        }
      `}</style>
      <Routes>
        <Route index element={<BuyerOverview />} />
        <Route path="browse" element={<BrowseMedicines />} />
        <Route path="outstanding" element={<Outstanding />} />
        <Route path="cart" element={<Cart />} />
        <Route path="orders" element={<MyOrders />} />
      </Routes>
    </DashboardLayout>
  );
};

export default BuyerDashboard;
