import React, { useState, useRef } from 'react';
import { Menu, Plus } from 'lucide-react';

export default function FloatingHistoryButton({ onOpenHistory, onNewChat }) {
  // Default position: left edge (12px), top (130px) as marked in user photo 3
  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem('floating_btn_pos');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { x: 12, y: 130 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0, moved: false });

  // Touch Handlers for Draggable Button on Mobile
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    dragStartRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      initialX: pos.x,
      initialY: pos.y,
      moved: false
    };
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!dragStartRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStartRef.current.startX;
    const dy = touch.clientY - dragStartRef.current.startY;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragStartRef.current.moved = true;
    }

    const newX = Math.max(8, Math.min(window.innerWidth - 130, dragStartRef.current.initialX + dx));
    const newY = Math.max(60, Math.min(window.innerHeight - 100, dragStartRef.current.initialY + dy));

    setPos({ x: newX, y: newY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (!dragStartRef.current.moved) {
      // Small or no movement -> Tap action -> Open History Drawer
      onOpenHistory();
    } else {
      // Save position preference
      try {
        localStorage.setItem('floating_btn_pos', JSON.stringify(pos));
      } catch (e) {}
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
        onClick={(e) => {
          if (!dragStartRef.current.moved) {
            onOpenHistory();
          }
        }}
        title="Tap to open Chat History (Drag to move)"
      >
        <Menu size={18} />
        <span>History</span>
      </button>

      <button
        className="floating-new-chat-btn"
        onClick={(e) => {
          e.stopPropagation();
          onNewChat();
        }}
        title="Start New Conversation"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
