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
import { Settings } from './pages/Settings';
import { ActivationQueue } from './pages/ActivationQueue';
import { DatabaseExplorer } from './pages/DatabaseExplorer';
import { ThemeProvider } from './components/ThemeProvider';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import { ProtectedRoute } from './components/ProtectedRoute';

import { AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { PageTransition } from './components/PageTransition';

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Home /></PageTransition>} />
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/admin" element={<ProtectedRoute><PageTransition><Dashboard /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/keys" element={<ProtectedRoute><PageTransition><AdminPanel /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute><PageTransition><Users /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/logs" element={<ProtectedRoute><PageTransition><ActivityLogs /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/stats" element={<ProtectedRoute><PageTransition><Statistics /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/backups" element={<ProtectedRoute><PageTransition><Backups /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/inventory" element={<ProtectedRoute><PageTransition><Inventory /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/health" element={<ProtectedRoute><PageTransition><Health /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/rate-limit" element={<ProtectedRoute><PageTransition><RateLimit /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/sla" element={<ProtectedRoute><PageTransition><SLA /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/calendar" element={<ProtectedRoute><PageTransition><Calendar /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/changelog" element={<ProtectedRoute><PageTransition><Changelog /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute><PageTransition><Settings /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/queue" element={<ProtectedRoute><PageTransition><ActivationQueue /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/db" element={<ProtectedRoute><PageTransition><DatabaseExplorer /></PageTransition></ProtectedRoute>} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <ToastProvider>
        <ConfirmProvider>
          <BrowserRouter>
            <AnimatedRoutes />
          </BrowserRouter>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
