import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import html2pdf from 'html2pdf.js';

const socket = io(process.env.REACT_APP_API_URL);

function Editor() {
  const { roomId } = useParams();
  const location = useLocation();
  const myName = location.state?.userName || "Guest";
  const myPassword = location.state?.password || "";

  const [text, setText] = useState("");
  const [status, setStatus] = useState("Connecting…");
  const [activeUsers, setActiveUsers] = useState([]);
  const [notification, setNotification] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [typingInfo, setTypingInfo] = useState({ name: null, color: '#888' });
  const [cursors, setCursors] = useState({});
  const [myColor, setMyColor] = useState('#3498db');
  const [aiResult, setAiResult] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const mediaRecorderRef = useRef(null);
  const [allUsers, setAllUsers] = useState([]);
  const allUsersRef = useRef([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState([]);

  const quillRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const cursorTimeoutRef = useRef(null);
  const peersRef = useRef({});
  const localStreamRef = useRef(null);

  const shareUrl = window.location.href;
  const D = isDarkMode;

  const showNotif = (msg, duration = 3000) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), duration);
  };

  // ── VOICE ROOM ─────────────────────────────────────────────
  const startVoiceRoom = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      showNotif("🎙 You are now speaking");
      allUsersRef.current.forEach(async (user) => {
        if (user.userId === socket.id) return;
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        pc.onicecandidate = (e) => { if (e.candidate) socket.emit('ice-candidate', { candidate: e.candidate, to: user.userId }); };
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        pc.ontrack = (e) => { const a = new Audio(); a.srcObject = e.streams[0]; a.play(); };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call-user', { offer, to: user.userId, from: socket.id });
        peersRef.current[user.userId] = pc;
      });
    } catch (err) { showNotif("Mic error: " + err.message); }
  };

  // ── SOCKETS ─────────────────────────────────────────────────
  useEffect(() => {
    socket.on('all-users-in-room', (users) => { setAllUsers(users); allUsersRef.current = users; });

    socket.on('call-made', async ({ offer, from }) => {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peersRef.current[from] = pc;
      pc.ontrack = (e) => { const a = new Audio(); a.srcObject = e.streams[0]; a.play(); showNotif("🔊 Listener joined"); };
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('make-answer', { answer, to: from });
    });

    socket.on('answer-made', async ({ answer, to }) => {
      const pc = peersRef.current[to];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('ice-candidate', async ({ candidate, from }) => {
      const tryAdd = async (pc) => {
        if (pc && pc.remoteDescription) {
          try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
        }
      };
      if (from && peersRef.current[from]) {
        tryAdd(peersRef.current[from]);
      } else {
        Object.values(peersRef.current).forEach(tryAdd);
      }
    });

    socket.emit('join-room', { roomId, userName: myName, password: myPassword });

    socket.on('error-msg', (msg) => { alert(msg); window.location.href = "/"; });

    socket.on('init-text', ({ content, assignedColor, history: h }) => {
      setText(content);
      setMyColor(assignedColor);
      if (h) setHistory(h);
      setStatus("Live");
    });

    socket.on('update-user-list', setActiveUsers);
    socket.on('user-notification', (msg) => showNotif(msg));
    socket.on('user-typing', ({ isTyping, userName, userColor }) => {
      setTypingInfo(isTyping ? { name: userName, color: userColor } : { name: null, color: '#888' });
    });
    socket.on('cursor-update', (data) => setCursors(prev => ({ ...prev, [data.id]: data })));
    socket.on('text-update', (newHtml) => setText(newHtml));
    socket.on('audio-clip', ({ audioBlob }) => { try { new Audio(audioBlob).play(); } catch {} });
    socket.on('save-success', ({ timestamp, history: h }) => {
      setLastSaved(timestamp);
      if (h) setHistory(h);
      showNotif("Version saved");
    });
    socket.on('user-left', (userId) => setCursors(prev => { const n = {...prev}; delete n[userId]; return n; }));

    return () => {
      ['init-text','text-update','update-user-list','user-notification','user-typing',
       'audio-clip','save-success','cursor-update','error-msg','all-users-in-room',
       'call-made','answer-made','ice-candidate','user-left'].forEach(e => socket.off(e));
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [roomId, myName, myPassword]);

  // ── MICROPHONE ───────────────────────────────────────────────
  useEffect(() => {
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const rec = new MediaRecorder(stream);
        rec.ondataavailable = (e) => {
          const reader = new FileReader();
          reader.readAsDataURL(e.data);
          reader.onloadend = () => socket.emit('audio-clip', { roomId, audioBlob: reader.result });
        };
        mediaRecorderRef.current = rec;
        setMediaRecorder(rec);
      }).catch(() => {});
    }
  }, [roomId]);

  // ── HANDLERS ─────────────────────────────────────────────────
  const handleChange = (content, delta, source) => {
    setText(content);
    if (source === 'user') {
      socket.emit('text-update', { roomId, newText: content, isManualSave: false });
      socket.emit('typing', { roomId, isTyping: true });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => socket.emit('typing', { roomId, isTyping: false }), 2000);
    }
  };

  const saveDocument = () => {
    showNotif("Saving version…");
    socket.emit('text-update', { roomId, newText: text, isManualSave: true });
  };

  const handleSelectionChange = (range) => {
    if (!range) return;
    if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
    cursorTimeoutRef.current = setTimeout(() => {
      socket.emit('cursor-move', { roomId, range, userName: myName, userColor: myColor });
    }, 50);
  };

  const toggleListening = () => {
    const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SR) return alert("Use Chrome for voice input.");
    if (isListening) { window.recognitionInstance?.stop(); setIsListening(false); return; }
    const r = new SR();
    window.recognitionInstance = r;
    r.lang = 'en-US'; r.continuous = true;
    r.onstart = () => setIsListening(true);
    r.onresult = (e) => {
      const t = e.results[e.results.length - 1][0].transcript;
      if (t.toLowerCase().includes("clear page")) { setText(""); socket.emit('text-update', { roomId, newText: "" }); }
      else { setText(prev => { const u = prev + " " + t; socket.emit('text-update', { roomId, newText: u }); return u; }); }
    };
    r.onend = () => setIsListening(false);
    r.start();
  };

  const downloadPDF = () => {
    const el = document.querySelector('.ql-editor');
    html2pdf().from(el).save(`${roomId}-document.pdf`);
  };

  const handleAIAction = async (instruction, label) => {
    setAiLoading(true);
    setAiResult("");
    setIsSidebarOpen(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.replace(/<[^>]*>/g, ''), instruction })
      });
      const data = await res.json();
      if (data.result) { setAiResult(data.result); setAiHistory(prev => [data.result, ...prev].slice(0, 5)); showNotif(`${label} done`); }
    } catch { showNotif("AI request failed"); }
    setAiLoading(false);
  };

  const insertAiResult = () => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    const range = editor.getSelection();
    if (range) {
      editor.insertText(range.index, `\n-- AI Suggestion --\n${aiResult}\n`);
      editor.setSelection(range.index + aiResult.length + 22);
    } else {
      setText(prev => prev + `<br><strong>AI:</strong> ${aiResult}`);
    }
    setIsSidebarOpen(false);
    showNotif("Inserted at cursor");
  };

  // ── COLORS ───────────────────────────────────────────────────
  const bg     = D ? '#16191f' : '#f5f2ec';
  const surface= D ? '#1e2228' : '#ffffff';
  const border = D ? '#2a2e38' : '#ddd9d1';
  const txt    = D ? '#e8e3d8' : '#1a1814';
  const muted  = D ? '#7a7566' : '#9a8f80';
  const accent = D ? '#c9b99a' : '#1a1814';

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'DM Sans', sans-serif", color: txt, transition: 'background 0.2s, color 0.2s' }}>

      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');
        .cwe-quill .ql-toolbar { background: ${D ? '#1e2228' : '#faf9f6'} !important; border-color: ${border} !important; border-bottom-color: ${border} !important; }
        .cwe-quill .ql-container { background: ${surface} !important; border-color: ${border} !important; font-family: 'DM Sans', sans-serif !important; color: ${txt} !important; font-size: 1rem !important; }
        .cwe-quill .ql-editor { min-height: calc(100vh - 220px); line-height: 1.75; padding: 28px 32px; }
        .cwe-quill .ql-stroke { stroke: ${D ? '#c9b99a' : '#4a4540'} !important; }
        .cwe-quill .ql-fill { fill: ${D ? '#c9b99a' : '#4a4540'} !important; }
        .cwe-quill .ql-picker { color: ${D ? '#c9b99a' : '#4a4540'} !important; }
        .cwe-quill .ql-picker-options { background: ${surface} !important; border-color: ${border} !important; }
        .cwe-notif { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: ${D ? '#2a2e38' : '#1a1814'}; color: ${D ? '#e8e3d8' : '#f5f2ec'}; padding: 10px 22px; border-radius: 3px; font-size: 0.82rem; font-weight: 500; z-index: 9999; white-space: nowrap; animation: cwe-fadein 0.2s; pointer-events: none; letter-spacing: 0.02em; }
        @keyframes cwe-fadein { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        .cwe-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border-radius: 3px; border: 1px solid ${border}; background: ${surface}; color: ${txt}; font-family: 'DM Sans', sans-serif; font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: background 0.15s, border-color 0.15s; white-space: nowrap; }
        .cwe-btn:hover { background: ${D ? '#252a34' : '#f0ece4'}; border-color: ${D ? '#3a3f4d' : '#c5bfb5'}; }
        .cwe-btn.primary { background: ${D ? '#c9b99a' : '#1a1814'}; color: ${D ? '#16191f' : '#f5f2ec'}; border-color: transparent; }
        .cwe-btn.primary:hover { background: ${D ? '#d8cbaf' : '#2e2b24'}; }
        .cwe-btn.danger { border-color: #c0392b; color: #c0392b; }
        .cwe-btn.danger:hover { background: #fff5f5; }
        .cwe-btn.ai { border-color: ${D ? '#3a4a5a' : '#cce0f5'}; background: ${D ? '#1e2a38' : '#f0f7ff'}; color: ${D ? '#88b8e0' : '#1a4a7a'}; }
        .cwe-btn.ai:hover { background: ${D ? '#253344' : '#e3effe'}; }
        .cwe-sidebar { position: fixed; top: 0; width: 320px; height: 100vh; background: ${surface}; border: 1px solid ${border}; z-index: 500; transition: transform 0.28s ease; display: flex; flex-direction: column; }
        .cwe-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 499; animation: cwe-fadein 0.15s; }
        .cwe-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 600; display: flex; align-items: center; justify-content: center; padding: 20px; animation: cwe-fadein 0.15s; }
        .cwe-modal { background: ${surface}; border: 1px solid ${border}; border-radius: 4px; padding: 32px; max-width: 400px; width: 100%; }
        .cwe-input { width: 100%; padding: 9px 12px; background: ${D ? '#16191f' : '#faf9f6'}; border: 1px solid ${border}; border-radius: 3px; font-family: 'DM Sans', sans-serif; font-size: 0.85rem; color: ${txt}; outline: none; }
        .cwe-input:focus { border-color: ${D ? '#c9b99a' : '#1a1814'}; }
        .cwe-tag { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px; font-size: 0.76rem; font-weight: 500; }
        .cwe-ver-item { padding: 12px 16px; border-bottom: 1px solid ${border}; cursor: pointer; transition: background 0.15s; }
        .cwe-ver-item:hover { background: ${D ? '#252a34' : '#faf9f6'}; }
      `}</style>

      {/* ── NOTIFICATION ─────────────────────────────────────── */}
      {notification && <div className="cwe-notif">{notification}</div>}

      {/* ── TOPBAR ───────────────────────────────────────────── */}
      <div style={{ background: D ? '#1e2228' : '#ffffff', borderBottom: `1px solid ${border}`, padding: '0 24px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>

        {/* Left: wordmark + doc title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.05rem', color: txt, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>CollabWrite</span>
          <span style={{ color: border, fontSize: '0.9rem' }}>/</span>
          <span style={{ fontSize: '0.85rem', color: txt, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{roomId}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: status === 'Live' ? '#2ecc71' : muted, fontWeight: 500 }}>
            {status === 'Live' && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#2ecc71', display: 'inline-block' }}></span>}
            {status}
          </span>
        </div>

        {/* Right: action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button className="cwe-btn ai" onClick={() => handleAIAction("Summarize this text in 3 short bullet points.", "Summary")}>Summarize</button>
          <button className="cwe-btn ai" onClick={() => handleAIAction("Fix the grammar and make the tone more professional.", "Improve")}>Improve</button>
          <button className="cwe-btn ai" onClick={() => handleAIAction("Generate 3 study questions based on this text.", "Quiz")}>Quiz me</button>
          <div style={{ width: 1, height: 20, background: border, margin: '0 4px' }}></div>
          <button className="cwe-btn" onClick={() => setIsHistoryOpen(true)}>History</button>
          <button className="cwe-btn primary" onClick={saveDocument}>Save</button>
          <button className="cwe-btn" onClick={() => setIsShareOpen(true)}>Share</button>
          <div style={{ width: 1, height: 20, background: border, margin: '0 4px' }}></div>
          <button className="cwe-btn" onClick={toggleListening} title="Voice to text">{isListening ? '⏹ Stop' : '🎤 Voice'}</button>
          <button
            className="cwe-btn"
            onMouseDown={() => {
              const rec = mediaRecorderRef.current;
              if (rec && rec.state === 'inactive') rec.start();
            }}
            onMouseUp={() => {
              const rec = mediaRecorderRef.current;
              if (rec && rec.state === 'recording') rec.stop();
            }}
            title="Push-to-talk (hold)"
          >Talk</button>
          <button className="cwe-btn" onClick={startVoiceRoom} title="Live voice room">Voice room</button>
          <button className="cwe-btn" onClick={downloadPDF}>PDF</button>
          <button className="cwe-btn" onClick={() => setIsDarkMode(!D)}>{D ? '☀' : '◑'}</button>
          <button className="cwe-btn danger" onClick={() => { socket.disconnect(); window.location.href = '/'; }}>Exit</button>
        </div>
      </div>

      {/* ── PRESENCE BAR ─────────────────────────────────────── */}
      <div style={{ background: D ? '#1a1e26' : '#faf9f6', borderBottom: `1px solid ${border}`, padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 20, minHeight: 38 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
          {activeUsers.map((user) => (
            <span key={user.userId} className="cwe-tag" style={{ background: user.color + '22', color: user.color }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: user.color }}></span>
              {user.userName}{user.userId === socket.id ? ' (you)' : ''}
            </span>
          ))}
        </div>
        <div style={{ fontSize: '0.75rem', color: muted, flexShrink: 0 }}>
          {lastSaved ? `Saved ${lastSaved}` : 'Not saved yet'}
        </div>
        {typingInfo.name && (
          <div style={{ fontSize: '0.75rem', color: typingInfo.color, fontWeight: 500, flexShrink: 0 }}>
            {typingInfo.name} is typing…
          </div>
        )}
      </div>

      {/* ── EDITOR ───────────────────────────────────────────── */}
      <div style={{ position: 'relative', maxWidth: 860, margin: '0 auto', padding: '24px 24px 40px' }}>

        {/* Remote cursors */}
        {Object.values(cursors).map((cursor) => {
          if (!cursor.range || !quillRef.current || cursor.id === socket.id) return null;
          const editor = quillRef.current.getEditor();
          const bounds = editor.getBounds(cursor.range.index);
          if (!bounds) return null;
          return (
            <div key={cursor.id} style={{ position: 'absolute', left: bounds.left + 24, top: bounds.top + 90, height: bounds.height, width: 2, background: cursor.userColor, zIndex: 50, pointerEvents: 'none', transition: 'all 0.1s ease' }}>
              <div style={{ position: 'absolute', top: -20, left: 0, background: cursor.userColor, color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: '3px 3px 3px 0', whiteSpace: 'nowrap', fontWeight: 500 }}>
                {cursor.userName}
              </div>
            </div>
          );
        })}

        <div className="cwe-quill" style={{ borderRadius: 4, overflow: 'hidden', boxShadow: D ? 'none' : '0 1px 4px rgba(0,0,0,0.06)' }}>
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={text}
            onChange={handleChange}
            onChangeSelection={handleSelectionChange}
          />
        </div>
      </div>

      {/* ── AI SIDEBAR ───────────────────────────────────────── */}
      {isSidebarOpen && <div className="cwe-overlay" onClick={() => setIsSidebarOpen(false)} />}
      <div className="cwe-sidebar" style={{ right: 0, transform: isSidebarOpen ? 'translateX(0)' : 'translateX(100%)' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.05rem', color: txt }}>AI Assistant</span>
          <button className="cwe-btn" style={{ padding: '4px 8px', fontSize: 16 }} onClick={() => setIsSidebarOpen(false)}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', fontSize: '0.88rem', lineHeight: 1.7, color: D ? '#c0bab0' : '#4a4540', whiteSpace: 'pre-wrap' }}>
          {aiLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 40, color: muted }}>
              <div style={{ width: 24, height: 24, border: `2px solid ${border}`, borderTopColor: accent, borderRadius: '50%', animation: 'cwe-fadein 0.2s' }}></div>
              <span style={{ fontSize: '0.78rem' }}>Working…</span>
            </div>
          ) : aiResult || (
            <span style={{ color: muted, fontStyle: 'italic' }}>Use the AI buttons in the toolbar to analyse or improve your text.</span>
          )}
        </div>
        {aiResult && !aiLoading && (
          <div style={{ padding: '14px 16px', borderTop: `1px solid ${border}` }}>
            <button className="cwe-btn primary" style={{ width: '100%', justifyContent: 'center' }} onClick={insertAiResult}>
              Insert into document
            </button>
          </div>
        )}
      </div>

      {/* ── HISTORY SIDEBAR ──────────────────────────────────── */}
      {isHistoryOpen && <div className="cwe-overlay" onClick={() => setIsHistoryOpen(false)} />}
      <div className="cwe-sidebar" style={{ left: 0, transform: isHistoryOpen ? 'translateX(0)' : 'translateX(-100%)' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.05rem', color: txt }}>Version history</span>
          <button className="cwe-btn" style={{ padding: '4px 8px', fontSize: 16 }} onClick={() => setIsHistoryOpen(false)}>✕</button>
        </div>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${border}` }}>
          <p style={{ fontSize: '0.76rem', color: muted, margin: 0 }}>Click a version to restore it. Saves are created manually.</p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {history.length === 0 ? (
            <p style={{ padding: '20px 16px', fontSize: '0.82rem', color: muted, fontStyle: 'italic' }}>No saved versions yet. Use "Save" in the toolbar.</p>
          ) : [...history].reverse().map((ver, i) => (
            <div key={i} className="cwe-ver-item" onClick={() => { setText(ver.content); socket.emit('text-update', { roomId, newText: ver.content }); setIsHistoryOpen(false); showNotif("Version restored"); }}>
              <div style={{ fontWeight: 500, fontSize: '0.85rem', color: txt, marginBottom: 3 }}>{ver.timestamp}</div>
              <div style={{ fontSize: '0.76rem', color: muted }}>Saved by {ver.savedBy}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SHARE MODAL ──────────────────────────────────────── */}
      {isShareOpen && (
        <div className="cwe-modal-bg" onClick={() => setIsShareOpen(false)}>
          <div className="cwe-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.3rem', color: txt, marginBottom: 6 }}>Share & publish</h3>
            <p style={{ fontSize: '0.8rem', color: muted, marginBottom: 24 }}>Invite collaborators or share a read-only public link.</p>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted, marginBottom: 10 }}>Collaborate</div>
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(shareUrl)}`} alt="QR Code" style={{ display: 'inline-block', border: `1px solid ${border}`, borderRadius: 3, padding: 8, background: '#fff' }} />
              </div>
              <button className="cwe-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { navigator.clipboard.writeText(shareUrl); showNotif("Invite link copied"); }}>
                Copy invite link
              </button>
            </div>

            <div style={{ borderTop: `1px solid ${border}`, paddingTop: 18 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted, marginBottom: 8 }}>Public read-only page</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input readOnly className="cwe-input" value={window.location.origin + "/view/" + roomId} style={{ flex: 1 }} />
                <button className="cwe-btn primary" onClick={() => { navigator.clipboard.writeText(window.location.origin + "/view/" + roomId); showNotif("Public link copied"); }}>
                  Copy
                </button>
              </div>
            </div>

            <button className="cwe-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 20 }} onClick={() => setIsShareOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Editor;