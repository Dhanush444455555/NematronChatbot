import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import SettingsModal from './components/SettingsModal';
import FloatingHistoryButton from './components/FloatingHistoryButton';
import LoginPage from './components/LoginPage';
import AdminModal from './components/AdminModal';
import {
  loadSettings,
  saveSettings,
  loadActiveChatId,
  saveActiveChatId,
  DEFAULT_SETTINGS
} from './utils/storage';
import { 
  checkBackendHealth, 
  streamChatCompletion,
  fetchChats,
  fetchChat,
  deleteChat as apiDeleteChat,
  renameChat as apiRenameChat
} from './services/api';
import { Bot } from 'lucide-react';

const API_BASE = import.meta.env.VITE_BACKEND_URL || '';

// ── Inner chat app (shown only when logged in) ──────────────────────────────
function ChatApp({ authUser, onLogout }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeMessages, setActiveMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [backendHealthy, setBackendHealthy] = useState(true);

  const abortControllerRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const loadedSettings = loadSettings();
    setSettings(loadedSettings);

    checkBackendHealth(loadedSettings.backendUrl).then(res => {
      setBackendHealthy(res.healthy);
    });

    loadAllChats();

    // Check secret URL param ?admin=true
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
      setIsAdminOpen(true);
    }

    // Secret shortcut: Ctrl + Shift + A
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setIsAdminOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadAllChats = async () => {
    const loadedChats = await fetchChats(settings.backendUrl);
    setChats(loadedChats);
    
    const activeId = loadActiveChatId();
    if (activeId && loadedChats.some(c => c._id === activeId)) {
      setActiveChatId(activeId);
    } else if (loadedChats.length > 0) {
      setActiveChatId(loadedChats[0]._id);
    }
  };

  useEffect(() => {
    if (activeChatId) {
      saveActiveChatId(activeChatId);
      // Don't reload from DB while streaming — it would wipe the live assistant bubble
      if (!isStreaming) {
        loadActiveChatMessages(activeChatId);
      }
    } else {
      setActiveMessages([]);
    }
  }, [activeChatId]);

  const loadActiveChatMessages = async (id) => {
    const data = await fetchChat(id, settings.backendUrl);
    if (data && data.messages) {
      setActiveMessages(data.messages);
    } else {
      setActiveMessages([]);
    }
  };

  const activeChatTitle = chats.find(c => c._id === activeChatId)?.title;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages, isStreaming]);

  const handleNewChat = () => {
    setActiveChatId(null);
    setActiveMessages([]);
  };

  const handleDeleteChat = async (chatId) => {
    await apiDeleteChat(chatId, settings.backendUrl);
    setChats(prev => prev.filter(c => c._id !== chatId));
    if (activeChatId === chatId) {
      const remaining = chats.filter(c => c._id !== chatId);
      setActiveChatId(remaining.length > 0 ? remaining[0]._id : null);
    }
  };

  const handleRenameChat = async (chatId, newTitle) => {
    await apiRenameChat(chatId, newTitle, settings.backendUrl);
    setChats(prev => prev.map(c => c._id === chatId ? { ...c, title: newTitle } : c));
  };

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    checkBackendHealth(newSettings.backendUrl).then(res => {
      setBackendHealthy(res.healthy);
    });
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  const handleClearCurrentChat = async () => {
    if (activeChatId) {
      await handleDeleteChat(activeChatId);
    } else {
      setActiveMessages([]);
    }
  };

  const handleExportPDF = () => {
    if (!activeMessages || activeMessages.length === 0) return;
    const title = activeChatTitle || 'Nematron_Chat';
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title} - Nematron AI Export</title>
        <style>
          * { box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            padding: 40px; 
            color: #0f172a; 
            line-height: 1.6;
            max-width: 850px;
            margin: 0 auto;
            background: #ffffff;
          }
          .header { 
            text-align: center; 
            border-bottom: 2px solid #6366f1; 
            padding-bottom: 16px; 
            margin-bottom: 30px; 
          }
          .header h1 { 
            margin: 0; 
            color: #4f46e5; 
            font-size: 24px; 
            font-weight: 700;
          }
          .header p { 
            color: #64748b; 
            font-size: 13px; 
            margin-top: 6px; 
          }
          .message { 
            margin-bottom: 20px; 
            padding: 16px; 
            border-radius: 8px; 
            page-break-inside: avoid;
          }
          .user { 
            background: #f1f5f9; 
            border-left: 4px solid #3b82f6; 
          }
          .assistant { 
            background: #f8fafc; 
            border-left: 4px solid #8b5cf6; 
            border: 1px solid #e2e8f0;
            border-left: 4px solid #8b5cf6;
          }
          .role { 
            font-weight: 700; 
            font-size: 12px; 
            text-transform: uppercase; 
            letter-spacing: 0.5px; 
            margin-bottom: 8px; 
          }
          .user .role { color: #2563eb; }
          .assistant .role { color: #7c3aed; }
          .content {
            font-size: 14px;
            white-space: pre-wrap;
            word-break: break-word;
          }
          pre { 
            background: #0f172a; 
            color: #f8fafc; 
            padding: 14px; 
            border-radius: 6px; 
            overflow-x: auto; 
            font-family: 'Courier New', Courier, monospace; 
            font-size: 13px;
          }
          code { 
            font-family: monospace; 
            background: #e2e8f0; 
            padding: 2px 6px; 
            border-radius: 4px; 
            font-size: 13px;
          }
          pre code { background: none; padding: 0; color: inherit; }
          @media print { 
            body { padding: 0; } 
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🤖 Nematron AI Export</h1>
          <p>Title: <strong>${title}</strong> | Model: <strong>${settings.model}</strong> | Date: ${new Date().toLocaleString()}</p>
        </div>
        ${activeMessages.map(m => `
          <div class="message ${m.role}">
            <div class="role">${m.role === 'user' ? '👤 You' : '🤖 Nematron AI'}</div>
            <div class="content">${m.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          </div>
        `).join('')}
      </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 400);
  };

  const handleExportDOCX = () => {
    if (!activeMessages || activeMessages.length === 0) return;
    const title = activeChatTitle || 'Nematron_Chat';

    const htmlDoc = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${title}</title>
        <style>
          body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.5; color: #1e293b; }
          h1 { color: #4f46e5; font-size: 18pt; border-bottom: 2px solid #6366f1; padding-bottom: 6px; }
          .meta { color: #64748b; font-size: 9.5pt; margin-bottom: 20px; }
          .msg-box { margin-bottom: 16px; padding: 12px; border-radius: 6px; }
          .user-box { background-color: #f1f5f9; border-left: 4px solid #2563eb; }
          .assistant-box { background-color: #f8fafc; border-left: 4px solid #7c3aed; }
          .role { font-weight: bold; font-size: 10pt; margin-bottom: 6px; }
          .user-role { color: #2563eb; }
          .assistant-role { color: #7c3aed; }
          pre { background-color: #0f172a; color: #f8fafc; padding: 10px; font-family: 'Consolas', monospace; font-size: 9.5pt; }
          code { font-family: 'Consolas', monospace; background-color: #e2e8f0; padding: 2px 4px; }
        </style>
      </head>
      <body>
        <h1>🤖 Nematron AI Conversation Document</h1>
        <div class="meta">Title: <b>${title}</b> | Model: <b>${settings.model}</b> | Date: ${new Date().toLocaleString()}</div>
        <hr/>
        <br/>
        ${activeMessages.map(m => `
          <div class="msg-box ${m.role === 'user' ? 'user-box' : 'assistant-box'}">
            <div class="role ${m.role === 'user' ? 'user-role' : 'assistant-role'}">
              ${m.role === 'user' ? '👤 YOU' : '🤖 NEMATRON AI'}
            </div>
            <div>${m.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</div>
          </div>
        `).join('')}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + htmlDoc], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = () => {
    if (!activeMessages || activeMessages.length === 0) return;
    const title = activeChatTitle || 'Nematron_Chat';
    let md = `# ${title}\n*Exported from Nematron AI on ${new Date().toLocaleString()}*\n*Model: ${settings.model}*\n\n---\n\n`;
    
    activeMessages.forEach(m => {
      const sender = m.role === 'user' ? '### 👤 You' : '### 🤖 Nematron AI';
      md += `${sender}\n\n${m.content}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportTXT = () => {
    if (!activeMessages || activeMessages.length === 0) return;
    const title = activeChatTitle || 'Nematron_Chat';
    let txt = `========================================\nNEMATRON AI CONVERSATION EXPORT\nTitle: ${title}\nModel: ${settings.model}\nDate: ${new Date().toLocaleString()}\n========================================\n\n`;
    
    activeMessages.forEach(m => {
      const sender = m.role === 'user' ? '[YOU]' : '[NEMATRON AI]';
      txt += `${sender}\n${m.content}\n\n----------------------------------------\n\n`;
    });

    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendMessage = async (textToSend, uploadedFileIds = []) => {
    const text = (textToSend || input).trim();
    if ((!text && uploadedFileIds.length === 0) || isStreaming) return;

    const userMessage = {
      _id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setActiveMessages(prev => [...prev, userMessage]);

    const assistantMessageId = `msg_assistant_${Date.now()}`;
    const assistantMessage = {
      _id: assistantMessageId,
      role: 'assistant',
      content: '',
      thinking: '',
      isThinking: false,
      timestamp: new Date().toISOString()
    };
    setActiveMessages(prev => [...prev, assistantMessage]);

    setInput('');
    setIsStreaming(true);

    const historyPayload = [...activeMessages, userMessage].map(m => ({
      role: m.role,
      content: m.content
    }));

    abortControllerRef.current = new AbortController();

    await streamChatCompletion({
      chatId: activeChatId,
      messages: historyPayload,
      fileIds: uploadedFileIds,
      model: settings.model,
      systemPrompt: settings.systemPrompt,
      temperature: settings.temperature,
      topP: settings.topP,
      enableThinking: settings.enableThinking,
      reasoningBudget: settings.reasoningBudget,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      backendUrl: settings.backendUrl,
      signal: abortControllerRef.current.signal,

      onChatId: (newChatId) => {
        if (!activeChatId) {
          setActiveChatId(newChatId);
          setChats(prev => [{ _id: newChatId, title: text.slice(0,30) || "New Conversation" }, ...prev]);
        }
      },

      onThinkingStart: () => {
        setActiveMessages(prev => prev.map(m =>
          m._id === assistantMessageId ? { ...m, isThinking: true } : m
        ));
      },

      onThinkingChunk: (chunk) => {
        setActiveMessages(prev => prev.map(m =>
          m._id === assistantMessageId ? { ...m, thinking: (m.thinking || '') + chunk } : m
        ));
      },

      onThinkingEnd: () => {
        setActiveMessages(prev => prev.map(m =>
          m._id === assistantMessageId ? { ...m, isThinking: false } : m
        ));
      },

      onModelSwitched: (switchedModel) => {
        // Backend auto-routed to vision model — update UI to reflect this
        const updated = { ...settings, model: switchedModel };
        setSettings(updated);
        saveSettings(updated);
      },

      onChunk: (chunk) => {
        setActiveMessages(prev => prev.map(m =>
          m._id === assistantMessageId ? { ...m, content: m.content + chunk } : m
        ));
      },

      onError: (errMessage) => {
        setActiveMessages(prev => prev.map(m =>
          m._id === assistantMessageId
            ? { ...m, content: `⚠️ **Error**: ${errMessage}` }
            : m
        ));
        setIsStreaming(false);
      },

      onComplete: () => {
        setIsStreaming(false);
        loadAllChats();
      }
    });
  };

  return (
    <div className="app-container">
      <FloatingHistoryButton
        onOpenHistory={() => setIsMobileSidebarOpen(true)}
        onNewChat={handleNewChat}
      />

      <div 
        className={`sidebar-backdrop ${isMobileSidebarOpen ? 'active' : ''}`}
        onClick={() => setIsMobileSidebarOpen(false)}
      />

      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onSelectChat={(id) => {
          setActiveChatId(id);
          setIsMobileSidebarOpen(false);
        }}
        onNewChat={() => {
          handleNewChat();
          setIsMobileSidebarOpen(false);
        }}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onOpenSettings={() => {
          setIsSettingsOpen(true);
          setIsMobileSidebarOpen(false);
        }}
        currentModel={settings.model}
        onModelChange={(m) => {
          const updated = { ...settings, model: m };
          setSettings(updated);
          saveSettings(updated);
        }}
        authUser={authUser}
        onLogout={onLogout}
        onOpenAdmin={() => setIsAdminOpen(true)}
      />

      <main className="main-workspace">
        <Header
          activeChatTitle={activeChatTitle}
          currentModel={settings.model}
          backendHealthy={backendHealthy}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onNewChat={handleNewChat}
          onClearCurrentChat={handleClearCurrentChat}
          onExportPDF={handleExportPDF}
          onExportDOCX={handleExportDOCX}
          onExportMarkdown={handleExportMarkdown}
          onExportTXT={handleExportTXT}
          hasMessages={activeMessages && activeMessages.length > 0}
          authUser={authUser}
          onLogout={onLogout}
        />

        <div className="chat-messages-container">
          {activeMessages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Bot size={34} />
              </div>
              <h2>NVIDIA Nemotron Agents</h2>
              <p>
                Upload documents, images, ask for web searches, or request code. The intelligent agent router will handle it.
              </p>
            </div>
          ) : (
            activeMessages.map(msg => (
              <ChatMessage key={msg._id || msg.id} message={msg} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <ChatInput
          input={input}
          setInput={setInput}
          onSendMessage={handleSendMessage}
          onStopStreaming={handleStopStreaming}
          isStreaming={isStreaming}
          showQuickPrompts={activeMessages.length === 0}
          backendUrl={settings.backendUrl}
          onImageAttached={() => {
            if (!settings.model.includes('vision') && !settings.model.includes('minimax')) {
              handleSaveSettings({ ...settings, model: 'meta/llama-3.2-90b-vision-instruct' });
            }
          }}
        />
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />

      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
      />
    </div>
  );
}

// ── Root App: handles auth gate ──────────────────────────────────────────────
export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('nematron_token');
    const userStr = localStorage.getItem('nematron_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(async res => {
          if (res.ok) {
            const data = await res.json().catch(() => null);
            if (data && data.user) {
              setAuthUser(data.user);
              localStorage.setItem('nematron_user', JSON.stringify(data.user));
            } else {
              setAuthUser(user);
            }
          } else if (res.status === 401) {
            // Token explicitly invalid — clear local auth
            localStorage.removeItem('nematron_token');
            localStorage.removeItem('nematron_user');
            setAuthUser(null);
          } else {
            // Temporary backend status — keep user logged in locally
            setAuthUser(user);
          }
        }).catch(() => {
          // Network or server offline — trust cached local session
          setAuthUser(user);
        }).finally(() => {
          setAuthChecked(true);
        });
      } catch {
        setAuthChecked(true);
      }
    } else {
      setAuthChecked(true);
    }
  }, []);

  const handleLogin = (user, token) => {
    if (token) localStorage.setItem('nematron_token', token);
    if (user) localStorage.setItem('nematron_user', JSON.stringify(user));
    setAuthUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('nematron_token');
    localStorage.removeItem('nematron_user');
    setAuthUser(null);
  };

  if (!authChecked) {
    // Minimal splash while verifying token
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#090d16', color: '#6366f1',
        fontSize: '1.1rem', fontFamily: 'Outfit, sans-serif', gap: '12px'
      }}>
        <Bot size={28} />
        Loading...
      </div>
    );
  }

  if (!authUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <ChatApp authUser={authUser} onLogout={handleLogout} />;
}
