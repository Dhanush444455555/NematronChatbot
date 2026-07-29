import React, { useState } from 'react';
import { Plus, MessageSquare, Trash2, Settings, Bot, Search } from 'lucide-react';

export default function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onOpenSettings,
  currentModel,
  onModelChange
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredChats = chats.filter(c => 
    (c.title || "New Chat").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-badge">
          <div className="logo-icon">
            <Bot size={22} />
          </div>
          <div className="logo-text">
            <h1>Nemotron Workspace</h1>
            <span>Free AI Client</span>
          </div>
        </div>
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
              key={chat.id}
              className={`history-item ${chat.id === activeChatId ? 'active' : ''}`}
              onClick={() => onSelectChat(chat.id)}
            >
              <div className="history-title">
                <MessageSquare size={15} />
                <span>{chat.title || "Untitled Conversation"}</span>
              </div>
              <button
                className="delete-chat-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChat(chat.id);
                }}
                title="Delete chat"
              >
                <Trash2 size={14} />
              </button>
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
            <option value="nvidia/nemotron-3-ultra-550b-a55b">Nemotron 3 Ultra 550B 🧠</option>
            <option value="nvidia/llama-3.1-nemotron-70b-instruct">Llama 3.1 Nemotron 70B ⚡</option>
            <option value="nvidia/mistral-nemo-12b-instruct">Mistral Nemo 12B</option>
          </select>
        </div>

        <button className="settings-btn" onClick={onOpenSettings}>
          <Settings size={16} />
          <span>API & Engine Settings</span>
        </button>
      </div>
    </aside>
  );
}
