import { useMemo, useState } from 'react';
import { format, parseISO, endOfMonth, addMonths, addDays, isBefore, differenceInDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useStudentStore } from '../stores/studentStore';
import { usePlannedTopicsStore } from '../stores/plannedTopicsStore';
import { getSubjectById } from '../constants/subjects';
import { getStudyTopics, PAST_EXAM_TOPIC, PAST_EXAM_START_DAYS } from '../constants/studyTopics';
import { getAvailableMinutesFromSchedule } from '../utils/scheduleUtils';
import { detectPhase } from '../utils/phaseDetector';
import { allocateTime } from '../utils/timeAllocation';

/** 色の強度を0-maxの値から算出（薄い緑→濃い緑） */
function intensityToColor(value: number, max: number): string {
  if (max <= 0) return '#f1f5f9'; // slate-100
  const ratio = Math.min(1, value / max);
  if (ratio <= 0) return '#f1f5f9';
  if (ratio < 0.25) return '#dcfce7'; // green-100
  if (ratio < 0.5) return '#86efac'; // green-300
  if (ratio < 0.75) return '#4ade80'; // green-400
  return '#22c55e'; // green-500
}

type EditTarget = { subjectId: string; subjectName: string; monthKey: string; monthLabel: string } | null;

export function PlannedProgressHeatmap() {
  const profile = useStudentStore((s) => s.profile);
  const events = useStudentStore((s) => s.events);
  const getTopics = usePlannedTopicsStore((s) => s.getTopics);
  const setTopics = usePlannedTopicsStore((s) => s.setTopics);
  const clearCell = usePlannedTopicsStore((s) => s.clearCell);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [editValue, setEditValue] = useState('');

  const { months, topicData, maxTopicCount } = useMemo(() => {
    if (!profile?.examDate || !profile.studyStartDate) {
      return { months: [] as Date[], topicData: new Map<string, Map<string, string[]>>(), maxTopicCount: 0 };
    }
    const exam = parseISO(profile.examDate.slice(0, 10));
    const start = parseISO(profile.studyStartDate.slice(0, 10));

    const months: Date[] = [];
    const examMonth = new Date(exam.getFullYear(), exam.getMonth(), 1);
    const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
    let d = isBefore(startMonth, examMonth) ? startMonth : examMonth;
    while (isBefore(d, examMonth) || d.getTime() === examMonth.getTime()) {
      months.push(endOfMonth(d));
      d = addMonths(d, 1);
    }

    const minutesData = new Map<string, Map<string, number>>();
    for (const s of profile.subjects) {
      minutesData.set(s.subjectId, new Map<string, number>());
    }

    for (const month of months) {
      const monthKey = format(month, 'yyyy-MM');
      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
      let day = new Date(monthStart);

      while (day <= month) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const availableMinutes = getAvailableMinutesFromSchedule(profile, events, dateStr);
        const phase = detectPhase(profile.examDate.slice(0, 10), dateStr);
        const allocations = allocateTime(profile.subjects, availableMinutes, phase);

        for (const a of allocations) {
          const byMonth = minutesData.get(a.subjectId)!;
          const prev = byMonth.get(monthKey) ?? 0;
          byMonth.set(monthKey, prev + a.minutes);
        }
        day = addDays(day, 1);
      }
    }

    const topicData = new Map<string, Map<string, string[]>>();
    let maxTopicCount = 0;
    const examDate = profile.examDate.slice(0, 10);

    for (const s of profile.subjects) {
      const allTopics = getStudyTopics(s.subjectId);
      if (allTopics.length === 0) {
        topicData.set(s.subjectId, new Map());
        continue;
      }

      const regularTopics = allTopics.filter((t) => t !== PAST_EXAM_TOPIC);
      const hasPastExam = allTopics.includes(PAST_EXAM_TOPIC);

      const byMonth = minutesData.get(s.subjectId)!;
      const monthTopics = new Map<string, string[]>();

      const prePastExamMonths = months.filter((m) => {
        const daysLeft = differenceInDays(parseISO(examDate), m);
        return daysLeft > PAST_EXAM_START_DAYS;
      });
      const totalPrePastMinutes = prePastExamMonths.reduce(
        (sum, m) => sum + (byMonth.get(format(m, 'yyyy-MM')) ?? 0),
        0
      );
      const minutesPerTopic =
        totalPrePastMinutes > 0 && regularTopics.length > 0
          ? totalPrePastMinutes / regularTopics.length
          : 1;

      let cumulativeMinutes = 0;

      for (const month of months) {
        const monthKey = format(month, 'yyyy-MM');
        const monthEnd = endOfMonth(month);
        const daysLeft = differenceInDays(parseISO(examDate), format(monthEnd, 'yyyy-MM-dd'));
        const isPastExamPeriod = daysLeft <= PAST_EXAM_START_DAYS;

        if (isPastExamPeriod && hasPastExam) {
          monthTopics.set(monthKey, [PAST_EXAM_TOPIC]);
          if (1 > maxTopicCount) maxTopicCount = 1;
        } else if (regularTopics.length > 0) {
          const monthMinutes = byMonth.get(monthKey) ?? 0;
          const prevEnd = Math.min(regularTopics.length, Math.floor(cumulativeMinutes / minutesPerTopic));
          cumulativeMinutes += monthMinutes;
          const currEnd = Math.min(regularTopics.length, Math.floor(cumulativeMinutes / minutesPerTopic));

          const topicsThisMonth = regularTopics.slice(prevEnd, currEnd);
          monthTopics.set(monthKey, topicsThisMonth);
          if (topicsThisMonth.length > maxTopicCount) maxTopicCount = topicsThisMonth.length;
        } else {
          monthTopics.set(monthKey, []);
        }
      }
      topicData.set(s.subjectId, monthTopics);
    }

    return { months, topicData, maxTopicCount };
  }, [profile, events]);

  if (!profile) return null;
  if (months.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">
          予定の学習内容（編集可能）
        </h3>
        <p className="text-sm text-slate-500">
          試験日と勉強を始める日を設定すると、勉強開始月から試験月までの予定学習内容が表示されます。設定タブで確認・変更してください。
        </p>
      </section>
    );
  }

  const handleCellClick = (subjectId: string, subjectName: string, monthKey: string, monthLabel: string, topics: string[]) => {
    setEditTarget({ subjectId, subjectName, monthKey, monthLabel });
    setEditValue(topics.join('・'));
  };

  const handleSaveEdit = () => {
    if (!editTarget) return;
    const topics = editValue
      .split(/[・\n,、]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    setTopics(editTarget.subjectId, editTarget.monthKey, topics);
    setEditTarget(null);
  };

  const handleRevertEdit = () => {
    if (!editTarget) return;
    clearCell(editTarget.subjectId, editTarget.monthKey);
    setEditTarget(null);
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">
        予定の学習内容（編集可能）
      </h3>
      <p className="mb-4 text-xs text-slate-500">
        セルをタップして内容を入力・修正できます。1日の勉強可能時間・部活・イベントから算出した初期値をベースに、自由に調整してください。
      </p>

      {/* 編集モーダル */}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditTarget(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-md rounded-xl bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="mb-2 text-sm font-semibold text-slate-800">
              {editTarget.subjectName} - {editTarget.monthLabel}
            </h4>
            <p className="mb-2 text-xs text-slate-500">
              学習項目を「・」または「,」「改行」で区切って入力
            </p>
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              rows={5}
              placeholder="例：不定詞・動名詞・分詞"
              autoFocus
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                保存
              </button>
              <button
                type="button"
                onClick={handleRevertEdit}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                算出値に戻す
              </button>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full min-w-max text-xs" style={{ minWidth: `calc(6rem + 6rem * ${months.length})` }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-24 bg-white py-2 text-left font-medium text-slate-600">
                科目
              </th>
              {months.map((m) => (
                <th
                  key={format(m, 'yyyy-MM')}
                  className="min-w-[5rem] max-w-[8rem] px-1 py-2 text-center font-medium text-slate-600"
                >
                  {format(m, 'M月', { locale: ja })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profile.subjects.map((s) => {
              const sub = getSubjectById(s.subjectId);
              const byMonth = topicData.get(s.subjectId);
              return (
                <tr key={s.subjectId} className="border-t border-slate-100">
                  <td className="sticky left-0 z-10 bg-white py-2 font-medium text-slate-700">
                    {sub?.name ?? s.subjectId}
                  </td>
                  {months.map((m) => {
                    const monthKey = format(m, 'yyyy-MM');
                    const monthLabel = format(m, 'yyyy年M月', { locale: ja });
                    const calculatedTopics = byMonth?.get(monthKey) ?? [];
                    const customTopics = getTopics(s.subjectId, monthKey);
                    const topics = customTopics ?? calculatedTopics;
                    const isCustom = customTopics !== undefined;
                    const bg = intensityToColor(topics.length, Math.max(maxTopicCount, 1));
                    const displayText = topics.length > 0 ? topics.join('・') : '—';
                    const subName = sub?.name ?? s.subjectId;
                    return (
                      <td
                        key={monthKey}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer border-l border-slate-100 px-2 py-3 text-left align-top hover:ring-2 hover:ring-blue-300"
                        style={{ backgroundColor: bg }}
                        title={`タップで編集: ${subName} ${monthLabel}`}
                        onClick={() => handleCellClick(s.subjectId, subName, monthKey, monthLabel, topics)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleCellClick(s.subjectId, subName, monthKey, monthLabel, topics);
                          }
                        }}
                      >
                        {topics.length > 0 ? (
                          <span className="block text-[10px] leading-tight text-slate-800">
                            {displayText}
                            {isCustom && (
                              <span className="ml-1 text-blue-600" title="編集済み">✎</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-300" title={`タップで編集: ${subName} ${monthLabel}`}>·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
        {maxTopicCount > 0 && (
          <>
            <span>凡例:</span>
            <div className="flex items-center gap-1">
              <div
                className="h-3 w-4 rounded"
                style={{ backgroundColor: intensityToColor(0, 1) }}
              />
              <span>0項目</span>
            </div>
            <div className="flex items-center gap-1">
              <div
                className="h-3 w-4 rounded"
                style={{ backgroundColor: intensityToColor(Math.max(1, Math.floor(maxTopicCount * 0.5)), maxTopicCount) }}
              />
              <span>～{Math.floor(maxTopicCount * 0.5)}項目</span>
            </div>
            <div className="flex items-center gap-1">
              <div
                className="h-3 w-4 rounded"
                style={{ backgroundColor: intensityToColor(maxTopicCount, maxTopicCount) }}
              />
              <span>{maxTopicCount}項目</span>
            </div>
          </>
        )}
        <span className="text-slate-400">· 空のセル（タップで学習項目を追加できます）</span>
      </div>
    </section>
  );
}
