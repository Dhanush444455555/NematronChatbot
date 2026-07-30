import React, { useState } from 'react';
import { Bot, Mail, Lock, User, Eye, EyeOff, Loader2, Sparkles, Shield, Zap } from 'lucide-react';

const API_BASE = import.meta.env.VITE_BACKEND_URL || '';

async function apiAuth(endpoint, body) {
  const res = await fetch(`${API_BASE}/api/auth/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Something went wrong');
  return data;
}

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = mode === 'login'
        ? { email: form.email, password: form.password }
        : { email: form.email, password: form.password, name: form.name };

      const data = await apiAuth(mode, payload);
      localStorage.setItem('nematron_token', data.token);
      localStorage.setItem('nematron_user', JSON.stringify(data.user));
      onLogin(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(m => m === 'login' ? 'register' : 'login');
    setForm({ name: '', email: '', password: '' });
    setError('');
  };

  return (
    <div className="login-page">
      {/* Animated background orbs */}
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-orb login-orb-3" />

      <div className="login-container">
        {/* Left panel — branding */}
        <div className="login-brand-panel">
          <div className="login-brand-inner">
            <div className="login-logo">
              <Bot size={40} />
            </div>
            <h1 className="login-brand-title">Nematron</h1>
            <p className="login-brand-subtitle">NVIDIA AI — Next Generation Intelligence</p>

            <div className="login-features">
              <div className="login-feature">
                <div className="login-feature-icon">
                  <Sparkles size={18} />
                </div>
                <div>
                  <div className="login-feature-title">Thinking AI</div>
                  <div className="login-feature-desc">Deep reasoning with Nemotron Ultra 550B</div>
                </div>
              </div>
              <div className="login-feature">
                <div className="login-feature-icon">
                  <Zap size={18} />
                </div>
                <div>
                  <div className="login-feature-title">Multi-modal</div>
                  <div className="login-feature-desc">Upload docs, images, PDFs & more</div>
                </div>
              </div>
              <div className="login-feature">
                <div className="login-feature-icon">
                  <Shield size={18} />
                </div>
                <div>
                  <div className="login-feature-title">Secure</div>
                  <div className="login-feature-desc">Your conversations are private</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="login-form-panel">
          <div className="login-form-card">
            <div className="login-form-header">
              <h2 className="login-form-title">
                {mode === 'login' ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="login-form-subtitle">
                {mode === 'login'
                  ? 'Sign in to continue to Nematron'
                  : 'Join and start chatting with AI'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              {mode === 'register' && (
                <div className="login-field">
                  <label className="login-label">Full Name</label>
                  <div className="login-input-wrap">
                    <User size={16} className="login-input-icon" />
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Your name"
                      className="login-input"
                      autoComplete="name"
                    />
                  </div>
                </div>
              )}

              <div className="login-field">
                <label className="login-label">Email Address</label>
                <div className="login-input-wrap">
                  <Mail size={16} className="login-input-icon" />
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    className="login-input"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="login-field">
                <label className="login-label">Password</label>
                <div className="login-input-wrap">
                  <Lock size={16} className="login-input-icon" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder={mode === 'register' ? 'Min. 6 characters' : 'Your password'}
                    className="login-input login-input-pass"
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    minLength={mode === 'register' ? 6 : undefined}
                  />
                  <button
                    type="button"
                    className="login-pass-toggle"
                    onClick={() => setShowPass(p => !p)}
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="login-error">
                  <span>⚠️ {error}</span>
                </div>
              )}

              <button
                type="submit"
                className="login-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 size={18} className="spin" /> {mode === 'login' ? 'Signing in...' : 'Creating account...'}</>
                ) : (
                  mode === 'login' ? 'Sign In' : 'Create Account'
                )}
              </button>
            </form>

            <div className="login-switch">
              <span>{mode === 'login' ? "Don't have an account?" : 'Already have an account?'}</span>
              <button className="login-switch-btn" onClick={switchMode}>
                {mode === 'login' ? 'Sign Up' : 'Sign In'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
