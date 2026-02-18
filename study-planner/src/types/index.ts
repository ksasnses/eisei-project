/**
 * 共通テスト対応 学習計画ソフト - 型定義
 * docs/spec.md セクション2・6 に基づく
 */

/** 科目マスターデータ */
export interface Subject {
  id: string;
  name: string;
  score: number;
  time: number;
  day: 1 | 2;
  category: SubjectCategory;
  studyType: StudyType;
  memorizationRatio: number;
  thinkingRatio: number;
  processingSpeedCritical: boolean;
  dailyPracticeNeeded: boolean;
  recommendedDailyMin: number;
  crammingEffective: boolean;
  tips: string[];
  note?: string;
}

export type SubjectCategory =
  | '地歴公民'
  | '国語'
  | '外国語'
  | '理科'
  | '数学'
  | '情報';

export type StudyType = 'thinking' | 'memorization' | 'processing' | 'mixed';

/** 受験テンプレート */
export interface ExamTemplate {
  id: string;
  name: string;
  requiredSubjects: string[];
  selectGroups: SelectGroup[];
  totalScore: number;
  note: string;
}

export interface SelectGroup {
  from: string;
  count: number;
  /** 指定時はこのID一覧から選択（未指定時は from カテゴリから取得） */
  subjectIds?: string[];
  recommended?: string[];
}

/** 生徒が選択した科目 */
export interface SelectedSubject {
  subjectId: string;
  currentScore: number;
  targetScore: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  textbooks: string[];
}

/** 得点履歴（模試等） */
export interface ScoreRecord {
  subjectId: string;
  date: string;
  score: number;
}

/** 1日の生活スケジュール */
export interface DailySchedule {
  wakeUpTime: string;
  bedTime: string;
  schoolStart: string;
  schoolEnd: string;
  commuteMinutesOneWay: number;
  mealAndBathMinutes: number;
  clubDays: number[];
  /** 平日の部活 開始（月〜金で部活がある日） */
  clubStartTime: string;
  /** 平日の部活 終了 */
  clubEndTime: string;
  /** 土日・休日の部活 開始（省略時は平日と同じ） */
  clubWeekendStart?: string;
  /** 土日・休日の部活 終了 */
  clubWeekendEnd?: string;
  freeTimeBufferMinutes: number;
}

/** 生徒プロフィール */
export interface StudentProfile {
  name: string;
  examType: string;
  subjects: SelectedSubject[];
  dailySchedule: DailySchedule;
  examDate: string;
  /** 試験勉強を開始する日（YYYY-MM-DD または ISO）。未設定時は計画開始日として今日を使用 */
  studyStartDate?: string;
}

/** イベント */
export interface EventDate {
  id: string;
  title: string;
  date: string;
  type: EventType;
  durationDays: number;
  note?: string;
}

export type EventType =
  | 'tennis_match'
  | 'school_event'
  | 'regular_test'
  | 'mock_exam'
  | 'other';

/** 学習タスク */
export interface StudyTask {
  id: string;
  subjectId: string;
  type: 'new' | 'review' | 'exam_practice' | 'speed_training';
  content: string;
  pomodoroType: PomodoroType;
  pomodoroCount: number;
  estimatedMinutes: number;
  reviewSource?: { originalDate: string; reviewNumber: number };
  completed: boolean;
  actualMinutes?: number;
  completedAt?: string;
}

export type PomodoroType =
  | 'thinking'
  | 'memorization'
  | 'processing'
  | 'exam_practice';

/** 日次計画 */
export interface DailyPlan {
  date: string;
  phase: PhaseName;
  isClubDay: boolean;
  isMatchDay: boolean;
  isEventDay: boolean;
  availableMinutes: number;
  tasks: StudyTask[];
  completionRate: number;
}

export type PhaseName = '基礎期' | '実践期' | '直前期';

/** ポモドーロ設定 */
export interface PomodoroConfig {
  workMinutes: number;
  breakMinutes: number;
  longBreakAfter: number;
  longBreakMinutes: number;
}

/** 仮本番の日程（1日目・2日目の日付） */
export interface MockExamSchedule {
  day1Date: string;
  day2Date: string;
}

/** 仮本番の結果（1日目 or 2日目ごとに1件） */
export interface MockExamResult {
  id: string;
  date: string;
  day: 1 | 2;
  scores: Record<string, number>;
  total: number;
  completedAt: string;
}
