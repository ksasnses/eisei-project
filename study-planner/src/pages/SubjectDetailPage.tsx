import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Star, Plus, Trash2 } from 'lucide-react';
import { getSubjectById } from '../constants/subjects';
import { getPhaseByDaysLeft } from '../constants/phaseConfig';
import { useStudentStore } from '../stores/studentStore';
import { useStudyStore } from '../stores/studyStore';
import { daysUntilExam } from '../utils/dateUtils';
import { generateReviewTasks } from '../utils/forgettingCurve';
import type { StudyTask } from '../types';

const STUDY_TYPE_LABELS: Record<string, string> = {
  thinking: '思考型',
  memorization: '暗記型',
  processing: '処理速度型',
  mixed: '混合型',
};

export function SubjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const profile = useStudentStore((s) => s.profile);
  const scoreRecords = useStudentStore((s) => s.scoreRecords);
  const updateSubject = useStudentStore((s) => s.updateSubject);
  const addScoreRecord = useStudentStore((s) => s.addScoreRecord);
  const dailyPlans = useStudyStore((s) => s.dailyPlans);
  const completedTasks = useStudyStore((s) => s.completedTasks);
  const generateDailyPlan = useStudyStore((s) => s.generateDailyPlan);

  const subject = useMemo(() => (id ? getSubjectById(id) : undefined), [id]);
  const selected = useMemo(
    () => profile?.subjects.find((s) => s.subjectId === id),
    [profile, id]
  );

  const [showScoreForm, setShowScoreForm] = useState(false);
  const [newScoreDate, setNewScoreDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newScoreValue, setNewScoreValue] = useState('');
  const [newTextbook, setNewTextbook] = useState('');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'done' | 'pending'>('all');

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  useEffect(() => {
    if (id && profile && !selected) {
      const exists = profile.subjects.some((s) => s.subjectId === id);
      if (!exists) navigate('/', { replace: true });
    }
  }, [id, profile, selected, navigate]);

  const scoreHistory = useMemo(() => {
    if (!id) return [];
    return scoreRecords
      .filter((r) => r.subjectId === id)
      .map((r) => ({ date: r.date, score: r.score, current: r.score }));
  }, [id, scoreRecords]);

  const chartData = useMemo(() => {
    const current = selected?.currentScore ?? 0;
    const points = [...scoreHistory];
    if (points.length === 0) {
      points.push({ date: todayStr, score: current, current });
    }
    return points;
  }, [scoreHistory, selected, subject, todayStr]);

  const phase = useMemo(() => {
    if (!profile) return null;
    const daysLeft = daysUntilExam(profile.examDate);
    return getPhaseByDaysLeft(daysLeft);
  }, [profile]);

  const reviewStats = useMemo(() => {
    if (!id) return { total: 0, byDay: [] as { label: string; count: number }[] };
    const byDay: Record<string, number> = {};
    const dayLabels: Record<string, string> = {};
    for (let i = 0; i < 14; i++) {
      const d = addDays(new Date(), i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const tasks = generateReviewTasks(completedTasks, dateStr).filter(
        (t) => t.subjectId === id
      );
      if (tasks.length > 0) {
        byDay[dateStr] = tasks.length;
        if (i === 0) dayLabels[dateStr] = '今日';
        else if (i === 1) dayLabels[dateStr] = '明日';
        else dayLabels[dateStr] = `${i}日後`;
      }
    }
    const total = Object.values(byDay).reduce((a, b) => a + b, 0);
    const byDayList = Object.entries(byDay).map(([date, count]) => ({
      label: dayLabels[date] ?? date,
      count,
    }));
    return { total, byDay: byDayList };
  }, [id, completedTasks]);

  const reviewTaskList = useMemo(() => {
    if (!id) return [];
    const list: { task: StudyTask; date: string }[] = [];
    const dates = Object.keys(dailyPlans).sort();
    for (const dateStr of dates) {
      const plan = dailyPlans[dateStr];
      for (const task of plan.tasks) {
        if (task.subjectId === id && task.type === 'review') {
          list.push({ task, date: dateStr });
        }
      }
    }
    for (let i = 0; i < 14; i++) {
      const d = addDays(new Date(), i);
      const dateStr = format(d, 'yyyy-MM-dd');
      if (dailyPlans[dateStr]) continue;
      const tasks = generateReviewTasks(completedTasks, dateStr).filter(
        (t) => t.subjectId === id
      );
      for (const task of tasks) {
        list.push({ task, date: dateStr });
      }
    }
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [id, dailyPlans, completedTasks]);

  const handleAddScore = () => {
    const score = Math.min(
      subject?.score ?? 100,
      Math.max(0, parseInt(newScoreValue, 10) || 0)
    );
    if (!id) return;
    addScoreRecord({ subjectId: id, date: newScoreDate, score });
    updateSubject(id, { currentScore: score });
    setNewScoreValue('');
    setShowScoreForm(false);
  };

  const handleDifficultyChange = (level: 1 | 2 | 3 | 4 | 5) => {
    if (!id) return;
    updateSubject(id, { difficulty: level });
    generateDailyPlan(todayStr);
  };

  const handleAddTextbook = () => {
    if (!id || !newTextbook.trim()) return;
    const list = [...(selected?.textbooks ?? []), newTextbook.trim()];
    updateSubject(id, { textbooks: list });
    setNewTextbook('');
  };

  const handleRemoveTextbook = (index: number) => {
    if (!id) return;
    const list = [...(selected?.textbooks ?? [])];
    list.splice(index, 1);
    updateSubject(id, { textbooks: list });
  };

  if (!id || !subject || !selected) {
    return (
      <div className="p-6">
        <p className="text-slate-500">科目が見つかりません。</p>
      </div>
    );
  }

  const currentScore = selected.currentScore;
  const targetScore = selected.targetScore;
  const diff = targetScore - currentScore;
  const gapText = diff > 0 ? `あと+${diff}点` : diff < 0 ? `${diff}点` : '達成';

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-4" style={{ color: '#0f172a' }}>
      {/* ヘッダー */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{subject.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-indigo-100 px-3 py-0.5 text-sm font-medium text-indigo-800">
            {STUDY_TYPE_LABELS[subject.studyType] ?? subject.studyType}
          </span>
          <span className="text-sm text-slate-500">
            配点 {subject.score}点 ・ 試験時間 {subject.time}分
          </span>
        </div>
      </header>

      {/* 得点推移 */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-slate-800">得点推移</h2>
        <p className="mb-4 text-2xl font-bold text-slate-800">
          現在 {currentScore}点 → 目標 {targetScore}点
          <span className="ml-2 text-lg font-normal text-slate-600">（{gapText}）</span>
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => format(new Date(v), 'M/d', { locale: ja })}
                fontSize={12}
              />
              <YAxis domain={[0, subject.score]} fontSize={12} />
              <Tooltip
                labelFormatter={(v) => format(new Date(v), 'yyyy年M月d日', { locale: ja })}
              />
              <Legend />
              <ReferenceLine
                y={targetScore}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                name="目標"
              />
              <Line
                type="monotone"
                dataKey="score"
                name="得点"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {!showScoreForm ? (
          <button
            type="button"
            onClick={() => setShowScoreForm(true)}
            className="mt-3 flex items-center gap-2 rounded-lg bg-indigo-100 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-200"
          >
            <Plus className="h-4 w-4" />
            模試結果を入力
          </button>
        ) : (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs text-slate-500">日付</label>
              <input
                type="date"
                value={newScoreDate}
                onChange={(e) => setNewScoreDate(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">得点</label>
              <input
                type="number"
                min={0}
                max={subject.score}
                value={newScoreValue}
                onChange={(e) => setNewScoreValue(e.target.value)}
                placeholder="0"
                className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleAddScore}
              className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
            >
              反映
            </button>
            <button
              type="button"
              onClick={() => setShowScoreForm(false)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600"
            >
              キャンセル
            </button>
          </div>
        )}
      </section>

      {/* 共通テスト傾向と対策 */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">
          共通テスト傾向と対策
        </h2>
        <ul className="space-y-2">
          {(subject.tips ?? []).map((tip, i) => (
            <li
              key={i}
              className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700"
            >
              {tip}
            </li>
          ))}
        </ul>
      </section>

      {/* 学習フェーズ別のやるべきこと */}
      {phase && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-slate-800">
            学習フェーズ別のやるべきこと
          </h2>
          <p className="mb-2 text-sm text-slate-600">
            現在のフェーズ：<strong>{phase.name}</strong>（{phase.condition}）
          </p>
          <p className="mb-3 text-sm text-slate-700">{phase.description}</p>
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
            {phase.rules.map((rule, i) => (
              <li key={i}>{rule}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 忘却曲線の状況 */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">忘却曲線の状況</h2>
        <p className="text-slate-700">
          復習待ちタスク：<strong>{reviewStats.total}件</strong>
        </p>
        {reviewStats.byDay.length > 0 && (
          <p className="mt-1 text-sm text-slate-600">
            次回の復習：
            {reviewStats.byDay.map(({ label, count }) => `${label} ${count}件`).join('、')}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          {(['all', 'pending', 'done'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setReviewFilter(f)}
              className={`rounded px-3 py-1 text-sm ${
                reviewFilter === f
                  ? 'bg-indigo-100 text-indigo-800'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {f === 'all' ? 'すべて' : f === 'done' ? '完了' : '未完了'}
            </button>
          ))}
        </div>
        <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
          {reviewTaskList
            .filter(({ task }) => {
              if (reviewFilter === 'done') return task.completed;
              if (reviewFilter === 'pending') return !task.completed;
              return true;
            })
            .slice(0, 20)
            .map(({ task, date }) => (
              <li
                key={task.id}
                className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="text-slate-700">{task.content}</span>
                <span className="text-slate-500">
                  {date === todayStr ? '今日' : format(new Date(date), 'M/d', { locale: ja })}{' '}
                  {task.completed ? '✓' : '—'}
                </span>
              </li>
            ))}
        </ul>
      </section>

      {/* 使用教材 */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">使用教材</h2>
        <ul className="mb-3 space-y-2">
          {(selected.textbooks ?? []).map((name, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded bg-slate-50 px-3 py-2"
            >
              <span className="text-slate-700">{name}</span>
              <button
                type="button"
                onClick={() => handleRemoveTextbook(i)}
                className="text-slate-400 hover:text-red-600"
                aria-label="削除"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTextbook}
            onChange={(e) => setNewTextbook(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTextbook()}
            placeholder="教材名を入力"
            className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleAddTextbook}
            className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> 追加
          </button>
        </div>
      </section>

      {/* 苦手度 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">苦手度</h2>
        <p className="mb-2 text-xs text-slate-500">
          変更すると今日のスケジュールの時間配分が再計算されます
        </p>
        <div className="flex gap-1">
          {([1, 2, 3, 4, 5] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => handleDifficultyChange(level)}
              className="rounded p-2 transition-colors hover:bg-amber-50"
              aria-label={`星${level}`}
            >
              <Star
                className={`h-8 w-8 ${
                  selected.difficulty >= level ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                }`}
              />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
