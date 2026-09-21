import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { medicinesAPI, ordersAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { FiHome, FiPackage, FiShoppingCart, FiPlus, FiEdit2, FiTrash2, FiSearch, FiX } from 'react-icons/fi';

const ConfirmModal = ({ open, title, message, onConfirm, onCancel, danger = false }) => {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px',
        padding: '28px 32px', maxWidth: '400px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
      }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-white)', marginBottom: '10px' }}>{title}</div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>{message}</div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button className="btn btn-outline btn-sm" onClick={onCancel} style={{ padding: '8px 18px' }}>Cancel</button>
          <button className="btn btn-sm" onClick={onConfirm} style={{
            padding: '8px 18px', background: danger ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'var(--primary)',
            color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer'
          }}>Confirm</button>
        </div>
      </div>
    </div>
  );
};

const navItems = [
  { path: '/seller', label: 'Dashboard', icon: <FiHome />, exact: true },
  { path: '/seller/medicines', label: 'My Medicines', icon: <FiPackage /> },
  { path: '/seller/orders', label: 'Orders', icon: <FiShoppingCart /> },
];

// Medicine Form Modal
const MedicineModal = ({ medicine, onClose, onSave }) => {
  const [formData, setFormData] = useState(medicine || {
    name: '', genericName: '', manufacturer: '',
    price: '', stock: '', unit: 'box', description: '', prescription: false
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (medicine) {
        await medicinesAPI.update(medicine._id, formData);
        toast.success('Medicine updated!');
      } else {
        await medicinesAPI.create(formData);
        toast.success('Medicine added!');
      }
      onSave();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save medicine');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{medicine ? 'Edit Medicine' : 'Add Medicine'}</h2>
          <button className="modal-close" onClick={onClose}><FiX /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Medicine Name *</label>
              <input className="form-input" type="text" required value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Paracetamol 500mg" />
            </div>
            <div className="form-group">
              <label className="form-label">Generic Name</label>
              <input className="form-input" type="text" value={formData.genericName}
                onChange={e => setFormData({...formData, genericName: e.target.value})} placeholder="e.g. Acetaminophen" />
            </div>
            <div className="form-group">
              <label className="form-label">Manufacturer</label>
              <input className="form-input" type="text" value={formData.manufacturer}
                onChange={e => setFormData({...formData, manufacturer: e.target.value})} placeholder="e.g. Cipla" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Price (₹) *</label>
                <input className="form-input" type="number" required min="0" step="0.01" value={formData.price}
                  onChange={e => setFormData({...formData, price: e.target.value})} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="form-label">Stock *</label>
                <input className="form-input" type="number" required min="0" value={formData.stock}
                  onChange={e => setFormData({...formData, stock: e.target.value})} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-select" value={formData.unit}
                  onChange={e => setFormData({...formData, unit: e.target.value})}>
                  <option value="box">Box</option>
                  <option value="strip">Strip</option>
                  <option value="bottle">Bottle</option>
                  <option value="tube">Tube</option>
                  <option value="vial">Vial</option>
                  <option value="packet">Packet</option>
                  <option value="tablet">Tablet</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input" rows="3" value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Brief description of the medicine..." style={{ resize: 'vertical' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.prescription}
                  onChange={e => setFormData({...formData, prescription: e.target.checked})}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }} />
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Prescription Required</span>
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : (medicine ? 'Update' : 'Add Medicine')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Seller Overview
const SellerOverview = () => {
  const [medicines, setMedicines] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [medsRes, ordersRes] = await Promise.all([
          medicinesAPI.getAll(),
          ordersAPI.getAll()
        ]);
        setMedicines(medsRes.data);
        setOrders(ordersRes.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  const totalRevenue = orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;

  return (
    <div className="animate-slide-up">
      <div className="page-header">
        <h1>Seller Dashboard</h1>
        <p>Manage your medicines and orders</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">💊</div>
          <div className="stat-value">{medicines.length}</div>
          <div className="stat-label">My Medicines</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24' }}>📦</div>
          <div className="stat-value">{orders.length}</div>
          <div className="stat-label">Total Orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>⏳</div>
          <div className="stat-value">{pendingOrders}</div>
          <div className="stat-label">Pending Orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(6, 214, 160, 0.12)', color: '#06d6a0' }}>💰</div>
          <div className="stat-value">₹{totalRevenue.toLocaleString()}</div>
          <div className="stat-label">Revenue</div>
        </div>
      </div>
    </div>
  );
};

// Seller Medicines
const SellerMedicines = () => {
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editMedicine, setEditMedicine] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);

  const fetchMedicines = async () => {
    try {
      setPage(1);
      setHasMore(true);
      const params = { page: 1, limit: 50 };
      if (search) params.search = search;
      const res = await medicinesAPI.getAll(params);
      setMedicines(res.data);
      if (res.data.length < 50) setHasMore(false);
    } catch (error) {
      toast.error('Failed to fetch medicines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    // Add debounce
    const timer = setTimeout(() => {
        fetchMedicines();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const params = { page: nextPage, limit: 50 };
      if (search) params.search = search;
      
      const res = await medicinesAPI.getAll(params);
      setMedicines(prev => [...prev, ...res.data]);
      setPage(nextPage);
      if (res.data.length < 50) setHasMore(false);
    } catch (error) {
       toast.error('Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  };

  const deleteMedicine = async (id, name) => {
    setConfirmModal({
      title: 'Delete Medicine',
      message: `Are you sure you want to delete "${name}"?`,
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await medicinesAPI.delete(id);
          toast.success('Medicine deleted');
          fetchMedicines();
        } catch (error) {
          toast.error('Failed to delete');
        }
      }
    });
  };

  return (
    <div className="animate-slide-up">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>My Medicines</h1>
          <p>Manage your medicine listings</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditMedicine(null); setShowModal(true); }}>
          <FiPlus /> Add Medicine
        </button>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <div className="search-bar">
          <FiSearch className="search-icon" />
          <input type="text" placeholder="Search medicines..." value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner"></div></div>
      ) : medicines.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💊</div>
          <h3>No medicines listed</h3>
          <p>Start by adding your first medicine</p>
          <button className="btn btn-primary" style={{ marginTop: '16px' }}
            onClick={() => setShowModal(true)}>
            <FiPlus /> Add Medicine
          </button>
        </div>
      ) : (
        <>
        <div className="content-grid">
          {medicines.map(med => (
            <div className="card" key={med._id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-white)', marginBottom: '4px' }}>{med.name}</h3>
                  {med.genericName && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{med.genericName}</p>}
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>PRICE</p>
                  <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent)' }}>₹{med.price}</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>STOCK</p>
                  <p style={{ fontSize: '18px', fontWeight: 700 }}>
                    <span className={med.stock > 10 ? '' : 'text-danger'}>{med.stock}</span>
                  </p>
                </div>
              </div>

              {med.manufacturer && (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  By {med.manufacturer}
                </p>
              )}

              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }}
                  onClick={() => { setEditMedicine(med); setShowModal(true); }}>
                  <FiEdit2 /> Edit
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => deleteMedicine(med._id, med.name)}>
                  <FiTrash2 style={{ color: 'var(--danger)' }} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {hasMore && (
          <div style={{ textAlign: 'center', marginTop: '30px', paddingBottom: '30px' }}>
            <button 
              className="btn btn-primary" 
              onClick={loadMore} 
              disabled={loadingMore}
              style={{ padding: '12px 32px', fontSize: '15px' }}
            >
              {loadingMore ? 'Loading More...' : 'Load More Medicines'}
            </button>
          </div>
        )}
        </>
      )}

      {showModal && (
        <MedicineModal
          medicine={editMedicine}
          onClose={() => { setShowModal(false); setEditMedicine(null); }}
          onSave={fetchMedicines}
        />
      )}
      <ConfirmModal
        open={!!confirmModal}
        title={confirmModal?.title || ''}
        message={confirmModal?.message || ''}
        danger={confirmModal?.danger}
        onConfirm={confirmModal?.onConfirm || (() => {})}
        onCancel={() => setConfirmModal(null)}
      />
    </div>
  );
};

// Seller Orders
const SellerOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const res = await ordersAPI.getAll();
      setOrders(res.data);
    } catch (error) {
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const updateStatus = async (id, status) => {
    try {
      await ordersAPI.updateStatus(id, { status });
      toast.success(`Order ${status}`);
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  return (
    <div className="animate-slide-up">
      <div className="page-header">
        <h1>My Orders</h1>
        <p>Orders containing your medicines</p>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner"></div></div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h3>No orders yet</h3>
          <p>Orders will appear here when buyers purchase your medicines</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Buyer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order._id}>
                  <td style={{ fontWeight: 600, color: 'var(--primary-light)' }}>{order.orderNumber}</td>
                  <td>
                    <div>{order.buyer?.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{order.buyer?.phone}</div>
                  </td>
                  <td>
                    {order.items?.map((item, i) => (
                      <div key={i} style={{ fontSize: '13px', marginBottom: '2px' }}>
                        {item.medicineName} × {item.quantity}
                      </div>
                    ))}
                  </td>
                  <td style={{ fontWeight: 600 }}>₹{order.totalAmount?.toLocaleString()}</td>
                  <td><span className={`badge status-${order.status}`}>{order.status}</span></td>
                  <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    {order.status !== 'delivered' && order.status !== 'cancelled' && (
                      <select className="form-select" style={{ padding: '6px 10px', fontSize: '12px', minWidth: '120px' }}
                        value={order.status} onChange={(e) => updateStatus(order._id, e.target.value)}>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const SellerDashboard = () => {
  return (
    <DashboardLayout navItems={navItems}>
      <Routes>
        <Route index element={<SellerOverview />} />
        <Route path="medicines" element={<SellerMedicines />} />
        <Route path="orders" element={<SellerOrders />} />
      </Routes>
    </DashboardLayout>
  );
};

export default SellerDashboard;
