import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import html2pdf from 'html2pdf.js';
const socket = io('http://localhost:1234');
const btnBase = {
  padding: '8px 14px',
  borderRadius: '6px',
  border: '1px solid #e1e4e8',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: '500',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  transition: 'all 0.2s'
};

const primaryBtn = { ...btnBase, backgroundColor: '#6c5ce7', color: 'white', border: 'none' };
const secondaryBtn = { ...btnBase, backgroundColor: '#fff', color: '#444' };
const aiBtn = { ...btnBase, backgroundColor: '#f8f7ff', color: '#6c5ce7', borderColor: '#dcd7ff' };
const dangerBtn = { ...btnBase, backgroundColor: '#fff5f5', color: '#e74c3c', borderColor: '#ffe3e3' };

function Editor() {
  const { roomId } = useParams();
  const location = useLocation();
  const myName = location.state?.userName || "Guest";
  
  // --- STATE ---
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Connecting...");
  const [isOtherTyping, setIsOtherTyping] = useState(null); // Changed to hold Name
  const [isListening, setIsListening] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]); // Array of names
  const [notification, setNotification] = useState(""); // For "Joined/Left" popups
  const [lastSaved, setLastSaved] = useState("Never");
  const [typingInfo, setTypingInfo] = useState({ name: null, color: '#333' });
  const typingTimeoutRef = useRef(null);
  const [cursors, setCursors] = useState({}); // Stores { socketId: { range, userName, userColor } }
  const quillRef = useRef(null); // IMPORTANT: Add this to your ReactQuill later
  const myPassword = location.state?.password || "";
  const [myColor, setMyColor] = useState('#3498db');
  const [aiResult, setAiResult] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [aiHistory, setAiHistory] = useState([]);
  const [history, setHistory] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const shareUrl = window.location.href; // Gets the current room link
  // Remove [otherUserId, setOtherUserId] and use this:
  const [allUsers, setAllUsers] = useState([]); // Array of {userId, userName}
  const peersRef = useRef({}); // Stores connections: { "socketId": RTCPeerConnection }
  const localStreamRef = useRef(null);   // --- EFFECT: SOCKETS ---
  const [isDarkMode, setIsDarkMode] = useState(false);
  const startVoiceRoom = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = stream;
    setNotification("🎙️ You are now speaking to the room!");

    // For every user ALREADY in the room, start a connection
    allUsers.forEach(async (user) => {
      if (user.userId === socket.id) return; // Don't call yourself
      
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { candidate: event.candidate, to: user.userId });
        }
      };
      // Add your voice to this connection
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Listen for their voice coming back
      pc.ontrack = (event) => {
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.play();
      };

      // Create the "Offer" for this specific user
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socket.emit('call-user', { offer, to: user.userId, from: socket.id });
      
      // Save this specific connection to our map
      peersRef.current[user.userId] = pc;
    });
  } catch (err) {
    setNotification("❌ Mic Error: " + err.message);
  }
};
  useEffect(() => {
    socket.on('all-users-in-room', (users) => {
    setAllUsers(users);
  });

  // 2. Handle an incoming call from ANY user
  socket.on('call-made', async ({ offer, from }) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // Save this connection to our Map
    peersRef.current[from] = pc;

    // Handle their incoming audio
    pc.ontrack = (event) => {
      const audio = new Audio();
      audio.srcObject = event.streams[0];
      audio.play();
      setNotification("🔊 User joined voice!");
    };

    // If YOU are already speaking, send your audio back to them
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => 
        pc.addTrack(track, localStreamRef.current)
      );
    }

    // Handshake: Set Offer -> Create Answer
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('make-answer', { answer, to: from });
  });

  // 3. Handle the Answer coming back to you
  socket.on('answer-made', async ({ answer, to }) => {
    const pc = peersRef.current[to];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  });
  socket.on('ice-candidate', async ({ candidate, from }) => {
  const pc = peersRef.current[from];
  if (pc) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error("Error adding ice candidate", e);
    }
  }
});
    socket.emit('join-room', { roomId, userName: myName, password: myPassword });
    socket.on('error-msg', (msg) => {
    alert(msg);
    window.location.href = "/"; // Send them back to Home
  });

  socket.on('init-text', ({ content, assignedColor }) => {
  // 1. Set the document text from the database
  setText(content);
  
  // 2. Update your local state with the color the server picked for you
  // This ensures your cursor matches your name tag in the header!
  setMyColor(assignedColor); 
  
  // 3. Update the UI status
  setStatus("Live");
});
    // Listen for the updated name list
    socket.on('update-user-list', (users) => {
    console.log("👥 Received User List:", users); // Add this log!
    setActiveUsers(users);
  });

    // Listen for Joined/Left notifications
    socket.on('user-notification', (msg) => {
      setNotification(msg);
      setTimeout(() => setNotification(""), 3000); // Clear after 3s
    });
    
    // Improved typing listener (shows name)
    socket.on('user-typing', ({ isTyping, userName, userColor }) => {
      setTypingInfo(isTyping ? { name: userName, color: userColor } : { name: null, color: '#333' });
    });
    socket.on('cursor-update', (data) => {
      setCursors(prev => ({ ...prev, [data.id]: data }));
    });

    socket.on('text-update', (newHtml) => setText(newHtml));

    socket.on('audio-clip', ({ audioBlob }) => {
      const audio = new Audio(audioBlob);
      audio.play().catch(err => console.error("Audio failed", err));
    });
    socket.on('save-success', ({ timestamp, history: updatedHistory }) => {
  setLastSaved(timestamp);
  
  // 1. Update the local history state so the sidebar shows the new version
  if (updatedHistory) {
    setHistory(updatedHistory);
  }
  
  // 2. Clear the "Saving..." notification immediately
  setNotification("✅ Version Saved!");
  setTimeout(() => setNotification(""), 2000);
});
    // Listen for users leaving to remove their ghost cursors
socket.on('user-left', (userId) => {
  setCursors(prev => {
    const newCursors = { ...prev };
    delete newCursors[userId];
    return newCursors;
  });
});
  
    return () => {
      socket.off('init-text');
      socket.off('text-update');
      socket.off('update-user-list');
      socket.off('user-notification');
      socket.off('user-typing');
      socket.off('audio-clip');
      socket.off('save-success');
      socket.off('cursor-update');
      socket.off('error-msg');
      socket.off('all-users-in-room');
      socket.off('call-made');
      socket.off('answer-made');

      if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
      };
  }, [roomId, myName, myPassword]);

  // --- EFFECT: MICROPHONE ---
  useEffect(() => {
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          const reader = new FileReader();
          reader.readAsDataURL(e.data);
          reader.onloadend = () => {
            socket.emit('audio-clip', { roomId, audioBlob: reader.result });
          };
        };
        setMediaRecorder(recorder);
      });
    }
  }, [roomId]);

  // --- HANDLERS ---
  const handleChange = (content, delta, source) => {
    setText(content);
    if (source === 'user') {
    // 💡 Add 'isManualSave: false' here to prevent auto-versioning
    socket.emit('text-update', { 
      roomId, 
      newText: content, 
      isManualSave: false 
    });

    socket.emit('typing', { roomId, isTyping: true });
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { roomId, isTyping: false });
    }, 2000);
  }
};
  const saveDocument = () => {
  setNotification("💾 Saving milestone version...");
  socket.emit('text-update', { 
    roomId, 
    newText: text, // 'text' is your current state
    isManualSave: true 
  });
};
  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    setNotification("📋 Link copied to clipboard!");
    setTimeout(() => setNotification(""), 2000);
  };
  const toggleListening = () => {
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SpeechRecognition) return alert("Use Chrome!");

    if (isListening) {
      window.recognitionInstance?.stop();
      setIsListening(false);
    } else {
      const recognition = new SpeechRecognition();
      window.recognitionInstance = recognition;
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        if (transcript.toLowerCase().includes("clear page")) {
          setText("");
          socket.emit('text-update', { roomId, newText: "" });
        } else {
          setText(prev => {
            const updated = prev + " " + transcript;
            socket.emit('text-update', { roomId, newText: updated });
            return updated;
          });
        }
      };
      recognition.onend = () => setIsListening(false);
      recognition.start();
    }
  };

  const downloadPDF = () => {
    const element = document.querySelector('.ql-editor');
    html2pdf().from(element).save(`${roomId}-document.pdf`);
  };
  const cursorTimeoutRef = useRef(null); // Add this at the top with your other refs

const handleSelectionChange = (range) => {
  if (!range) return;

  // Clear the previous timer
  if (cursorTimeoutRef.current) {
    clearTimeout(cursorTimeoutRef.current);
  }
  
  // Set a new 50ms "Cooldown"
  cursorTimeoutRef.current = setTimeout(() => {
    socket.emit('cursor-move', { 
      roomId, 
      range, 
      userName: myName, 
      // 💡 Suggestion: Use the color assigned to you by the server!
      userColor: myColor
    });
  }, 50); 
};
const handleAIAction = async (instruction) => {
  setNotification("🤖 AI is working...");
  
  try {
    const response = await fetch('http://localhost:1234/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // We send the current text and the specific instruction
      body: JSON.stringify({ 
        text: text.replace(/<[^>]*>/g, ''), // Strip HTML for the AI
        instruction: instruction 
      })
    });

    const data = await response.json();

    if (data.result) {
      // Option A: Alert the result (Good for summaries)
      setAiResult(data.result);
      setAiHistory(prev => [data.result, ...prev].slice(0, 5));
      setIsSidebarOpen(true);
      setNotification("✅ AI task complete!");
      setTimeout(() => setNotification(""), 2000);
      
      // Option B: Append to the editor (Good for "Continue writing")
      // setText(prev => prev + `<br><strong>AI:</strong> ${data.result}`);
    }
  } catch (err) {
    setNotification("❌ AI Error");
    console.error(err);
  }
};
  return (
  <div style={{ 
    padding: '20px 15px', // Reduced padding for mobile
    maxWidth: '1000px', 
    margin: '0 auto', 
    position: 'relative',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: isDarkMode ? '#1a1a2e' : '#f8f9fa', 
    color: isDarkMode ? '#e0e0e0' : '#333',
    transition: 'all 0.3s ease'
  }}>
    
    {/* 🔔 Floating Notification Toast */}
    {notification && (
      <div style={{
        position: 'fixed', top: '20px', right: '20px', backgroundColor: '#333',
        color: 'white', padding: '10px 20px', borderRadius: '8px', zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)', animation: 'fadeIn 0.3s'
      }}>
        {notification}
      </div>
    )}

    <header style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'flex-start', 
      marginBottom: '20px',
      flexWrap: 'wrap', // 👈 Crucial: Wraps buttons to next line on small screens
      gap: '15px' 
    }}>
      <div style={{ flex: '1 1 300px' }}>
        <h2 style={{ margin: 0, color: isDarkMode ? '#00cec9' : '#2d3436' }}>📄 {roomId}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px', flexWrap: 'wrap' }}>
          <span style={{ color: '#2ecc71', fontSize: '0.85rem', fontWeight: 'bold' }}>● {status}</span>
          <span style={{ color: '#95a5a6', fontSize: '0.85rem' }}>| Saved: {lastSaved}</span>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
  {activeUsers.map((user) => (
    <div 
      key={user.userId} 
      style={{
        backgroundColor: user.color || '#00cec9', // Professional teal fallback
        padding: '6px 14px',
        borderRadius: '25px',
        color: 'white',
        fontSize: '0.8rem',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)' // Adds a subtle "modern" lift
      }}
    >
      {/* Small "Online" indicator dot */}
      <span style={{ 
        width: '6px', 
        height: '6px', 
        borderRadius: '50%', 
        backgroundColor: '#55efc4' 
      }}></span>

      {user.userName} {user.userId === socket.id ? '(You)' : ''}
    </div>
  ))}
</div>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button 
    onClick={() => handleAIAction("Summarize this text in 3 short bullet points.")} 
    style={aiBtnStyle}
  >
    📝 Summarize
  </button>

  {/* Improve Writing Button */}
  <button 
    onClick={() => handleAIAction("Fix the grammar and make the tone more professional.")} 
    style={aiBtnStyle}
  >
    ✨ Improve
  </button>

  {/* Generate Q&A Button (Great for your student profile!) */}
  <button 
    onClick={() => handleAIAction("Generate 3 study questions based on this text.")} 
    style={aiBtnStyle}
  >
    ❓ Quiz Me
  </button>
  <button 
  onClick={() => setIsHistoryOpen(true)} 
  style={{ ...secondaryBtnStyle, backgroundColor: '#f0f2f5' }}
>
  🕒 History
</button>

  <button 
  onClick={saveDocument} 
  style={{ 
    ...secondaryBtnStyle, 
    backgroundColor: '#6c5ce7', 
    color: 'white',
    border: 'none' 
  }}
>
  💾 Save Version
</button>

        <button onClick={toggleListening} title="Voice to Text" style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>
          {isListening ? '🛑' : '🎤'}
        </button>

        <button onMouseDown={() => mediaRecorder?.start()} onMouseUp={() => mediaRecorder?.stop()} style={{ padding: '10px', borderRadius: '8px', cursor: 'pointer', border: '1px solid #ddd', backgroundColor: '#fff' }}>
          📻 Talk
        </button>
        <button onClick={downloadPDF} style={{ padding: '10px', borderRadius: '8px', cursor: 'pointer', border: '1px solid #ddd', backgroundColor: '#fff' }}>📥 PDF</button>
        <button 
          onClick={() => { socket.disconnect(); window.location.href = '/'; }}
          style={{ 
              padding: '10px 18px', borderRadius: '8px', border: 'none', 
              backgroundColor: '#e74c3c', color: 'white', cursor: 'pointer', fontWeight: 'bold' 
          }}
        >
          Exit
        </button>
      </div>
      <button 
  onClick={() => setIsShareOpen(true)} 
  style={{ 
    ...secondaryBtnStyle, 
    backgroundColor: '#6366f1', 
    color: 'white', 
    border: 'none' 
  }}
>
  🔗 Share & Publish
</button>
<button 
  onClick={() => setIsDarkMode(!isDarkMode)} 
  style={secondaryBtn} // Uses your existing white button style
>
  {isDarkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
</button>
{/* ✅ Update this to call startVoiceRoom */}
<button 
  onClick={startVoiceRoom} 
  style={{ 
    ...secondaryBtnStyle, 
    backgroundColor: '#00cec9', 
    color: 'white', 
    border: 'none' 
  }}
>
  🎙️ Join Voice Room
</button>
    </header>
    {/* 🚀 PASTE THE DEBUG BAR HERE (Between Header and Typing Info) */}
    <div style={{ height: '30px', marginBottom: '10px' }}>
      {typingInfo.name && (
        <p style={{ margin: 0, fontSize: '0.85rem', color: typingInfo.color, fontWeight: '600' }}>
          ✍️ {typingInfo.name} is typing...
        </p>
      )}
    </div>

    <div style={{ 
      position: 'relative', 
      marginTop: '10px',
      flex: 1, // 👈 Makes editor take up remaining vertical space
      backgroundColor: isDarkMode ? '#16213e' : '#fff',
        borderLeft: typingInfo.name ? `5px solid ${typingInfo.color}` : (isDarkMode ? '5px solid #0f3460' : '5px solid #eee'),
        borderRadius: '8px',
        transition: 'all 0.3s ease' 
    }}>
      
      {Object.values(cursors).map((cursor) => {
        if (!cursor.range || !quillRef.current || cursor.id === socket.id) return null;
        const editor = quillRef.current.getEditor();
        const bounds = editor.getBounds(cursor.range.index);
        if (!bounds) return null;

        return (
          <div
            key={cursor.id}
            style={{
              position: 'absolute',
              left: bounds.left,
              top: bounds.top + 42, 
              height: bounds.height,
              width: '2px',
              backgroundColor: cursor.userColor,
              zIndex: 50,
              pointerEvents: 'none',
              transition: 'all 0.1s ease'
            }}
          >
            <div style={{
              position: 'absolute', top: '-20px', left: '0', backgroundColor: cursor.userColor,
              color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '3px',
              whiteSpace: 'nowrap', fontWeight: 'bold'
            }}>
              {cursor.userName}
            </div>
          </div>
        );
      })}

      <ReactQuill 
        ref={quillRef}
        theme="snow" 
        value={text} 
        onChange={handleChange} 
        onChangeSelection={handleSelectionChange} 
        style={{ height: '70vh' }} // 👈 Changed from 500px to 70% of viewport height
      />
    </div>
    {/* 🤖 AI Sidebar */}
<div style={{
  position: 'fixed', top: 0, right: isSidebarOpen ? 0 : '-350px',
  width: '320px', height: '100vh', backgroundColor: isDarkMode ? '#16213e' : '#fff',color: isDarkMode ? '#fff' : '#444',
borderLeft: isDarkMode ? '1px solid #0f3460' : 'none',
  boxShadow: '-4px 0 15px rgba(0,0,0,0.1)', transition: 'right 0.3s ease',
  zIndex: 1001, padding: '20px', 
  display: 'flex', flexDirection: 'column' // 👈 This is key
}}>
  
  {/* 1. Sidebar Header */}
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
    <h3 style={{ margin: 0, color: '#6c5ce7' }}>🤖 AI Assistant</h3>
    <button onClick={() => setIsSidebarOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
  </div>
  
  <hr style={{ margin: '15px 0', border: '0.5px solid #eee', flexShrink: 0 }} />

  {/* 2. Scrollable Content Area */}
  <div style={{ 
    flex: 1,           // 👈 Takes up all space except the header and button
    overflowY: 'auto', // 👈 Enables scrolling inside the sidebar
    fontSize: '0.95rem', 
    lineHeight: '1.6', 
    color: '#444', 
    whiteSpace: 'pre-wrap',
    paddingRight: '5px' 
  }}>
    {aiResult || "Waiting for AI..."}
  </div>

  {/* 3. Fixed Action Button Area */}
  <div style={{ padding: '15px 0 5px 0', borderTop: '1px solid #eee', marginTop: '10px', flexShrink: 0 }}>
    <button 
      onClick={() => {
        const editor = quillRef.current.getEditor();
    const range = editor.getSelection();
    
    if (range) {
      // 1. Insert the AI text at the current cursor position
      editor.insertText(range.index, `\n-- AI Suggestion --\n${aiResult}\n`);
      
      // 2. Move the cursor to the end of the new text
      editor.setSelection(range.index + aiResult.length + 22); 
    } else {
      // Fallback: Append to end if no cursor is active
      setText(prev => prev + `<br><strong>AI:</strong> ${aiResult}`);
    }
    
    setIsSidebarOpen(false);
    setNotification("📥 Inserted at cursor!");
    setTimeout(() => setNotification(""), 2000);
  }}
      style={{ 
        width: '100%', 
        padding: '12px', 
        backgroundColor: '#6c5ce7', 
        color: 'white', 
        border: 'none', 
        borderRadius: '8px', 
        cursor: 'pointer', 
        fontWeight: 'bold',
        boxShadow: '0 4px 6px rgba(108, 92, 231, 0.2)'
      }}
    >
      📥 Insert into Editor
    </button>
  </div>
</div>
{/* 🕒 Version History Sidebar */}
<div style={{
  position: 'fixed', top: 0, left: isHistoryOpen ? 0 : '-350px', // Slides from LEFT
  width: '300px', height: '100vh',backgroundColor: isDarkMode ? '#16213e' : '#fff',
color: isDarkMode ? '#fff' : '#333',
borderRight: isDarkMode ? '1px solid #0f3460' : 'none',
  boxShadow: '4px 0 15px rgba(0,0,0,0.1)', transition: 'left 0.3s ease',
  zIndex: 1002, padding: '20px', display: 'flex', flexDirection: 'column'
}}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <h3 style={{ margin: 0 }}>🕒 Version History</h3>
    <button onClick={() => setIsHistoryOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>✖</button>
  </div>
  <p style={{ fontSize: '0.8rem', color: '#888' }}>Click a version to restore it.</p>
  <hr />
  
  <div style={{ flex: 1, overflowY: 'auto' }}>
    {history.map((ver, i) => (
      <div 
        key={i} 
        onClick={() => {
          setText(ver.content);
          socket.emit('text-update', { roomId, newText: ver.content });
          setIsHistoryOpen(false);
        }}
        style={{
          padding: '12px', borderBottom: '1px solid #eee', cursor: 'pointer',
          borderRadius: '5px', transition: 'background 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{ver.timestamp}</div>
        <div style={{ fontSize: '0.75rem', color: '#666' }}>Saved by {ver.savedBy}</div>
      </div>
    ))}
  </div>
</div>
{isShareOpen && (
  <div style={{
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center',
    alignItems: 'center', zIndex: 2000
  }}>
    <div style={{
      backgroundColor: 'white', padding: '30px', borderRadius: '15px',
      textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', maxWidth: '380px', width: '90%'
    }}>
      <h3 style={{ marginTop: 0, color: '#2d3436' }}>Invite & Publish</h3>
      
      {/* --- COLLABORATION SECTION --- */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600', textAlign: 'left', marginBottom: '8px' }}>🤝 Collaborate</p>
        <div style={{ margin: '10px auto', padding: '15px', background: 'white', display: 'inline-block', borderRadius: '10px', border: '1px solid #eee' }}>
          <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shareUrl)}`} 
            alt="QR Code"
            style={{ display: 'block' }}
          />
        </div>
        <button onClick={copyToClipboard} style={{ ...secondaryBtnStyle, width: '100%', justifyContent: 'center', marginTop: '10px' }}>
          Copy Invite Link
        </button>
      </div>

      {/* --- PUBLIC VIEW SECTION --- */}
      <div style={{ padding: '15px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'left' }}>
        <p style={{ margin: '0 0 5px 0', fontSize: '0.8rem', fontWeight: 'bold', color: '#6366f1' }}>🌐 Public Webpage</p>
        <p style={{ margin: '0 0 10px 0', fontSize: '0.7rem', color: '#64748b' }}>Anyone with this link can read this document.</p>
        
        <div style={{ display: 'flex', gap: '5px' }}>
          <input 
            readOnly 
            value={window.location.origin + "/view/" + roomId} 
            style={{ flex: 1, padding: '8px', fontSize: '0.75rem', borderRadius: '5px', border: '1px solid #ddd', backgroundColor: '#fff' }}
          />
          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.origin + "/view/" + roomId);
              setNotification("🚀 Public link copied!");
            }}
            style={{ padding: '8px 12px', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.75rem' }}
          >
            Copy
          </button>
        </div>
      </div>

      {/* --- CLOSE BUTTON (Inside the modal) --- */}
      <button 
        onClick={() => setIsShareOpen(false)} 
        style={{ 
          marginTop: '20px', width: '100%', padding: '10px', 
          backgroundColor: '#f1f2f6', border: 'none', borderRadius: '8px', 
          cursor: 'pointer', fontWeight: 'bold', color: '#2d3436' 
        }}
      >
        Close
      </button>
    </div>
  </div>
)}
</div>

);
}
const aiBtnStyle = {
  padding: '6px 12px',
  borderRadius: '6px',
  cursor: 'pointer',
  border: '1px solid #6c5ce7',
  backgroundColor: '#f3f0ff',
  color: '#6c5ce7',
  fontSize: '0.75rem',
  fontWeight: 'bold'
};
// Add these below your aiBtnStyle
const secondaryBtnStyle = {
  padding: '8px 15px',
  borderRadius: '8px',
  border: '1px solid #ddd',
  backgroundColor: '#ffffff',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: '500',
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  transition: 'all 0.2s ease'
};

const exitBtnStyle = {
  padding: '8px 18px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: '#ff7675', // A soft red for the exit button
  color: 'white',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '0.85rem',
  transition: 'background 0.2s'
};
const darkTheme = {
  container: {
    backgroundColor: '#1a1a2e', // Deep Navy/Charcoal
    color: '#e0e0e0',
    minHeight: '100vh',
    transition: 'all 0.3s ease'
  },
  editorWrapper: {
    backgroundColor: '#16213e',
    borderRadius: '12px',
    border: '1px solid #0f3460',
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
  }
};
export default Editor;