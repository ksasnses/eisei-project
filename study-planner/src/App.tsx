import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useStudentStore } from './stores/studentStore';
import { useAuthStore } from './stores/authStore';
import { AuthScreen } from './components/AuthScreen';
import { BottomNav } from './components/BottomNav';
import { DashboardPage } from './pages/DashboardPage';
import { WizardPage } from './pages/WizardPage';
import { CalendarPage } from './pages/CalendarPage';
import { TimerPage } from './pages/TimerPage';
import { SettingsPage } from './pages/SettingsPage';
import { SubjectListPage } from './pages/SubjectListPage';
import { SubjectDetailPage } from './pages/SubjectDetailPage';
import { ProgressHeatmapPage } from './pages/ProgressHeatmapPage';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const hasPassword = useAuthStore((s) => s.hasPassword)();
  const isUnlocked = useAuthStore((s) => s.isUnlocked);

  if (hasPassword && !isUnlocked) {
    return <AuthScreen />;
  }
  if (!hasPassword) {
    return <AuthScreen />;
  }
  return <>{children}</>;
}

function InitializedGuard({ children }: { children: React.ReactNode }) {
  const isInitialized = useStudentStore((s) => s.isInitialized);
  const location = useLocation();

  if (!isInitialized && location.pathname !== '/wizard') {
    return <Navigate to="/wizard" replace />;
  }
  return <>{children}</>;
}

function AppTitle() {
  const profile = useStudentStore((s) => s.profile);
  const title = profile?.name ? `${profile.name}の試験までの道` : '試験までの道';
  return <h1 className="text-xl font-bold text-slate-800">{title}</h1>;
}

function App() {
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const isInitialized = useStudentStore((s) => s.isInitialized);

  useEffect(() => {
    try {
      localStorage.setItem('__storage_test__', '1');
      localStorage.removeItem('__storage_test__');
    } catch (e) {
      if (e instanceof DOMException && (e.code === 22 || e.name === 'QuotaExceededError')) {
        setStorageError('保存容量が不足しています。不要なデータを削除してください。');
      }
    }
  }, []);

  useEffect(() => {
    const persistApi = useStudentStore.persist;
    if (persistApi?.hasHydrated?.()) {
      setHydrated(true);
      return;
    }
    const unsub = persistApi?.onFinishHydration?.(() => setHydrated(true));
    const fallback = setTimeout(() => setHydrated(true), 1500);
    return () => {
      unsub?.();
      clearTimeout(fallback);
    };
  }, []);

  if (!hydrated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          color: '#0f172a',
          fontFamily: 'sans-serif',
        }}
      >
        <p style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>
          読み込み中...
        </p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AuthGuard>
        <InitializedGuard>
          <div className="min-h-screen bg-slate-50" style={{ color: '#0f172a' }}>
            {storageError && (
              <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
                {storageError}
              </div>
            )}
            {isInitialized && (
              <header className="border-b border-slate-200 bg-white px-4 py-3">
                <AppTitle />
              </header>
            )}
          <main className={isInitialized ? 'pb-16' : ''}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/wizard" element={<WizardPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/progress" element={<ProgressHeatmapPage />} />
              <Route path="/timer" element={<TimerPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/subjects" element={<SubjectListPage />} />
              <Route path="/subjects/:id" element={<SubjectDetailPage />} />
            </Routes>
          </main>
          {isInitialized && <BottomNav />}
          </div>
        </InitializedGuard>
      </AuthGuard>
    </BrowserRouter>
  );
}

export default App;
