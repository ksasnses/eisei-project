import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useStudentStore } from '../stores/studentStore';
import { useStudyStore } from '../stores/studyStore';
import { getSubjectById } from '../constants/subjects';
import { EXAM_TEMPLATES } from '../constants/examTemplates';
import { formatDateForInput } from '../utils/dateUtils';

const TIME_OPTIONS = (() => {
  const opts: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return opts;
})();

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

/** 伸ばしやすさ 1〜5: 暗記型+苦手度低→高、思考型+苦手度高→低 */
function getEaseScore(
  memorizationRatio: number,
  difficulty: number
): number {
  const ease = memorizationRatio * 2 + (6 - difficulty);
  return Math.max(1, Math.min(5, Math.round(ease)));
}

export function SettingsPage() {
  const navigate = useNavigate();
  const profile = useStudentStore((s) => s.profile);
  const updateProfile = useStudentStore((s) => s.updateProfile);
  const updateSubject = useStudentStore((s) => s.updateSubject);
  const resetAllStudent = useStudentStore((s) => s.resetAll);
  const resetAllStudy = useStudyStore((s) => s.resetAll);
  const generateDailyPlan = useStudyStore((s) => s.generateDailyPlan);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showImportError, setShowImportError] = useState<string | null>(null);

  const totalCurrent = useMemo(
    () =>
      profile?.subjects.reduce((sum, s) => sum + s.currentScore, 0) ?? 0,
    [profile]
  );
  const totalTarget = useMemo(
    () =>
      profile?.subjects.reduce((sum, s) => sum + s.targetScore, 0) ?? 0,
    [profile]
  );
  const gapTotal = totalTarget - totalCurrent;

  const gapData = useMemo(() => {
    if (!profile) return [];
    return profile.subjects
      .map((s) => {
        const sub = getSubjectById(s.subjectId);
        const maxScore = sub?.score ?? 100;
        const gap = s.targetScore - s.currentScore;
        const ease = sub
          ? getEaseScore(sub.memorizationRatio, s.difficulty)
          : 3;
        return {
          subjectId: s.subjectId,
          name: sub?.name ?? s.subjectId,
          current: s.currentScore,
          target: s.targetScore,
          gap,
          maxScore,
          ease,
        };
      })
      .filter((d) => d.gap > 0)
      .sort((a, b) => b.gap - a.gap);
  }, [profile]);

  const gapBarColor = (gap: number, maxScore: number) => {
    const ratio = maxScore > 0 ? gap / maxScore : 0;
    if (ratio <= 0.15) return '#22c55e';
    if (ratio <= 0.3) return '#eab308';
    return '#ef4444';
  };

  const recommendedAllocation = useMemo(() => {
    if (!profile) return { push: [] as string[], maintain: [] as string[] };
    const withEase = profile.subjects.map((s) => {
      const sub = getSubjectById(s.subjectId);
      const ease = sub
        ? getEaseScore(sub.memorizationRatio, s.difficulty)
        : 3;
      const gap = s.targetScore - s.currentScore;
      return { ...s, ease, gap, name: sub?.name ?? s.subjectId };
    });
    const push = withEase
      .filter((s) => s.gap > 0 && s.ease >= 4)
      .sort((a, b) => b.ease - a.ease)
      .map((s) => s.name);
    const maintain = withEase
      .filter((s) => s.gap > 0 && s.ease <= 2)
      .map((s) => s.name);
    return { push, maintain };
  }, [profile]);

  const strategyMessage = useMemo(() => {
    if (gapTotal <= 0)
      return '目標得点まであと少し、または達成済みです。維持を心がけましょう。';
    const parts: string[] = [];
    if (recommendedAllocation.push.length > 0) {
      parts.push(
        `${recommendedAllocation.push.slice(0, 2).join('と')}で+${gapTotal}点を狙うのが効率的です。`
      );
    }
    if (recommendedAllocation.maintain.length > 0) {
      parts.push(
        `${recommendedAllocation.maintain.join('・')}は基礎固めを優先しましょう。`
      );
    }
    if (parts.length === 0) {
      parts.push('全科目バランスよく伸ばしていきましょう。');
    }
    return parts.join(' ');
  }, [gapTotal, recommendedAllocation]);

  const handleApplySimulator = () => {
    const today = formatDateForInput(new Date());
    generateDailyPlan(today);
  };

  const handleReset = () => {
    resetAllStudy();
    resetAllStudent();
    setShowResetConfirm(false);
    navigate('/wizard', { replace: true });
  };

  const handleExport = () => {
    const student = useStudentStore.getState();
    const study = useStudyStore.getState();
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      student: {
        profile: student.profile,
        events: student.events,
        scoreRecords: student.scoreRecords,
      },
      study: {
        dailyPlans: study.dailyPlans,
        completedTasks: study.completedTasks,
        reviewQueue: study.reviewQueue,
        streakDays: study.streakDays,
        totalPomodoros: study.totalPomodoros,
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eisei-backup-${formatDateForInput(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const data = JSON.parse(text);
        if (!data.student?.profile) throw new Error('無効なバックアップ形式です');
        useStudentStore.setState({
          profile: data.student.profile,
          events: data.student.events ?? [],
          scoreRecords: data.student.scoreRecords ?? [],
          isInitialized: true,
        });
        if (data.study) {
          useStudyStore.setState({
            dailyPlans: data.study.dailyPlans ?? {},
            completedTasks: data.study.completedTasks ?? [],
            reviewQueue: data.study.reviewQueue ?? [],
            streakDays: data.study.streakDays ?? 0,
            totalPomodoros: data.study.totalPomodoros ?? 0,
          });
        }
        e.target.value = '';
      } catch (err) {
        setShowImportError(err instanceof Error ? err.message : '読み込みに失敗しました');
      }
    };
    reader.readAsText(file);
  };

  if (!profile) return null;

  const schedule = profile.dailySchedule;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-4" style={{ color: '#0f172a' }}>
      <h1 className="mb-6 text-xl font-semibold text-slate-800">設定</h1>

      {/* 得点戦略シミュレーター */}
      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">
          得点戦略シミュレーター
        </h2>

        <div className="mb-4 rounded-lg bg-slate-50 p-3 text-center">
          <span className="text-slate-600">合計</span>
          <div className="text-2xl font-bold text-slate-800">
            現在 {totalCurrent}点 → 目標 {totalTarget}点
            <span className="ml-2 text-lg font-normal text-slate-600">
              （あと+{gapTotal}点）
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {profile.subjects.map((s) => {
            const sub = getSubjectById(s.subjectId);
            const maxScore = sub?.score ?? 100;
            return (
              <div
                key={s.subjectId}
                className="rounded-lg border border-slate-100 bg-slate-50/50 p-3"
              >
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium text-slate-800">
                    {sub?.name ?? s.subjectId}
                  </span>
                  <span className="text-slate-500">
                    {s.currentScore} → {s.targetScore} 点
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500">現在</label>
                    <input
                      type="range"
                      min={0}
                      max={maxScore}
                      value={s.currentScore}
                      onChange={(e) =>
                        updateSubject(s.subjectId, {
                          currentScore: Number(e.target.value),
                        })
                      }
                      className="h-2 w-full accent-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">目標</label>
                    <input
                      type="range"
                      min={0}
                      max={maxScore}
                      value={s.targetScore}
                      onChange={(e) =>
                        updateSubject(s.subjectId, {
                          targetScore: Number(e.target.value),
                        })
                      }
                      className="h-2 w-full accent-green-500"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {gapData.length > 0 && (
          <>
            <h3 className="mt-6 mb-2 text-sm font-semibold text-slate-700">
              ギャップ分析（現在 → 目標）
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={gapData}
                  layout="vertical"
                  margin={{ top: 4, right: 24, left: 80, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" domain={[0, 'auto']} fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={76}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value: number, _name, props) => [
                      `+${value}点`,
                      props.payload?.name,
                    ]}
                  />
                  <Bar dataKey="gap" name="必要な伸び" radius={[0, 4, 4, 0]}>
                    {gapData.map((entry) => (
                      <Cell
                        key={entry.subjectId}
                        fill={gapBarColor(entry.gap, entry.maxScore)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50/80 p-3">
          <h3 className="text-sm font-semibold text-amber-900">
            あと{gapTotal}点を上げるには
          </h3>
          <p className="mt-1 text-xs text-amber-800">
            伸ばしやすさ：暗記型・苦手度低 → 高、思考型・苦手度高 → 低
          </p>
          {profile.subjects.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-amber-900">
              {profile.subjects.map((s) => {
                const sub = getSubjectById(s.subjectId);
                const ease = sub
                  ? getEaseScore(sub.memorizationRatio, s.difficulty)
                  : 3;
                return (
                  <li key={s.subjectId}>
                    {sub?.name ?? s.subjectId}：★{ease}（
                    {ease >= 4 ? '伸ばしやすい' : ease <= 2 ? '伸ばしにくい' : '普通'}）
                  </li>
                );
              })}
            </ul>
          )}
          {recommendedAllocation.push.length > 0 && (
            <p className="mt-2 text-sm font-medium text-amber-900">
              おすすめ：{recommendedAllocation.push.join('・')}で得点を狙う
            </p>
          )}
        </div>

        <p className="mt-4 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">
          💡 {strategyMessage}
        </p>

        <button
          type="button"
          onClick={handleApplySimulator}
          className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          この目標でスケジュールを再計算
        </button>
      </section>

      {/* プロフィール編集 */}
      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">
          プロフィール編集
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600">名前</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => updateProfile({ name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600">志望校タイプ</label>
            <select
              value={profile.examType}
              onChange={(e) => updateProfile({ examType: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              {EXAM_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-600">試験日</label>
            <input
              type="date"
              value={profile.examDate.slice(0, 10)}
              onChange={(e) =>
                updateProfile({ examDate: new Date(e.target.value).toISOString() })
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
        </div>
      </section>

      {/* 生活スケジュール */}
      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">
          1日の生活スケジュール
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600">起床</label>
              <select
                value={schedule.wakeUpTime}
                onChange={(e) =>
                  updateProfile({
                    dailySchedule: { ...schedule, wakeUpTime: e.target.value },
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600">就寝</label>
              <select
                value={schedule.bedTime}
                onChange={(e) =>
                  updateProfile({
                    dailySchedule: { ...schedule, bedTime: e.target.value },
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600">学校 始業</label>
              <select
                value={schedule.schoolStart}
                onChange={(e) =>
                  updateProfile({
                    dailySchedule: { ...schedule, schoolStart: e.target.value },
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600">学校 終業</label>
              <select
                value={schedule.schoolEnd}
                onChange={(e) =>
                  updateProfile({
                    dailySchedule: { ...schedule, schoolEnd: e.target.value },
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-600">片道通学時間（分）</label>
            <input
              type="number"
              min={0}
              max={180}
              value={schedule.commuteMinutesOneWay}
              onChange={(e) =>
                updateProfile({
                  dailySchedule: {
                    ...schedule,
                    commuteMinutesOneWay: Number(e.target.value) || 0,
                  },
                })
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600">食事・風呂（分）</label>
            <input
              type="number"
              min={0}
              max={240}
              value={schedule.mealAndBathMinutes}
              onChange={(e) =>
                updateProfile({
                  dailySchedule: {
                    ...schedule,
                    mealAndBathMinutes: Number(e.target.value) || 0,
                  },
                })
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600">自由時間バッファ（分）</label>
            <input
              type="number"
              min={0}
              max={120}
              value={schedule.freeTimeBufferMinutes}
              onChange={(e) =>
                updateProfile({
                  dailySchedule: {
                    ...schedule,
                    freeTimeBufferMinutes: Number(e.target.value) || 0,
                  },
                })
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
        </div>
      </section>

      {/* 部活スケジュール */}
      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">
          部活スケジュール
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600">部活のある曜日</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                <label
                  key={day}
                  className={`flex cursor-pointer items-center rounded-lg border px-4 py-2 ${
                    schedule.clubDays.includes(day)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={schedule.clubDays.includes(day)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...schedule.clubDays, day].sort((a, b) => a - b)
                        : schedule.clubDays.filter((d) => d !== day);
                      updateProfile({
                        dailySchedule: { ...schedule, clubDays: next },
                      });
                    }}
                    className="sr-only"
                  />
                  {WEEKDAY_LABELS[day]}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-600">平日（月〜金）の部活時間</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500">開始</label>
                  <select
                    value={schedule.clubStartTime}
                    onChange={(e) =>
                      updateProfile({
                        dailySchedule: { ...schedule, clubStartTime: e.target.value },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500">終了</label>
                  <select
                    value={schedule.clubEndTime}
                    onChange={(e) =>
                      updateProfile({
                        dailySchedule: { ...schedule, clubEndTime: e.target.value },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-600">土日・休日の部活時間</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500">開始</label>
                  <select
                    value={schedule.clubWeekendStart ?? schedule.clubStartTime}
                    onChange={(e) =>
                      updateProfile({
                        dailySchedule: { ...schedule, clubWeekendStart: e.target.value },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500">終了</label>
                  <select
                    value={schedule.clubWeekendEnd ?? schedule.clubEndTime}
                    onChange={(e) =>
                      updateProfile({
                        dailySchedule: { ...schedule, clubWeekendEnd: e.target.value },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* データのエクスポート/インポート */}
      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">
          データのバックアップ
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            エクスポート（JSON）
          </button>
          <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            インポート（JSON）
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImport}
              className="sr-only"
            />
          </label>
        </div>
        {showImportError && (
          <p className="mt-2 text-sm text-red-600">{showImportError}</p>
        )}
      </section>

      {/* データのリセット */}
      <section className="rounded-xl border border-red-100 bg-red-50/50 p-4">
        <h2 className="mb-2 text-lg font-semibold text-red-900">データのリセット</h2>
        <p className="mb-4 text-sm text-red-800">
          すべてのデータが削除され、初期設定ウィザードに戻ります。
        </p>
        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          リセットする
        </button>
      </section>

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">本当にリセットしますか？</h3>
            <p className="mt-2 text-sm text-slate-600">
              プロフィール・イベント・学習記録など、すべてのデータが削除されます。この操作は取り消せません。
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 rounded-lg border border-slate-300 py-2 text-slate-600"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 rounded-lg bg-red-600 py-2 text-white hover:bg-red-700"
              >
                リセットする
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
