import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, User, Bot, Brain, ChevronDown, ChevronRight } from 'lucide-react';

export default function ChatMessage({ message }) {
  const [copied, setCopied] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`message-bubble ${isUser ? 'user' : 'assistant'}`}>
      <div className={`avatar ${isUser ? 'user' : 'assistant'}`}>
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Thinking block (collapsible) */}
        {!isUser && message.thinking && (
          <div
            style={{
              background: 'rgba(139, 92, 246, 0.08)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: '12px',
              overflow: 'hidden'
            }}
          >
            <button
              onClick={() => setThinkingExpanded(prev => !prev)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#c084fc',
                fontSize: '0.82rem',
                fontWeight: '600',
                textAlign: 'left'
              }}
            >
              <Brain size={14} />
              <span>Thinking Process {message.isThinking ? '(in progress...)' : ''}</span>
              {thinkingExpanded ? <ChevronDown size={14} style={{ marginLeft: 'auto' }} /> : <ChevronRight size={14} style={{ marginLeft: 'auto' }} />}
            </button>

            {thinkingExpanded && (
              <div
                style={{
                  padding: '0 14px 14px 14px',
                  borderTop: '1px solid rgba(139, 92, 246, 0.15)',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}
              >
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: '0.8rem',
                  lineHeight: '1.5',
                  color: '#a78bfa',
                  fontFamily: 'var(--font-code)',
                  margin: '12px 0 0 0'
                }}>
                  {message.thinking}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Main response bubble */}
        <div className="message-content">
          <div className="message-header">
            <span style={{ fontWeight: 600, color: isUser ? '#93c5fd' : '#c084fc' }}>
              {isUser ? 'You' : 'Nemotron'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {message.timestamp && (
                <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              )}
              {!isUser && (
                <button className="copy-btn" onClick={handleCopy} title="Copy response">
                  {copied ? <Check size={13} color="#4ade80" /> : <Copy size={13} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="markdown-body">
            {message.isThinking && !message.content ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                <Brain size={14} color="#c084fc" />
                <span style={{ color: '#c084fc' }}>Thinking deeply...</span>
                <span className="thinking-dots" />
              </div>
            ) : (
              <ReactMarkdown>{message.content || (isUser ? '' : '...')}</ReactMarkdown>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
