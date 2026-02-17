import { useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Flame, Clock, BarChart3, Calendar, Settings, Bus, TrendingUp } from 'lucide-react';
import { useStudentStore } from '../stores/studentStore';
import { useStudyStore } from '../stores/studyStore';
import { getPhaseByDaysLeft } from '../constants/phaseConfig';
import { getSubjectById } from '../constants/subjects';
import { daysUntilExam } from '../utils/dateUtils';
import type { StudyTask } from '../types';

const TYPE_LABELS: Record<StudyTask['type'], string> = {
  new: '新規学習',
  review: '復習',
  exam_practice: '演習',
  speed_training: '処理速度',
};

const CATEGORY_COLORS: Record<string, string> = {
  地歴公民: 'bg-amber-100 text-amber-800',
  国語: 'bg-green-100 text-green-800',
  外国語: 'bg-blue-100 text-blue-800',
  理科: 'bg-purple-100 text-purple-800',
  数学: 'bg-indigo-100 text-indigo-800',
  情報: 'bg-slate-100 text-slate-800',
};

export function DashboardPage() {
  const profile = useStudentStore((s) => s.profile);
  const events = useStudentStore((s) => s.events);
  const streakDays = useStudyStore((s) => s.streakDays);
  const totalPomodoros = useStudyStore((s) => s.totalPomodoros);
  const dailyPlans = useStudyStore((s) => s.dailyPlans);
  const completedTasks = useStudyStore((s) => s.completedTasks);
  const generateDailyPlan = useStudyStore((s) => s.generateDailyPlan);
  const completeTask = useStudyStore((s) => s.completeTask);
  const skipTask = useStudyStore((s) => s.skipTask);

  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const plan = dailyPlans[today];
  const tasks = plan?.tasks ?? [];

  useEffect(() => {
    if (profile && !plan) generateDailyPlan(today);
  }, [profile, today, plan, generateDailyPlan]);

  const daysLeft = profile ? daysUntilExam(profile.examDate) : 0;
  const phase = getPhaseByDaysLeft(daysLeft);
  const isClubDay = plan?.isClubDay ?? false;
  const studyHours =
    plan != null
      ? `約${Math.floor(plan.availableMinutes / 60)}時間${plan.availableMinutes % 60 ? plan.availableMinutes % 60 + '分' : ''}`
      : '—';

  const weeklyCompletionRate = 0;

  const handleComplete = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) completeTask(taskId, task.estimatedMinutes);
  };

  const allCompleted =
    tasks.length > 0 && tasks.every((t) => t.completed);

  const phaseBadgeClass =
    phase.name === '基礎期'
      ? 'bg-blue-100 text-blue-700'
      : phase.name === '実践期'
        ? 'bg-orange-100 text-orange-700'
        : 'bg-red-100 text-red-700';

  const upcomingEvents = useMemo(() => {
    if (!events.length) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inWeek = new Date(today);
    inWeek.setDate(inWeek.getDate() + 7);
    return events
      .filter((e) => {
        const d = new Date(e.date);
        d.setHours(0, 0, 0, 0);
        return d >= today && d <= inWeek;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  }, [events]);

  const last7DaysStudy = useMemo(() => {
    const days: { date: string; 合計: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayTasks = completedTasks.filter(
        (t) => t.completedAt && t.completedAt.startsWith(dateStr)
      );
      const total = dayTasks.reduce(
        (sum, t) => sum + (t.actualMinutes ?? t.estimatedMinutes ?? 0),
        0
      );
      days.push({ date: format(d, 'M/d', { locale: ja }), 合計: total });
    }
    return days;
  }, [completedTasks]);

  const subjectTotals = useMemo(() => {
    const map: Record<string, number> = {};
    completedTasks.forEach((t) => {
      const min = t.actualMinutes ?? t.estimatedMinutes ?? 0;
      map[t.subjectId] = (map[t.subjectId] ?? 0) + min;
    });
    return Object.entries(map)
      .map(([subjectId, minutes]) => ({
        name: getSubjectById(subjectId)?.name ?? subjectId,
        value: minutes,
      }))
      .filter((s) => s.value > 0);
  }, [completedTasks]);

  const reviewStats = useMemo(() => {
    const review = completedTasks.filter((t) => t.reviewSource);
    const completed = review.filter((t) => t.completed);
    const total = Math.max(completedTasks.filter((t) => t.reviewSource).length, completed.length);
    return {
      completed: completed.length,
      total,
      rate: total > 0 ? Math.round((completed.length / total) * 100) : 0,
    };
  }, [completedTasks]);

  const commuteSuggestion = useMemo(() => {
    const memorizationTask = tasks.find((t) => {
      const sub = getSubjectById(t.subjectId);
      return sub && sub.memorizationRatio >= 0.5 && !t.completed;
    });
    if (memorizationTask) {
      const sub = getSubjectById(memorizationTask.subjectId);
      return `${sub?.name ?? memorizationTask.subjectId}の暗記（${memorizationTask.content.slice(0, 20)}…）`;
    }
    return '英単語・暗記系のインプット（音声付き推奨）';
  }, [tasks]);

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-4">
      {/* ヘッダーエリア */}
      <header className="mb-6">
        <h1 className="text-lg font-semibold text-slate-700">
          {profile.name}さんの学習計画
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div
            className={`text-2xl font-bold tabular-nums ${
              daysLeft <= 30 ? 'text-red-600' : 'text-slate-800'
            }`}
          >
            試験まであと {daysLeft} 日
          </div>
          <span
            className={`rounded-full px-3 py-0.5 text-sm font-medium ${phaseBadgeClass}`}
          >
            {phase.name}
          </span>
          <span className="text-sm text-slate-500">
            {format(new Date(), 'M月d日(E)', { locale: ja })}
          </span>
        </div>
      </header>

      {daysLeft <= 30 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-medium text-amber-800">
            仮本番を実施しましょう（月2回推奨）
          </p>
          <Link
            to="/calendar"
            className="mt-2 inline-block text-sm font-medium text-amber-700 underline"
          >
            カレンダーで仮本番を設定 →
          </Link>
        </div>
      )}

      {/* モチベーションカード */}
      <section className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <Flame className="h-5 w-5 text-orange-500" />
            <span className="text-xs">連続学習</span>
          </div>
          <div className="mt-1 text-xl font-bold text-slate-800">
            {streakDays}日連続
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <Clock className="h-5 w-5 text-red-500" />
            <span className="text-xs">累計ポモドーロ</span>
          </div>
          <div className="mt-1 text-xl font-bold text-slate-800">
            {totalPomodoros}セット
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            <span className="text-xs">今週の達成率</span>
          </div>
          <div className="mt-1 text-xl font-bold text-slate-800">
            {weeklyCompletionRate}%
          </div>
        </div>
      </section>

      {/* 通学時間の活用 */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-slate-500">
          <Bus className="h-5 w-5 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">通学時間の活用</span>
        </div>
        <p className="mt-2 text-slate-800">
          今日の通学時間おすすめ：{commuteSuggestion}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          暗記系のインプットに最適です。音声教材も活用しましょう。
        </p>
      </section>

      <div className="lg:flex lg:gap-6">
        {/* メイン: 今日のタスク */}
        <main className="min-w-0 flex-1">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold text-slate-800">
              今日の学習計画
            </h2>
            <p className="mb-4 text-sm text-slate-500">
              {plan != null && (
                <>
                  {isClubDay && '今日は部活あり → '}
                  勉強可能時間 {studyHours}
                </>
              )}
            </p>

            {tasks.length === 0 && plan == null && profile && (
              <p className="py-4 text-center text-slate-500">
                計画を生成しています...
              </p>
            )}
            {tasks.length === 0 && plan != null && (
              <p className="py-4 text-center text-slate-500">
                今日のタスクはありません。明日またお試しください。
              </p>
            )}
            {allCompleted && tasks.length > 0 ? (
              <div className="task-complete-flash rounded-lg bg-green-50 py-8 text-center text-green-800">
                <p className="text-lg font-medium">
                  🎉 今日のタスク完了！お疲れさまでした！
                </p>
              </div>
            ) : tasks.length > 0 ? (
              <ul className="space-y-3">
                {tasks.map((task) => {
                  const subject = getSubjectById(task.subjectId);
                  const categoryColor =
                    subject ? CATEGORY_COLORS[subject.category] ?? 'bg-slate-100 text-slate-800' : 'bg-slate-100 text-slate-800';
                  return (
                    <li
                      key={task.id}
                      className={`rounded-lg border p-4 ${
                        task.completed
                          ? 'border-slate-100 bg-slate-50 opacity-75'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/subjects/${task.subjectId}`}
                            className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${categoryColor} hover:opacity-90`}
                          >
                            {subject?.name ?? task.subjectId}
                          </Link>
                          <p className="mt-2 font-medium text-slate-800">
                            {task.content}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                            <span>
                              🍅×{task.pomodoroCount} = {task.estimatedMinutes}
                              分
                            </span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                              {TYPE_LABELS[task.type]}
                            </span>
                            {task.reviewSource && (
                              <span className="text-amber-600">
                                忘却曲線 {task.reviewSource.reviewNumber}回目復習
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!task.completed && (
                            <>
                              <Link
                                to="/timer"
                                state={{ task }}
                                className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white"
                              >
                                開始
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleComplete(task.id)}
                                className="rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                              >
                                完了
                              </button>
                              <button
                                type="button"
                                onClick={() => skipTask(task.id)}
                                className="text-xs text-slate-400 hover:text-slate-600"
                              >
                                スキップ
                              </button>
                            </>
                          )}
                          {task.completed && (
                            <span className="text-sm text-green-600">
                              ✓ 完了
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        </main>

        {/* サイドバー / 下部エリア */}
        <aside className="mt-6 lg:mt-0 lg:w-72 lg:shrink-0">
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Calendar className="h-4 w-4" />
                今後1週間のイベント
              </h3>
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-slate-500">予定はありません</p>
              ) : (
                <ul className="space-y-2">
                  {upcomingEvents.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-medium text-slate-700">
                        {e.title}
                      </span>
                      <span className="text-slate-500">
                        {format(new Date(e.date), 'M/d', { locale: ja })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">
                科目別進捗
              </h3>
              <ul className="space-y-3">
                {profile.subjects.slice(0, 6).map((s) => (
                  <li key={s.subjectId}>
                    <div className="flex justify-between text-xs">
                      <Link
                        to={`/subjects/${s.subjectId}`}
                        className="font-medium text-slate-600 hover:text-indigo-600"
                      >
                        {getSubjectById(s.subjectId)?.name ?? s.subjectId}
                      </Link>
                      <span className="text-slate-500">
                        {s.currentScore}→{s.targetScore}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${Math.min(100, s.currentScore)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <div className="flex gap-2">
              <Link
                to="/calendar"
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white py-2 text-sm text-slate-700"
              >
                <Calendar className="h-4 w-4" />
                スケジュール
              </Link>
              <Link
                to="/settings"
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white py-2 text-sm text-slate-700"
              >
                <Settings className="h-4 w-4" />
                設定
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {/* 学習統計 */}
      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
          <TrendingUp className="h-5 w-5" />
          学習統計
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-600">過去7日間の学習時間</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7DaysStudy} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `${v}分`} />
                  <Tooltip formatter={(v: number) => [`${v}分`, '学習時間']} />
                  <Bar dataKey="合計" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-600">科目別累計学習時間</h3>
            {subjectTotals.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={subjectTotals}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {subjectTotals.map((_, i) => (
                        <Cell key={i} fill={['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4'][i % 6]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v}分`, '学習時間']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">データがありません</p>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700">
            連続学習: {streakDays}日
          </span>
          <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700">
            忘却曲線 復習完了率: {reviewStats.rate}%
          </span>
        </div>
      </section>
    </div>
  );
}
