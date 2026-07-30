import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, X, RefreshCw, Check, AlertCircle } from 'lucide-react';

export default function CameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [preview, setPreview] = useState(null);   // base64 data-url of captured frame
  const [error, setError]     = useState(null);
  const [ready, setReady]     = useState(false);   // camera stream live

  /* ── Start webcam ───────────────────────────────────────────────── */
  const startCamera = useCallback(async () => {
    setError(null);
    setPreview(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setReady(true);
        };
      }
    } catch (err) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your browser.'
          : `Camera error: ${err.message}`
      );
    }
  }, []);

  /* ── Stop webcam ────────────────────────────────────────────────── */
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  /* ── Capture frame ──────────────────────────────────────────────── */
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setPreview(dataUrl);
    stopCamera();
  };

  /* ── Retake ─────────────────────────────────────────────────────── */
  const retake = () => {
    setPreview(null);
    startCamera();
  };

  /* ── Confirm – convert data-url → File → pass up ─────────────────── */
  const confirm = () => {
    if (!preview) return;
    const byteStr = atob(preview.split(',')[1]);
    const arr = new Uint8Array(byteStr.length);
    for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
    const blob = new Blob([arr], { type: 'image/jpeg' });
    const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
    onCapture(file);
    onClose();
  };

  /* ── Backdrop click to close ─────────────────────────────────────── */
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) { stopCamera(); onClose(); }
  };

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div style={{
        background: 'var(--bg-secondary, #0f1117)',
        border: '1px solid rgba(99,102,241,0.3)',
        borderRadius: '20px',
        padding: '24px',
        width: '100%',
        maxWidth: '620px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Camera size={20} color="var(--accent-cyan, #22d3ee)" />
            <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary, #fff)' }}>
              Take a Photo
            </span>
          </div>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            style={{
              background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '8px',
              padding: '6px', cursor: 'pointer', color: 'var(--text-secondary, #aaa)',
              display: 'flex', transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewfinder / Preview */}
        <div style={{
          position: 'relative',
          borderRadius: '14px',
          overflow: 'hidden',
          background: '#000',
          aspectRatio: '16/9',
          width: '100%'
        }}>
          {/* Live video */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              display: preview ? 'none' : 'block',
              transform: 'scaleX(-1)'   // mirror front-cam
            }}
          />

          {/* Captured snapshot */}
          {preview && (
            <img
              src={preview}
              alt="Captured"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}

          {/* Error overlay */}
          {error && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '12px', padding: '24px', textAlign: 'center'
            }}>
              <AlertCircle size={36} color="#ef4444" />
              <p style={{ color: '#ef4444', fontSize: '0.88rem', lineHeight: 1.5 }}>{error}</p>
            </div>
          )}

          {/* Viewfinder corners (decorative) */}
          {!preview && !error && (
            <>
              {[['0px','0px','borderTop','borderLeft'],
                ['0px','auto','borderTop','borderRight'],
                ['auto','0px','borderBottom','borderLeft'],
                ['auto','auto','borderBottom','borderRight']
              ].map(([top, right, bt, bl], i) => (
                <div key={i} style={{
                  position: 'absolute',
                  top: top === 'auto' ? undefined : '12px',
                  bottom: top === 'auto' ? '12px' : undefined,
                  left: right === 'auto' ? undefined : '12px',
                  right: right === 'auto' ? '12px' : undefined,
                  width: '24px', height: '24px',
                  [bt]: '2px solid rgba(99,102,241,0.8)',
                  [bl]: '2px solid rgba(99,102,241,0.8)',
                  borderRadius: i === 0 ? '6px 0 0 0' : i === 1 ? '0 6px 0 0' : i === 2 ? '0 0 0 6px' : '0 0 6px 0'
                }} />
              ))}
            </>
          )}
        </div>

        {/* Hidden canvas for snapshot */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          {!preview ? (
            <button
              onClick={capturePhoto}
              disabled={!ready || !!error}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: ready && !error
                  ? 'linear-gradient(135deg, #6366f1, #22d3ee)'
                  : 'rgba(255,255,255,0.08)',
                color: '#fff', border: 'none', borderRadius: '12px',
                padding: '12px 28px', fontWeight: 600, fontSize: '0.92rem',
                cursor: ready && !error ? 'pointer' : 'not-allowed',
                opacity: ready && !error ? 1 : 0.5,
                transition: 'transform 0.15s, opacity 0.2s',
                boxShadow: ready && !error ? '0 4px 20px rgba(99,102,241,0.35)' : 'none'
              }}
              onMouseEnter={e => { if (ready && !error) e.currentTarget.style.transform = 'scale(1.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <Camera size={18} />
              {ready ? 'Capture' : 'Starting camera…'}
            </button>
          ) : (
            <>
              <button
                onClick={retake}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: 'rgba(255,255,255,0.08)',
                  color: 'var(--text-secondary, #aaa)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '12px', padding: '12px 22px',
                  fontWeight: 500, fontSize: '0.92rem', cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.13)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              >
                <RefreshCw size={16} />
                Retake
              </button>
              <button
                onClick={confirm}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  color: '#fff', border: 'none', borderRadius: '12px',
                  padding: '12px 28px', fontWeight: 600, fontSize: '0.92rem',
                  cursor: 'pointer', transition: 'transform 0.15s',
                  boxShadow: '0 4px 20px rgba(34,197,94,0.3)'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <Check size={18} />
                Use Photo
              </button>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted, #555)', margin: 0 }}>
          Photo will be attached to your message and analysed by the AI.
        </p>
      </div>
    </div>
  );
}
