/**
 * 1日の学習計画を自動生成するエンジン
 * docs/spec.md セクション3・4
 * ブロック方式: dayTemplates + determineDayType + blockToTasks
 */

import { parseISO, getDay, differenceInCalendarDays } from 'date-fns';
import type {
  StudentProfile,
  EventDate,
  StudyTask,
  DailyPlan,
  SelectedSubject,
  StudyBlock,
} from '../types';
import type { DayType } from '../types';
import type { PhaseName } from '../types';
import { getSubjectById } from '../constants/subjects';
import { getPomodoroConfig } from '../constants/pomodoroConfig';
import { detectPhase } from './phaseDetector';
import { type SubjectTimeAllocation } from './timeAllocation';
import { generateReviewTasks } from './forgettingCurve';
import { getAvailableMinutesFromSchedule } from './scheduleUtils';
import { getAdjustedTemplate } from '../constants/dayTemplates';
import type { DayTemplate } from '../types';

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
 * その日の日種別を判定する
 */
export function determineDayType(
  profile: StudentProfile,
  events: EventDate[],
  targetDate: string
): DayType {
  const schedule = profile.dailySchedule;

  const isMatchDay = events.some(
    (e) => e.type === 'tennis_match' && isDateInRange(targetDate, e)
  );
  if (isMatchDay) return 'match_day';

  const isEventDay = events.some(
    (e) => (e.type === 'school_event' || e.type === 'other') && isDateInRange(targetDate, e)
  );
  if (isEventDay) return 'event_day';

  const start = schedule.summerVacationStart?.trim() ?? '';
  const end = schedule.summerVacationEnd?.trim() ?? '';
  if (start && end && targetDate >= start && targetDate <= end) {
    const dayOfWeek = getDay(parseISO(targetDate));
    return schedule.clubDays.includes(dayOfWeek) ? 'summer_club' : 'summer_no_club';
  }

  const dayOfWeek = getDay(parseISO(targetDate));
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  if (isWeekend) return 'weekend_holiday';

  if (schedule.clubDays.includes(dayOfWeek)) return 'weekday_club';
  return 'weekday_no_club';
}

/**
 * 復習タスクを上限分に収める
 */
function capReviewTasks(
  reviewTasks: StudyTask[],
  maxReviewMinutes: number
): StudyTask[] {
  const total = reviewTasks.reduce((s, t) => s + t.estimatedMinutes, 0);
  if (total <= maxReviewMinutes) return reviewTasks;
  const workMin = getPomodoroConfig('thinking').workMinutes;
  let remaining = maxReviewMinutes;
  const result: StudyTask[] = [];
  for (const t of reviewTasks) {
    if (remaining <= 0) break;
    const take = Math.min(t.estimatedMinutes, remaining);
    const count = Math.max(0, Math.floor(take / workMin)) || (take > 0 ? 1 : 0);
    const estimatedMinutes = count * workMin;
    if (estimatedMinutes <= 0) continue;
    remaining -= estimatedMinutes;
    result.push({ ...t, pomodoroCount: count, estimatedMinutes });
  }
  return result;
}

function toPomodoroType(
  studyType: string,
  memorizationRatio: number
): StudyTask['pomodoroType'] {
  if (studyType === 'memorization') return 'memorization';
  if (studyType === 'processing') return 'processing';
  if (studyType === 'mixed') return memorizationRatio >= 0.5 ? 'memorization' : 'thinking';
  return 'thinking';
}

/**
 * StudyBlock を具体的な StudyTask の配列に変換する
 */
function blockToTasks(
  block: StudyBlock,
  selectedSubjects: SelectedSubject[],
  phase: PhaseName,
  targetDate: string,
  startIndex: number
): StudyTask[] {
  const tasks: StudyTask[] = [];
  const workMin = block.pomodoroWorkMinutes;
  let index = startIndex;

  const selectedIds = (block.subjectIds?.length ? block.subjectIds : []).filter((id) =>
    selectedSubjects.some((s) => s.subjectId === id)
  );
  const getSub = (id: string) => getSubjectById(id);
  const getPomoType = (id: string): StudyTask['pomodoroType'] => {
    const sub = getSub(id);
    return toPomodoroType(sub?.studyType ?? 'thinking', sub?.memorizationRatio ?? 0.5);
  };

  if (block.subjectCategory === 'english') {
    const hasR = selectedIds.includes('eng_r');
    const hasL = selectedIds.includes('eng_l');
    if (!hasR && !hasL) return [];
    const contents =
      phase === '基礎期'
        ? ['英単語暗記', '英文法・精読', 'リスニング基礎練習']
        : phase === '実践期'
          ? ['共テ形式 語彙問題', '共テ形式 長文読解', '共テ形式 リスニング演習']
          : ['過去問演習（リーディング）', '速読＋時間配分練習', '過去問演習（リスニング）'];
    const subjectIds =
      hasR && hasL
        ? ['eng_r', 'eng_l', 'eng_l']
        : hasR
          ? ['eng_r', 'eng_r', 'eng_r']
          : hasL
            ? ['eng_l', 'eng_l', 'eng_l']
            : [];
    for (let i = 0; i < block.pomodoroCount && i < contents.length; i++) {
      const subjectId = subjectIds[i] ?? subjectIds[0] ?? 'eng_r';
      tasks.push({
        id: `${subjectId}_${targetDate}_${index++}`,
        subjectId,
        type: 'new',
        content: contents[i] ?? '英語 学習',
        pomodoroType: getPomoType(subjectId),
        pomodoroCount: 1,
        estimatedMinutes: workMin,
        completed: false,
      });
    }
    return tasks;
  }

  if (block.subjectCategory === 'math') {
    const has1a = selectedIds.includes('math1a');
    const has2bc = selectedIds.includes('math2bc');
    const dayNum = differenceInCalendarDays(parseISO(targetDate), parseISO('2000-01-01'));
    const isOdd = dayNum % 2 === 1;
    const contents =
      phase === '基礎期'
        ? ['基本問題演習', '基本問題演習', '基本問題演習']
        : phase === '実践期'
          ? ['共テ形式演習（時間を測る）', '共テ形式演習（時間を測る）', '共テ形式演習（時間を測る）']
          : ['過去問演習', '過去問演習', '過去問演習'];
    let subIds: string[];
    if (has1a && has2bc) {
      subIds = isOdd
        ? ['math1a', 'math1a', 'math2bc']
        : ['math1a', 'math2bc', 'math2bc'];
    } else if (has1a) {
      subIds = ['math1a', 'math1a', 'math1a'];
    } else if (has2bc) {
      subIds = ['math2bc', 'math2bc', 'math2bc'];
    } else {
      subIds = [];
    }
    for (let i = 0; i < block.pomodoroCount && i < subIds.length; i++) {
      const subjectId = subIds[i] ?? subIds[0];
      if (!subjectId) break;
      tasks.push({
        id: `${subjectId}_${targetDate}_${index++}`,
        subjectId,
        type: 'new',
        content: contents[i] ?? '数学 学習',
        pomodoroType: getPomoType(subjectId),
        pomodoroCount: 1,
        estimatedMinutes: workMin,
        completed: false,
      });
    }
    return tasks;
  }

  if (block.subjectCategory === 'japanese') {
    const contents =
      phase === '基礎期'
        ? ['現代文 読解基礎', '古文単語・文法', '漢文 句法暗記']
        : phase === '実践期'
          ? ['共テ形式 現代文演習', '共テ形式 古文演習', '共テ形式 漢文演習']
          : ['過去問 現代文', '過去問 古文', '過去問 漢文'];
    const subjectId = selectedIds.includes('japanese') ? 'japanese' : null;
    if (!subjectId) return tasks;
    for (let i = 0; i < block.pomodoroCount; i++) {
      tasks.push({
        id: `${subjectId}_${targetDate}_${index++}`,
        subjectId,
        type: 'new',
        content: contents[i] ?? '国語 学習',
        pomodoroType: getPomoType(subjectId),
        pomodoroCount: 1,
        estimatedMinutes: workMin,
        completed: false,
      });
    }
    return tasks;
  }

  if (block.subjectCategory === 'science') {
    const ids = selectedIds.length > 0 ? selectedIds : block.subjectIds?.length ? block.subjectIds : [];
    if (ids.length === 0) return tasks;
    const dayNum = differenceInCalendarDays(parseISO(targetDate), parseISO('2000-01-01'));
    const contents =
      phase === '基礎期'
        ? ['基本問題演習', '基本問題演習']
        : phase === '実践期'
          ? ['共テ形式演習', '共テ形式演習']
          : ['過去問演習', '過去問演習'];
    for (let i = 0; i < block.pomodoroCount; i++) {
      const subjectId = ids[(dayNum + i) % ids.length]!;
      tasks.push({
        id: `${subjectId}_${targetDate}_${index++}`,
        subjectId,
        type: 'new',
        content: contents[i] ?? '理科 学習',
        pomodoroType: getPomoType(subjectId),
        pomodoroCount: 1,
        estimatedMinutes: workMin,
        completed: false,
      });
    }
    return tasks;
  }

  if (block.subjectCategory === 'social') {
    const ids = selectedIds.length > 0 ? selectedIds : block.subjectIds?.length ? block.subjectIds : [];
    if (ids.length === 0) return tasks;
    const dayNum = differenceInCalendarDays(parseISO(targetDate), parseISO('2000-01-01'));
    const contents =
      phase === '基礎期'
        ? ['教科書確認＋一問一答', '教科書確認＋一問一答']
        : phase === '実践期'
          ? ['共テ形式演習', '共テ形式演習']
          : ['過去問＋暗記最終確認', '過去問＋暗記最終確認'];
    for (let i = 0; i < block.pomodoroCount; i++) {
      const subjectId = ids[(dayNum + i) % ids.length]!;
      tasks.push({
        id: `${subjectId}_${targetDate}_${index++}`,
        subjectId,
        type: 'new',
        content: contents[i] ?? '社会 学習',
        pomodoroType: getPomoType(subjectId),
        pomodoroCount: 1,
        estimatedMinutes: workMin,
        completed: false,
      });
    }
    return tasks;
  }

  if (block.subjectCategory === 'info') {
    const subjectId = selectedIds.includes('info1') ? 'info1' : block.subjectIds?.[0];
    if (!subjectId) return tasks;
    const content =
      phase === '基礎期'
        ? '基礎知識（2進数、論理回路等）'
        : phase === '実践期'
          ? 'プログラミング問題演習'
          : '予想問題演習';
    for (let i = 0; i < block.pomodoroCount; i++) {
      tasks.push({
        id: `${subjectId}_${targetDate}_${index++}`,
        subjectId,
        type: 'new',
        content,
        pomodoroType: getPomoType(subjectId),
        pomodoroCount: 1,
        estimatedMinutes: workMin,
        completed: false,
      });
    }
    return tasks;
  }

  if (block.subjectCategory === 'review') {
    const memorizationIds = selectedSubjects
      .filter((s) => {
        const sub = getSub(s.subjectId);
        return sub && (sub.memorizationRatio >= 0.5 || sub.studyType === 'memorization');
      })
      .map((s) => s.subjectId);
    const reviewContents = ['英単語確認', '古文単語確認', '社会 一問一答'];
    for (let i = 0; i < block.pomodoroCount; i++) {
      const subjectId = memorizationIds[i % memorizationIds.length] ?? memorizationIds[0];
      if (!subjectId) break;
      const content = reviewContents[i % reviewContents.length] ?? '暗記確認';
      tasks.push({
        id: `${subjectId}_${targetDate}_${index++}`,
        subjectId,
        type: 'review',
        content,
        pomodoroType: 'memorization',
        pomodoroCount: 1,
        estimatedMinutes: workMin,
        completed: false,
      });
    }
    return tasks;
  }

  return tasks;
}

/**
 * 指定日が部活日・試合日・イベント日かどうかと利用可能時間（分）を返す。
 * 利用可能時間はスケジュール設定から計算し、ホーム・設定の勉強可能時間と一致させる。
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
  const isMatchDay = events.some(
    (e) => e.type === 'tennis_match' && isDateInRange(targetDate, e)
  );
  const isEventDay = events.some(
    (e) => e.type !== 'tennis_match' && isDateInRange(targetDate, e)
  );

  const availableMinutes = getAvailableMinutesFromSchedule(
    profile,
    events,
    targetDate
  );

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

/**
 * タスク合計を勉強可能時間以内に収める。復習を優先し、新規・毎日学習を削る。
 * 試験当日までにノルマを達成するため、復習は維持する。
 */
function capTasksToAvailable(
  tasks: StudyTask[],
  availableMinutes: number
): StudyTask[] {
  const total = tasks.reduce((s, t) => s + t.estimatedMinutes, 0);
  if (total <= availableMinutes) return tasks;

  const isReview = (t: StudyTask) => t.type === 'review' || t.reviewSource != null;
  const reviewTasks = tasks.filter(isReview);
  const otherTasks = tasks.filter((t) => !isReview(t));
  const reviewTotal = reviewTasks.reduce((s, t) => s + t.estimatedMinutes, 0);

  const workMin = getPomodoroConfig('thinking').workMinutes;

  if (reviewTotal >= availableMinutes) {
    const ratio = availableMinutes / reviewTotal;
    const cappedReview = reviewTasks.map((t) => {
      const min = Math.max(workMin, Math.floor((t.estimatedMinutes * ratio) / workMin) * workMin);
      const count = Math.max(1, Math.floor(min / workMin));
      return { ...t, estimatedMinutes: count * workMin, pomodoroCount: count };
    });
    let sum = cappedReview.reduce((s, t) => s + t.estimatedMinutes, 0);
    if (sum > availableMinutes) {
      const last = cappedReview[cappedReview.length - 1];
      if (last) {
        const reduce = sum - availableMinutes;
        const newMin = Math.max(workMin, last.estimatedMinutes - reduce);
        const count = Math.max(1, Math.floor(newMin / workMin));
        cappedReview[cappedReview.length - 1] = { ...last, estimatedMinutes: count * workMin, pomodoroCount: count };
      }
    }
    return cappedReview.filter((t) => t.estimatedMinutes > 0);
  }

  const remainingForOthers = availableMinutes - reviewTotal;
  let used = 0;
  const cappedOther: StudyTask[] = [];
  for (const t of otherTasks) {
    const take = Math.min(t.estimatedMinutes, Math.max(0, remainingForOthers - used));
    if (take <= 0) continue;
    const count = Math.max(0, Math.floor(take / workMin)) || (take > 0 ? 1 : 0);
    const estimatedMinutes = count * workMin;
    if (estimatedMinutes <= 0) continue;
    used += estimatedMinutes;
    cappedOther.push({ ...t, pomodoroCount: count, estimatedMinutes });
  }
  return [...reviewTasks, ...cappedOther];
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

/** 削減優先順位（小さいほど先に削る）: 情報→社会→理科→国語→数学→英語 */
const REDUCE_PRIORITY: Record<string, number> = {
  info: 0,
  social: 1,
  science: 2,
  japanese: 3,
  math: 4,
  english: 5,
  review: 99,
};

/**
 * 実際の利用可能時間がテンプレート合計より少ない場合、
 * ブロックを後ろから削減（情報→社会→理科→国語→英語・数学は最低60分まで）
 */
function reduceTemplateToFit(
  template: DayTemplate,
  actualAvailableMinutes: number
): DayTemplate {
  const reviewReserved = template.maxReviewMinutes;
  const actualForBlocks = Math.max(0, actualAvailableMinutes - reviewReserved);
  if (template.totalStudyMinutes <= actualForBlocks) {
    return template;
  }

  const blocks = template.blocks
    .filter((b) => b.subjectCategory !== 'review')
    .map((b) => ({ ...b, durationMinutes: b.durationMinutes, pomodoroCount: b.pomodoroCount }));
  const sorted = [...blocks].sort((a, b) => {
    if (b.order !== a.order) return b.order - a.order;
    return (REDUCE_PRIORITY[a.subjectCategory] ?? 99) - (REDUCE_PRIORITY[b.subjectCategory] ?? 99);
  });

  let total = blocks.reduce((s, b) => s + b.durationMinutes, 0);
  const minPomoForEnglishMath = 2;
  const workMin = 30;

  for (const block of sorted) {
    if (total <= actualForBlocks) break;
    const current = blocks.find((b) => b.order === block.order && b.subjectCategory === block.subjectCategory);
    if (!current || current.durationMinutes <= 0) continue;
    const isEnglishOrMath = current.subjectCategory === 'english' || current.subjectCategory === 'math';
    const minPomo = isEnglishOrMath ? minPomoForEnglishMath : 0;
    if (current.pomodoroCount <= minPomo) continue;

    const removeEntire = total - current.durationMinutes <= actualForBlocks;
    if (removeEntire && minPomo === 0) {
      total -= current.durationMinutes;
      current.durationMinutes = 0;
      current.pomodoroCount = 0;
      continue;
    }
    const newPomo = Math.max(minPomo, current.pomodoroCount - 1);
    const newDuration = newPomo * (current.pomodoroWorkMinutes || workMin);
    total -= current.durationMinutes - newDuration;
    current.durationMinutes = newDuration;
    current.pomodoroCount = newPomo;
  }

  const kept = blocks.filter((b) => b.durationMinutes > 0);
  const newTotal = kept.reduce((s, b) => s + b.durationMinutes, 0);
  return {
    ...template,
    blocks: kept,
    totalStudyMinutes: newTotal,
  };
}

/**
 * 1日の学習計画を生成する（ブロック方式）
 * 実際の利用可能時間とテンプレートを比較し、必要ならブロックを削減する。
 */
export function generateDailyPlan(
  profile: StudentProfile,
  events: EventDate[],
  completedTasks: StudyTask[],
  targetDate: string
): DailyPlan {
  const dayType = determineDayType(profile, events, targetDate);
  const phase = detectPhase(profile.examDate, targetDate);
  const selectedIds = profile.subjects.map((s) => s.subjectId);
  let { template } = getAdjustedTemplate(dayType, selectedIds);

  const actualAvailableMinutes = getAvailableMinutesFromSchedule(profile, events, targetDate);
  template = reduceTemplateToFit(template, actualAvailableMinutes);

  const reviewTasks = generateReviewTasks(completedTasks, targetDate);
  const cappedReviewTasks = capReviewTasks(reviewTasks, template.maxReviewMinutes);

  const blockTasks: StudyTask[] = [];
  let taskIndex = 0;
  for (const block of template.blocks) {
    if (block.subjectCategory === 'review') continue;
    const tasks = blockToTasks(block, profile.subjects, phase.name, targetDate, taskIndex);
    blockTasks.push(...tasks);
    taskIndex += tasks.length;
  }

  const allTasks = [...cappedReviewTasks, ...blockTasks];
  const totalAvailable = template.totalStudyMinutes + template.maxReviewMinutes;
  const finalTasks = capTasksToAvailable(allTasks, totalAvailable);

  return {
    date: targetDate,
    phase: phase.name,
    isClubDay: dayType === 'weekday_club' || dayType === 'summer_club',
    isMatchDay: dayType === 'match_day',
    isEventDay: dayType === 'event_day',
    availableMinutes: actualAvailableMinutes,
    tasks: finalTasks,
    completionRate: 0,
  };
}

/** 将来のブロック内配分等で利用するため残している既存関数（allocateTime は timeAllocation.ts にあり） */
export {
  getAvailableMinutes,
  allocationToTasks,
  orderTasks,
  ensureDailyPractice,
};
