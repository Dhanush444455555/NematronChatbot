import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, User, Bot, Brain, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import 'katex/dist/katex.min.css';

function CodeBlock({ node, inline, className, children, ...props }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (inline) {
    return <code className={className} {...props}>{children}</code>;
  }

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-language">{language || 'code'}</span>
        <button className="copy-code-btn" onClick={handleCopy} title="Copy code">
          {copied ? <Check size={13} color="#4ade80" /> : <Copy size={13} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: '0 0 10px 10px',
          fontSize: '0.84rem',
          background: '#050811',
          border: 'none'
        }}
        {...props}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

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

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>

        {/* Thinking Block — collapsible */}
        {!isUser && message.thinking && (
          <div className="thinking-block">
            <button
              className="thinking-header"
              onClick={() => setThinkingExpanded(prev => !prev)}
            >
              <Brain size={14} />
              <span>Thinking Process {message.isThinking ? '(in progress...)' : ''}</span>
              {thinkingExpanded
                ? <ChevronDown size={14} style={{ marginLeft: 'auto' }} />
                : <ChevronRight size={14} style={{ marginLeft: 'auto' }} />}
            </button>
            {thinkingExpanded && (
              <div className="thinking-body">
                <pre className="thinking-pre">{message.thinking}</pre>
              </div>
            )}
          </div>
        )}

        {/* Main Message Bubble */}
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
              <div className="thinking-indicator">
                <Brain size={14} color="#c084fc" />
                <span>Thinking deeply...</span>
                <span className="thinking-dots" />
              </div>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  code: CodeBlock,
                  // Style tables
                  table: ({ children }) => (
                    <div className="table-wrapper">
                      <table className="md-table">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => <th className="md-th">{children}</th>,
                  td: ({ children }) => <td className="md-td">{children}</td>,
                }}
              >
                {message.content || (isUser ? '' : '...')}
              </ReactMarkdown>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
