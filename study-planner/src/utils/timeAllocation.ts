/**
 * 科目間の時間配分計算
 * docs/spec.md セクション4-2
 */

import type { SelectedSubject } from '../types';
import type { Phase } from './phaseDetector';
import { getSubjectById } from '../constants/subjects';

export interface SubjectTimeAllocation {
  subjectId: string;
  minutes: number;
}

const WEIGHT_DIFFICULTY = 0.3;
const WEIGHT_SCORE = 0.2;
const WEIGHT_GROWTH = 0.25;
const WEIGHT_EFFICIENCY = 0.15;
const WEIGHT_DAILY_NEED = 0.1;
const MAX_PCT_PER_SUBJECT = 0.25;
const MIN_MINUTES_DAILY_SUBJECT = 15;

/** 英語・数学の科目ID（毎日継続を保証） */
const DAILY_PRACTICE_SUBJECT_IDS = new Set([
  'eng_r',
  'eng_l',
  'math1a',
  'math2bc',
]);

/**
 * 利用可能時間を科目ごとに配分する
 * - 苦手度 30%: 苦手なほど多く。1科目あたり最大25%
 * - 配点の重み 20%
 * - 伸びしろ 25%: (目標-現在) が大きいほど
 * - 学習効率 15%: 暗記は直前期に増、思考型は早期から
 * - 毎日継続 10%: 英語・数学は最低15分保証
 */
export function allocateTime(
  subjects: SelectedSubject[],
  availableMinutes: number,
  phase: Phase
): SubjectTimeAllocation[] {
  if (subjects.length === 0 || availableMinutes <= 0) {
    return [];
  }

  const totalScore = subjects.reduce(
    (sum, s) => sum + (getSubjectById(s.subjectId)?.score ?? 100),
    0
  );

  const scores: { subjectId: string; rawScore: number }[] = subjects.map(
    (s) => {
      const sub = getSubjectById(s.subjectId);
      const difficultyNorm = (6 - s.difficulty) / 5;
      const scoreNorm = sub ? sub.score / Math.max(totalScore, 1) : 1 / subjects.length;
      const growth = Math.max(0, s.targetScore - s.currentScore) / 100;
      const isCramming = sub?.crammingEffective ?? false;
      const efficiency =
        phase.name === '直前期' && isCramming
          ? 1.2
          : sub?.studyType === 'thinking'
            ? 1.0
            : 0.9;
      const dailyNeed = DAILY_PRACTICE_SUBJECT_IDS.has(s.subjectId) ? 1 : 0.3;

      const rawScore =
        WEIGHT_DIFFICULTY * difficultyNorm +
        WEIGHT_SCORE * scoreNorm +
        WEIGHT_GROWTH * growth +
        WEIGHT_EFFICIENCY * efficiency +
        WEIGHT_DAILY_NEED * dailyNeed;

      return { subjectId: s.subjectId, rawScore };
    }
  );

  const totalRaw = scores.reduce((sum, x) => sum + x.rawScore, 0);
  if (totalRaw <= 0) {
    return subjects.map((s) => ({
      subjectId: s.subjectId,
      minutes: Math.floor(availableMinutes / subjects.length),
    }));
  }

  let allocations = scores.map(({ subjectId, rawScore }) => ({
    subjectId,
    minutes: Math.round((rawScore / totalRaw) * availableMinutes),
  }));

  const cap = Math.floor(availableMinutes * MAX_PCT_PER_SUBJECT);
  allocations = allocations.map((a) => ({
    ...a,
    minutes: Math.min(a.minutes, cap),
  }));

  const currentTotal = allocations.reduce((sum, a) => sum + a.minutes, 0);
  if (currentTotal !== availableMinutes) {
    const diff = availableMinutes - currentTotal;
    const idx = allocations.findIndex((a) =>
      DAILY_PRACTICE_SUBJECT_IDS.has(a.subjectId)
    );
    const adjustIdx = idx >= 0 ? idx : 0;
    allocations[adjustIdx] = {
      ...allocations[adjustIdx],
      minutes: allocations[adjustIdx].minutes + diff,
    };
  }

  for (const subjectId of DAILY_PRACTICE_SUBJECT_IDS) {
    const found = allocations.find((a) => a.subjectId === subjectId);
    if (found && found.minutes < MIN_MINUTES_DAILY_SUBJECT) {
      found.minutes = MIN_MINUTES_DAILY_SUBJECT;
    }
  }

  const finalTotal = allocations.reduce((sum, a) => sum + a.minutes, 0);
  if (finalTotal > availableMinutes) {
    const excess = finalTotal - availableMinutes;
    const nonDaily = allocations.filter(
      (a) => !DAILY_PRACTICE_SUBJECT_IDS.has(a.subjectId)
    );
    for (let i = 0; i < excess && nonDaily.length > 0; i++) {
      const a = allocations.find((x) => x.subjectId === nonDaily[i % nonDaily.length].subjectId);
      if (a && a.minutes > 0) {
        a.minutes = Math.max(0, a.minutes - 1);
      }
    }
  }

  return allocations.filter((a) => a.minutes > 0);
}
