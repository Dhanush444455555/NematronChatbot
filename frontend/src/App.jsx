import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import SettingsModal from './components/SettingsModal';
import {
  loadSettings,
  saveSettings,
  loadChats,
  saveChats,
  loadActiveChatId,
  saveActiveChatId,
  DEFAULT_SETTINGS
} from './utils/storage';
import { checkBackendHealth, streamChatCompletion } from './services/api';
import { Bot } from 'lucide-react';

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [backendHealthy, setBackendHealthy] = useState(true);

  const abortControllerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Initialize from localStorage
  useEffect(() => {
    const loadedSettings = loadSettings();
    setSettings(loadedSettings);

    const loadedChats = loadChats();
    setChats(loadedChats);

    const activeId = loadActiveChatId();
    if (activeId && loadedChats.some(c => c.id === activeId)) {
      setActiveChatId(activeId);
    } else if (loadedChats.length > 0) {
      setActiveChatId(loadedChats[0].id);
    }

    checkBackendHealth(loadedSettings.backendUrl).then(res => {
      setBackendHealthy(res.healthy);
    });
  }, []);

  useEffect(() => { saveChats(chats); }, [chats]);
  useEffect(() => { saveActiveChatId(activeChatId); }, [activeChatId]);

  const activeChat = chats.find(c => c.id === activeChatId);
  const activeMessages = activeChat ? activeChat.messages : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages, isStreaming]);

  const handleNewChat = () => {
    const newChat = {
      id: `chat_${Date.now()}`,
      title: "New Conversation",
      createdAt: new Date().toISOString(),
      messages: []
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  };

  const handleDeleteChat = (chatId) => {
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (activeChatId === chatId) {
      const remaining = chats.filter(c => c.id !== chatId);
      setActiveChatId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleClearCurrentChat = () => {
    if (!activeChatId) return;
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [] } : c));
  };

  const handleExportChat = () => {
    if (!activeMessages || activeMessages.length === 0) return;
    const mdContent = activeMessages
      .map(m => `### ${m.role === 'user' ? 'User' : 'Nemotron'}\n\n${m.content}\n\n---`)
      .join('\n\n');
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(activeChat?.title || 'chat').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
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

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text || isStreaming) return;

    let targetChatId = activeChatId;
    let updatedChats = [...chats];

    if (!targetChatId || !chats.some(c => c.id === targetChatId)) {
      const newChat = {
        id: `chat_${Date.now()}`,
        title: text.length > 30 ? `${text.slice(0, 30)}...` : text,
        createdAt: new Date().toISOString(),
        messages: []
      };
      updatedChats = [newChat, ...updatedChats];
      targetChatId = newChat.id;
      setActiveChatId(targetChatId);
    }

    const userMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    const targetChatObj = updatedChats.find(c => c.id === targetChatId);
    if (targetChatObj && targetChatObj.messages.length === 0) {
      targetChatObj.title = text.length > 30 ? `${text.slice(0, 30)}...` : text;
    }

    targetChatObj.messages.push(userMessage);

    const assistantMessageId = `msg_assistant_${Date.now()}`;
    const assistantMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      thinking: '',
      isThinking: false,
      timestamp: new Date().toISOString()
    };
    targetChatObj.messages.push(assistantMessage);

    setChats([...updatedChats]);
    setInput('');
    setIsStreaming(true);

    const historyPayload = targetChatObj.messages
      .slice(0, -1)
      .map(m => ({ role: m.role, content: m.content }));

    abortControllerRef.current = new AbortController();

    await streamChatCompletion({
      messages: historyPayload,
      model: settings.model,
      systemPrompt: settings.systemPrompt,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      topP: settings.topP,
      enableThinking: settings.enableThinking,
      reasoningBudget: settings.reasoningBudget,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      backendUrl: settings.backendUrl,
      signal: abortControllerRef.current.signal,

      onThinkingStart: () => {
        setChats(prev => prev.map(c => {
          if (c.id !== targetChatId) return c;
          return {
            ...c,
            messages: c.messages.map(m =>
              m.id === assistantMessageId ? { ...m, isThinking: true } : m
            )
          };
        }));
      },

      onThinkingChunk: (chunk) => {
        setChats(prev => prev.map(c => {
          if (c.id !== targetChatId) return c;
          return {
            ...c,
            messages: c.messages.map(m =>
              m.id === assistantMessageId ? { ...m, thinking: (m.thinking || '') + chunk } : m
            )
          };
        }));
      },

      onThinkingEnd: () => {
        setChats(prev => prev.map(c => {
          if (c.id !== targetChatId) return c;
          return {
            ...c,
            messages: c.messages.map(m =>
              m.id === assistantMessageId ? { ...m, isThinking: false } : m
            )
          };
        }));
      },

      onChunk: (chunk) => {
        setChats(prev => prev.map(c => {
          if (c.id !== targetChatId) return c;
          return {
            ...c,
            messages: c.messages.map(m =>
              m.id === assistantMessageId ? { ...m, content: m.content + chunk } : m
            )
          };
        }));
      },

      onError: (errMessage) => {
        setChats(prev => prev.map(c => {
          if (c.id !== targetChatId) return c;
          return {
            ...c,
            messages: c.messages.map(m =>
              m.id === assistantMessageId
                ? { ...m, content: `⚠️ **Error**: ${errMessage}\n\n*Ensure the Python backend is running at ${settings.backendUrl}*` }
                : m
            )
          };
        }));
        setIsStreaming(false);
      },

      onComplete: () => {
        setIsStreaming(false);
      }
    });
  };

  return (
    <div className="app-container">
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
      />

      <main className="main-workspace">
        <Header
          activeChatTitle={activeChat?.title}
          currentModel={settings.model}
          backendHealthy={backendHealthy}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onClearCurrentChat={activeMessages.length > 0 ? handleClearCurrentChat : null}
          onExportChat={activeMessages.length > 0 ? handleExportChat : null}
        />

        <div className="chat-messages-container">
          {activeMessages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Bot size={34} />
              </div>
              <h2>NVIDIA Nemotron is ready</h2>
              <p>
                Powered by <strong>nvidia/nemotron-3-ultra-550b-a55b</strong> with deep chain-of-thought reasoning. Select a starter prompt or ask anything.
              </p>
            </div>
          ) : (
            activeMessages.map(msg => (
              <ChatMessage key={msg.id} message={msg} />
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
        />
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />
    </div>
  );
}
