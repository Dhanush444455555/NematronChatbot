import React, { useState, useRef, useEffect } from 'react';
import { Settings, Sparkles, Trash2, Download, ShieldCheck, ShieldAlert, Menu, Plus, FileText, FileCode, ChevronDown, Printer, File } from 'lucide-react';

export default function Header({
  activeChatTitle,
  currentModel,
  backendHealthy,
  onToggleMobileSidebar,
  onOpenSettings,
  onNewChat,
  onClearCurrentChat,
  onExportPDF,
  onExportDOCX,
  onExportMarkdown,
  onExportTXT,
  hasMessages
}) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        {/* Export Dropdown Button */}
        {hasMessages && (
          <div className="export-dropdown-container" ref={dropdownRef} style={{ position: 'relative' }}>
            <button 
              className="copy-btn export-btn-header"
              onClick={() => setShowExportMenu(prev => !prev)}
              title="Export Conversation Document"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                color: '#a5b4fc',
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Download size={15} color="#818cf8" />
              <span className="header-btn-text">Export</span>
              <ChevronDown size={13} style={{ transform: showExportMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {showExportMenu && (
              <div 
                className="export-dropdown-menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: '210px',
                  background: 'var(--bg-secondary, #0f172a)',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                  borderRadius: 'var(--radius-md, 8px)',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
                  padding: '6px',
                  zIndex: 100,
                  backdropFilter: 'blur(16px)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <button
                  onClick={() => {
                    setShowExportMenu(false);
                    onExportPDF && onExportPDF();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '8px 10px',
                    border: 'none',
                    background: 'transparent',
                    color: '#e2e8f0',
                    fontSize: '0.83rem',
                    fontWeight: 500,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Printer size={15} color="#38bdf8" />
                  <span>Export PDF</span>
                </button>

                <button
                  onClick={() => {
                    setShowExportMenu(false);
                    onExportDOCX && onExportDOCX();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '8px 10px',
                    border: 'none',
                    background: 'transparent',
                    color: '#e2e8f0',
                    fontSize: '0.83rem',
                    fontWeight: 500,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <File size={15} color="#60a5fa" />
                  <span>Export Word Doc (.doc)</span>
                </button>

                <button
                  onClick={() => {
                    setShowExportMenu(false);
                    onExportMarkdown && onExportMarkdown();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '8px 10px',
                    border: 'none',
                    background: 'transparent',
                    color: '#e2e8f0',
                    fontSize: '0.83rem',
                    fontWeight: 500,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <FileCode size={15} color="#c084fc" />
                  <span>Export Markdown (.md)</span>
                </button>

                <button
                  onClick={() => {
                    setShowExportMenu(false);
                    onExportTXT && onExportTXT();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '8px 10px',
                    border: 'none',
                    background: 'transparent',
                    color: '#e2e8f0',
                    fontSize: '0.83rem',
                    fontWeight: 500,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <FileText size={15} color="#4ade80" />
                  <span>Export Text (.txt)</span>
                </button>
              </div>
            )}
          </div>
        )}

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

        {onClearCurrentChat && hasMessages && (
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
      </div>
    </header>
  );
}

