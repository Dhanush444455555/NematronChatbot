import React, { useState } from 'react';
import { Plus, MessageSquare, Trash2, Edit2, Settings, Bot, Search, X, LogOut, User } from 'lucide-react';

export default function Sidebar({
  chats,
  activeChatId,
  isOpenMobile,
  onCloseMobile,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  onOpenSettings,
  currentModel,
  onModelChange,
  authUser,
  onLogout,
  onOpenAdmin
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  const filteredChats = chats.filter(c => 
    (c.title || "New Chat").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const startRename = (chat, e) => {
    e.stopPropagation();
    setEditingId(chat._id);
    setEditTitle(chat.title || "New Chat");
  };

  const handleRenameSubmit = (e) => {
    e.preventDefault();
    if (editTitle.trim() && editingId) {
      onRenameChat(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <aside className={`sidebar ${isOpenMobile ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="logo-badge">
          <div className="logo-icon">
            <Bot size={22} />
          </div>
          <div className="logo-text">
            <h1>Nemotron Agents</h1>
            <span>Advanced AI Client</span>
          </div>
        </div>
        <button className="mobile-close-btn" onClick={onCloseMobile} title="Close Sidebar">
          <X size={20} />
        </button>
      </div>

      <button className="new-chat-btn" onClick={onNewChat}>
        <Plus size={18} />
        <span>New Conversation</span>
      </button>

      <div style={{ padding: '0 16px 12px 16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 12px'
        }}>
          <Search size={14} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search history..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              width: '100%'
            }}
          />
        </div>
      </div>

      <div className="chat-history-list">
        {filteredChats.length === 0 ? (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            No chat history found.
          </div>
        ) : (
          filteredChats.map((chat) => (
            <div
              key={chat._id}
              className={`history-item ${chat._id === activeChatId ? 'active' : ''}`}
              onClick={() => onSelectChat(chat._id)}
            >
              {editingId === chat._id ? (
                <form onSubmit={handleRenameSubmit} style={{ flex: 1, display: 'flex' }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={handleRenameSubmit}
                    autoFocus
                    style={{
                      width: '100%',
                      background: 'rgba(0,0,0,0.3)',
                      color: 'white',
                      border: '1px solid var(--accent-indigo)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      outline: 'none',
                      fontSize: '0.88rem'
                    }}
                  />
                </form>
              ) : (
                <>
                  <div className="history-title">
                    <MessageSquare size={15} />
                    <span>{chat.title || "Untitled Conversation"}</span>
                  </div>
                  <div className="history-actions" style={{ display: 'flex', gap: '4px' }}>
                    <button
                      className="delete-chat-btn"
                      onClick={(e) => startRename(chat, e)}
                      title="Rename chat"
                      style={{ padding: '2px' }}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="delete-chat-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(chat._id);
                      }}
                      title="Delete chat"
                      style={{ padding: '2px' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <div style={{ padding: '0 4px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '6px', display: 'block' }}>
            ACTIVE MODEL
          </label>
          <select
            className="form-select"
            value={currentModel}
            onChange={(e) => onModelChange(e.target.value)}
            style={{ padding: '8px 10px', fontSize: '0.82rem' }}
          >
            <option value="meta/llama-3.3-70b-instruct">Llama 3.3 70B Instruct 🔥</option>
            <option value="meta/llama-3.2-90b-vision-instruct">Llama 3.2 90B Vision 👁️</option>
            <option value="nvidia/nemotron-3-ultra-550b-a55b">Nemotron 3 Ultra 550B 🧠</option>
            <option value="minimaxai/minimax-m3">MiniMax M3 (Vision) 🌟</option>
            <option value="nvidia/llama-3.1-nemotron-70b-instruct">Llama 3.1 Nemotron 70B ⚡</option>
            <option value="nvidia/mistral-nemo-12b-instruct">Mistral Nemo 12B 🔹</option>
          </select>
        </div>

        <button className="settings-btn" onClick={onOpenSettings}>
          <Settings size={16} />
          <span>API & Engine Settings</span>
        </button>

        {authUser && (
          <div 
            onClick={() => {
              if (onOpenAdmin && (authUser.is_admin || authUser.email?.toLowerCase() === '1si24ci013@sit.ac.in')) {
                onOpenAdmin();
              }
            }}
            title={authUser.is_admin || authUser.email?.toLowerCase() === '1si24ci013@sit.ac.in' ? "View User Registrations (Admin)" : "Your Profile"}
            style={{
              marginTop: '8px',
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.03)',
              border: (authUser.is_admin || authUser.email?.toLowerCase() === '1si24ci013@sit.ac.in') ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: (authUser.is_admin || authUser.email?.toLowerCase() === '1si24ci013@sit.ac.in') ? 'pointer' : 'default'
            }}
          >
            <div style={{
              width: '30px', height: '30px',
              borderRadius: '50%',
              background: 'var(--accent-gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <User size={14} color="white" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {authUser.name || 'User'}
                {(authUser.is_admin || authUser.email?.toLowerCase() === '1si24ci013@sit.ac.in') && (
                  <span style={{ fontSize: '0.65rem', background: 'var(--accent-indigo)', color: 'white', padding: '1px 5px', borderRadius: '4px' }}>
                    ADMIN
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {authUser.email}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLogout();
              }}
              title="Sign out"
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', padding: '4px', borderRadius: '6px',
                display: 'flex', alignItems: 'center', transition: 'color 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
