import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';

const socket = io('http://localhost:1234');

function PublicView() {
  const { roomId } = useParams();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Join as a viewer only
    socket.emit('join-view-only', roomId);

    // 2. Listen for the specific data event
    socket.on('init-text', (data) => {
      setText(data.content);
      setLoading(false);
    });

    // 3. Keep it live if someone is editing
    socket.on('text-update', (newHtml) => {
      setText(newHtml);
    });

    return () => {
      socket.off('init-text');
      socket.off('text-update');
    };
  }, [roomId]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <p>⏳ Loading document {roomId}...</p>
    </div>
  );

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif', lineHeight: '1.6' }}>
      <header style={{ borderBottom: '2px solid #6c5ce7', marginBottom: '20px', paddingBottom: '10px' }}>
        <h1 style={{ color: '#6c5ce7' }}>🌐 Public View: {roomId}</h1>
      </header>
      
      {/* This renders the HTML from the database safely */}
      <div 
        className="ql-editor" 
        dangerouslySetInnerHTML={{ __html: text || "<i>This document is empty.</i>" }} 
      />
    </div>
  );
}

export default PublicView;