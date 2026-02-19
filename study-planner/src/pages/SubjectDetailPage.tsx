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
import { Star, Plus, Trash2, MoreVertical, Pencil, Pause, Play, Replace } from 'lucide-react';
import { getSubjectById } from '../constants/subjects';
import { getPhaseByDaysLeft } from '../constants/phaseConfig';
import { getPresetsForSubject } from '../constants/textbookPresets';
import {
  UNIT_LABEL_OPTIONS,
  TEXTBOOK_CATEGORY_OPTIONS,
  JAPANESE_SUBCATEGORY_OPTIONS,
  getUnitLabelDisplay,
  getCategoryDisplay,
} from '../constants/textbookLabels';
import { useStudentStore } from '../stores/studentStore';
import { useStudyStore } from '../stores/studyStore';
import { useCurriculumStore, unitLabelToDisplay } from '../stores/curriculumStore';
import { daysUntilExam } from '../utils/dateUtils';
import { generateReviewTasks } from '../utils/forgettingCurve';
import { getSubjectCategory } from '../constants/dayTemplates';
import type { StudyTask, Textbook, TextbookPreset, TextbookCategory, UnitLabel } from '../types';

const STUDY_TYPE_LABELS: Record<string, string> = {
  thinking: '思考型',
  memorization: '暗記型',
  processing: '処理速度型',
  mixed: '混合型',
};

type AddTab = 'manual' | 'template';

interface TextbookFormState {
  name: string;
  totalUnits: number;
  unitLabel: UnitLabel;
  customUnitLabel: string;
  minutesPerUnit: number;
  category: TextbookCategory;
  subCategory?: 'modern' | 'classical' | 'chinese' | 'general';
  priority: number;
  memo: string;
}

const defaultFormState: TextbookFormState = {
  name: '',
  totalUnits: 50,
  unitLabel: 'section',
  customUnitLabel: '',
  minutesPerUnit: 20,
  category: 'vocabulary',
  subCategory: 'general',
  priority: 1,
  memo: '',
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

  const getTextbooks = useCurriculumStore((s) => s.getTextbooks);
  const addTextbook = useCurriculumStore((s) => s.addTextbook);
  const updateTextbook = useCurriculumStore((s) => s.updateTextbook);
  const removeTextbook = useCurriculumStore((s) => s.removeTextbook);
  const replaceTextbook = useCurriculumStore((s) => s.replaceTextbook);
  const pauseTextbook = useCurriculumStore((s) => s.pauseTextbook);
  const resumeTextbook = useCurriculumStore((s) => s.resumeTextbook);
  const migrateFromLegacyTextbooks = useCurriculumStore((s) => s.migrateFromLegacyTextbooks);

  const subject = useMemo(() => (id ? getSubjectById(id) : undefined), [id]);
  const selected = useMemo(
    () => profile?.subjects.find((s) => s.subjectId === id),
    [profile, id]
  );

  const textbooks = useMemo(() => (id ? getTextbooks(id) : []), [id, getTextbooks]);
  const presets = useMemo(() => (id ? getPresetsForSubject(id) : []), [id]);
  const isJapanese = useMemo(() => id && getSubjectCategory(id) === 'japanese', [id]);

  const [showScoreForm, setShowScoreForm] = useState(false);
  const [newScoreDate, setNewScoreDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newScoreValue, setNewScoreValue] = useState('');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'done' | 'pending'>('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab] = useState<AddTab>('manual');
  const [formState, setFormState] = useState<TextbookFormState>(defaultFormState);
  const [templateSearch, setTemplateSearch] = useState('');

  const [editTextbook, setEditTextbook] = useState<Textbook | null>(null);
  const [replaceTextbookObj, setReplaceTextbookObj] = useState<Textbook | null>(null);
  const [deleteTextbook, setDeleteTextbook] = useState<Textbook | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  useEffect(() => {
    if (id && selected?.textbooks?.length) {
      migrateFromLegacyTextbooks(id, selected.textbooks);
    }
  }, [id, selected?.textbooks, migrateFromLegacyTextbooks]);

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

  const filteredPresets = useMemo(() => {
    if (!templateSearch.trim()) return presets;
    const q = templateSearch.toLowerCase();
    return presets.filter((p) => p.name.toLowerCase().includes(q));
  }, [presets, templateSearch]);

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

  const openAddModal = () => {
    setFormState(defaultFormState);
    setAddTab('manual');
    setTemplateSearch('');
    setShowAddModal(true);
  };

  const applyPreset = (preset: TextbookPreset) => {
    const unitLabel = preset.customUnitLabel
      ? 'custom'
      : preset.unitLabel;
    setFormState({
      name: preset.name,
      totalUnits: preset.totalUnits,
      unitLabel,
      customUnitLabel: preset.customUnitLabel ?? '',
      minutesPerUnit: preset.minutesPerUnit,
      category: preset.category,
      subCategory: isJapanese ? 'general' : undefined,
      priority: textbooks.length + 1,
      memo: '',
    });
    setAddTab('manual');
  };

  const handleAddTextbook = () => {
    if (!id || !formState.name.trim()) return;
    const unitLabel = formState.unitLabel === 'custom' ? 'custom' : formState.unitLabel;
    addTextbook(id, {
      name: formState.name.trim(),
      totalUnits: Math.max(1, formState.totalUnits),
      unitLabel,
      customUnitLabel: unitLabel === 'custom' ? formState.customUnitLabel : undefined,
      minutesPerUnit: Math.max(5, formState.minutesPerUnit),
      category: formState.category,
      subCategory: isJapanese ? formState.subCategory : undefined,
      priority: formState.priority,
      memo: formState.memo.trim() || undefined,
    });
    setShowAddModal(false);
    generateDailyPlan(todayStr);
  };

  const handleEdit = (t: Textbook) => {
    setEditTextbook(t);
    setFormState({
      name: t.name,
      totalUnits: t.totalUnits,
      unitLabel: t.unitLabel,
      customUnitLabel: t.customUnitLabel ?? '',
      minutesPerUnit: t.minutesPerUnit,
      category: t.category,
      subCategory: t.subCategory,
      priority: t.priority,
      memo: t.memo ?? '',
    });
  };

  const handleSaveEdit = () => {
    if (!editTextbook) return;
    const newTotal = Math.max(1, formState.totalUnits);
    if (newTotal < editTextbook.totalUnits && editTextbook.completedUnitCount > 0) {
      const removed = editTextbook.totalUnits - newTotal;
      if (!window.confirm(`${removed}個のユニットが削除されます。よろしいですか？`)) return;
    }
    const unitLabel = formState.unitLabel === 'custom' ? 'custom' : formState.unitLabel;
    updateTextbook(editTextbook.id, {
      name: formState.name.trim(),
      totalUnits: newTotal,
      unitLabel,
      customUnitLabel: unitLabel === 'custom' ? formState.customUnitLabel : undefined,
      minutesPerUnit: Math.max(5, formState.minutesPerUnit),
      category: formState.category,
      subCategory: isJapanese ? formState.subCategory : undefined,
      priority: formState.priority,
      memo: formState.memo.trim() || undefined,
    });
    setEditTextbook(null);
    generateDailyPlan(todayStr);
  };

  const handleReplace = (t: Textbook) => {
    setReplaceTextbookObj(t);
    setFormState({
      name: '',
      totalUnits: 50,
      unitLabel: 'section',
      customUnitLabel: '',
      minutesPerUnit: 20,
      category: 'vocabulary',
      subCategory: isJapanese ? 'general' : undefined,
      priority: t.priority,
      memo: '',
    });
    setAddTab('manual');
  };

  const handleConfirmReplace = () => {
    if (!replaceTextbookObj || !id || !formState.name.trim()) return;
    const unitLabel = formState.unitLabel === 'custom' ? 'custom' : formState.unitLabel;
    replaceTextbook(replaceTextbookObj.id, {
      name: formState.name.trim(),
      totalUnits: Math.max(1, formState.totalUnits),
      unitLabel,
      customUnitLabel: unitLabel === 'custom' ? formState.customUnitLabel : undefined,
      minutesPerUnit: Math.max(5, formState.minutesPerUnit),
      category: formState.category,
      subCategory: isJapanese ? formState.subCategory : undefined,
      priority: formState.priority,
      memo: formState.memo.trim() || undefined,
    });
    setReplaceTextbookObj(null);
    generateDailyPlan(todayStr);
  };

  const handleDelete = (t: Textbook) => {
    removeTextbook(t.id);
    setDeleteTextbook(null);
    setMenuOpenId(null);
    generateDailyPlan(todayStr);
  };

  const handlePauseResume = (t: Textbook) => {
    if (t.status === 'paused') resumeTextbook(t.id);
    else pauseTextbook(t.id);
    setMenuOpenId(null);
    generateDailyPlan(todayStr);
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

  const unitDisplay = (t: Textbook) =>
    unitLabelToDisplay(t.unitLabel, t.customUnitLabel);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-4" style={{ color: '#0f172a' }}>
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

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">共通テスト傾向と対策</h2>
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

      {phase && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-slate-800">学習フェーズ別のやるべきこと</h2>
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

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">忘却曲線の状況</h2>
        <p className="text-slate-700">復習待ちタスク：<strong>{reviewStats.total}件</strong></p>
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
                reviewFilter === f ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'
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
          {textbooks
            .sort((a, b) => a.priority - b.priority)
            .map((t) => (
              <li
                key={t.id}
                className={`relative rounded-lg border p-3 ${
                  t.status === 'paused' ? 'border-slate-200 bg-slate-50 opacity-75' : 'border-slate-100 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{t.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {getCategoryDisplay(t.category)}
                      {t.subCategory && `（${JAPANESE_SUBCATEGORY_OPTIONS.find((o) => o.value === t.subCategory)?.label}）`} ・{' '}
                      {t.completedUnitCount}/{t.totalUnits}
                      {unitDisplay(t)} ・ {t.minutesPerUnit}分
                    </p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{
                          width: `${Math.min(100, (t.completedUnitCount / t.totalUnits) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleEdit(t)}
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      aria-label="編集"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setMenuOpenId(menuOpenId === t.id ? null : t.id)}
                        className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="メニュー"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {menuOpenId === t.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setMenuOpenId(null)}
                            aria-hidden
                          />
                          <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                            <button
                              type="button"
                              onClick={() => {
                                handleReplace(t);
                                setMenuOpenId(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <Replace className="h-4 w-4" />
                              別の教材に入れ替え
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handlePauseResume(t);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                            >
                              {t.status === 'paused' ? (
                                <><Play className="h-4 w-4" />再開</>
                              ) : (
                                <><Pause className="h-4 w-4" />一時停止</>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteTextbook(t);
                                setMenuOpenId(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              この教材を削除
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {t.status === 'paused' && (
                  <span className="mt-2 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                    一時停止中
                  </span>
                )}
              </li>
            ))}
        </ul>
        <button
          type="button"
          onClick={openAddModal}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
        >
          <Plus className="h-5 w-5" />
          教材を追加
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">苦手度</h2>
        <p className="mb-2 text-xs text-slate-500">変更すると今日のスケジュールの時間配分が再計算されます</p>
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

      {/* 教材追加モーダル */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-800">教材を追加</h3>
            <div className="mb-4 flex gap-2 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setAddTab('manual')}
                className={`border-b-2 px-4 py-2 text-sm font-medium ${
                  addTab === 'manual'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500'
                }`}
              >
                自分で入力
              </button>
              <button
                type="button"
                onClick={() => setAddTab('template')}
                className={`border-b-2 px-4 py-2 text-sm font-medium ${
                  addTab === 'template'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500'
                }`}
              >
                テンプレートから選ぶ
              </button>
            </div>

            {addTab === 'manual' ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">教材名 *</label>
                  <input
                    type="text"
                    value={formState.name}
                    onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                    placeholder="例: 速読英単語 必修編"
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">全体の分量 *</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={formState.totalUnits}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, totalUnits: parseInt(e.target.value, 10) || 1 }))
                      }
                      className="w-20 rounded border border-slate-300 px-3 py-2 text-sm"
                    />
                    <select
                      value={formState.unitLabel}
                      onChange={(e) => {
                        const v = e.target.value as UnitLabel;
                        setFormState((s) => ({ ...s, unitLabel: v }));
                      }}
                      className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
                    >
                      {UNIT_LABEL_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {formState.unitLabel === 'custom' && (
                    <input
                      type="text"
                      value={formState.customUnitLabel}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, customUnitLabel: e.target.value }))
                      }
                      placeholder="単位名を入力"
                      className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    />
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    1単元あたりの目安時間 *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={5}
                      value={formState.minutesPerUnit}
                      onChange={(e) =>
                        setFormState((s) => ({
                          ...s,
                          minutesPerUnit: parseInt(e.target.value, 10) || 5,
                        }))
                      }
                      className="w-20 rounded border border-slate-300 px-3 py-2 text-sm"
                    />
                    <span className="text-sm text-slate-500">分</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    実際にやってみて合わなければ後から変更できます
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">種類</label>
                  <select
                    value={formState.category}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        category: e.target.value as TextbookCategory,
                      }))
                    }
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  >
                    {TEXTBOOK_CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                {isJapanese && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">分野</label>
                    <select
                      value={formState.subCategory ?? 'general'}
                      onChange={(e) =>
                        setFormState((s) => ({
                          ...s,
                          subCategory: e.target.value as 'modern' | 'classical' | 'chinese' | 'general',
                        }))
                      }
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    >
                      {JAPANESE_SUBCATEGORY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">メモ（任意）</label>
                  <input
                    type="text"
                    value={formState.memo}
                    onChange={(e) => setFormState((s) => ({ ...s, memo: e.target.value }))}
                    placeholder="例: 学校の先生に勧められた教材"
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-2 text-sm text-slate-600">
                  ※ あくまで参考です。選んだ後に自由に変更できます
                </p>
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="検索"
                  className="mb-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
                <ul className="max-h-64 space-y-2 overflow-y-auto">
                  {filteredPresets.map((preset) => (
                    <li
                      key={preset.name + preset.applicableSubjectIds.join(',')}
                      className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
                    >
                      <div>
                        <p className="font-medium text-slate-800">{preset.name}</p>
                        <p className="text-sm text-slate-500">
                          {getCategoryDisplay(preset.category)} /{' '}
                          {preset.totalUnits}
                          {getUnitLabelDisplay(preset.unitLabel)} / {preset.minutesPerUnit}分
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
                      >
                        これをベースに追加
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600"
              >
                キャンセル
              </button>
              {addTab === 'manual' && (
                <button
                  type="button"
                  onClick={handleAddTextbook}
                  disabled={!formState.name.trim()}
                  className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  追加する
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 教材編集モーダル */}
      {editTextbook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-800">教材を編集</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">教材名 *</label>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">全体の分量 *</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    value={formState.totalUnits}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, totalUnits: parseInt(e.target.value, 10) || 1 }))
                    }
                    className="w-20 rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={formState.unitLabel}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, unitLabel: e.target.value as UnitLabel }))
                    }
                    className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
                  >
                    {UNIT_LABEL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                {formState.unitLabel === 'custom' && (
                  <input
                    type="text"
                    value={formState.customUnitLabel}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, customUnitLabel: e.target.value }))
                    }
                    placeholder="単位名を入力"
                    className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  1単元あたりの目安時間 *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    value={formState.minutesPerUnit}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        minutesPerUnit: parseInt(e.target.value, 10) || 5,
                      }))
                    }
                    className="w-20 rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                  <span className="text-sm text-slate-500">分</span>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">種類</label>
                <select
                  value={formState.category}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, category: e.target.value as TextbookCategory }))
                  }
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  {TEXTBOOK_CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {isJapanese && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">分野</label>
                  <select
                    value={formState.subCategory ?? 'general'}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        subCategory: e.target.value as 'modern' | 'classical' | 'chinese' | 'general',
                      }))
                    }
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  >
                    {JAPANESE_SUBCATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">優先度</label>
                <input
                  type="number"
                  min={1}
                  value={formState.priority}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, priority: parseInt(e.target.value, 10) || 1 }))
                  }
                  className="w-20 rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditTextbook(null)}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 教材入れ替えモーダル */}
      {replaceTextbookObj && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-800">教材の入れ替え</h3>
            <p className="mb-2 text-sm text-slate-700">
              現在: {replaceTextbookObj.name}（{replaceTextbookObj.completedUnitCount}/
              {replaceTextbookObj.totalUnits}
              {unitDisplay(replaceTextbookObj)}完了）
            </p>
            <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              ⚠️ 進捗は引き継げません。新しい教材は最初から開始になります。
              （旧教材の完了記録は履歴として残ります）
            </div>
            <div className="mb-4 flex gap-2 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setAddTab('manual')}
                className={`border-b-2 px-4 py-2 text-sm font-medium ${
                  addTab === 'manual'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500'
                }`}
              >
                自分で入力
              </button>
              <button
                type="button"
                onClick={() => setAddTab('template')}
                className={`border-b-2 px-4 py-2 text-sm font-medium ${
                  addTab === 'template'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500'
                }`}
              >
                テンプレートから選ぶ
              </button>
            </div>
            {addTab === 'manual' ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">新しい教材名 *</label>
                  <input
                    type="text"
                    value={formState.name}
                    onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                    placeholder="例: システム英単語"
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">全体の分量 *</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={formState.totalUnits}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, totalUnits: parseInt(e.target.value, 10) || 1 }))
                      }
                      className="w-20 rounded border border-slate-300 px-3 py-2 text-sm"
                    />
                    <select
                      value={formState.unitLabel}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, unitLabel: e.target.value as UnitLabel }))
                      }
                      className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
                    >
                      {UNIT_LABEL_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    1単元あたりの目安時間 *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={5}
                      value={formState.minutesPerUnit}
                      onChange={(e) =>
                        setFormState((s) => ({
                          ...s,
                          minutesPerUnit: parseInt(e.target.value, 10) || 5,
                        }))
                      }
                      className="w-20 rounded border border-slate-300 px-3 py-2 text-sm"
                    />
                    <span className="text-sm text-slate-500">分</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">種類</label>
                  <select
                    value={formState.category}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, category: e.target.value as TextbookCategory }))
                    }
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  >
                    {TEXTBOOK_CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                {isJapanese && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">分野</label>
                    <select
                      value={formState.subCategory ?? 'general'}
                      onChange={(e) =>
                        setFormState((s) => ({
                          ...s,
                          subCategory: e.target.value as 'modern' | 'classical' | 'chinese' | 'general',
                        }))
                      }
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    >
                      {JAPANESE_SUBCATEGORY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="検索"
                  className="mb-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
                <ul className="max-h-48 space-y-2 overflow-y-auto">
                  {filteredPresets.map((preset) => (
                    <li
                      key={preset.name + preset.applicableSubjectIds.join(',')}
                      className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
                    >
                      <div>
                        <p className="font-medium text-slate-800">{preset.name}</p>
                        <p className="text-sm text-slate-500">
                          {getCategoryDisplay(preset.category)} / {preset.totalUnits}
                          {getUnitLabelDisplay(preset.unitLabel)} / {preset.minutesPerUnit}分
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
                      >
                        これをベースに追加
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReplaceTextbookObj(null)}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600"
              >
                キャンセル
              </button>
              {addTab === 'manual' && (
                <button
                  type="button"
                  onClick={handleConfirmReplace}
                  disabled={!formState.name.trim()}
                  className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  入れ替える
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 削除確認ダイアログ */}
      {deleteTextbook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-slate-800">教材を削除</h3>
            <p className="mb-4 text-sm text-slate-600">
              {deleteTextbook.name} を削除しますか？完了記録も全て削除されます。
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTextbook(null)}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteTextbook)}
                className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
