import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';

const socket = io('http://localhost:1234');

function PublicView() {
  const { roomId } = useParams();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    socket.emit('join-view-only', roomId);

    socket.on('init-text', (data) => {
      setText(data.content);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setLoading(false);
    });

    socket.on('text-update', (newHtml) => {
      setText(newHtml);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    });

    return () => {
      socket.off('init-text');
      socket.off('text-update');
    };
  }, [roomId]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body { background: #f5f2ec; }

        .pv-root {
          min-height: 100vh;
          background: #f5f2ec;
          font-family: 'DM Sans', sans-serif;
        }

        .pv-bar {
          background: #1a1814;
          padding: 14px 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .pv-wordmark {
          font-family: 'DM Serif Display', serif;
          font-size: 1.05rem;
          color: #f5f2ec;
        }

        .pv-badge {
          font-size: 0.7rem;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #b5aa97;
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .pv-live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #7ec98b;
          animation: pv-pulse 2s infinite;
        }

        @keyframes pv-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .pv-content {
          max-width: 740px;
          margin: 0 auto;
          padding: 56px 40px 80px;
        }

        .pv-doc-meta {
          margin-bottom: 36px;
          padding-bottom: 24px;
          border-bottom: 1px solid #ddd9d1;
        }

        .pv-room-id {
          font-family: 'DM Serif Display', serif;
          font-size: 2rem;
          color: #1a1814;
          letter-spacing: -0.02em;
          margin-bottom: 8px;
          text-transform: capitalize;
        }

        .pv-meta-row {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 0.78rem;
          color: #9a8f80;
        }

        .pv-meta-sep {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: #bdb6aa;
        }

        .pv-body {
          font-family: 'DM Sans', sans-serif;
          font-size: 1rem;
          color: #2e2b24;
          line-height: 1.75;
        }

        .pv-body h1, .pv-body h2, .pv-body h3 {
          font-family: 'DM Serif Display', serif;
          color: #1a1814;
          margin: 1.5em 0 0.5em;
          letter-spacing: -0.02em;
        }

        .pv-body h1 { font-size: 1.8rem; }
        .pv-body h2 { font-size: 1.4rem; }
        .pv-body h3 { font-size: 1.15rem; }

        .pv-body p { margin: 0 0 1em; }

        .pv-body strong { font-weight: 500; }

        .pv-body ul, .pv-body ol {
          margin: 0 0 1em;
          padding-left: 1.4em;
        }

        .pv-body li { margin-bottom: 0.3em; }

        .pv-body blockquote {
          border-left: 2px solid #bdb6aa;
          margin: 1.5em 0;
          padding: 0.5em 0 0.5em 1.2em;
          color: #6b6455;
          font-style: italic;
        }

        .pv-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
          gap: 16px;
        }

        .pv-spinner {
          width: 28px;
          height: 28px;
          border: 2px solid #ddd9d1;
          border-top-color: #1a1814;
          border-radius: 50%;
          animation: pv-spin 0.7s linear infinite;
        }

        @keyframes pv-spin {
          to { transform: rotate(360deg); }
        }

        .pv-loading-text {
          font-size: 0.85rem;
          color: #9a8f80;
          font-weight: 300;
        }

        .pv-empty {
          color: #9a8f80;
          font-style: italic;
          font-size: 0.95rem;
          margin-top: 20px;
        }

        .pv-footer {
          text-align: center;
          padding: 24px;
          font-size: 0.72rem;
          color: #bdb6aa;
          letter-spacing: 0.05em;
          border-top: 1px solid #ddd9d1;
          margin-top: 60px;
        }

        @media (max-width: 600px) {
          .pv-bar { padding: 14px 20px; }
          .pv-content { padding: 36px 20px 60px; }
          .pv-room-id { font-size: 1.5rem; }
        }
      `}</style>

      <div className="pv-root">
        <div className="pv-bar">
          <span className="pv-wordmark">CollabWrite</span>
          <span className="pv-badge">
            <span className="pv-live-dot"></span>
            Public view
          </span>
        </div>

        {loading ? (
          <div className="pv-loading">
            <div className="pv-spinner"></div>
            <span className="pv-loading-text">Loading {roomId}…</span>
          </div>
        ) : (
          <div className="pv-content">
            <div className="pv-doc-meta">
              <div className="pv-room-id">{roomId.replace(/-/g, ' ')}</div>
              <div className="pv-meta-row">
                <span>Read-only</span>
                <span className="pv-meta-sep"></span>
                <span>CollabWrite document</span>
                {lastUpdated && (
                  <>
                    <span className="pv-meta-sep"></span>
                    <span>Updated {lastUpdated}</span>
                  </>
                )}
              </div>
            </div>

            <div
              className="pv-body ql-editor"
              dangerouslySetInnerHTML={{
                __html: text || '<p class="pv-empty">This document is empty.</p>'
              }}
            />

            <div className="pv-footer">
              CollabWrite · Collaborative document editor
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default PublicView;