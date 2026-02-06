import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Home } from './pages/Home';
import { AdminPanel } from './pages/AdminPanel';
import { Users } from './pages/Users';
import { ActivityLogs } from './pages/ActivityLogs';
import { Statistics } from './pages/Statistics';
import { ThemeProvider } from './components/ThemeProvider';

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/logs" element={<ActivityLogs />} />
          <Route path="/admin/stats" element={<Statistics />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
