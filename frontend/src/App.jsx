import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import SettingsModal from './components/SettingsModal';
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

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeMessages, setActiveMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
      loadActiveChatMessages(activeChatId);
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

    // Optimistically add user message
    const userMessage = {
      _id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setActiveMessages(prev => [...prev, userMessage]);

    // Optimistically add assistant thinking placeholder
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
          // Optimistically add to sidebar
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
        // Refresh chats to get updated titles/timestamps
        loadAllChats();
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
      />

      <main className="main-workspace">
        <Header
          activeChatTitle={activeChatTitle}
          currentModel={settings.model}
          backendHealthy={backendHealthy}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
          onOpenSettings={() => setIsSettingsOpen(true)}
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
