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
import type { Textbook } from '../types';
import { unitLabelToDisplay } from '../stores/curriculumStore';
import type { DayType } from '../types';
import type { PhaseName } from '../types';
import { getSubjectById } from '../constants/subjects';
import { getPomodoroConfig } from '../constants/pomodoroConfig';
import { useRuleConfigStore } from '../stores/ruleConfigStore';
import { useCurriculumStore } from '../stores/curriculumStore';
import { detectPhase } from './phaseDetector';
import { type SubjectTimeAllocation } from './timeAllocation';
import { generateReviewTasks } from './forgettingCurve';
import { getAvailableMinutesFromSchedule } from './scheduleUtils';
import { getAdjustedTemplate } from '../constants/dayTemplates';

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

function getPhaseContents(
  subjectCategory: string,
  phase: PhaseName
): string[] {
  const pc = useRuleConfigStore
    .getState()
    .config.phaseContents.find(
      (p) => p.subjectCategory === subjectCategory && p.phase === phase
    );
  return pc?.contents ?? [];
}

/** 教材からタスク用のコンテンツ文字列を生成 */
function textbookTaskContent(textbook: Textbook, unitIndex: number): string {
  const unitLabel = unitLabelToDisplay(textbook.unitLabel, textbook.customUnitLabel);
  return `${textbook.name} 第${unitIndex + 1}${unitLabel}`;
}

/** ブロック用の有効教材リスト（一時停止・完了済みを除外）を取得 */
function getActiveTextbooksForBlock(
  subjectIds: string[]
): { textbook: Textbook; subjectId: string }[] {
  const getTextbooks = useCurriculumStore.getState().getTextbooks;
  const result: { textbook: Textbook; subjectId: string }[] = [];
  for (const subjectId of subjectIds) {
    const list = getTextbooks(subjectId).filter(
      (t) => t.status === 'active' && t.completedUnitCount < t.totalUnits
    );
    for (const t of list) {
      result.push({ textbook: t, subjectId });
    }
  }
  return result.sort((a, b) => a.textbook.priority - b.textbook.priority);
}

/**
 * 教材をポモドーロ数に分配
 * pomodoroCount >= 教材数: 各1 + 残りは優先度順
 * pomodoroCount < 教材数: 日替わりローテーション
 */
function distributeTextbooksToPomodoros(
  items: { textbook: Textbook; subjectId: string }[],
  pomodoroCount: number,
  targetDate: string
): { textbook: Textbook; subjectId: string }[] {
  if (items.length === 0) return [];
  if (pomodoroCount >= items.length) {
    const base = items.map((x) => x);
    const extra = pomodoroCount - items.length;
    for (let i = 0; i < extra; i++) {
      base.push(items[i % items.length]!);
    }
    return base.sort((a, b) => a.textbook.priority - b.textbook.priority);
  }
  const dayNum = differenceInCalendarDays(parseISO(targetDate), parseISO('2000-01-01'));
  const result: { textbook: Textbook; subjectId: string }[] = [];
  for (let i = 0; i < pomodoroCount; i++) {
    const idx = (dayNum * pomodoroCount + i) % items.length;
    result.push(items[idx]!);
  }
  return result;
}

/**
 * StudyBlock を具体的な StudyTask の配列に変換する
 * 教材が登録されていれば教材ベース、なければフェーズ内容で生成
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
    const items = getActiveTextbooksForBlock(selectedIds);
    if (items.length > 0) {
      const distributed = distributeTextbooksToPomodoros(
        items,
        block.pomodoroCount,
        targetDate
      );
      const unitOffsetByTb = new Map<string, number>();
      for (const { textbook, subjectId } of distributed) {
        const offset = unitOffsetByTb.get(textbook.id) ?? 0;
        const unitIndex = textbook.completedUnitCount + offset;
        if (unitIndex >= textbook.totalUnits) continue;
        unitOffsetByTb.set(textbook.id, offset + 1);
        const estMin = textbook.minutesPerUnit;
        tasks.push({
          id: `${textbook.id}_${targetDate}_${index++}`,
          subjectId,
          type: 'new',
          content: textbookTaskContent(textbook, unitIndex),
          pomodoroType: getPomoType(subjectId),
          pomodoroCount: 1,
          estimatedMinutes: estMin,
          completed: false,
          textbookId: textbook.id,
          unitIndex,
        });
      }
      return tasks;
    }
    const contents = getPhaseContents('english', phase);
    const subjectIds =
      hasR && hasL ? ['eng_r', 'eng_l', 'eng_l'] : hasR ? ['eng_r', 'eng_r', 'eng_r'] : ['eng_l', 'eng_l', 'eng_l'];
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
    if (!has1a && !has2bc) return [];
    const items = getActiveTextbooksForBlock(selectedIds);
    if (items.length > 0) {
      const mathAlternate = useRuleConfigStore.getState().config.generalRules.mathAlternate;
      const dayNum = differenceInCalendarDays(parseISO(targetDate), parseISO('2000-01-01'));
      const isOdd = dayNum % 2 === 1;
      const items1a = items.filter((x) => x.subjectId === 'math1a');
      const items2bc = items.filter((x) => x.subjectId === 'math2bc');
      let distributed: { textbook: Textbook; subjectId: string }[];
      if (has1a && has2bc && mathAlternate) {
        const p1a = isOdd ? 2 : 1;
        const p2bc = isOdd ? 1 : 2;
        distributed = [
          ...distributeTextbooksToPomodoros(items1a, Math.min(p1a, block.pomodoroCount), targetDate),
          ...distributeTextbooksToPomodoros(
            items2bc,
            Math.min(p2bc, Math.max(0, block.pomodoroCount - p1a)),
            targetDate
          ),
        ].slice(0, block.pomodoroCount);
      } else {
        distributed = distributeTextbooksToPomodoros(items, block.pomodoroCount, targetDate);
      }
      const unitOffsetByTb = new Map<string, number>();
      for (const { textbook, subjectId } of distributed) {
        const offset = unitOffsetByTb.get(textbook.id) ?? 0;
        const unitIndex = textbook.completedUnitCount + offset;
        if (unitIndex >= textbook.totalUnits) continue;
        unitOffsetByTb.set(textbook.id, offset + 1);
        tasks.push({
          id: `${textbook.id}_${targetDate}_${index++}`,
          subjectId,
          type: 'new',
          content: textbookTaskContent(textbook, unitIndex),
          pomodoroType: getPomoType(subjectId),
          pomodoroCount: 1,
          estimatedMinutes: textbook.minutesPerUnit,
          completed: false,
          textbookId: textbook.id,
          unitIndex,
        });
      }
      return tasks;
    }
    const contents = getPhaseContents('math', phase);
    const dayNum = differenceInCalendarDays(parseISO(targetDate), parseISO('2000-01-01'));
    const isOdd = dayNum % 2 === 1;
    const mathAlternate = useRuleConfigStore.getState().config.generalRules.mathAlternate;
    let subIds: string[];
    if (has1a && has2bc) {
      subIds = mathAlternate
        ? isOdd ? ['math1a', 'math1a', 'math2bc'] : ['math1a', 'math2bc', 'math2bc']
        : ['math1a', 'math2bc', 'math1a'];
    } else if (has1a) {
      subIds = ['math1a', 'math1a', 'math1a'];
    } else {
      subIds = ['math2bc', 'math2bc', 'math2bc'];
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
    const subjectId = selectedIds.includes('japanese') ? 'japanese' : null;
    if (!subjectId) return tasks;
    const items = getActiveTextbooksForBlock([subjectId]);
    if (items.length > 0) {
      const order: Array<'modern' | 'classical' | 'chinese' | 'general'> = ['modern', 'classical', 'chinese'];
      const bySub: Record<string, { textbook: Textbook; subjectId: string }[]> = {
        modern: [],
        classical: [],
        chinese: [],
        general: [],
      };
      for (const x of items) {
        const sub = x.textbook.subCategory ?? 'general';
        bySub[sub].push(x);
      }
      const distributed: { textbook: Textbook; subjectId: string }[] = [];
      for (let i = 0; i < block.pomodoroCount; i++) {
        const preferred = order[i % 3];
        const list = bySub[preferred].length > 0 ? bySub[preferred] : [...bySub.modern, ...bySub.classical, ...bySub.chinese, ...bySub.general];
        if (list.length === 0) break;
        const pick = list[i % list.length]!;
        distributed.push(pick);
      }
      const unitOffsetByTb = new Map<string, number>();
      for (const { textbook, subjectId: sid } of distributed) {
        const offset = unitOffsetByTb.get(textbook.id) ?? 0;
        const unitIndex = textbook.completedUnitCount + offset;
        if (unitIndex >= textbook.totalUnits) continue;
        unitOffsetByTb.set(textbook.id, offset + 1);
        tasks.push({
          id: `${textbook.id}_${targetDate}_${index++}`,
          subjectId: sid,
          type: 'new',
          content: textbookTaskContent(textbook, unitIndex),
          pomodoroType: getPomoType(sid),
          pomodoroCount: 1,
          estimatedMinutes: textbook.minutesPerUnit,
          completed: false,
          textbookId: textbook.id,
          unitIndex,
        });
      }
      return tasks;
    }
    const contents = getPhaseContents('japanese', phase);
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
    const items = getActiveTextbooksForBlock(ids);
    if (items.length > 0) {
      const distributed = distributeTextbooksToPomodoros(items, block.pomodoroCount, targetDate);
      const unitOffsetByTb = new Map<string, number>();
      for (const { textbook, subjectId } of distributed) {
        const offset = unitOffsetByTb.get(textbook.id) ?? 0;
        const unitIndex = textbook.completedUnitCount + offset;
        if (unitIndex >= textbook.totalUnits) continue;
        unitOffsetByTb.set(textbook.id, offset + 1);
        tasks.push({
          id: `${textbook.id}_${targetDate}_${index++}`,
          subjectId,
          type: 'new',
          content: textbookTaskContent(textbook, unitIndex),
          pomodoroType: getPomoType(subjectId),
          pomodoroCount: 1,
          estimatedMinutes: textbook.minutesPerUnit,
          completed: false,
          textbookId: textbook.id,
          unitIndex,
        });
      }
      return tasks;
    }
    const dayNum = differenceInCalendarDays(parseISO(targetDate), parseISO('2000-01-01'));
    const scienceRotation = useRuleConfigStore.getState().config.generalRules.scienceRotation;
    const contents = getPhaseContents('science', phase);
    for (let i = 0; i < block.pomodoroCount; i++) {
      const subjectId = scienceRotation ? ids[(dayNum + i) % ids.length]! : ids[i % ids.length]!;
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
    const items = getActiveTextbooksForBlock(ids);
    if (items.length > 0) {
      const distributed = distributeTextbooksToPomodoros(items, block.pomodoroCount, targetDate);
      const unitOffsetByTb = new Map<string, number>();
      for (const { textbook, subjectId } of distributed) {
        const offset = unitOffsetByTb.get(textbook.id) ?? 0;
        const unitIndex = textbook.completedUnitCount + offset;
        if (unitIndex >= textbook.totalUnits) continue;
        unitOffsetByTb.set(textbook.id, offset + 1);
        tasks.push({
          id: `${textbook.id}_${targetDate}_${index++}`,
          subjectId,
          type: 'new',
          content: textbookTaskContent(textbook, unitIndex),
          pomodoroType: getPomoType(subjectId),
          pomodoroCount: 1,
          estimatedMinutes: textbook.minutesPerUnit,
          completed: false,
          textbookId: textbook.id,
          unitIndex,
        });
      }
      return tasks;
    }
    const dayNum = differenceInCalendarDays(parseISO(targetDate), parseISO('2000-01-01'));
    const socialRotation = useRuleConfigStore.getState().config.generalRules.socialRotation;
    const contents = getPhaseContents('social', phase);
    for (let i = 0; i < block.pomodoroCount; i++) {
      const subjectId = socialRotation ? ids[(dayNum + i) % ids.length]! : ids[i % ids.length]!;
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
    const items = getActiveTextbooksForBlock([subjectId]);
    if (items.length > 0) {
      const distributed = distributeTextbooksToPomodoros(items, block.pomodoroCount, targetDate);
      const unitOffsetByTb = new Map<string, number>();
      for (const { textbook, subjectId: sid } of distributed) {
        const offset = unitOffsetByTb.get(textbook.id) ?? 0;
        const unitIndex = textbook.completedUnitCount + offset;
        if (unitIndex >= textbook.totalUnits) continue;
        unitOffsetByTb.set(textbook.id, offset + 1);
        tasks.push({
          id: `${textbook.id}_${targetDate}_${index++}`,
          subjectId: sid,
          type: 'new',
          content: textbookTaskContent(textbook, unitIndex),
          pomodoroType: getPomoType(sid),
          pomodoroCount: 1,
          estimatedMinutes: textbook.minutesPerUnit,
          completed: false,
          textbookId: textbook.id,
          unitIndex,
        });
      }
      return tasks;
    }
    const contents = getPhaseContents('info', phase);
    const content = contents[0] ?? '情報 学習';
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

function getCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    english: '英語',
    math: '数学',
    japanese: '国語',
    science: '理科',
    social: '社会',
    info: '情報',
  };
  return map[category] ?? category;
}

/**
 * 生活スケジュールから計算した勉強可能時間にゆとりを適用し、
 * 実際にタスクを配置できる「実効勉強時間」を返す
 */
function calcEffectiveMinutes(
  rawAvailableMinutes: number,
  bufferRatio: number = 0.15
): {
  effectiveMinutes: number;
  bufferMinutes: number;
  rawMinutes: number;
} {
  const bufferMinutes = Math.ceil(rawAvailableMinutes * bufferRatio);
  const effectiveMinutes = rawAvailableMinutes - bufferMinutes;
  return {
    effectiveMinutes: Math.max(effectiveMinutes, 0),
    bufferMinutes,
    rawMinutes: rawAvailableMinutes,
  };
}

/** fitBlocksToTime 用のブロック型（StudyBlock互換） */
interface FittableBlock {
  subjectCategory: string;
  subjectIds: string[];
  durationMinutes: number;
  pomodoroCount: number;
  pomodoroWorkMinutes: number;
  label: string;
  order: number;
}

/**
 * テンプレートのブロック合計が実効勉強時間を超える場合、
 * 優先度の低いブロックから削減して収める。
 */
function fitBlocksToTime(
  blocks: FittableBlock[],
  effectiveMinutes: number,
  maxReviewMinutes: number
): { fittedBlocks: FittableBlock[]; reviewMinutes: number; totalMinutes: number; adjustedBlocks: string[] } {
  const adjustedBlocks: string[] = [];
  const reviewCap = Math.min(maxReviewMinutes, Math.floor(effectiveMinutes * 0.2));
  let remaining = effectiveMinutes - reviewCap;

  let activeBlocks = blocks
    .filter((b) => b.subjectCategory !== 'review')
    .map((b) => ({ ...b }))
    .sort((a, b) => a.order - b.order);

  const totalBlockMinutes = activeBlocks.reduce((s, b) => s + b.durationMinutes, 0);
  if (totalBlockMinutes <= remaining) {
    return {
      fittedBlocks: activeBlocks,
      reviewMinutes: reviewCap,
      totalMinutes: reviewCap + totalBlockMinutes,
      adjustedBlocks: [],
    };
  }

  const cutOrder = ['info', 'social', 'science', 'japanese'] as const;
  let fitted = [...activeBlocks];

  for (const category of cutOrder) {
    const currentTotal = fitted.reduce((s, b) => s + b.durationMinutes, 0);
    if (currentTotal <= remaining) break;
    const removed = fitted.filter((b) => b.subjectCategory === category);
    if (removed.length > 0) {
      adjustedBlocks.push(`${getCategoryLabel(category)}ブロックを除外しました`);
      fitted = fitted.filter((b) => b.subjectCategory !== category);
    }
  }

  let currentTotal = fitted.reduce((s, b) => s + b.durationMinutes, 0);
  if (currentTotal > remaining) {
    const sorted = [...fitted].sort((a, b) => b.order - a.order);
    for (const block of sorted) {
      if (currentTotal <= remaining) break;
      if (block.pomodoroCount > 2) {
        const reduction = block.pomodoroWorkMinutes;
        const oldMin = block.durationMinutes;
        block.durationMinutes -= reduction;
        block.pomodoroCount -= 1;
        block.label = `${getCategoryLabel(block.subjectCategory)} ${(block.durationMinutes / 60).toFixed(1)}h`;
        adjustedBlocks.push(
          `${getCategoryLabel(block.subjectCategory)}を${oldMin}分→${block.durationMinutes}分に短縮しました`
        );
        currentTotal -= reduction;
      }
    }
    fitted = sorted.sort((a, b) => a.order - b.order);
  }

  currentTotal = fitted.reduce((s, b) => s + b.durationMinutes, 0);
  if (currentTotal > remaining) {
    for (const block of fitted) {
      if (currentTotal <= remaining) break;
      if (['english', 'math'].includes(block.subjectCategory) && block.pomodoroCount > 2) {
        const reduction = (block.pomodoroCount - 2) * block.pomodoroWorkMinutes;
        block.durationMinutes = block.pomodoroWorkMinutes * 2;
        block.pomodoroCount = 2;
        block.label = `${getCategoryLabel(block.subjectCategory)} 1h`;
        adjustedBlocks.push(`${getCategoryLabel(block.subjectCategory)}を2ポモドーロ（60分）に短縮しました`);
        currentTotal -= reduction;
      }
    }
  }

  const finalTotal = fitted.reduce((s, b) => s + b.durationMinutes, 0);
  return {
    fittedBlocks: fitted,
    reviewMinutes: reviewCap,
    totalMinutes: reviewCap + finalTotal,
    adjustedBlocks,
  };
}

/**
 * 1日の学習計画を生成する（ブロック方式）
 * 勉強可能時間の85%を実効時間とし、タスク合計が絶対に超えないように保証する。
 */
export function generateDailyPlan(
  profile: StudentProfile,
  events: EventDate[],
  completedTasks: StudyTask[],
  targetDate: string
): DailyPlan {
  const dayType = determineDayType(profile, events, targetDate);
  const phase = detectPhase(profile.examDate, targetDate);
  const rawAvailable = getAvailableMinutesFromSchedule(profile, events, targetDate);

  const bufferRatio =
    useRuleConfigStore.getState().config.generalRules.bufferRatio ?? 0.15;
  const { effectiveMinutes, bufferMinutes } = calcEffectiveMinutes(
    rawAvailable,
    bufferRatio
  );

  const selectedIds = profile.subjects.map((s) => s.subjectId);
  const { template } = getAdjustedTemplate(dayType, selectedIds);

  const blockCopies: FittableBlock[] = template.blocks.map((b) => ({
    ...b,
    subjectIds: b.subjectIds ?? [],
  }));
  const { fittedBlocks, reviewMinutes, adjustedBlocks } = fitBlocksToTime(
    blockCopies,
    effectiveMinutes,
    template.maxReviewMinutes
  );

  const reviewTasks = generateReviewTasks(completedTasks, targetDate);
  const cappedReviewTasks = capReviewTasks(reviewTasks, reviewMinutes);

  const blockTasks: StudyTask[] = [];
  let taskIndex = 0;
  for (const block of fittedBlocks) {
    const tasks = blockToTasks(
      block as StudyBlock,
      profile.subjects,
      phase.name,
      targetDate,
      taskIndex
    );
    blockTasks.push(...tasks);
    taskIndex += tasks.length;
  }

  const allTasks = [...cappedReviewTasks, ...blockTasks];
  const finalTasks = capTasksToAvailable(allTasks, effectiveMinutes);

  return {
    date: targetDate,
    phase: phase.name,
    isClubDay: dayType === 'weekday_club' || dayType === 'summer_club',
    isMatchDay: dayType === 'match_day',
    isEventDay: dayType === 'event_day',
    availableMinutes: effectiveMinutes,
    tasks: finalTasks,
    completionRate: 0,
    rawAvailableMinutes: rawAvailable,
    bufferMinutes,
    effectiveMinutes,
    adjustedBlocks: adjustedBlocks.length > 0 ? adjustedBlocks : undefined,
  };
}

/** 将来のブロック内配分等で利用するため残している既存関数（allocateTime は timeAllocation.ts にあり） */
export {
  getAvailableMinutes,
  allocationToTasks,
  orderTasks,
  ensureDailyPractice,
};
