import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
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
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/admin/keys" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
            <Route path="/admin/logs" element={<ProtectedRoute><ActivityLogs /></ProtectedRoute>} />
            <Route path="/admin/stats" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
            <Route path="/admin/backups" element={<ProtectedRoute><Backups /></ProtectedRoute>} />
            <Route path="/admin/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/admin/health" element={<ProtectedRoute><Health /></ProtectedRoute>} />
            <Route path="/admin/rate-limit" element={<ProtectedRoute><RateLimit /></ProtectedRoute>} />
            <Route path="/admin/sla" element={<ProtectedRoute><SLA /></ProtectedRoute>} />
            <Route path="/admin/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
            <Route path="/admin/changelog" element={<ProtectedRoute><Changelog /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
