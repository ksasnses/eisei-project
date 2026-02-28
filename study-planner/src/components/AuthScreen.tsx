import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { getDailyMotivation } from '../constants/dailyMotivations';

/** パスワード作成・ロック解除画面 */
export function AuthScreen() {
  const hasPassword = useAuthStore((s) => s.hasPassword)();
  const setPassword = useAuthStore((s) => s.setPassword);
  const unlock = useAuthStore((s) => s.unlock);

  const [password, setPasswordInput] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 4) {
      setError('パスワードは4文字以上にしてください');
      return;
    }
    if (password !== confirm) {
      setError('パスワードが一致しません');
      return;
    }
    setPassword(password);
    setPasswordInput('');
    setConfirm('');
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!unlock(password)) {
      setError('パスワードが違います');
      return;
    }
    setPasswordInput('');
  };

  const motivation = getDailyMotivation(new Date());

  if (hasPassword) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
          <h1 className="mb-2 text-center text-lg font-bold text-slate-800">
            試験までの道
          </h1>
          <p className="mb-6 text-center text-sm font-bold text-slate-700">
            📌 今日の心構え：「{motivation}」
          </p>
          <h2 className="mb-4 text-center text-base font-semibold text-slate-700">
            ロック解除
          </h2>
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2"
                placeholder="パスワードを入力"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-600 py-2 font-medium text-white hover:bg-indigo-700"
            >
              解除
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <h1 className="mb-2 text-center text-lg font-bold text-slate-800">
          試験までの道
        </h1>
        <p className="mb-6 text-center text-sm font-bold text-slate-700">
          📌 今日の心構え：「{motivation}」
        </p>
        <h2 className="mb-2 text-center text-base font-semibold text-slate-700">
          パスワードを作成
        </h2>
        <p className="mb-6 text-center text-xs text-slate-500">
          アプリを保護するパスワードを設定してください
        </p>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600">
              パスワード（4文字以上）
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2"
              placeholder="パスワードを入力"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600">
              確認
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2"
              placeholder="もう一度入力"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 py-2 font-medium text-white hover:bg-indigo-700"
          >
            作成して開始
          </button>
        </form>
      </div>
    </div>
  );
}
