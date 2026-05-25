import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function HomePage() {
  const [userName, setUserName] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [password, setPassword] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [focused, setFocused] = useState(null);
  const navigate = useNavigate();

  const handleJoin = (e) => {
    e.preventDefault();
    if (roomInput.trim() && userName.trim()) {
      navigate(`/${roomInput.trim().toLowerCase()}`, {
        state: {
          userName: userName.trim(),
          password: isPrivate ? password : ""
        }
      });
    } else {
      alert("Please enter both your name and a room name.");
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .cw-root {
          min-height: 100vh;
          background-color: #f5f2ec;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
        }

        .cw-nav {
          padding: 20px 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #ddd9d1;
        }

        .cw-wordmark {
          font-family: 'DM Serif Display', serif;
          font-size: 1.25rem;
          color: #1a1814;
          letter-spacing: -0.01em;
        }

        .cw-nav-tag {
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #8a8478;
        }

        .cw-main {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          max-width: 1100px;
          margin: 0 auto;
          width: 100%;
          padding: 0 40px;
          gap: 80px;
          align-items: center;
          min-height: calc(100vh - 65px);
        }

        .cw-left h1 {
          font-family: 'DM Serif Display', serif;
          font-size: 3.4rem;
          color: #1a1814;
          line-height: 1.12;
          letter-spacing: -0.02em;
          margin-bottom: 18px;
        }

        .cw-left h1 em {
          font-style: italic;
          color: #7a6f5a;
        }

        .cw-left p {
          font-size: 1rem;
          color: #6b6455;
          line-height: 1.65;
          font-weight: 300;
          max-width: 400px;
        }

        .cw-features {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-top: 36px;
        }

        .cw-feature {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.85rem;
          color: #7a6f5a;
          font-weight: 400;
        }

        .cw-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #b5aa97;
          flex-shrink: 0;
        }

        .cw-panel {
          background: #ffffff;
          border: 1px solid #ddd9d1;
          border-radius: 4px;
          padding: 36px 32px;
        }

        .cw-panel-title {
          font-family: 'DM Serif Display', serif;
          font-size: 1.4rem;
          color: #1a1814;
          margin-bottom: 6px;
        }

        .cw-panel-sub {
          font-size: 0.82rem;
          color: #9a8f80;
          margin-bottom: 28px;
          font-weight: 400;
        }

        .cw-field {
          margin-bottom: 16px;
        }

        .cw-label {
          display: block;
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8a8478;
          margin-bottom: 6px;
        }

        .cw-input {
          width: 100%;
          padding: 11px 14px;
          background: #faf9f6;
          border: 1px solid #ddd9d1;
          border-radius: 3px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.92rem;
          color: #1a1814;
          outline: none;
          transition: border-color 0.15s, background 0.15s;
          -webkit-appearance: none;
        }

        .cw-input:focus {
          border-color: #1a1814;
          background: #fff;
        }

        .cw-input::placeholder {
          color: #bdb6aa;
        }

        .cw-divider {
          border: none;
          border-top: 1px solid #ede9e2;
          margin: 20px 0;
        }

        .cw-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          padding: 2px 0;
        }

        .cw-toggle-label {
          font-size: 0.85rem;
          color: #4a4540;
          font-weight: 400;
          user-select: none;
        }

        .cw-toggle-switch {
          position: relative;
          width: 34px;
          height: 19px;
        }

        .cw-toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
          position: absolute;
        }

        .cw-track {
          position: absolute;
          inset: 0;
          background: #ddd9d1;
          border-radius: 19px;
          transition: background 0.2s;
          cursor: pointer;
        }

        .cw-track::after {
          content: '';
          position: absolute;
          width: 13px;
          height: 13px;
          background: #fff;
          border-radius: 50%;
          top: 3px;
          left: 3px;
          transition: transform 0.2s;
        }

        input:checked + .cw-track {
          background: #1a1814;
        }

        input:checked + .cw-track::after {
          transform: translateX(15px);
        }

        .cw-password-wrap {
          overflow: hidden;
          max-height: 0;
          opacity: 0;
          transition: max-height 0.25s ease, opacity 0.2s ease, margin 0.2s ease;
          margin-top: 0;
        }

        .cw-password-wrap.open {
          max-height: 80px;
          opacity: 1;
          margin-top: 14px;
        }

        .cw-btn {
          width: 100%;
          padding: 13px;
          background: #1a1814;
          color: #f5f2ec;
          border: none;
          border-radius: 3px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.88rem;
          font-weight: 500;
          cursor: pointer;
          letter-spacing: 0.02em;
          transition: background 0.15s;
          margin-top: 22px;
        }

        .cw-btn:hover {
          background: #2e2b24;
        }

        .cw-lock-note {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 14px;
          font-size: 0.75rem;
          color: #9a8f80;
        }

        .cw-lock-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #9a8f80;
        }

        @media (max-width: 768px) {
          .cw-main {
            grid-template-columns: 1fr;
            padding: 32px 24px;
            gap: 32px;
            min-height: auto;
          }
          .cw-left h1 { font-size: 2.2rem; }
          .cw-nav { padding: 16px 24px; }
        }
      `}</style>

      <div className="cw-root">
        <nav className="cw-nav">
          <span className="cw-wordmark">CollabWrite</span>
          <span className="cw-nav-tag">Real-time editor</span>
        </nav>

        <main className="cw-main">
          <div className="cw-left">
            <h1>Write together,<br /><em>in real time.</em></h1>
            <p>
              A shared workspace for teams and collaborators. Create a room, invite your people,
              and edit documents together — changes appear instantly.
            </p>
            <div className="cw-features">
              <div className="cw-feature"><span className="cw-dot"></span>Live cursors and presence</div>
              <div className="cw-feature"><span className="cw-dot"></span>Version history with snapshots</div>
              <div className="cw-feature"><span className="cw-dot"></span>AI writing assistant built in</div>
              <div className="cw-feature"><span className="cw-dot"></span>Password-protected private rooms</div>
              <div className="cw-feature"><span className="cw-dot"></span>Publish as a public read-only page</div>
            </div>
          </div>

          <div className="cw-panel">
            <div className="cw-panel-title">Join a room</div>
            <div className="cw-panel-sub">Enter a room name to create or rejoin a session</div>

            <form onSubmit={handleJoin}>
              <div className="cw-field">
                <label className="cw-label" htmlFor="uname">Your name</label>
                <input
                  id="uname"
                  className="cw-input"
                  type="text"
                  placeholder="e.g. Aryan"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                />
              </div>

              <div className="cw-field">
                <label className="cw-label" htmlFor="room">Room name</label>
                <input
                  id="room"
                  className="cw-input"
                  type="text"
                  placeholder="e.g. project-brief"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  required
                />
              </div>

              <hr className="cw-divider" />

              <div
                className="cw-toggle-row"
                onClick={() => setIsPrivate(!isPrivate)}
              >
                <span className="cw-toggle-label">
                  {isPrivate ? "Private room — password required" : "Public room — anyone can join"}
                </span>
                <label className="cw-toggle-switch" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={() => setIsPrivate(!isPrivate)}
                  />
                  <span className="cw-track"></span>
                </label>
              </div>

              <div className={`cw-password-wrap ${isPrivate ? 'open' : ''}`}>
                <label className="cw-label" htmlFor="pass">Room password</label>
                <input
                  id="pass"
                  className="cw-input"
                  type="password"
                  placeholder="Set or enter the room password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={isPrivate}
                />
              </div>

              <button type="submit" className="cw-btn">
                {isPrivate ? "Create / join private room →" : "Join room →"}
              </button>
            </form>

            <div className="cw-lock-note">
              <span className="cw-lock-dot"></span>
              {isPrivate
                ? "This room is end-to-end password protected."
                : "Switch the toggle above to set a password."}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default HomePage;