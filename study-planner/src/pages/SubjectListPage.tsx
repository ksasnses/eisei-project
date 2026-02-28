import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useStudentStore } from '../stores/studentStore';
import { getSubjectById } from '../constants/subjects';
import { ScoreStrategySimulator } from '../components/ScoreStrategySimulator';

const CATEGORY_COLORS: Record<string, string> = {
  地歴公民: 'bg-amber-100 text-amber-800',
  国語: 'bg-green-100 text-green-800',
  外国語: 'bg-blue-100 text-blue-800',
  理科: 'bg-purple-100 text-purple-800',
  数学: 'bg-indigo-100 text-indigo-800',
  情報: 'bg-slate-100 text-slate-800',
};

export function SubjectListPage() {
  const profile = useStudentStore((s) => s.profile);

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <h1 className="mb-6 text-xl font-semibold text-slate-800">受験科目</h1>

      <ScoreStrategySimulator />

      <ul className="mt-8 space-y-2">
        {profile.subjects.map((s) => {
          const subject = getSubjectById(s.subjectId);
          const color =
            subject ? CATEGORY_COLORS[subject.category] ?? 'bg-slate-100 text-slate-800' : 'bg-slate-100 text-slate-800';
          return (
            <li key={s.subjectId}>
              <Link
                to={`/subjects/${s.subjectId}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200"
              >
                <div>
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${color}`}
                  >
                    {subject?.name ?? s.subjectId}
                  </span>
                  <p className="mt-1 text-sm text-slate-500">
                    {s.currentScore}点 → 目標{s.targetScore}点
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
