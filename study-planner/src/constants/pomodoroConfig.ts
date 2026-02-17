/**
 * ポモドーロ設定（努力型生徒向け）
 * docs/spec.md セクション3-2 に基づく
 */

import type { PomodoroConfig } from '../types';

/** 本番形式演習は試験時間そのままのため workMinutes は可変。ここでは 80 をデフォルト表示用に使用 */
const EXAM_PRACTICE_DEFAULT_WORK_MINUTES = 80;

/**
 * 学習タイプ別ポモドーロ設定
 * - thinking: 30分+7分、3セットで長休憩、1日最大4セット
 * - memorization: 20分+5分、4セットで長休憩、1日最大6セット
 * - processing: 25分+5分、4セットで長休憩、1日最大4セット
 * - exam_practice: 試験時間そのまま（設定は参考値）
 */
export const POMODORO_CONFIGS: Record<string, PomodoroConfig & { maxDailySets?: number }> = {
  thinking: {
    workMinutes: 30,
    breakMinutes: 7,
    longBreakAfter: 3,
    longBreakMinutes: 20,
    maxDailySets: 4,
  },
  memorization: {
    workMinutes: 20,
    breakMinutes: 5,
    longBreakAfter: 4,
    longBreakMinutes: 15,
    maxDailySets: 6,
  },
  processing: {
    workMinutes: 25,
    breakMinutes: 5,
    longBreakAfter: 4,
    longBreakMinutes: 15,
    maxDailySets: 4,
  },
  exam_practice: {
    workMinutes: EXAM_PRACTICE_DEFAULT_WORK_MINUTES,
    breakMinutes: 10,
    longBreakAfter: 1,
    longBreakMinutes: 10,
    maxDailySets: 1,
  },
};

/** ポモドーロタイプから設定を取得（exam_practice は科目の試験時間で上書きする想定） */
export function getPomodoroConfig(
  type: keyof typeof POMODORO_CONFIGS
): PomodoroConfig {
  const c = POMODORO_CONFIGS[type];
  const { maxDailySets: _, ...config } = c;
  return config;
}
