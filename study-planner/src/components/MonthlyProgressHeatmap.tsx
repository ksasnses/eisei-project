import { useMemo } from 'react';
import { format, parseISO, endOfMonth, addMonths, isBefore, subYears } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useStudentStore } from '../stores/studentStore';
import { useStudyStore } from '../stores/studyStore';
import { getSubjectById } from '../constants/subjects';

/** 色の強度を0-maxの値から算出（薄い青→濃い青） */
function intensityToColor(value: number, max: number): string {
  if (max <= 0) return '#f1f5f9'; // slate-100
  const ratio = Math.min(1, value / max);
  if (ratio <= 0) return '#f1f5f9';
  if (ratio < 0.25) return '#dbeafe'; // blue-100
  if (ratio < 0.5) return '#93c5fd'; // blue-300
  if (ratio < 0.75) return '#60a5fa'; // blue-400
  return '#3b82f6'; // blue-500
}

export function MonthlyProgressHeatmap() {
  const profile = useStudentStore((s) => s.profile);
  const completedTasks = useStudyStore((s) => s.completedTasks);

  const { months, data, maxMinutes } = useMemo(() => {
    if (!profile?.examDate) {
      return { months: [] as Date[], data: new Map<string, Map<string, number>>(), maxMinutes: 0 };
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

    const data = new Map<string, Map<string, number>>();
    let maxMinutes = 0;

    for (const subject of profile.subjects) {
      const byMonth = new Map<string, number>();
      data.set(subject.subjectId, byMonth);

      for (const month of months) {
        const monthEndStr = format(month, 'yyyy-MM-dd');
        const tasks = completedTasks.filter(
          (t) =>
            t.subjectId === subject.subjectId &&
            t.completedAt &&
            t.completedAt.slice(0, 10) <= monthEndStr
        );
        const minutes = tasks.reduce(
          (sum, t) => sum + (t.actualMinutes ?? t.estimatedMinutes ?? 0),
          0
        );
        byMonth.set(format(month, 'yyyy-MM'), minutes);
        if (minutes > maxMinutes) maxMinutes = minutes;
      }
    }

    return { months, data, maxMinutes };
  }, [profile, completedTasks]);

  if (!profile) return null;
  if (months.length === 0) {
    return (
      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">
          実際の進捗状況
        </h3>
        <p className="text-sm text-slate-500">
          試験日を設定すると、勉強開始から試験月までの月別進捗が表示されます。設定タブで試験日を確認してください。
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">
        実際の進捗状況
      </h3>
      <p className="mb-4 text-xs text-slate-500">
        完了したタスクの累計学習時間（分）。各月末時点の実績。色が濃いほど学習量が多い。
      </p>

      <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full min-w-max text-xs" style={{ minWidth: `calc(6rem + 3.5rem * ${months.length})` }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-24 bg-white py-2 text-left font-medium text-slate-600">
                科目
              </th>
              {months.map((m) => (
                <th
                  key={format(m, 'yyyy-MM')}
                  className="min-w-[3rem] px-1 py-2 text-center font-medium text-slate-600"
                >
                  {format(m, 'M月', { locale: ja })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profile.subjects.map((s) => {
              const sub = getSubjectById(s.subjectId);
              const byMonth = data.get(s.subjectId)!;
              return (
                <tr key={s.subjectId} className="border-t border-slate-100">
                  <td className="sticky left-0 z-10 bg-white py-2 font-medium text-slate-700">
                    {sub?.name ?? s.subjectId}
                  </td>
                  {months.map((m) => {
                    const monthKey = format(m, 'yyyy-MM');
                    const minutes = byMonth?.get(monthKey) ?? 0;
                    const bg = intensityToColor(minutes, Math.max(maxMinutes, 1));
                    return (
                      <td
                        key={monthKey}
                        className="border-l border-slate-100 px-1 py-2 text-center"
                        style={{ backgroundColor: bg }}
                        title={`${sub?.name ?? s.subjectId} ${format(m, 'yyyy年M月', { locale: ja })}末: 累計 ${minutes}分`}
                      >
                        {minutes > 0 ? (
                          <span className="font-medium text-slate-800">
                            {minutes >= 60 ? `${Math.floor(minutes / 60)}h` : `${minutes}m`}
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

      {maxMinutes > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <span>凡例:</span>
          <div className="flex items-center gap-1">
            <div
              className="h-3 w-4 rounded"
              style={{ backgroundColor: intensityToColor(0, 1) }}
            />
            <span>0分</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="h-3 w-4 rounded"
              style={{ backgroundColor: intensityToColor(maxMinutes * 0.5, maxMinutes) }}
            />
            <span>～{Math.round(maxMinutes * 0.5)}分</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="h-3 w-4 rounded"
              style={{ backgroundColor: intensityToColor(maxMinutes, maxMinutes) }}
            />
            <span>{maxMinutes}分</span>
          </div>
        </div>
      )}
    </section>
  );
}
