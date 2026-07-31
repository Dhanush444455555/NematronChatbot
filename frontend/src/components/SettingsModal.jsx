import React, { useState } from 'react';
import { X, Key, Server, Sliders, Cpu, Save, Brain, Zap } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, settings, onSaveSettings }) {
  const [formData, setFormData] = useState({ ...settings });

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveSettings(formData);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={20} color="var(--accent-purple)" />
            <h3>API & Engine Settings</h3>
          </div>
          <button className="close-modal-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={14} color="var(--accent-cyan)" />
              NVIDIA NIM API Key
            </label>
            <input
              type="password"
              className="form-input"
              value={formData.apiKey}
              onChange={(e) => handleChange('apiKey', e.target.value)}
              placeholder="nvapi-..."
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              NVIDIA API key — securely sent to local Python backend only.
            </span>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Server size={14} color="var(--accent-cyan)" />
              Backend Server URL
            </label>
            <input
              type="text"
              className="form-input"
              value={formData.backendUrl}
              onChange={(e) => handleChange('backendUrl', e.target.value)}
              placeholder="http://localhost:8000"
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={14} color="var(--accent-cyan)" />
              Model
            </label>
            <select
              className="form-select"
              value={formData.model}
              onChange={(e) => handleChange('model', e.target.value)}
            >
              <option value="meta/llama-3.3-70b-instruct">Llama 3.3 70B Instruct</option>
              <option value="meta/llama-3.2-90b-vision-instruct">Llama 3.2 90B Vision</option>
              <option value="nvidia/nemotron-3-ultra-550b-a55b">Nemotron 3 Ultra 550B (Thinking)</option>
              <option value="minimaxai/minimax-m3">MiniMax M3 (Vision)</option>
              <option value="nvidia/llama-3.1-nemotron-70b-instruct">Llama 3.1 Nemotron 70B</option>
              <option value="nvidia/mistral-nemo-12b-instruct">Mistral Nemo 12B</option>
            </select>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Brain size={14} color="var(--accent-cyan)" />
              Chain-of-Thought Thinking
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 400, fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={formData.enableThinking !== false}
                  onChange={(e) => handleChange('enableThinking', e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent-purple)', cursor: 'pointer' }}
                />
                Enable deep reasoning / thinking mode (Nemotron Ultra only)
              </label>
            </div>
          </div>

          {formData.enableThinking !== false && (
            <div className="form-group">
              <label>Reasoning Budget (tokens): {formData.reasoningBudget?.toLocaleString()}</label>
              <div className="slider-container">
                <input
                  type="range"
                  min={1024}
                  max={65536}
                  step={1024}
                  value={formData.reasoningBudget || 32768}
                  onChange={(e) => handleChange('reasoningBudget', parseInt(e.target.value))}
                />
                <span className="slider-value">{(formData.reasoningBudget || 32768).toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>System Prompt</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={formData.systemPrompt}
              onChange={(e) => handleChange('systemPrompt', e.target.value)}
              placeholder="Set a behavior or persona..."
            />
          </div>

          <div className="form-group">
            <label>Temperature (Creativity: {formData.temperature})</label>
            <div className="slider-container">
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={formData.temperature}
                onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
              />
              <span className="slider-value">{formData.temperature}</span>
            </div>
          </div>

          <div className="form-group">
            <label>Top-P ({formData.topP})</label>
            <div className="slider-container">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={formData.topP || 0.95}
                onChange={(e) => handleChange('topP', parseFloat(e.target.value))}
              />
              <span className="slider-value">{formData.topP || 0.95}</span>
            </div>
          </div>

          <button type="submit" className="save-settings-btn">
            <Save size={16} style={{ display: 'inline', marginRight: '6px' }} />
            Save Configuration
          </button>
        </form>
      </div>
    </div>
  );
}
