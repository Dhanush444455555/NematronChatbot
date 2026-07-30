import React from 'react';
import { Settings, Sparkles, Trash2, Download, ShieldCheck, ShieldAlert, Menu, Plus } from 'lucide-react';

export default function Header({
  activeChatTitle,
  currentModel,
  backendHealthy,
  onToggleMobileSidebar,
  onOpenSettings,
  onNewChat,
  onClearCurrentChat,
  onExportChat
}) {
  // Build a short readable badge from any model ID
  const getModelLabel = (modelId = '') => {
    if (!modelId) return 'AI Model';
    const parts = modelId.split('/');
    const name = parts[parts.length - 1]; // e.g. "nemotron-3-ultra-550b-a55b"
    const words = name.split('-');
    return words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <header className="top-header">
      <div className="header-title-group">
        <button 
          className="mobile-menu-btn" 
          onClick={onToggleMobileSidebar}
          title="Open Conversation History"
          aria-label="Open History Menu"
        >
          <Menu size={20} />
          <span className="mobile-menu-label">History</span>
        </button>

        <div className="header-title-container">
          <h2 className="header-title">{activeChatTitle || "New Conversation"}</h2>
          <div className="model-badge">
            <Sparkles size={12} />
            <span>{getModelLabel(currentModel)}</span>
          </div>
        </div>
      </div>

      <div className="header-actions">
        {onNewChat && (
          <button 
            className="new-chat-header-btn"
            onClick={onNewChat}
            title="Start New Conversation"
          >
            <Plus size={17} />
            <span className="header-btn-text">New Chat</span>
          </button>
        )}

        <div className={`status-badge ${!backendHealthy ? 'offline' : ''}`}>
          {backendHealthy ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
          <span className="header-btn-text">{backendHealthy ? 'Online' : 'Offline'}</span>
        </div>

        {onExportChat && (
          <button 
            className="copy-btn"
            onClick={onExportChat} 
            title="Export Chat Markdown"
          >
            <Download size={15} />
            <span className="header-btn-text">Export</span>
          </button>
        )}

        {onClearCurrentChat && (
          <button 
            className="copy-btn" 
            onClick={onClearCurrentChat} 
            title="Clear Chat Messages"
          >
            <Trash2 size={15} />
            <span className="header-btn-text">Clear</span>
          </button>
        )}

        <button 
          className="settings-btn" 
          onClick={onOpenSettings}
          title="API & Settings"
        >
          <Settings size={16} />
          <span className="header-btn-text">Settings</span>
        </button>

        {onOpenAdmin && (
          <button 
            className="settings-btn" 
            onClick={onOpenAdmin}
            title="Registered Users Admin Panel"
            style={{ border: '1px solid rgba(99, 102, 241, 0.4)', background: 'rgba(99, 102, 241, 0.12)' }}
          >
            <ShieldCheck size={16} color="var(--accent-indigo)" />
            <span className="header-btn-text" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Users</span>
          </button>
        )}
      </div>
    </header>
  );
}
