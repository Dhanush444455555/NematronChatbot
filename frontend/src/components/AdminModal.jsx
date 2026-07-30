import React, { useState, useEffect } from 'react';
import { ShieldCheck, Users, Search, RefreshCw, X, Mail, Calendar, User } from 'lucide-react';

const API_BASE = import.meta.env.VITE_BACKEND_URL || '';

export default function AdminModal({ isOpen, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('nematron_token');
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to load users');
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.name && u.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card admin-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px', width: '92%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent-indigo)'
            }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>Admin Dashboard</h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Registered User Accounts ({users.length})
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
          {/* Controls bar */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)', padding: '8px 12px'
            }}>
              <Search size={15} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search user email or name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text-primary)', fontSize: '0.85rem', width: '100%'
                }}
              />
            </div>
            <button
              onClick={fetchUsers}
              disabled={loading}
              title="Refresh User List"
              style={{
                padding: '8px 14px', background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)', cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: '6px', fontSize: '0.83rem', fontWeight: 500
              }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              Refresh
            </button>
          </div>

          {error && (
            <div className="login-error">
              <span>⚠️ {error}</span>
            </div>
          )}

          {/* User List */}
          <div style={{
            maxHeight: '360px', overflowY: 'auto', display: 'flex',
            flexDirection: 'column', gap: '8px'
          }}>
            {filteredUsers.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '36px 16px',
                color: 'var(--text-muted)', fontSize: '0.88rem'
              }}>
                {loading ? 'Loading user registrations...' : 'No user accounts found.'}
              </div>
            ) : (
              filteredUsers.map((u, idx) => (
                <div key={u.id || idx} style={{
                  padding: '12px 14px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '50%',
                      background: 'var(--accent-gradient)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 600, fontSize: '0.85rem', flexShrink: 0
                    }}>
                      {(u.name?.[0] || u.email[0] || 'U').toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}>
                        {u.name || 'Unnamed User'}
                      </div>
                      <div style={{
                        fontSize: '0.8rem', color: 'var(--accent-cyan)',
                        display: 'flex', alignItems: 'center', gap: '4px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}>
                        <Mail size={12} />
                        {u.email}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    fontSize: '0.74rem', color: 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', gap: '4px',
                    whiteSpace: 'nowrap', flexShrink: 0
                  }}>
                    <Calendar size={12} />
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Recent'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
