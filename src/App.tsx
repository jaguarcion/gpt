import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { AdminPanel } from './pages/AdminPanel';
import { Users } from './pages/Users';
import { ActivityLogs } from './pages/ActivityLogs';
import { Statistics } from './pages/Statistics';
import { Backups } from './pages/Backups';
import { Inventory } from './pages/Inventory';
import { Health } from './pages/Health';
import { RateLimit } from './pages/RateLimit';
import { SLA } from './pages/SLA';
import { Calendar } from './pages/Calendar';
import { Changelog } from './pages/Changelog';
import { ThemeProvider } from './components/ThemeProvider';
import { ToastProvider } from './components/Toast';

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/keys" element={<AdminPanel />} />
            <Route path="/admin/users" element={<Users />} />
            <Route path="/admin/logs" element={<ActivityLogs />} />
            <Route path="/admin/stats" element={<Statistics />} />
            <Route path="/admin/backups" element={<Backups />} />
            <Route path="/admin/inventory" element={<Inventory />} />
            <Route path="/admin/health" element={<Health />} />
            <Route path="/admin/rate-limit" element={<RateLimit />} />
            <Route path="/admin/sla" element={<SLA />} />
            <Route path="/admin/calendar" element={<Calendar />} />
            <Route path="/admin/changelog" element={<Changelog />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
