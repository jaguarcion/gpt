import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Home } from './pages/Home';
import { AdminPanel } from './pages/AdminPanel';
import { Users } from './pages/Users';
import { ActivityLogs } from './pages/ActivityLogs';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/users" element={<Users />} />
        <Route path="/admin/logs" element={<ActivityLogs />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
