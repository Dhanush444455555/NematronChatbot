const STORAGE_KEYS = {
  CHATS: "claude_web_chats",
  ACTIVE_CHAT: "claude_web_active_chat",
  SETTINGS: "claude_web_settings",
  SETTINGS_VERSION: "claude_web_settings_version"
};

// Increment this when defaults change to auto-clear stale cached settings
const SETTINGS_VERSION = 2;

export const DEFAULT_SETTINGS = {
  apiKey: "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",
  baseUrl: "https://integrate.api.nvidia.com/v1",
  backendUrl: "http://localhost:8000",
  model: "nvidia/nemotron-3-ultra-550b-a55b",
  systemPrompt: "You are a helpful, harmless, and intelligent AI assistant powered by NVIDIA Nemotron.",
  temperature: 1.0,
  maxTokens: 16384,
  topP: 0.95,
  enableThinking: true,
  reasoningBudget: 16384
};

export function loadSettings() {
  try {
    // If stored version doesn't match, wipe old settings and use fresh defaults
    const storedVersion = localStorage.getItem(STORAGE_KEYS.SETTINGS_VERSION);
    if (!storedVersion || parseInt(storedVersion) < SETTINGS_VERSION) {
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      localStorage.setItem(STORAGE_KEYS.SETTINGS_VERSION, String(SETTINGS_VERSION));
      return { ...DEFAULT_SETTINGS };
    }
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!saved) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch (e) {
    console.error("Error loading settings from localStorage:", e);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error("Error saving settings:", e);
  }
}

export function loadChats() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CHATS);
    if (!saved) return [];
    return JSON.parse(saved);
  } catch (e) {
    console.error("Error loading chats:", e);
    return [];
  }
}

export function saveChats(chats) {
  try {
    localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
  } catch (e) {
    console.error("Error saving chats:", e);
  }
}

export function loadActiveChatId() {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_CHAT) || null;
}

export function saveActiveChatId(chatId) {
  if (chatId) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CHAT, chatId);
  } else {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_CHAT);
  }
}
