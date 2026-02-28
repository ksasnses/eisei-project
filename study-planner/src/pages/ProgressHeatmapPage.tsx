import { MonthlyProgressHeatmap } from '../components/MonthlyProgressHeatmap';
import { PlannedProgressHeatmap } from '../components/PlannedProgressHeatmap';
import { useStudentStore } from '../stores/studentStore';

export function ProgressHeatmapPage() {
  const profile = useStudentStore((s) => s.profile);

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-4">
      <h1 className="mb-4 text-xl font-semibold text-slate-800">
        学習進捗
      </h1>
      <div className="space-y-8">
        <section>
          <MonthlyProgressHeatmap />
        </section>
        <section>
          <PlannedProgressHeatmap />
        </section>
      </div>
    </div>
  );
}
