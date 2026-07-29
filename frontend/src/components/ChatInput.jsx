import React, { useRef, useEffect } from 'react';
import { Send, Square, Sparkles, Code, Lightbulb, Zap, BookOpen } from 'lucide-react';

const QUICK_CARDS = [
  {
    icon: Code,
    title: "Write & Refactor Code",
    prompt: "Write a high-performance Python script to scrape and process API data concurrently with asyncio."
  },
  {
    icon: Lightbulb,
    title: "Explain Complex Concepts",
    prompt: "Explain Quantum Entanglement simply with an everyday real-world analogy."
  },
  {
    icon: Zap,
    title: "Design UI Component",
    prompt: "Create a modern React component with glassmorphism styles and smooth CSS animations."
  },
  {
    icon: BookOpen,
    title: "Summarize & Analyze",
    prompt: "Provide a structured breakdown of the key architectural differences between REST and GraphQL."
  }
];

export default function ChatInput({
  input,
  setInput,
  onSendMessage,
  onStopStreaming,
  isStreaming,
  showQuickPrompts
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isStreaming) {
        onSendMessage(input);
      }
    }
  };

  return (
    <div className="chat-input-wrapper">
      {showQuickPrompts && (
        <div className="quick-prompts-grid" style={{ margin: '0 auto 20px auto' }}>
          {QUICK_CARDS.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={idx}
                className="prompt-card"
                onClick={() => onSendMessage(card.prompt)}
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
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          placeholder="Message Nemotron... (Press Enter to send, Shift+Enter for new line)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          rows={1}
        />

        <div className="chat-input-actions">
          <div className="input-hint">
            <span>Powered by NVIDIA Nemotron</span>
          </div>

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
              onClick={() => onSendMessage(input)}
              disabled={!input.trim()}
              title="Send message"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
