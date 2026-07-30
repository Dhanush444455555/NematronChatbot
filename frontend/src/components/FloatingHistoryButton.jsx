import React, { useState, useRef } from 'react';
import { Menu, Plus } from 'lucide-react';

export default function FloatingHistoryButton({ onOpenHistory, onNewChat }) {
  // Default position: left edge (12px), top (130px)
  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem('floating_btn_pos');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { x: 12, y: 130 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0, moved: false });

  // ── Touch Drag Handling ──────────────────────────────────────────
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    dragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      initialX: pos.x,
      initialY: pos.y,
      moved: false
    };
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!dragRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragRef.current.startX;
    const dy = touch.clientY - dragRef.current.startY;

    // Use 15px distance threshold to ignore small finger tap micro-jitters
    if (Math.hypot(dx, dy) > 15) {
      dragRef.current.moved = true;
    }

    if (dragRef.current.moved) {
      const newX = Math.max(4, Math.min(window.innerWidth - 130, dragRef.current.initialX + dx));
      const newY = Math.max(40, Math.min(window.innerHeight - 80, dragRef.current.initialY + dy));
      setPos({ x: newX, y: newY });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragRef.current.moved) {
      // Save dragged position
      try {
        localStorage.setItem('floating_btn_pos', JSON.stringify(pos));
      } catch (e) {}
    }
  };

  // ── Tap / Click Actions ──────────────────────────────────────────
  const handleHistoryAction = (e) => {
    e.stopPropagation();
    if (!dragRef.current.moved) {
      onOpenHistory();
    }
  };

  const handleNewChatAction = (e) => {
    e.stopPropagation();
    if (!dragRef.current.moved) {
      onNewChat();
    }
  };

  return (
    <div
      className={`floating-history-container ${isDragging ? 'dragging' : ''}`}
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <button
        className="floating-history-btn"
        onClick={handleHistoryAction}
        onTouchEnd={(e) => {
          if (!dragRef.current.moved) {
            e.preventDefault(); // Prevent double trigger with click
            onOpenHistory();
          }
        }}
        title="Tap to open History (Drag to move)"
      >
        <Menu size={18} />
        <span>History</span>
      </button>

      <button
        className="floating-new-chat-btn"
        onClick={handleNewChatAction}
        onTouchEnd={(e) => {
          if (!dragRef.current.moved) {
            e.preventDefault(); // Prevent double trigger with click
            onNewChat();
          }
        }}
        title="Start New Chat"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
