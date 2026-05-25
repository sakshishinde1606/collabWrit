import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function HomePage() {
  const [userName, setUserName] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [password, setPassword] = useState("");
  const [isPrivate, setIsPrivate] = useState(false); // 👈 Toggle state
  const navigate = useNavigate();

  const handleJoin = (e) => {
    e.preventDefault();
    if (roomInput.trim() && userName.trim()) {
      // Pass both userName and password (if any) to the Editor
      navigate(`/${roomInput.trim().toLowerCase()}`, { 
        state: { 
          userName: userName.trim(),
          password: isPrivate ? password : "" // Only send password if private
        } 
      });
    } else {
      alert("Please enter both your name and a room name!");
    }
  };

  return (
    <div style={{ padding: '80px 20px', textAlign: 'center', fontFamily: '"Inter", sans-serif' }}>
      <h1 style={{ fontSize: '3.5rem', marginBottom: '10px', color: '#1a1a1a' }}>🚀 CollabWrite</h1>
      <p style={{ color: '#666', marginBottom: '40px' }}>Secure, real-time collaboration.</p>
      
      <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', maxWidth: '400px', margin: '0 auto' }}>
        
        {/* User Identity */}
        <input 
          type="text" 
          placeholder="Your Name" 
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          style={inputStyle}
          required
        />

        {/* Room Name */}
        <input 
          type="text" 
          placeholder="Room name" 
          value={roomInput}
          onChange={(e) => setRoomInput(e.target.value)}
          style={inputStyle}
          required
        />

        {/* 🔒 Privacy Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0' }}>
          <label style={{ fontSize: '0.9rem', color: '#555', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={isPrivate} 
              onChange={() => setIsPrivate(!isPrivate)} 
              style={{ marginRight: '8px' }}
            />
            Private Room
          </label>
        </div>

        {/* Password Field (Only shows if Private is checked) */}
        {isPrivate && (
          <input 
            type="password" 
            placeholder="Set/Enter Room Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ ...inputStyle, border: '2px solid #007bff', animation: 'fadeIn 0.3s' }}
            required
          />
        )}

        <button type="submit" style={fullBtnStyle}>
          {isPrivate ? '🔐 Create/Join Secure Room' : '🚀 Join Public Room'}
        </button>
      </form>
    </div>
  );
}

// Styles
const inputStyle = { 
  padding: '15px', 
  width: '100%', 
  borderRadius: '8px', 
  border: '2px solid #ddd', 
  fontSize: '1rem',
  boxSizing: 'border-box'
};

const fullBtnStyle = { 
  padding: '15px 25px', 
  width: '100%',
  borderRadius: '8px', 
  border: 'none', 
  backgroundColor: '#007bff', 
  color: 'white', 
  fontWeight: 'bold', 
  fontSize: '1rem',
  cursor: 'pointer',
  transition: 'background 0.2s'
};

export default HomePage;