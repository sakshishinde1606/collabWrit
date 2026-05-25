import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './components/HomePage';
import Editor from './components/Editor';
import PublicView from './components/PublicView'; // 👈 Make sure the path is correct!

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/:roomId" element={<Editor />} />
        <Route path="/view/:roomId" element={<PublicView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;