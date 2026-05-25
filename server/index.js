const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const Groq = require('groq-sdk');
const activeRooms = {};
// 2. Initialize with your API Key
const groq = new Groq({ apiKey: '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' });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.post('/ai', async (req, res) => {
  const { text, instruction } = req.body;

  if (!text) {
    return res.status(400).json({ error: "No text provided" });
  }

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a helpful writing assistant for a collaborative editor. Keep responses concise and professional.'
        },
        {
          role: 'user',
          content: `${instruction}\n\nText to process:\n${text}`
        }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
    });

    res.json({
      result: chatCompletion.choices[0].message.content
    });

  } catch (error) {
    console.log("--- START AI ERROR LOG ---");
    console.error("Type:", error.constructor.name);
    console.error("Message:", error.message);
    if (error.response) {
        console.error("Status:", error.response.status);
        console.error("Data:", error.response.data); // This is key for Groq errors
    }
    console.log("--- END AI ERROR LOG ---");

    res.status(500).json({ 
      error: 'AI processing failed', 
      msg: error.message 
    });
  }
});
// 2. DATABASE CONNECTION
mongoose.connect('mongodb://127.0.0.1:27017/collab-editor')
  .then(() => console.log("🏠 Connected to LOCAL MongoDB"))
  .catch(err => console.error("❌ Local DB Connection Error:", err));

// 3. DEFINE DATABASE SCHEMA
const DocumentSchema = new mongoose.Schema({
  _id: String, 
  content: { type: String, default: "" },
  history: [{
    content: String,
    timestamp: String,
    savedBy: String
  }]
});
const Document = mongoose.model('Document', DocumentSchema);

// 4. SETUP SERVERS
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", 
    methods: ["GET", "POST"]
  }
});

// 5. REAL-TIME LOGIC
const roomUsers = {}; 
const roomPasswords = {}; 

io.on('connection', (socket) => {
  console.log('👤 User connected:', socket.id);
  // Add these inside your socket connection block
socket.on('call-user', ({ offer, to, from }) => {
  io.to(to).emit('call-made', { offer, from });
});
// --- PUBLIC VIEW LISTENER ---
socket.on('join-view-only', async (roomId) => {
  socket.join(roomId);
  console.log(`🌐 Public viewer joined: ${roomId}`);

  try {
    const doc = await Document.findById(roomId);
    if (doc) {
      // Use the SAME event name your Editor uses to ensure compatibility
      socket.emit('init-text', { 
        content: doc.content, 
        assignedColor: '#95a5a6' // Neutral gray for viewers
      });
    } else {
      socket.emit('init-text', { content: "<h3>Document is empty.</h3>" });
    }
  } catch (err) {
    console.error("MongoDB Error:", err);
  }
});
socket.on('make-answer', ({ answer, to }) => {
  io.to(to).emit('answer-made', { answer, to: socket.id });
});

socket.on('ice-candidate', ({ candidate, to }) => {
  io.to(to).emit('ice-candidate', { candidate });
});

  // 🚨 FIXED: Added 'password' to the destructured object below
  socket.on('join-room', async ({ roomId, userName, password }) => {
        // 1. Check Password
    if (roomPasswords[roomId] && roomPasswords[roomId] !== password) {
      return socket.emit('error-msg', "Incorrect password for this room!");
    }

    if (!roomPasswords[roomId] && password) {
      roomPasswords[roomId] = password;
      console.log(`🔐 Room ${roomId} secured.`);
    }

    // 2. Setup User Details
    socket.join(roomId);
    socket.roomId = roomId; // 💡 Store roomId on the socket for easier cleanup later
    socket.userName = userName || "Guest";
    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22'];
    socket.userColor = colors[Math.floor(Math.random() * colors.length)];

    if (!roomUsers[roomId]) roomUsers[roomId] = {};

    // 💡 THE FIX: Remove any existing entry with the same name to prevent duplicates
    // 💡 KEEP THIS: It prevents the "Ghost User" bug where one person appears twice
    if (roomUsers[roomId]) {
        Object.keys(roomUsers[roomId]).forEach(socketId => {
            if (roomUsers[roomId][socketId].name === socket.userName) {
                delete roomUsers[roomId][socketId];
            }
        });
    }

    // 3. Add the fresh connection
    roomUsers[roomId][socket.id] = { 
    userId: socket.id, // Important for WebRTC mapping
    userName: socket.userName, 
    color: socket.userColor 
  };
    const room = io.sockets.adapter.rooms.get(roomId);
    // Change this line:
// userName: roomUsers[roomId]?.[id]?.name || "User"

// To this:
const usersInRoom = room ? Array.from(room).map(id => ({
    userId: id,
    userName: roomUsers[roomId]?.[id]?.userName || "Guest" // 👈 Changed .name to .userName
})) : [];
    io.to(roomId).emit('all-users-in-room', usersInRoom);
    
    // 4. Update everyone (Now includes the assigned color for the frontend)
    io.in(roomId).emit('update-user-list', Object.values(roomUsers[roomId]));
    socket.to(roomId).emit('user-notification', `${socket.userName} joined the room`);

    try {
      let doc = await Document.findById(roomId);
      if (!doc) doc = await Document.create({ _id: roomId, content: "" });
      
      socket.emit('init-text', { 
        content: doc.content, 
        assignedColor: socket.userColor,
        history: doc.history || [] // 💡 Send the version history on join!
      });
    } catch (err) { console.error("Load Error:", err); }
});

  socket.on('text-update', async ({ roomId, newText, isManualSave }) => {
    socket.to(roomId).emit('text-update', newText);
    try {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // 2. Find or create the document
    let doc = await Document.findById(roomId);
    if (!doc) doc = new Document({ _id: roomId, content: newText, history: [] });

    doc.content = newText;

    // 💡 THE FIX: Only push to history if the button was clicked
    if (isManualSave) {
      doc.history.push({ 
        content: newText, 
        timestamp: now, 
        savedBy: socket.userName 
      });

      // Keep only the last 15 manual snapshots
      if (doc.history.length > 15) doc.history.shift();
      doc.markModified('history'); 
      
      await doc.save();
      
      // Send success back ONLY on manual save to clear the "Saving..." notification
      socket.emit('save-success', { 
        timestamp: now, 
        history: doc.history 
      });
    } else {
      // For normal typing, just save the main content silently
      await doc.save();
    }

  } catch (err) {
    console.error("❌ Save Error:", err);
  }
});

  socket.on('cursor-move', ({ roomId, range, userName, userColor }) => {
    socket.to(roomId).emit('cursor-update', { 
      id: socket.id, 
      range, 
      userName, 
      userColor 
    });
  });

  socket.on('typing', ({ roomId, isTyping }) => {
    socket.to(roomId).emit('user-typing', { isTyping, userName: socket.userName, userColor: socket.userColor });
  });

  socket.on('audio-clip', ({ roomId, audioBlob }) => {
    socket.to(roomId).emit('audio-clip', { audioBlob });
  });

  socket.on('disconnecting', () => {
    socket.rooms.forEach(roomId => {
      if (roomId !== socket.id && roomUsers[roomId]?.[socket.id]) {
        const leavingUserName = roomUsers[roomId][socket.id].userName; 
        delete roomUsers[roomId][socket.id];
        const remainingUsers = Object.values(roomUsers[roomId]);
        io.in(roomId).emit('update-user-list', remainingUsers);
        io.in(roomId).emit('user-left', socket.id);

        socket.to(roomId).emit('user-notification', `${leavingUserName} left the room`);
        // Inside index.js disconnecting/disconnect

        // Memory Cleanup: If room is empty, clear users and passwords
        if (remainingUsers.length === 0) {
          delete roomUsers[roomId];
          delete roomPasswords[roomId];
          console.log(`🏠 Room ${roomId} cleared.`);
        }
      }
    });
  });

  socket.on('disconnect', () => {
    console.log('👋 User disconnected');
  });
});

const PORT = 1234;
server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});