import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { UsageGuideContent } from '../components/UsageGuideContent';

export function UsageGuidePage() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-800"
        >
          <ChevronLeft className="h-5 w-5" />
          戻る
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <UsageGuideContent />
      </div>
    </div>
  );
}
