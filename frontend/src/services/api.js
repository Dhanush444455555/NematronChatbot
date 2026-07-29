const DEFAULT_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

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

/**
 * Stream chat completions from FastAPI backend using SSE reader.
 * Supports NVIDIA NIM API thinking/reasoning tokens.
 */
export async function streamChatCompletion({
  messages,
  model,
  systemPrompt,
  temperature = 1.0,
  maxTokens = 16384,
  topP = 0.95,
  enableThinking = true,
  reasoningBudget = 16384,
  apiKey = "",
  baseUrl = "",
  backendUrl = DEFAULT_BACKEND_URL,
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
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages,
        model,
        system_prompt: systemPrompt,
        temperature: parseFloat(temperature),
        max_tokens: parseInt(maxTokens, 10),
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
          if (dataStr && onChunk) onChunk(dataStr);
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
