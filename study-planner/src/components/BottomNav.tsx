import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Timer, BookOpen, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', label: 'ホーム', icon: Home },
  { path: '/calendar', label: 'カレンダー', icon: Calendar },
  { path: '/timer', label: 'タイマー', icon: Timer },
  { path: '/subjects', label: '科目', icon: BookOpen },
  { path: '/settings', label: '設定', icon: Settings },
] as const;

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur safe-area-pb">
      <div className="mx-auto flex max-w-4xl items-center justify-around">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const isActive =
            path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(path);
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center gap-0.5 py-3 px-4 text-xs ${
                isActive ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              <Icon className="h-6 w-6" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
