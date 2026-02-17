import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Flame, Tomato, BarChart3, Calendar, Settings } from 'lucide-react';
import { useStudentStore } from '../stores/studentStore';
import { useStudyStore } from '../stores/studyStore';
import { getPhaseByDaysLeft } from '../constants/phaseConfig';
import { getSubjectById } from '../constants/subjects';
import { daysUntilExam } from '../utils/dateUtils';
import type { StudyTask } from '../types';

/** 仮の今日のタスク（Step 5 で差し替え） */
const MOCK_TASKS: StudyTask[] = [
  {
    id: 'mock-1',
    subjectId: 'eng_r',
    type: 'review',
    content: '英単語 ターゲット1900 Section 8-10',
    pomodoroType: 'memorization',
    pomodoroCount: 1,
    estimatedMinutes: 20,
    reviewSource: { originalDate: new Date().toISOString(), reviewNumber: 3 },
    completed: false,
  },
  {
    id: 'mock-2',
    subjectId: 'math1a',
    type: 'new',
    content: '数学ⅠA チャート式 例題 45-52',
    pomodoroType: 'thinking',
    pomodoroCount: 1,
    estimatedMinutes: 30,
    completed: false,
  },
  {
    id: 'mock-3',
    subjectId: 'physics',
    type: 'new',
    content: '物理 セミナー物理 力学・波動',
    pomodoroType: 'thinking',
    pomodoroCount: 1,
    estimatedMinutes: 30,
    completed: false,
  },
  {
    id: 'mock-4',
    subjectId: 'japanese',
    type: 'new',
    content: '古文単語 ゴロゴ 第5章',
    pomodoroType: 'memorization',
    pomodoroCount: 1,
    estimatedMinutes: 20,
    completed: false,
  },
  {
    id: 'mock-5',
    subjectId: 'his_jp',
    type: 'new',
    content: '日本史 一問一答 第4章（江戸時代）',
    pomodoroType: 'memorization',
    pomodoroCount: 1,
    estimatedMinutes: 20,
    completed: false,
  },
];

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
  const completeTask = useStudyStore((s) => s.completeTask);
  const skipTask = useStudyStore((s) => s.skipTask);

  const [localCompleted, setLocalCompleted] = useState<Set<string>>(new Set());
  const tasksWithCompleted = useMemo(() => {
    return MOCK_TASKS.map((t) => ({
      ...t,
      completed: localCompleted.has(t.id),
    }));
  }, [localCompleted]);

  const daysLeft = profile ? daysUntilExam(profile.examDate) : 0;
  const phase = getPhaseByDaysLeft(daysLeft);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const dayOfWeek = new Date().getDay();
  const isClubDay = profile?.dailySchedule.clubDays.includes(dayOfWeek) ?? false;
  const studyHours = isClubDay ? '約2.5' : '約4.5';

  const weeklyCompletionRate = 0;

  const handleComplete = (taskId: string) => {
    const task = MOCK_TASKS.find((t) => t.id === taskId);
    if (task) {
      setLocalCompleted((prev) => new Set(prev).add(taskId));
      completeTask(taskId, task.estimatedMinutes);
    }
  };

  const handleSkip = (taskId: string) => {
    setLocalCompleted((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    skipTask(taskId);
  };

  const allCompleted = tasksWithCompleted.every((t) => t.completed);

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
            <Tomato className="h-5 w-5 text-red-500" />
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

      <div className="lg:flex lg:gap-6">
        {/* メイン: 今日のタスク */}
        <main className="min-w-0 flex-1">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold text-slate-800">
              今日の学習計画
            </h2>
            <p className="mb-4 text-sm text-slate-500">
              {isClubDay
                ? '今日は部活あり → 勉強可能時間 約2.5時間'
                : `勉強可能時間 約${studyHours}時間`}
            </p>

            {allCompleted ? (
              <div className="rounded-lg bg-green-50 py-8 text-center text-green-800">
                <p className="text-lg font-medium">
                  🎉 今日のタスク完了！お疲れさまでした！
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {tasksWithCompleted.map((task) => {
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
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${categoryColor}`}
                          >
                            {subject?.name ?? task.subjectId}
                          </span>
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
                                onClick={() => handleSkip(task.id)}
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
            )}
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
                      <span className="text-slate-600">
                        {getSubjectById(s.subjectId)?.name ?? s.subjectId}
                      </span>
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
    </div>
  );
}
