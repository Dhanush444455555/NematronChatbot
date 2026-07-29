import React from 'react';
import { Settings, Sparkles, Trash2, Download, ShieldCheck, ShieldAlert, Menu } from 'lucide-react';

export default function Header({
  activeChatTitle,
  currentModel,
  backendHealthy,
  onToggleMobileSidebar,
  onOpenSettings,
  onClearCurrentChat,
  onExportChat
}) {
  // Build a short readable badge from any model ID
  const getModelLabel = (modelId = '') => {
    if (!modelId) return 'AI Model';
    const parts = modelId.split('/');
    const name = parts[parts.length - 1]; // e.g. "nemotron-3-ultra-550b-a55b"
    const words = name.split('-');
    // Keep first 3 meaningful words max
    return words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };
  return (
    <header className="top-header">
      <div className="header-title-group">
        <button 
          className="mobile-menu-btn" 
          onClick={onToggleMobileSidebar}
          title="Open Menu"
        >
          <Menu size={20} />
        </button>
        <h2 className="header-title">{activeChatTitle || "New Conversation"}</h2>
        <div className="model-badge">
          <Sparkles size={13} />
          <span>{getModelLabel(currentModel)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className={`status-badge ${!backendHealthy ? 'offline' : ''}`} style={!backendHealthy ? { color: '#f87171', background: 'rgba(248, 113, 113, 0.1)', borderColor: 'rgba(248, 113, 113, 0.2)' } : {}}>
          {backendHealthy ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
          <span>{backendHealthy ? 'Backend Connected' : 'Backend Disconnected'}</span>
        </div>

        {onExportChat && (
          <button 
            className="copy-btn"
            onClick={onExportChat} 
            title="Export Chat Markdown"
            style={{ padding: '6px 10px' }}
          >
            <Download size={15} />
            <span>Export</span>
          </button>
        )}

        {onClearCurrentChat && (
          <button 
            className="copy-btn" 
            onClick={onClearCurrentChat} 
            title="Clear Chat Messages"
            style={{ padding: '6px 10px' }}
          >
            <Trash2 size={15} />
            <span>Clear</span>
          </button>
        )}

        <button 
          className="settings-btn" 
          onClick={onOpenSettings}
          style={{ padding: '6px 12px' }}
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>
      </div>
    </header>
  );
}
