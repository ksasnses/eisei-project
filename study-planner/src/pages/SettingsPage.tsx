import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStudentStore } from '../stores/studentStore';
import { useStudyStore } from '../stores/studyStore';
import { useCurriculumStore } from '../stores/curriculumStore';
import { useFeedbackStore } from '../stores/feedbackStore';
import { getSubjectById } from '../constants/subjects';
import { EXAM_TEMPLATES } from '../constants/examTemplates';
import { format, subDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { formatDateForInput } from '../utils/dateUtils';
import { getStudyMinutesSummary } from '../utils/scheduleUtils';
import { getDayTemplate } from '../constants/dayTemplates';
import { RuleConfigEditor } from '../components/RuleConfigEditor';

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

/** 学習レポート出力（保護者へ共有用） */
function StudyReportSection({
  profile,
  getFeedbackSince,
}: {
  profile: ReturnType<typeof useStudentStore.getState>['profile'];
  getFeedbackSince: (date: string) => { date: string; text: string }[];
}) {
  const completedTasks = useStudyStore((s) => s.completedTasks);
  const streakDays = useStudyStore((s) => s.streakDays);
  const totalPomodoros = useStudyStore((s) => s.totalPomodoros);
  const [reportToast, setReportToast] = useState(false);
  useEffect(() => {
    if (!reportToast) return;
    const t = setTimeout(() => setReportToast(false), 3000);
    return () => clearTimeout(t);
  }, [reportToast]);

  const generateReportText = (days: number) => {
    const endDate = new Date();
    const startDate = subDays(endDate, days);
    const startStr = formatDateForInput(startDate);
    const endStr = formatDateForInput(endDate);
    const tasksInPeriod = completedTasks.filter((t) => {
      if (!t.completedAt) return false;
      const d = t.completedAt.slice(0, 10);
      return d >= startStr && d <= endStr;
    });
    const totalMinutes = tasksInPeriod.reduce(
      (sum, t) => sum + (t.actualMinutes ?? t.estimatedMinutes ?? 0),
      0
    );
    const bySubject = new Map<string, number>();
    tasksInPeriod.forEach((t) => {
      const name = getSubjectById(t.subjectId)?.name ?? t.subjectId;
      bySubject.set(name, (bySubject.get(name) ?? 0) + (t.actualMinutes ?? t.estimatedMinutes ?? 0));
    });
    const feedbackEntries = getFeedbackSince(startStr);

    const lines: string[] = [
      '＝＝＝ 学習レポート（保護者用） ＝＝＝',
      `作成日時: ${format(new Date(), 'yyyy年M月d日(E) HH:mm', { locale: ja })}`,
      `対象期間: ${format(startDate, 'M/d', { locale: ja })} 〜 ${format(endDate, 'M/d', { locale: ja })}`,
      `名前: ${profile?.name ?? '—'}`,
      `試験日: ${profile?.examDate ? format(new Date(profile.examDate), 'yyyy年M月d日', { locale: ja }) : '—'}`,
      '',
      '【学習サマリー】',
      `・連続学習: ${streakDays}日`,
      `・累計ポモドーロ: ${totalPomodoros}セット`,
      `・期間内の学習時間: 合計 ${Math.floor(totalMinutes / 60)}時間${totalMinutes % 60}分`,
      `・完了タスク数: ${tasksInPeriod.length}件`,
      '',
      '【科目別学習時間】',
      ...Array.from(bySubject.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, min]) => `・${name}: ${Math.floor(min / 60)}h${min % 60}m`),
    ];

    if (feedbackEntries.length > 0) {
      lines.push('', '【振り返り・フィードバック】');
      feedbackEntries.forEach((e) => {
        const d = format(new Date(e.date + 'T12:00:00'), 'M/d(E)', { locale: ja });
        lines.push(`・${d}: ${e.text}`);
      });
    }

    lines.push('', '＝＝＝ 以上 ＝＝＝');
    return lines.join('\n');
  };

  const handleCopyReport = (days: number) => {
    const text = generateReportText(days);
    navigator.clipboard.writeText(text).then(() => setReportToast(true));
  };

  const handleDownloadReport = (days: number) => {
    const text = generateReportText(days);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `学習レポート-${formatDateForInput(new Date())}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setReportToast(true);
  };

  const handleShareReport = async (days: number) => {
    const text = generateReportText(days);
    const title = `学習レポート（過去${days}日分）`;
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
        });
        setReportToast(true);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          navigator.clipboard?.writeText(text).then(() => setReportToast(true));
        }
      }
    } else {
      navigator.clipboard?.writeText(text).then(() => setReportToast(true));
    }
  };

  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <section className="mb-8 rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 shadow-sm">
      <h2 className="mb-2 text-lg font-semibold text-slate-800">
        📋 学習レポート（保護者へ共有）
      </h2>
      <p className="mb-4 text-sm text-slate-600">
        学習状況と「今日の振り返り」をまとめたレポートを出力できます。保護者に渡して学習の様子を共有できます。
      </p>
      {canShare && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleShareReport(7)}
            className="flex items-center gap-1.5 rounded-lg border-2 border-indigo-500 bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            📤 過去7日分を保護者に送る
          </button>
          <button
            type="button"
            onClick={() => handleShareReport(30)}
            className="flex items-center gap-1.5 rounded-lg border-2 border-indigo-500 bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            📤 過去30日分を保護者に送る
          </button>
        </div>
      )}
      <p className="mb-3 text-xs text-slate-500">
        {canShare
          ? '「保護者に送る」をタップすると、LINE・メールなどで共有できます。'
          : '以下のコピー・ダウンロードから共有できます。'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleCopyReport(7)}
          className="rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
        >
          過去7日分をコピー
        </button>
        <button
          type="button"
          onClick={() => handleCopyReport(30)}
          className="rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
        >
          過去30日分をコピー
        </button>
        <button
          type="button"
          onClick={() => handleDownloadReport(7)}
          className="rounded-lg border border-indigo-300 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          過去7日分をダウンロード
        </button>
        <button
          type="button"
          onClick={() => handleDownloadReport(30)}
          className="rounded-lg border border-indigo-300 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          過去30日分をダウンロード
        </button>
      </div>
      {reportToast && (
        <p className="mt-3 text-sm text-green-700">✓ 共有しました / クリップボードにコピーしました / ダウンロードしました</p>
      )}
    </section>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const profile = useStudentStore((s) => s.profile);
  const updateProfile = useStudentStore((s) => s.updateProfile);
  const resetAllStudent = useStudentStore((s) => s.resetAll);
  const resetAllStudy = useStudyStore((s) => s.resetAll);
  const generateDailyPlan = useStudyStore((s) => s.generateDailyPlan);
  const getTextbooks = useCurriculumStore((s) => s.getTextbooks);
  const resetAllCurriculum = useCurriculumStore((s) => s.resetAll);
  const getFeedbackSince = useFeedbackStore((s) => s.getFeedbackSince);
  const resetAllFeedback = useFeedbackStore((s) => s.clearAll);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showImportError, setShowImportError] = useState<string | null>(null);
  const [scheduleToast, setScheduleToast] = useState(false);
  const [ruleConfigToast, setRuleConfigToast] = useState(false);
  const onRuleConfigSave = useCallback(() => setRuleConfigToast(true), []);
  useEffect(() => {
    if (!scheduleToast) return;
    const t = setTimeout(() => setScheduleToast(false), 3000);
    return () => clearTimeout(t);
  }, [scheduleToast]);

  useEffect(() => {
    if (!ruleConfigToast) return;
    const t = setTimeout(() => setRuleConfigToast(false), 3000);
    return () => clearTimeout(t);
  }, [ruleConfigToast]);

  const handleReset = () => {
    resetAllStudy();
    resetAllStudent();
    resetAllCurriculum();
    resetAllFeedback();
    setShowResetConfirm(false);
    navigate('/wizard', { replace: true });
  };

  const handleExport = () => {
    const student = useStudentStore.getState();
    const study = useStudyStore.getState();
    const curriculum = useCurriculumStore.getState();
    const data = {
      version: 2,
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
      curriculum: {
        textbooksBySubject: curriculum.textbooksBySubject,
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
        if (data.curriculum?.textbooksBySubject) {
          useCurriculumStore.setState({
            textbooksBySubject: data.curriculum.textbooksBySubject,
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

  const studyMinutes = useMemo(
    () => getStudyMinutesSummary(schedule),
    [schedule]
  );

  const formatStudyTime = (minutes: number) =>
    `${Math.floor(minutes / 60)}時間${minutes % 60 ? minutes % 60 + '分' : ''}`;

  const textbookStats = useMemo(() => {
    if (!profile) return { bySubject: [] as { name: string; subjectId: string; textbooks: { name: string; progress: string; status: string }[] }[], totalCount: 0, totalRemaining: 0 };
    const bySubject: { name: string; subjectId: string; textbooks: { name: string; progress: string; status: string }[] }[] = [];
    let totalCount = 0;
    let totalRemaining = 0;
    for (const s of profile.subjects) {
      const sub = getSubjectById(s.subjectId);
      const list = getTextbooks(s.subjectId).sort((a, b) => a.priority - b.priority);
      if (list.length === 0) continue;
      totalCount += list.length;
      const items = list.map((t) => {
        const remaining = t.totalUnits - t.completedUnitCount;
        totalRemaining += remaining;
        const pct = t.totalUnits > 0 ? Math.round((t.completedUnitCount / t.totalUnits) * 100) : 0;
        return {
          name: t.name,
          progress: `${t.completedUnitCount}/${t.totalUnits} (${pct}%)`,
          status: t.status === 'paused' ? '⏸️ 一時停止' : '🟢 進行中',
        };
      });
      bySubject.push({
        name: sub?.name ?? s.subjectId,
        subjectId: s.subjectId,
        textbooks: items,
      });
    }
    return { bySubject, totalCount, totalRemaining };
  }, [profile, getTextbooks]);

  const subjectsWithoutTextbooks = useMemo(() => {
    if (!profile) return [];
    return profile.subjects.filter((s) => getTextbooks(s.subjectId).length === 0);
  }, [profile, getTextbooks]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-4" style={{ color: '#0f172a' }}>
      <h1 className="mb-6 text-xl font-semibold text-slate-800">設定</h1>

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
          <div>
            <label className="block text-sm text-slate-600">
              試験勉強を開始する日
            </label>
            <input
              type="date"
              value={profile.studyStartDate?.slice(0, 10) ?? formatDateForInput(new Date())}
              onChange={(e) =>
                updateProfile({
                  studyStartDate: e.target.value,
                })
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            <p className="mt-1 text-xs text-slate-500">
              この日以降に学習計画が生成されます
            </p>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600">夏休み開始日</label>
              <input
                type="date"
                value={schedule.summerVacationStart ?? ''}
                onChange={(e) => {
                  updateProfile({
                    dailySchedule: { ...schedule, summerVacationStart: e.target.value || '' },
                  });
                  setScheduleToast(true);
                  generateDailyPlan(formatDateForInput(new Date()));
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600">夏休み終了日</label>
              <input
                type="date"
                value={schedule.summerVacationEnd ?? ''}
                onChange={(e) => {
                  updateProfile({
                    dailySchedule: { ...schedule, summerVacationEnd: e.target.value || '' },
                  });
                  setScheduleToast(true);
                  generateDailyPlan(formatDateForInput(new Date()));
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
          </div>
          {scheduleToast && (
            <div className="rounded-lg bg-blue-100 px-4 py-2 text-sm text-blue-800">
              スケジュールが再生成されます
            </div>
          )}
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

        <div className="mt-6 rounded-xl bg-slate-50 p-4">
          <p className="mb-3 text-sm font-medium text-slate-700">
            1日の勉強可能時間（上記スケジュールから自動計算）
          </p>
          {(() => {
            const badgeByCat: Record<string, { label: string; cn: string }> = {
              english: { label: '英語', cn: 'bg-blue-100 text-blue-800' },
              math: { label: '数学', cn: 'bg-red-100 text-red-800' },
              japanese: { label: '国語', cn: 'bg-green-100 text-green-800' },
              science: { label: '理科', cn: 'bg-purple-100 text-purple-800' },
              social: { label: '社会', cn: 'bg-orange-100 text-orange-800' },
              info: { label: '情報', cn: 'bg-gray-100 text-gray-800' },
            };
            const rows: { label: string; minutes: number; templateKey: 'weekday_club' | 'weekday_no_club' | 'weekend_holiday' | 'summer_club' | 'summer_no_club' }[] = [
              { label: '部活のある日（平日）', minutes: studyMinutes.withClubWeekday, templateKey: 'weekday_club' },
              { label: '部活のない日（平日）', minutes: studyMinutes.noClubWeekday, templateKey: 'weekday_no_club' },
              { label: '部活のない日（土日・休日）', minutes: studyMinutes.noClubWeekend, templateKey: 'weekend_holiday' },
              { label: '部活のある日（土日・休日）', minutes: studyMinutes.withClubWeekend, templateKey: 'weekend_holiday' },
              { label: '夏休み 部活あり日', minutes: studyMinutes.summerClub, templateKey: 'summer_club' },
              { label: '夏休み 部活なし日', minutes: studyMinutes.summerNoClub, templateKey: 'summer_no_club' },
            ];
            return (
              <ul className="space-y-2 text-sm">
                {rows.map((r) => {
                  const t = getDayTemplate(r.templateKey);
                  const categories = [...new Set(t.blocks.map((b) => b.subjectCategory).filter((c) => c !== 'review'))];
                  return (
                    <li key={r.label} className="flex flex-wrap items-center justify-between gap-2 text-slate-700">
                      <span>{r.label}</span>
                      <span className="flex items-center gap-1.5">
                        {categories.map((cat) => (
                          <span
                            key={cat}
                            className={`rounded px-1.5 py-0.5 text-xs font-medium ${badgeByCat[cat]?.cn ?? 'bg-slate-100 text-slate-700'}`}
                          >
                            {badgeByCat[cat]?.label ?? cat}
                          </span>
                        ))}
                        <span className="font-medium tabular-nums">{formatStudyTime(r.minutes)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </div>
      </section>

      {/* 学習ルール設定 */}
      <section className="mb-8 rounded-xl border border-indigo-100 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">
          学習ルール設定
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          曜日別のスケジュール・フェーズ別学習内容・復習ルールなどを、コードを触らずに変更できます。
        </p>
        <RuleConfigEditor onSaveToast={onRuleConfigSave} />
        {ruleConfigToast && (
          <div className="mt-4 rounded-lg bg-green-100 px-4 py-2 text-sm text-green-800">
            設定を保存しました。スケジュールが再生成されます。
          </div>
        )}
      </section>

      {/* 登録教材一覧 */}
      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">
          📚 登録教材一覧
        </h2>
        {textbookStats.bySubject.length > 0 ? (
          <>
            {textbookStats.bySubject.map(({ name, subjectId, textbooks }) => (
              <div key={subjectId} className="mb-4 last:mb-0">
                <h3 className="mb-2 font-medium text-slate-700">
                  {name}（{textbooks.length}教材）
                </h3>
                <ul className="space-y-2">
                  {textbooks.map((tb, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm"
                    >
                      <span className="text-slate-800">
                        {i + 1}. {tb.name} — {tb.progress} {tb.status}
                      </span>
                      <Link
                        to={`/subjects/${subjectId}`}
                        className="text-indigo-600 hover:text-indigo-700"
                      >
                        編集
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              全教材の合計: {textbookStats.totalCount}教材、残り{textbookStats.totalRemaining}ユニット
            </div>
          </>
        ) : (
          <p className="text-slate-600">登録されている教材はありません。</p>
        )}
        {subjectsWithoutTextbooks.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="mb-2 text-sm font-medium text-amber-800">
              ⚠️ 以下の科目は教材が未登録です
            </p>
            <ul className="space-y-1">
              {subjectsWithoutTextbooks.map((s) => {
                const sub = getSubjectById(s.subjectId);
                return (
                  <li key={s.subjectId} className="flex items-center justify-between text-sm">
                    <span className="text-amber-900">{sub?.name ?? s.subjectId}</span>
                    <Link
                      to={`/subjects/${s.subjectId}`}
                      className="font-medium text-amber-700 hover:text-amber-800"
                    >
                      登録する
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* 学習レポート出力（保護者へ共有） */}
      <StudyReportSection
        profile={profile}
        getFeedbackSince={getFeedbackSince}
      />

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
