import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated, apiFetch } from './auth';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LeadQueue from './pages/LeadQueue';
import ReportDetail from './pages/ReportDetail';
import Settings from './pages/Settings';
import ActivityLog from './pages/ActivityLog';

function PrivateLayout({ children }) {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    apiFetch('/stats')
      .then((r) => r?.json())
      .then((d) => setPendingCount(d?.totals?.awaiting_review || 0))
      .catch(() => {});
  }, []);

  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <Sidebar pendingCount={pendingCount} />
      <main className="flex-1 overflow-auto p-8">
        <ErrorBoundary title="Something went wrong on this page">
          {children}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/portal">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateLayout><Dashboard /></PrivateLayout>} />
        <Route path="/leads" element={<PrivateLayout><LeadQueue /></PrivateLayout>} />
        <Route path="/leads/:id" element={<PrivateLayout><ReportDetail /></PrivateLayout>} />
        <Route path="/resolved" element={
          <PrivateLayout>
            <LeadQueue title="Resolved Cases" defaultStatus="ACTIONED,NO_FINDING" />
          </PrivateLayout>
        } />
        <Route path="/settings" element={<PrivateLayout><Settings /></PrivateLayout>} />
        <Route path="/activity" element={<PrivateLayout><ActivityLog /></PrivateLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
