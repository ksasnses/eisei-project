import { useMemo } from 'react';
import { format, parseISO, endOfMonth, addMonths, addDays, isBefore, subYears, differenceInDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useStudentStore } from '../stores/studentStore';
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

export function PlannedProgressHeatmap() {
  const profile = useStudentStore((s) => s.profile);
  const events = useStudentStore((s) => s.events);

  const { months, topicData, maxTopicCount } = useMemo(() => {
    if (!profile?.examDate) {
      return { months: [] as Date[], topicData: new Map<string, Map<string, string[]>>(), maxTopicCount: 0 };
    }
    const exam = parseISO(profile.examDate.slice(0, 10));
    const start = profile.studyStartDate
      ? parseISO(profile.studyStartDate.slice(0, 10))
      : subYears(exam, 1);

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
          予定の学習内容（設定ベース）
        </h3>
        <p className="text-sm text-slate-500">
          試験日を設定すると、設定に基づく予定の学習内容が表示されます。
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">
        予定の学習内容（設定に基づく想定）
      </h3>
      <p className="mb-4 text-xs text-slate-500">
        1日の勉強可能時間・部活・イベント・科目配分から算出した月別の予定学習項目。試験{PAST_EXAM_START_DAYS}日前から全教科で過去問演習。色が濃いほど項目数が多い。
      </p>

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
                    const topics = byMonth?.get(monthKey) ?? [];
                    const bg = intensityToColor(topics.length, Math.max(maxTopicCount, 1));
                    const displayText = topics.length > 0 ? topics.join('・') : '—';
                    return (
                      <td
                        key={monthKey}
                        className="border-l border-slate-100 px-2 py-3 text-left align-top"
                        style={{ backgroundColor: bg }}
                        title={`${sub?.name ?? s.subjectId} ${format(m, 'yyyy年M月', { locale: ja })}: ${displayText}`}
                      >
                        {topics.length > 0 ? (
                          <span className="block text-[10px] leading-tight text-slate-800">
                            {displayText}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
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

      {maxTopicCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
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
        </div>
      )}
    </section>
  );
}
