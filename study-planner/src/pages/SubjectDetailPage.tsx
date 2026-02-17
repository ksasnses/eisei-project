import { useParams } from 'react-router-dom';

export function SubjectDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-secondary">
        科目詳細ページ（準備中）{id != null && ` - ID: ${id}`}
      </h2>
    </div>
  );
}
