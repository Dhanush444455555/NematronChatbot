const DEFAULT_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

function getAuthHeaders() {
  const token = localStorage.getItem("nematron_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Health check endpoint for Python backend
 */
export async function checkBackendHealth(backendUrl = DEFAULT_BACKEND_URL) {
  try {
    const res = await fetch(`${backendUrl}/health`);
    if (!res.ok) return { healthy: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { healthy: true, data };
  } catch (err) {
    return { healthy: false, error: err.message };
  }
}

/**
 * Fetch available models from backend
 */
export async function fetchAvailableModels(backendUrl = DEFAULT_BACKEND_URL) {
  try {
    const res = await fetch(`${backendUrl}/api/models`);
    if (!res.ok) throw new Error("Failed to fetch models");
    const data = await res.json();
    return data.models || [];
  } catch (err) {
    console.error("Error fetching models:", err);
    return [];
  }
}

export async function fetchChats(backendUrl = DEFAULT_BACKEND_URL) {
  try {
    const res = await fetch(`${backendUrl}/api/chats`, {
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.chats || [];
  } catch (err) {
    console.error("Error fetching chats:", err);
    return [];
  }
}

export async function fetchChat(chatId, backendUrl = DEFAULT_BACKEND_URL) {
  try {
    const res = await fetch(`${backendUrl}/api/chats/${chatId}`, {
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("Error fetching chat:", err);
    return null;
  }
}

export async function renameChat(chatId, title, backendUrl = DEFAULT_BACKEND_URL) {
  try {
    const res = await fetch(`${backendUrl}/api/chats/${chatId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ title })
    });
    return res.ok;
  } catch (err) {
    console.error("Error renaming chat:", err);
    return false;
  }
}

export async function deleteChat(chatId, backendUrl = DEFAULT_BACKEND_URL) {
  try {
    const res = await fetch(`${backendUrl}/api/chats/${chatId}`, {
      method: "DELETE",
      headers: { ...getAuthHeaders() }
    });
    return res.ok;
  } catch (err) {
    console.error("Error deleting chat:", err);
    return false;
  }
}

export async function uploadFile(file, backendUrl = DEFAULT_BACKEND_URL) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${backendUrl}/api/upload`, {
      method: "POST",
      headers: { ...getAuthHeaders() },
      body: formData
    });
    if (!res.ok) throw new Error("Upload failed");
    return await res.json();
  } catch (err) {
    console.error("Error uploading file:", err);
    return null;
  }
}

/**
 * Stream chat completions from FastAPI backend using SSE reader.
 */
export async function streamChatCompletion({
  chatId,
  messages,
  fileIds = [],
  model,
  systemPrompt,
  temperature = 1.0,
  topP = 0.95,
  enableThinking = true,
  reasoningBudget = 32768,
  apiKey = "",
  baseUrl = "",
  backendUrl = DEFAULT_BACKEND_URL,
  onChatId,
  onChunk,
  onThinkingChunk,
  onThinkingStart,
  onThinkingEnd,
  onError,
  onComplete,
  signal
}) {
  try {
    const response = await fetch(`${backendUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        chat_id: chatId,
        messages,
        file_ids: fileIds,
        model,
        system_prompt: systemPrompt,
        temperature: parseFloat(temperature),
        top_p: parseFloat(topP),
        enable_thinking: enableThinking,
        reasoning_budget: parseInt(reasoningBudget, 10),
        api_key: apiKey || undefined,
        base_url: baseUrl || undefined
      }),
      signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const dataStr = trimmed.replace(/^data:\s*/, "");
        if (dataStr === "[DONE]") {
          if (onComplete) onComplete();
          return;
        }

        try {
          const parsed = JSON.parse(dataStr);

          if (parsed.error) {
            if (onError) onError(parsed.error);
            return;
          }
          
          if (parsed.chat_id && onChatId) {
            onChatId(parsed.chat_id);
          }

          // Thinking/reasoning events
          if (parsed.thinking_start && onThinkingStart) {
            onThinkingStart();
          } else if (parsed.thinking_end && onThinkingEnd) {
            onThinkingEnd();
          } else if (parsed.thinking && onThinkingChunk) {
            onThinkingChunk(parsed.thinking);
          }

          // Regular response chunk
          if (parsed.delta && onChunk) {
            onChunk(parsed.delta);
          }
        } catch (e) {
          // If JSON parse fails, it might just be a string delta in some edge cases
        }
      }
    }

    if (onComplete) onComplete();
  } catch (err) {
    if (err.name === "AbortError") {
      console.log("Stream aborted by user");
    } else {
      if (onError) onError(err.message || "An unexpected streaming error occurred.");
    }
  }
}
