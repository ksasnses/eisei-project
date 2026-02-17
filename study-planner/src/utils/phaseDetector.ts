/**
 * 学習フェーズの判定
 * docs/spec.md セクション3-1
 */

import { parseISO, differenceInDays } from 'date-fns';
import {
  getPhaseByDaysLeft,
  PHASE_CONFIGS,
  type PhaseName,
  type PhaseTimeAllocation,
} from '../constants/phaseConfig';

export interface Phase {
  name: PhaseName;
  daysLeft: number;
  timeAllocation: PhaseTimeAllocation;
}

/**
 * 試験日と対象日から学習フェーズを判定し、時間配分比率を返す
 * - 残り120日以上 → 基礎期
 * - 残り60〜119日 → 実践期
 * - 残り30日以内 → 直前期
 */
export function detectPhase(
  examDate: string,
  currentDate: string
): Phase {
  const exam = parseISO(examDate);
  const current = parseISO(currentDate);
  exam.setHours(0, 0, 0, 0);
  current.setHours(0, 0, 0, 0);
  const daysLeft = differenceInDays(exam, current);
  const daysLeftClamped = Math.max(0, daysLeft);

  const config = getPhaseByDaysLeft(daysLeftClamped);
  return {
    name: config.name,
    daysLeft: daysLeftClamped,
    timeAllocation: config.timeAllocation,
  };
}

export { PHASE_CONFIGS };
