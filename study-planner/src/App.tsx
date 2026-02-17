import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useStudentStore } from './stores/studentStore';
import { BottomNav } from './components/BottomNav';
import { DashboardPage } from './pages/DashboardPage';
import { WizardPage } from './pages/WizardPage';
import { CalendarPage } from './pages/CalendarPage';
import { TimerPage } from './pages/TimerPage';
import { SettingsPage } from './pages/SettingsPage';
import { SubjectListPage } from './pages/SubjectListPage';
import { SubjectDetailPage } from './pages/SubjectDetailPage';

function InitializedGuard({ children }: { children: React.ReactNode }) {
  const isInitialized = useStudentStore((s) => s.isInitialized);
  const location = useLocation();

  if (!isInitialized && location.pathname !== '/wizard') {
    return <Navigate to="/wizard" replace />;
  }
  return <>{children}</>;
}

function App() {
  const isInitialized = useStudentStore((s) => s.isInitialized);

  return (
    <BrowserRouter>
      <InitializedGuard>
        <div className="min-h-screen bg-slate-50">
          {isInitialized && (
            <header className="border-b border-slate-200 bg-white px-4 py-3">
              <h1 className="text-xl font-bold text-slate-800">eisei project</h1>
            </header>
          )}
          <main className={isInitialized ? 'pb-16' : ''}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/wizard" element={<WizardPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/timer" element={<TimerPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/subjects" element={<SubjectListPage />} />
              <Route path="/subjects/:id" element={<SubjectDetailPage />} />
            </Routes>
          </main>
          {isInitialized && <BottomNav />}
        </div>
      </InitializedGuard>
    </BrowserRouter>
  );
}

export default App;
