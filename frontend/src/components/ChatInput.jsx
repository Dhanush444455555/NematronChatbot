import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Send, Square, Sparkles, Code, Lightbulb, Zap, BookOpen, Paperclip, X, FileText, Image, Camera } from 'lucide-react';
import { uploadFile } from '../services/api';
import CameraModal from './CameraModal';

const QUICK_CARDS = [
  {
    icon: Code,
    title: "Write & Debug Code",
    prompt: "Explain the Two Sum problem. Provide Logic, Dry Run, Python code, Time and Space Complexity."
  },
  {
    icon: Lightbulb,
    title: "Explain Concepts",
    prompt: "Explain Quantum Entanglement simply with an everyday real-world analogy."
  },
  {
    icon: Zap,
    title: "Design UI Component",
    prompt: "Create a modern React glassmorphism card component with smooth CSS animations."
  },
  {
    icon: BookOpen,
    title: "Plan & Organize",
    prompt: "Create a 30-day DSA study roadmap for a beginner targeting FAANG interviews."
  }
];

const FILE_ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf,.docx,.txt,.csv,.xlsx,.pptx";

function FilePreviewChip({ file, onRemove }) {
  const isImage = file.file.type.startsWith("image/");
  const icon = isImage ? <Image size={14} /> : <FileText size={14} />;
  const status = file.status === 'uploading' ? '↑' : file.status === 'error' ? '⚠' : '✓';
  const statusColor = file.status === 'error' ? '#ef4444' : file.status === 'uploading' ? '#f59e0b' : '#4ade80';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      background: 'rgba(99, 102, 241, 0.12)',
      border: '1px solid rgba(99, 102, 241, 0.25)',
      borderRadius: '8px',
      padding: '4px 8px',
      fontSize: '0.78rem',
      color: 'var(--text-secondary)',
      maxWidth: '180px'
    }}>
      {icon}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {file.file.name}
      </span>
      <span style={{ color: statusColor, fontWeight: 700, fontSize: '0.7rem', flexShrink: 0 }}>{status}</span>
      <button
        onClick={() => onRemove(file.id)}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: 0,
          display: 'flex',
          flexShrink: 0
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

export default function ChatInput({
  input,
  setInput,
  onSendMessage,
  onStopStreaming,
  isStreaming,
  showQuickPrompts,
  backendUrl,
  onImageAttached
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if ((input.trim() || attachedFiles.length > 0) && !isStreaming) {
        handleSend();
      }
    }
  };

  const processFiles = useCallback(async (files) => {
    const hasImage = Array.from(files).some(f => f.type.startsWith('image/'));
    if (hasImage && onImageAttached) {
      onImageAttached();
    }

    const newEntries = Array.from(files).map(f => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      file: f,
      status: 'uploading',
      fileId: null
    }));
    setAttachedFiles(prev => [...prev, ...newEntries]);

    for (const entry of newEntries) {
      const result = await uploadFile(entry.file, backendUrl);
      setAttachedFiles(prev => prev.map(f =>
        f.id === entry.id
          ? { ...f, status: result ? 'done' : 'error', fileId: result?.file_id || null }
          : f
      ));
    }
  }, [backendUrl]);

  const handleFileInput = (e) => {
    if (e.target.files?.length) processFiles(e.target.files);
    e.target.value = '';
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  };

  // ── Clipboard paste (Ctrl+V / Cmd+V) ──────────────────────────────
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles = [];
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          // Give pasted images a proper timestamped name
          const ext = file.type.split('/')[1] || 'png';
          const named = new File([file], `pasted_${Date.now()}.${ext}`, { type: file.type });
          imageFiles.push(named);
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault(); // don't paste raw binary text into textarea
      processFiles(imageFiles);
    }
    // If no image items, let the default paste (text) through
  }, [processFiles]);

  const removeFile = (id) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSend = () => {
    const readyFileIds = attachedFiles.filter(f => f.status === 'done' && f.fileId).map(f => f.fileId);
    onSendMessage(input, readyFileIds);
    setAttachedFiles([]);
  };

  const canSend = (input.trim() || attachedFiles.some(f => f.status === 'done')) && !isStreaming;

  return (
    <div
      className={`chat-input-wrapper ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="drop-zone-overlay">
          <div className="drop-zone-content">
            <Paperclip size={32} />
            <span>Drop files here to attach</span>
            <p>Images, PDFs, DOCX, CSV, XLSX, TXT</p>
          </div>
        </div>
      )}

      {showQuickPrompts && (
        <div className="quick-prompts-grid" style={{ margin: '0 auto 20px auto' }}>
          {QUICK_CARDS.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={idx}
                className="prompt-card"
                onClick={() => onSendMessage(card.prompt, [])}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Icon size={16} color="var(--accent-cyan)" />
                  <h4>{card.title}</h4>
                </div>
                <p>{card.prompt}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="chat-input-box">
        {/* File Previews */}
        {attachedFiles.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
            {attachedFiles.map(f => (
              <FilePreviewChip key={f.id} file={f} onRemove={removeFile} />
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="chat-textarea"
          placeholder="Message Nemotron Agents... attach files, drop or paste images"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={isStreaming}
          rows={1}
        />

        <div className="chat-input-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              className="attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              title="Attach file (PDF, DOCX, Image, CSV, XLSX)"
            >
              <Paperclip size={17} />
            </button>
            <button
              className="attach-btn"
              onClick={() => setIsCameraOpen(true)}
              disabled={isStreaming}
              title="Take a photo with your camera"
            >
              <Camera size={17} />
            </button>
            <span className="input-hint">
              <Sparkles size={12} style={{ marginRight: 4 }} />
              Nemotron Agents
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={FILE_ACCEPT}
            multiple
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />

          {isStreaming ? (
            <button
              className="send-btn"
              onClick={onStopStreaming}
              style={{ background: '#ef4444' }}
              title="Stop generating"
            >
              <Square size={16} fill="white" />
            </button>
          ) : (
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={!canSend}
              title="Send message"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Camera Modal */}
      {isCameraOpen && (
        <CameraModal
          onCapture={(file) => processFiles([file])}
          onClose={() => setIsCameraOpen(false)}
        />
      )}
    </div>
  );
}
