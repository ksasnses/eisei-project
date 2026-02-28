import { useMemo } from 'react';
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
import { formatDateForInput } from '../utils/dateUtils';

/** 伸ばしやすさ 1〜5: 暗記型+苦手度低→高、思考型+苦手度高→低 */
function getEaseScore(
  memorizationRatio: number,
  difficulty: number
): number {
  const ease = memorizationRatio * 2 + (6 - difficulty);
  return Math.max(1, Math.min(5, Math.round(ease)));
}

export function ScoreStrategySimulator() {
  const profile = useStudentStore((s) => s.profile);
  const updateSubject = useStudentStore((s) => s.updateSubject);
  const generateDailyPlan = useStudyStore((s) => s.generateDailyPlan);

  if (!profile) return null;

  const totalCurrent = useMemo(
    () => profile.subjects.reduce((sum, s) => sum + s.currentScore, 0),
    [profile]
  );
  const totalTarget = useMemo(
    () => profile.subjects.reduce((sum, s) => sum + s.targetScore, 0),
    [profile]
  );
  const gapTotal = totalTarget - totalCurrent;

  const gapData = useMemo(() => {
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

  return (
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
          <p className="mb-3 text-xs text-slate-500">
            棒の長さ＝あと必要な得点数。色：緑＝ギャップ小／黄＝中／赤＝大。目標未達の科目のみ表示。
          </p>
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
  );
}
