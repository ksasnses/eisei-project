/**
 * 忘却曲線に基づく復習タスク生成
 * docs/spec.md セクション3-3
 */

import { addDays, parseISO } from 'date-fns';
import type { StudyTask } from '../types';

const MAX_DAILY_REVIEW_MINUTES = 45;

/** 復習間隔（日） */
const INTERVALS = {
  memorization_heavy: [1, 3, 7, 14, 30],
  understanding_heavy: [3, 7, 14, 30],
  speed_training: [7, 14],
} as const;

function getIntervalsForType(
  pomodoroType: StudyTask['pomodoroType']
): readonly number[] {
  if (pomodoroType === 'memorization') return INTERVALS.memorization_heavy;
  if (pomodoroType === 'processing') return INTERVALS.speed_training;
  return INTERVALS.understanding_heavy;
}

function getSeriesKey(task: StudyTask): string {
  const d = task.reviewSource?.originalDate ?? task.completedAt ?? '';
  return `${task.subjectId}:${d.slice(0, 10)}`;
}

/** 完了済み復習の回番号を収集（originalDate ごと） */
function getCompletedReviewNumbers(completedTasks: StudyTask[]): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();
  for (const t of completedTasks) {
    if (!t.completed || !t.reviewSource) continue;
    const key = getSeriesKey(t);
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(t.reviewSource.reviewNumber);
  }
  return map;
}

/** 3回連続完了で卒業しているか */
function isGraduated(completedNumbers: Set<number>): boolean {
  return (
    completedNumbers.has(1) &&
    completedNumbers.has(2) &&
    completedNumbers.has(3)
  );
}

/**
 * 完了タスクから、指定日の復習タスクを生成する
 * - 1日の復習上限は45分。超えた分は返さない（翌日繰り越しは呼び出し側で扱う）
 */
export function generateReviewTasks(
  completedTasks: StudyTask[],
  currentDate: string
): StudyTask[] {
  const current = parseISO(currentDate);
  current.setHours(0, 0, 0, 0);
  const completedReviews = getCompletedReviewNumbers(completedTasks);

  const tasks: StudyTask[] = [];
  let totalMinutes = 0;

  const completedOriginals = completedTasks.filter(
    (t) => t.completed && t.completedAt && !t.reviewSource
  );

  for (const orig of completedOriginals) {
    const originalDateStr = orig.completedAt!.slice(0, 10);
    const originalDate = parseISO(originalDateStr);
    originalDate.setHours(0, 0, 0, 0);
    const intervals = getIntervalsForType(orig.pomodoroType);
    const seriesKey = `${orig.subjectId}:${originalDateStr}`;
    const completedSet = completedReviews.get(seriesKey) ?? new Set();

    if (isGraduated(completedSet)) continue;

    for (let i = 0; i < intervals.length; i++) {
      const reviewNumber = i + 1;
      if (completedSet.has(reviewNumber)) continue;

      const dueDate = addDays(originalDate, intervals[i]);
      dueDate.setHours(0, 0, 0, 0);
      if (dueDate.getTime() !== current.getTime()) continue;

      const workMinutes =
        orig.pomodoroType === 'memorization'
          ? 20
          : orig.pomodoroType === 'processing'
            ? 25
            : 30;
      if (totalMinutes + workMinutes > MAX_DAILY_REVIEW_MINUTES) break;

      const reviewTask: StudyTask = {
        id: `review-${orig.subjectId}-${originalDateStr}-${reviewNumber}-${currentDate}`,
        subjectId: orig.subjectId,
        type: 'review',
        content: `【復習 ${reviewNumber}回目】${orig.content}`,
        pomodoroType: orig.pomodoroType,
        pomodoroCount: 1,
        estimatedMinutes: workMinutes,
        reviewSource: {
          originalDate: originalDateStr,
          reviewNumber,
        },
        completed: false,
      };
      tasks.push(reviewTask);
      totalMinutes += workMinutes;
    }
  }

  return tasks;
}
