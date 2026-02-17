/**
 * 1日の学習計画を自動生成するエンジン
 * docs/spec.md セクション3・4
 */

import { parseISO, getDay } from 'date-fns';
import type {
  StudentProfile,
  EventDate,
  StudyTask,
  DailyPlan,
} from '../types';
import { getSubjectById } from '../constants/subjects';
import { getPomodoroConfig } from '../constants/pomodoroConfig';
import { detectPhase } from './phaseDetector';
import { allocateTime, type SubjectTimeAllocation } from './timeAllocation';
import { generateReviewTasks } from './forgettingCurve';

const AVAILABLE = {
  CLUB_DAY: 150,
  NO_CLUB_WEEKDAY: 270,
  WEEKEND_NO_EVENT: 360,
  MATCH_DAY: 60,
  EVENT_DAY: 30,
} as const;

const MIN_ENGLISH_MATH_MINUTES = 15;

function isDateInRange(dateStr: string, event: EventDate): boolean {
  const d = parseISO(dateStr);
  d.setHours(0, 0, 0, 0);
  const start = parseISO(event.date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + event.durationDays);
  end.setHours(0, 0, 0, 0);
  return d >= start && d <= end;
}

/**
 * 指定日が部活日・試合日・イベント日かどうかと利用可能時間（分）を返す
 */
function getAvailableMinutes(
  profile: StudentProfile,
  events: EventDate[],
  targetDate: string
): {
  availableMinutes: number;
  isClubDay: boolean;
  isMatchDay: boolean;
  isEventDay: boolean;
} {
  const dayOfWeek = getDay(parseISO(targetDate));
  const isClubDay = profile.dailySchedule.clubDays.includes(dayOfWeek);
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const isMatchDay = events.some(
    (e) => e.type === 'tennis_match' && isDateInRange(targetDate, e)
  );
  const isEventDay = events.some(
    (e) => e.type !== 'tennis_match' && isDateInRange(targetDate, e)
  );

  let availableMinutes: number;
  if (isMatchDay) availableMinutes = AVAILABLE.MATCH_DAY;
  else if (isEventDay) availableMinutes = AVAILABLE.EVENT_DAY;
  else if (isWeekend && !isClubDay) availableMinutes = AVAILABLE.WEEKEND_NO_EVENT;
  else if (isClubDay) availableMinutes = AVAILABLE.CLUB_DAY;
  else availableMinutes = AVAILABLE.NO_CLUB_WEEKDAY;

  return {
    availableMinutes,
    isClubDay,
    isMatchDay,
    isEventDay,
  };
}

/** 配分時間をポモドーロ単位のタスクに変換 */
function allocationToTasks(
  allocations: SubjectTimeAllocation[],
  profile: StudentProfile,
  targetDate: string,
  startId: number
): StudyTask[] {
  const tasks: StudyTask[] = [];
  let id = startId;

  const getContent = (subjectId: string): string => {
    const sub = getSubjectById(subjectId);
    const sel = profile.subjects.find((s) => s.subjectId === subjectId);
    const book = sel?.textbooks?.[0];
    const name = sub?.name ?? subjectId;
    if (book) return `${name} ${book}`;
    return `${name} 学習`;
  };

  for (const { subjectId, minutes } of allocations) {
    if (minutes <= 0) continue;
    const sub = getSubjectById(subjectId);
    const pomodoroType =
      sub?.studyType === 'mixed'
        ? sub.memorizationRatio >= 0.5
          ? 'memorization'
          : 'thinking'
        : (sub?.studyType ?? 'thinking');
    const config = getPomodoroConfig(pomodoroType);
    const workMin = config.workMinutes;
    const count = Math.max(1, Math.floor(minutes / workMin));
    const actualMinutes = count * workMin;

    tasks.push({
      id: `gen-${targetDate}-${id++}`,
      subjectId,
      type: 'new',
      content: getContent(subjectId),
      pomodoroType: pomodoroType as StudyTask['pomodoroType'],
      pomodoroCount: count,
      estimatedMinutes: actualMinutes,
      completed: false,
    });
  }
  return tasks;
}

/** タスクを配置順に並べる：復習 → 思考型 → 処理速度 → 暗記型 */
function orderTasks(tasks: StudyTask[]): StudyTask[] {
  const order: StudyTask['pomodoroType'][] = [
    'thinking',
    'processing',
    'memorization',
    'exam_practice',
  ];
  return [...tasks].sort((a, b) => {
    if (a.type === 'review' && b.type !== 'review') return -1;
    if (a.type !== 'review' && b.type === 'review') return 1;
    const ai = order.indexOf(a.pomodoroType);
    const bi = order.indexOf(b.pomodoroType);
    return ai - bi;
  });
}

/** 英語・数学に最低時間を保証（既存タスクに足りなければ追加） */
function ensureDailyPractice(
  tasks: StudyTask[],
  profile: StudentProfile,
  targetDate: string,
  startId: number
): StudyTask[] {
  const dailyIds = new Set(['eng_r', 'eng_l', 'math1a', 'math2bc']);
  const bySubject = new Map<string, number>();
  for (const t of tasks) {
    if (!dailyIds.has(t.subjectId)) continue;
    bySubject.set(t.subjectId, (bySubject.get(t.subjectId) ?? 0) + t.estimatedMinutes);
  }
  const toAdd: StudyTask[] = [];
  let id = startId;
  for (const subjectId of dailyIds) {
    if (!profile.subjects.some((s) => s.subjectId === subjectId)) continue;
    const current = bySubject.get(subjectId) ?? 0;
    if (current >= MIN_ENGLISH_MATH_MINUTES) continue;
    const sub = getSubjectById(subjectId);
    const type = sub?.studyType === 'memorization'
      ? 'memorization'
      : sub?.studyType === 'processing'
        ? 'processing'
        : 'thinking';
    const workMin = getPomodoroConfig(type).workMinutes;
    toAdd.push({
      id: `gen-${targetDate}-daily-${id++}`,
      subjectId,
      type: 'new',
      content: `${sub?.name ?? subjectId} 毎日学習`,
      pomodoroType: type as StudyTask['pomodoroType'],
      pomodoroCount: 1,
      estimatedMinutes: workMin,
      completed: false,
    });
  }
  return [...tasks, ...toAdd];
}

/**
 * 1日の学習計画を生成する
 */
export function generateDailyPlan(
  profile: StudentProfile,
  events: EventDate[],
  completedTasks: StudyTask[],
  targetDate: string
): DailyPlan {
  const phase = detectPhase(profile.examDate, targetDate);
  const {
    availableMinutes,
    isClubDay,
    isMatchDay,
    isEventDay,
  } = getAvailableMinutes(profile, events, targetDate);

  const reviewTasks = generateReviewTasks(completedTasks, targetDate);
  const reviewMinutes = reviewTasks.reduce((s, t) => s + t.estimatedMinutes, 0);
  const remainingMinutes = Math.max(0, availableMinutes - reviewMinutes);

  let newTasks: StudyTask[] = [];
  if (remainingMinutes > 0 && profile.subjects.length > 0) {
    const allocations = allocateTime(
      profile.subjects,
      remainingMinutes,
      phase
    );
    newTasks = allocationToTasks(
      allocations,
      profile,
      targetDate,
      reviewTasks.length + 1
    );
  }

  let allTasks = [...reviewTasks, ...newTasks];
  allTasks = ensureDailyPractice(allTasks, profile, targetDate, 1000);
  allTasks = orderTasks(allTasks);

  const completionRate = 0;

  return {
    date: targetDate,
    phase: phase.name,
    isClubDay,
    isMatchDay,
    isEventDay,
    availableMinutes,
    tasks: allTasks,
    completionRate,
  };
}
