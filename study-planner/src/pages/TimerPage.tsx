import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import {
  getSubjectById,
  getExamSlotsForDay,
  EXAM_DAY1_ORDER,
  EXAM_DAY2_ORDER,
  type ExamSlot,
} from '../constants/subjects';
import { usePomodoroStore } from '../stores/pomodoroStore';
import { useStudyStore } from '../stores/studyStore';
import { useStudentStore } from '../stores/studentStore';
import { format } from 'date-fns';
import type { StudyTask } from '../types';

const CATEGORY_COLORS: Record<string, string> = {
  地歴公民: 'bg-amber-100 text-amber-800',
  国語: 'bg-green-100 text-green-800',
  外国語: 'bg-blue-100 text-blue-800',
  理科: 'bg-purple-100 text-purple-800',
  数学: 'bg-indigo-100 text-indigo-800',
  情報: 'bg-slate-100 text-slate-800',
};

const TYPE_LABELS: Record<StudyTask['type'], string> = {
  new: '新規学習',
  review: '復習',
  exam_practice: '演習',
  speed_training: '処理速度',
};

const POMODORO_TYPE_LABELS: Record<string, string> = {
  thinking: '思考型 30分+7分休憩',
  memorization: '暗記型 20分+5分休憩',
  processing: '処理速度型 25分+5分休憩',
  exam_practice: '本番形式演習',
};

function formatRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 仮本番モード（共通テスト時間割） */
function ExamTimerView({
  day,
  slots,
  examDate,
  onComplete,
}: {
  day: 1 | 2;
  slots: ExamSlot[];
  examDate: string;
  onComplete: (scores: Record<string, number>, total: number) => void;
}) {
  const [slotIndex, setSlotIndex] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [pausedRemaining, setPausedRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slot = slots[slotIndex];

  const getRemaining = (): number => {
    if (!slot) return 0;
    if (pausedAt !== null) return pausedRemaining;
    if (startedAt === null) return slot.durationSeconds;
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    return Math.max(0, slot.durationSeconds - elapsed);
  };
  const [displaySeconds, setDisplaySeconds] = useState(slot?.durationSeconds ?? 0);

  useEffect(() => {
    if (!slot) return;
    setDisplaySeconds(pausedAt !== null ? pausedRemaining : slot.durationSeconds);
  }, [slotIndex, slot?.durationSeconds, startedAt, pausedAt, pausedRemaining]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const r = getRemaining();
      setDisplaySeconds(r);
      if (r <= 0 && slot && startedAt !== null && pausedAt === null) {
        if (slotIndex < slots.length - 1) {
          const nextSlot = slots[slotIndex + 1];
          setSlotIndex((i) => i + 1);
          setPausedAt(null);
          if (nextSlot?.type === 'break') {
            setStartedAt(Date.now());
            setDisplaySeconds(nextSlot.durationSeconds);
          } else {
            setStartedAt(null);
          }
        }
      }
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [slotIndex, startedAt, pausedAt, slots.length, slot?.durationSeconds]);

  useEffect(() => {
    if (slot?.type === 'break' && startedAt === null && pausedAt === null)
      setStartedAt(Date.now());
  }, [slotIndex, slot?.type]);

  const handleStart = () => setStartedAt(Date.now());
  const handlePause = () => {
    setPausedAt(Date.now());
    setPausedRemaining(getRemaining());
  };
  const handleResume = () => {
    if (pausedRemaining <= 0) return;
    setStartedAt(Date.now());
    setPausedAt(null);
    setDisplaySeconds(pausedRemaining);
  };
  const handleSkipBreak = () => {
    if (slot?.type === 'break') {
      if (slotIndex < slots.length - 1) {
        setSlotIndex((i) => i + 1);
        setStartedAt(null);
        setPausedAt(null);
      }
    }
  };

  if (slots.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="text-center text-slate-600">この日の受験科目がありません</p>
        <Link to="/calendar" className="mt-4 block text-center text-blue-600">
          カレンダーへ
        </Link>
      </div>
    );
  }

  if (slotIndex >= slots.length) {
    return (
      <ExamScoreForm
        day={day}
        examDate={examDate}
        slots={slots}
        onSubmit={onComplete}
      />
    );
  }

  const progress =
    slot.durationSeconds > 0
      ? (100 * (slot.durationSeconds - displaySeconds)) / slot.durationSeconds
      : 0;
  const ringColor =
    displaySeconds <= 5 * 60 ? '#f97316' : slot.type === 'break' ? '#22c55e' : '#2563eb';

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">仮本番 {day}日目</p>
        <p className="text-xl font-bold text-slate-800">
          {slot.type === 'subject' ? slot.name : '休憩'}
        </p>
        <p className="mt-1 text-slate-500">
          {slotIndex + 1} / {slots.length}
        </p>
      </section>
      <section className="mb-8 flex flex-col items-center">
        <div className="h-64 w-64">
          <CircularProgressbar
            value={progress}
            text={formatRemaining(displaySeconds)}
            strokeWidth={10}
            styles={{
              path: { stroke: ringColor },
              text: { fill: '#0f172a', fontSize: '28px', fontWeight: 700 },
              trail: { stroke: '#e2e8f0' },
            }}
          />
        </div>
      </section>
      {slot.type === 'break' ? (
        <div className="text-center">
          <p className="mb-4 text-slate-600">休憩時間です</p>
          <button
            type="button"
            onClick={handleSkipBreak}
            className="rounded-xl bg-green-500 px-6 py-3 font-medium text-white"
          >
            次の科目へ
          </button>
        </div>
      ) : (
        <div className="flex justify-center gap-4">
          {!startedAt && (
            <button
              type="button"
              onClick={handleStart}
              className="rounded-xl bg-blue-500 px-8 py-4 text-lg font-medium text-white"
            >
              開始
            </button>
          )}
          {startedAt && !pausedAt && (
            <button
              type="button"
              onClick={handlePause}
              className="rounded-xl bg-slate-200 px-8 py-4 text-lg font-medium text-slate-800"
            >
              一時停止
            </button>
          )}
          {pausedAt !== null && (
            <button
              type="button"
              onClick={handleResume}
              className="rounded-xl bg-blue-500 px-8 py-4 text-lg font-medium text-white"
            >
              再開
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ExamScoreForm({
  day,
  examDate,
  slots,
  onSubmit,
}: {
  day: 1 | 2;
  examDate: string;
  slots: ExamSlot[];
  onSubmit: (scores: Record<string, number>, total: number) => void;
}) {
  const subjectSlots = slots.filter((s): s is ExamSlot & { subjectId: string; name: string } => s.type === 'subject' && s.subjectId != null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const navigate = useNavigate();
  const addMockExamResult = useStudentStore((s) => s.addMockExamResult);
  const mockExamResults = useStudentStore((s) => s.mockExamResults);

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const prevSameDay = mockExamResults.find((r) => r.day === day);

  const handleSubmit = () => {
    addMockExamResult({
      date: examDate,
      day,
      scores: { ...scores },
      total,
      completedAt: new Date().toISOString(),
    });
    onSubmit(scores, total);
    navigate('/calendar', { replace: true });
  };

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-bold text-slate-800">
          仮本番 {day}日目 得点入力
        </h2>
        <div className="space-y-4">
          {subjectSlots.map((s) => (
            <div key={s.subjectId} className="flex items-center justify-between gap-4">
              <label className="font-medium text-slate-700">{s.name}</label>
              <input
                type="number"
                min={0}
                max={getSubjectById(s.subjectId)?.score ?? 100}
                value={scores[s.subjectId] ?? ''}
                onChange={(e) =>
                  setScores((prev) => ({
                    ...prev,
                    [s.subjectId]: Math.max(0, parseInt(e.target.value, 10) || 0),
                  }))
                }
                className="w-24 rounded border border-slate-300 px-3 py-2 text-right"
              />
            </div>
          ))}
        </div>
        <p className="mt-4 text-lg font-bold text-slate-800">
          合計: {total} 点
          {prevSameDay != null && (
            <span className="ml-2 text-sm font-normal text-slate-600">
              （前回 {day}日目: {prevSameDay.total}点
              {total > prevSameDay.total ? ' → +' + (total - prevSameDay.total) : ''}）
            </span>
          )}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/calendar')}
            className="flex-1 rounded-lg border border-slate-300 py-2 text-slate-600"
          >
            スキップ
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 rounded-lg bg-blue-500 py-2 font-medium text-white"
          >
            保存してカレンダーへ
          </button>
        </div>
      </div>
    </div>
  );
}

export function TimerPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const taskFromState = location.state?.task as StudyTask | undefined;
  const mode = searchParams.get('mode');
  const examDay = searchParams.get('day');
  const profile = useStudentStore((s) => s.profile);
  const mockExamSchedule = useStudentStore((s) => s.mockExamSchedule);

  if (mode === 'exam' && (examDay === '1' || examDay === '2') && profile && mockExamSchedule) {
    const day = examDay === '1' ? 1 : 2;
    const subjectIds = profile.subjects.map((s) => s.subjectId);
    const order = day === 1 ? EXAM_DAY1_ORDER : EXAM_DAY2_ORDER;
    const slots = getExamSlotsForDay(subjectIds, order);
    const examDate = day === 1 ? mockExamSchedule.day1Date : mockExamSchedule.day2Date;
    return (
      <ExamTimerView
        day={day}
        slots={slots}
        examDate={examDate}
        onComplete={() => {}}
      />
    );
  }

  if (mode === 'exam' && profile && !mockExamSchedule) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="text-center text-slate-600">仮本番の日程が未設定です</p>
        <Link to="/calendar" className="mt-4 block text-center text-blue-600">
          カレンダーで設定
        </Link>
      </div>
    );
  }

  const dailyPlans = useStudyStore((s) => s.dailyPlans);
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayPlan = dailyPlans[today];
  const tasks = todayPlan?.tasks ?? [];

  const {
    currentTask,
    isRunning,
    remainingSeconds,
    totalSeconds,
    currentSet,
    isBreak,
    isCompleted,
    startPomodoro,
    pausePomodoro,
    resumePomodoro,
    skipBreak,
    completePomodoro,
    abortPomodoro,
    tick,
    getEffectiveRemaining,
  } = usePomodoroStore();

  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [abortConfirm, setAbortConfirm] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedRef = useRef(false);

  const task = currentTask ?? taskFromState;

  useEffect(() => {
    if (taskFromState && !currentTask && !isCompleted) {
      startPomodoro(taskFromState);
    }
  }, [taskFromState?.id]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      tick();
      setDisplaySeconds(getEffectiveRemaining());
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tick, getEffectiveRemaining]);

  useEffect(() => {
    setDisplaySeconds(getEffectiveRemaining());
  }, [remainingSeconds, totalSeconds, isRunning, getEffectiveRemaining]);

  useEffect(() => {
    if (displaySeconds > 0 || isCompleted) return;
    if (notifiedRef.current) return;
    notifiedRef.current = true;
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('ポモドーロタイマー', {
          body: isBreak ? '休憩が終わりました。次のセットを始めましょう。' : 'お疲れさまでした！休憩しましょう。',
        });
      } catch {
        // ignore
      }
    }
  }, [displaySeconds, isBreak, isCompleted]);

  useEffect(() => {
    if (!isBreak && totalSeconds > 0 && displaySeconds === totalSeconds)
      notifiedRef.current = false;
  }, [isBreak, totalSeconds, displaySeconds]);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleAbort = () => {
    if (abortConfirm) {
      abortPomodoro();
      setAbortConfirm(false);
      navigate('/', { replace: true });
    } else {
      setAbortConfirm(true);
      const t = setTimeout(() => setAbortConfirm(false), 3000);
      return () => clearTimeout(t);
    }
  };

  const nextTask = task && tasks.length > 0
    ? tasks.find((t) => !t.completed && t.id !== task.id)
    : null;

  const handleCompleteAndNext = () => {
    completePomodoro();
    if (nextTask) {
      startPomodoro(nextTask);
      setAbortConfirm(false);
      notifiedRef.current = false;
    } else {
      navigate('/', { replace: true });
    }
  };

  const handleCompleteAndDashboard = () => {
    completePomodoro();
    navigate('/', { replace: true });
  };

  if (!task && !currentTask) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <p className="mb-4 text-slate-600">タイマーを開始するタスクがありません</p>
        <Link to="/" className="rounded-lg bg-blue-500 px-4 py-2 text-white">
          ダッシュボードへ
        </Link>
      </div>
    );
  }

  const subject = task ? getSubjectById(task.subjectId) : null;
  const categoryColor = subject
    ? CATEGORY_COLORS[subject.category] ?? 'bg-slate-100 text-slate-800'
    : 'bg-slate-100 text-slate-800';
  const typeLabel = POMODORO_TYPE_LABELS[task?.pomodoroType ?? 'thinking'] ?? '';

  if (isCompleted && currentTask) {
    const completedTask = currentTask;
    const elapsed = completedTask.estimatedMinutes;
    return (
      <div className="mx-auto max-w-lg px-4 pb-24 pt-8">
        <div className="pomodoro-done rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
          <div className="mb-6 text-6xl">🎉</div>
          <h1 className="mb-2 text-2xl font-bold text-slate-800">
            ポモドーロ完了！
          </h1>
          <p className="mb-6 text-slate-600">
            かかった時間: 約{elapsed}分
          </p>
          <div className="flex flex-col gap-3">
            {nextTask && (
              <button
                type="button"
                onClick={handleCompleteAndNext}
                className="rounded-xl bg-blue-500 px-6 py-4 font-medium text-white"
              >
                次のタスクへ
              </button>
            )}
            <button
              type="button"
              onClick={handleCompleteAndDashboard}
              className="rounded-xl border border-slate-200 bg-white px-6 py-4 font-medium text-slate-700"
            >
              ダッシュボードに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  const effectiveTotal = totalSeconds || 1;
  const progress = Math.min(
    100,
    (100 * (effectiveTotal - displaySeconds)) / effectiveTotal
  );
  const ringColor =
    displaySeconds <= 5 * 60
      ? '#f97316'
      : isBreak
        ? '#22c55e'
        : '#2563eb';

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      {/* タスク情報 */}
      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-4">
        <span
          className={`inline-block rounded-lg px-3 py-1.5 text-sm font-medium ${categoryColor}`}
        >
          {subject?.name ?? task?.subjectId}
        </span>
        <p className="mt-2 text-lg font-semibold text-slate-800">
          {task?.content}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
          <span>
            {task?.reviewSource
              ? `復習 ${task.reviewSource.reviewNumber}回目`
              : TYPE_LABELS[task?.type ?? 'new']}
          </span>
          <span>{typeLabel}</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {currentSet}/{task?.pomodoroCount ?? 1} セット目
        </p>
      </section>

      {/* 休憩画面 */}
      {isBreak && (
        <section className="mb-6 rounded-2xl border-2 border-green-200 bg-green-50 p-6 text-center">
          <p className="mb-2 text-xl font-semibold text-green-800">
            休憩中！🌿 あと {formatRemaining(displaySeconds)}
          </p>
          <p className="mb-4 text-green-700">リラックスしてね</p>
          <button
            type="button"
            onClick={skipBreak}
            className="rounded-xl bg-green-500 px-6 py-3 font-medium text-white"
          >
            次のセットを開始
          </button>
        </section>
      )}

      {/* タイマーエリア */}
      {!isBreak && (
        <section className="mb-8 flex flex-col items-center">
          <div className="h-64 w-64">
            <CircularProgressbar
              value={progress}
              text={formatRemaining(displaySeconds)}
              strokeWidth={10}
              styles={{
                path: { stroke: ringColor, transition: 'stroke-dashoffset 0.5s ease' },
                text: {
                  fill: '#0f172a',
                  fontSize: '28px',
                  fontWeight: 700,
                },
                trail: { stroke: '#e2e8f0' },
              }}
            />
          </div>
          <p className="mt-4 text-slate-600">
            {currentSet}/{task?.pomodoroCount ?? 1} セット目
          </p>
        </section>
      )}

      {/* コントロール */}
      {!isBreak && (
        <section className="mb-6 flex flex-wrap items-center justify-center gap-4">
          {isRunning ? (
            <button
              type="button"
              onClick={pausePomodoro}
              className="rounded-xl bg-slate-200 px-8 py-4 text-lg font-medium text-slate-800"
            >
              一時停止
            </button>
          ) : (
            <button
              type="button"
              onClick={resumePomodoro}
              className="rounded-xl bg-blue-500 px-8 py-4 text-lg font-medium text-white"
            >
              再開
            </button>
          )}
          <button
            type="button"
            onClick={handleAbort}
            className={`rounded-lg px-4 py-2 text-sm ${
              abortConfirm
                ? 'bg-red-500 text-white'
                : 'border border-slate-300 text-slate-600'
            }`}
          >
            {abortConfirm ? '本当に中断する（タップで確定）' : '中断'}
          </button>
        </section>
      )}

      {isBreak && (
        <p className="text-center text-sm text-slate-500">
          休憩が終わると自動で次のセットが始まります
        </p>
      )}
    </div>
  );
}

