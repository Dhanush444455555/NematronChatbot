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
