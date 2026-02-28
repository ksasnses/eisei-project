import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Trophy, Building2, CalendarCheck } from 'lucide-react';
import { useStudentStore } from '../stores/studentStore';
import { useStudyStore } from '../stores/studyStore';
import {
  getWeekStart,
  getWeekDates,
  addWeeks,
  subWeeks,
  isSameDay,
  formatDateForInput,
} from '../utils/dateUtils';
import { determineDayType } from '../utils/scheduleEngine';
import { getAdjustedTemplate } from '../constants/dayTemplates';
import { isSummerVacation } from '../utils/scheduleUtils';
import { useRuleConfigStore } from '../stores/ruleConfigStore';
import type { EventDate, EventType, StudyTask } from '../types';
import type { DayType } from '../types';

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  tennis_match: 'テニスの試合',
  school_event: '学校行事',
  regular_test: '定期テスト',
  mock_exam: '模試',
  other: 'その他',
};

/** 科目カテゴリごとのブロック色（カレンダー用: 英語=青, 数学=赤, 国語=緑, 理科=紫, 社会=オレンジ, 情報=グレー） */
const SUBJECT_CATEGORY_BG: Record<string, string> = {
  english: 'bg-blue-500',
  math: 'bg-red-500',
  japanese: 'bg-green-500',
  science: 'bg-purple-500',
  social: 'bg-orange-500',
  info: 'bg-gray-500',
  review: 'bg-amber-400',
};

/** 日種別アイコン */
const DAY_TYPE_ICON: Record<DayType, string> = {
  weekday_club: '🎾',
  weekday_no_club: '📚',
  weekend_holiday: '📅',
  summer_club: '🎾',
  summer_no_club: '🌻',
  match_day: '🏆',
  event_day: '📅',
};

/** 指定日のイベント一覧（その日に含まれるもの） */
function getEventsOnDate(events: EventDate[], dateStr: string): EventDate[] {
  const d = parseISO(dateStr);
  d.setHours(0, 0, 0, 0);
  return events.filter((e) => {
    const start = parseISO(e.date);
    start.setHours(0, 0, 0, 0);
    const end = addDays(start, e.durationDays);
    return d >= start && d < end;
  });
}

export function CalendarPage() {
  const profile = useStudentStore((s) => s.profile);
  const events = useStudentStore((s) => s.events);
  useRuleConfigStore((s) => s.config); // 設定変更時に再描画
  const addEvent = useStudentStore((s) => s.addEvent);
  const mockExamSchedule = useStudentStore((s) => s.mockExamSchedule);
  const setMockExamSchedule = useStudentStore((s) => s.setMockExamSchedule);
  const dailyPlans = useStudyStore((s) => s.dailyPlans);
  const generateDailyPlan = useStudyStore((s) => s.generateDailyPlan);
  const streakDays = useStudyStore((s) => s.streakDays);

  const today = useMemo(() => new Date(), []);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const [showEventModal, setShowEventModal] = useState(false);
  const [showMockExamModal, setShowMockExamModal] = useState(false);
  const [mockExamForm, setMockExamForm] = useState({
    day1Date: mockExamSchedule?.day1Date ?? formatDateForInput(today),
    day2Date: mockExamSchedule?.day2Date ?? formatDateForInput(addDays(today, 1)),
  });
  const [eventForm, setEventForm] = useState({
    title: '',
    date: formatDateForInput(today),
    type: 'other' as EventType,
    durationDays: 1,
    note: '',
  });

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const isThisWeek = isSameDay(weekStart, getWeekStart(today));

  const goPrevWeek = () => setWeekStart((d) => subWeeks(d, 1));
  const goNextWeek = () => setWeekStart((d) => addWeeks(d, 1));
  const goThisWeek = () => setWeekStart(getWeekStart(today));

  // 表示週の日付の計画を生成
  useEffect(() => {
    if (!profile) return;
    weekDates.forEach((d) => {
      const dateStr = format(d, 'yyyy-MM-dd');
      if (!dailyPlans[dateStr]) generateDailyPlan(dateStr);
    });
  }, [profile, weekDates, dailyPlans, generateDailyPlan]);

  const weekRangeLabel =
    weekDates.length === 7
      ? `${format(weekDates[0], 'M月d日', { locale: ja })} 〜 ${format(weekDates[6], 'M月d日', { locale: ja })}`
      : '';

  const handleSaveEvent = () => {
    if (!eventForm.title.trim()) return;
    const newEvent: EventDate = {
      id: crypto.randomUUID?.() ?? `ev-${Date.now()}`,
      title: eventForm.title.trim(),
      date: eventForm.date,
      type: eventForm.type,
      durationDays: Math.max(1, eventForm.durationDays),
      note: eventForm.note.trim() || undefined,
    };
    addEvent(newEvent);
    const start = parseISO(newEvent.date);
    for (let i = 0; i < newEvent.durationDays; i++) {
      const d = addDays(start, i);
      const dateStr = format(d, 'yyyy-MM-dd');
      generateDailyPlan(dateStr);
      const prev = addDays(d, -1);
      generateDailyPlan(format(prev, 'yyyy-MM-dd'));
    }
    setShowEventModal(false);
    setEventForm({
      title: '',
      date: formatDateForInput(today),
      type: 'other',
      durationDays: 1,
      note: '',
    });
  };

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-4">
      {/* 週の切り替え */}
      <section className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrevWeek}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50"
            aria-label="前の週"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={goThisWeek}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              isThisWeek
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50'
            }`}
          >
            今週
          </button>
          <button
            type="button"
            onClick={goNextWeek}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50"
            aria-label="次の週"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm font-medium text-slate-600">{weekRangeLabel}</p>
        <button
          type="button"
          onClick={() => {
            setMockExamForm({
              day1Date: mockExamSchedule?.day1Date ?? formatDateForInput(today),
              day2Date: mockExamSchedule?.day2Date ?? formatDateForInput(addDays(today, 1)),
            });
            setShowMockExamModal(true);
          }}
          className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
        >
          <CalendarCheck className="h-4 w-4" />
          仮本番を設定
        </button>
      </section>

      {mockExamSchedule && (
        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
          <span className="text-sm text-slate-600">仮本番:</span>
          <Link
            to="/timer?mode=exam&day=1"
            className="rounded bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
          >
            1日目を開始
          </Link>
          <Link
            to="/timer?mode=exam&day=2"
            className="rounded bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
          >
            2日目を開始
          </Link>
          <span className="text-xs text-slate-500">
            {format(parseISO(mockExamSchedule.day1Date), 'M/d', { locale: ja })}・
            {format(parseISO(mockExamSchedule.day2Date), 'M/d', { locale: ja })}
          </span>
        </section>
      )}

      {/* 週間グリッド: PC 7列 / スマホ 横スクロール 最小幅 */}
      <section className="overflow-x-auto">
        <div className="grid min-w-[320px] grid-cols-3 gap-3 md:grid-cols-7 md:min-w-0">
          {weekDates.map((d) => {
            const dateStr = format(d, 'yyyy-MM-dd');
            const plan = dailyPlans[dateStr];
            const dayEvents = getEventsOnDate(events, dateStr);
            const dayType = profile
              ? determineDayType(profile, events, dateStr)
              : 'weekday_no_club';
            const template = profile
              ? getAdjustedTemplate(dayType, profile.subjects.map((s) => s.subjectId)).template
              : null;
            const isSummer = profile
              ? isSummerVacation(profile.dailySchedule, dateStr)
              : false;
            const availableHours =
              plan != null
                ? (plan.availableMinutes / 60).toFixed(1)
                : '—';
            const isToday = isSameDay(d, today);
            const studyBlocks = template?.blocks.filter((b) => b.subjectCategory !== 'review') ?? [];
            const totalBlockMinutes = studyBlocks.reduce((s, b) => s + b.durationMinutes, 0);

            return (
              <div
                key={dateStr}
                className={`flex flex-col rounded-xl border p-3 shadow-sm ${
                  isSummer ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'
                } ${isToday ? 'ring-2 ring-indigo-400' : ''}`}
              >
                <div className="mb-2 border-b border-slate-100 pb-2">
                  <div className="text-lg font-bold text-slate-800">
                    {format(d, 'd')}
                  </div>
                  <div className="text-xs text-slate-500">
                    {WEEKDAY_LABELS[(d.getDay() + 6) % 7]}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className="text-base" title={dayType}>
                      {DAY_TYPE_ICON[dayType]}
                    </span>
                    {dayEvents.map((ev) => (
                      <span
                        key={ev.id}
                        className="inline-flex items-center gap-0.5 text-xs"
                        title={ev.title}
                      >
                        {ev.type === 'tennis_match' ? (
                          <Trophy className="h-3.5 w-3 text-amber-600" />
                        ) : (
                          <Building2 className="h-3.5 w-3 text-slate-500" />
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-slate-500">
                  勉強可能 {availableHours}h
                </div>

                {/* タスク vs ゆとりのプログレスバー */}
                {plan && (() => {
                  const raw = plan.rawAvailableMinutes ?? plan.availableMinutes ?? 0;
                  if (raw <= 0) return null;
                  const taskTotal = plan.tasks.reduce((s, t) => s + t.estimatedMinutes, 0);
                  const buffer = plan.bufferMinutes ?? 0;
                  const taskPct = Math.min(100, (taskTotal / raw) * 100);
                  const bufferPct = Math.min(100 - taskPct, (buffer / raw) * 100);
                  return (
                    <div
                      className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200"
                      title={`タスク: ${taskTotal}分 / ゆとり: ${buffer}分`}
                    >
                      <div className="flex h-full">
                        <div className="bg-blue-600" style={{ width: `${taskPct}%` }} />
                        <div className="bg-blue-300" style={{ width: `${bufferPct}%` }} />
                      </div>
                    </div>
                  );
                })()}

                {/* テンプレートの科目ブロックを色分け表示（高さは時間に比例） */}
                <div className="mt-2 h-[140px] space-y-1 overflow-y-auto">
                  {studyBlocks.length > 0 ? (
                    (() => {
                      const total = totalBlockMinutes || 1;
                      const baseH = 136;
                      return studyBlocks.map((block, idx) => {
                        const h = Math.max(20, (block.durationMinutes / total) * baseH);
                        const bg = SUBJECT_CATEGORY_BG[block.subjectCategory] ?? 'bg-gray-400';
                        return (
                          <div
                            key={`${block.subjectCategory}-${block.order}-${idx}`}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium text-white ${bg}`}
                            style={{ minHeight: h }}
                            title={`${block.label ?? block.subjectCategory} ${block.durationMinutes}分`}
                          >
                            {block.label?.replace(/\s*\d+\.?\d*h?\s*$/, '') ?? block.subjectCategory}
                          </div>
                        );
                      });
                    })()
                  ) : (
                    <div className="rounded bg-slate-100 py-4 text-center text-xs text-slate-400">
                      予定なし
                    </div>
                  )}
                </div>

                {/* 達成率 */}
                {plan && plan.tasks.length > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>達成</span>
                      <span>{Math.round(plan.completionRate)}%</span>
                    </div>
                    <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${plan.completionRate}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 今月の全体ビュー */}
      <MonthMiniView
        currentMonth={weekStart}
        dailyPlans={dailyPlans}
        events={events}
        streakDays={streakDays}
      />

      {/* フローティング イベント追加ボタン */}
      <button
        type="button"
        onClick={() => setShowEventModal(true)}
        className="fixed bottom-20 right-6 flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-white shadow-lg hover:bg-indigo-700"
      >
        <Plus className="h-5 w-5" />
        <span className="font-medium">イベント追加</span>
      </button>

      {/* イベント追加モーダル */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">イベントを追加</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600">
                  イベント名
                </label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) =>
                    setEventForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="例: テニス県大会"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600">
                  日付
                </label>
                <input
                  type="date"
                  value={eventForm.date}
                  onChange={(e) =>
                    setEventForm((f) => ({ ...f, date: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600">
                  種類
                </label>
                <select
                  value={eventForm.type}
                  onChange={(e) =>
                    setEventForm((f) => ({
                      ...f,
                      type: e.target.value as EventType,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  {(Object.entries(EVENT_TYPE_LABELS) as [EventType, string][]).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600">
                  期間（日数）
                </label>
                <input
                  type="number"
                  min={1}
                  value={eventForm.durationDays}
                  onChange={(e) =>
                    setEventForm((f) => ({
                      ...f,
                      durationDays: Math.max(1, parseInt(e.target.value, 10) || 1),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600">
                  メモ（任意）
                </label>
                <textarea
                  value={eventForm.note}
                  onChange={(e) =>
                    setEventForm((f) => ({ ...f, note: e.target.value }))
                  }
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="備考"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                className="flex-1 rounded-lg border border-slate-300 py-2 text-slate-600 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSaveEvent}
                disabled={!eventForm.title.trim()}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showMockExamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">仮本番の日程を設定</h3>
            <p className="mt-1 text-sm text-slate-500">
              共通テスト本番と同じ時間割でタイマーを実施できます
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600">1日目</label>
                <input
                  type="date"
                  value={mockExamForm.day1Date}
                  onChange={(e) =>
                    setMockExamForm((f) => ({ ...f, day1Date: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600">2日目</label>
                <input
                  type="date"
                  value={mockExamForm.day2Date}
                  onChange={(e) =>
                    setMockExamForm((f) => ({ ...f, day2Date: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowMockExamModal(false)}
                className="flex-1 rounded-lg border border-slate-300 py-2 text-slate-600 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  setMockExamSchedule({
                    day1Date: mockExamForm.day1Date,
                    day2Date: mockExamForm.day2Date,
                  });
                  setShowMockExamModal(false);
                }}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-white hover:bg-indigo-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 今月のミニ月間ビュー */
function MonthMiniView({
  currentMonth,
  dailyPlans,
  events,
  streakDays,
}: {
  currentMonth: Date;
  dailyPlans: Record<string, { completionRate: number; tasks: StudyTask[] }>;
  events: EventDate[];
  streakDays: number;
}) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const daysInMonth = last.getDate();
  const totalCells = startPad + daysInMonth;
  const rows = Math.ceil(totalCells / 7);

  const cells: { date: Date | null; dateStr: string }[] = [];
  for (let i = 0; i < startPad; i++) cells.push({ date: null, dateStr: '' });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({ date, dateStr: format(date, 'yyyy-MM-dd') });
  }
  while (cells.length < rows * 7) cells.push({ date: null, dateStr: '' });

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm overflow-x-auto">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">
        {year}年{month + 1}月
        {streakDays > 0 && (
          <span className="ml-2 text-xs font-normal text-amber-600">
            連続学習 {streakDays} 日
          </span>
        )}
      </h3>
      <div className="grid min-w-[360px] grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="text-xs font-medium text-slate-400">
            {w}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell.date) return <div key={i} />;
          const plan = dailyPlans[cell.dateStr];
          const dayEvents = getEventsOnDate(events, cell.dateStr);
          const hasMatch = dayEvents.some((e) => e.type === 'tennis_match');
          const completed =
            plan &&
            plan.tasks.length > 0 &&
            plan.tasks.every((t) => t.completed);
          const mark = hasMatch ? '🎾' : completed ? '✓' : '━';
          return (
            <div
              key={i}
              className="flex flex-col items-center justify-center rounded p-1 text-xs"
              title={cell.dateStr}
            >
              <span className="text-slate-600">{cell.date.getDate()}</span>
              <span
                className={
                  completed ? 'text-green-600' : hasMatch ? 'text-amber-600' : 'text-slate-400'
                }
              >
                {mark}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
