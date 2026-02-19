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
  /** @deprecated 後方互換用。教材は curriculumStore を参照 */
  textbooks?: string[];
}

/** 教材の種類 */
export type TextbookCategory =
  | 'vocabulary'      // 単語帳
  | 'grammar'         // 文法書・文法問題集
  | 'reading'         // 読解問題集
  | 'listening'       // リスニング教材
  | 'textbook'        // 教科書
  | 'reference'       // 参考書
  | 'workbook'        // 問題集・ワーク
  | 'one_by_one'      // 一問一答
  | 'past_exam'       // 過去問・予想問題集
  | 'other';          // その他

/** 単位ラベル（Section, 章, 回 等） */
export type UnitLabel =
  | 'section'
  | 'chapter'
  | 'session'
  | 'unit'
  | 'lesson'
  | 'example'
  | 'question'
  | 'page10'
  | 'custom';

/** 教材（ユーザー登録） */
export interface Textbook {
  id: string;
  name: string;
  subjectId: string;
  totalUnits: number;
  unitLabel: UnitLabel;
  customUnitLabel?: string;  // unitLabel='custom' のとき
  minutesPerUnit: number;
  category: TextbookCategory;
  subCategory?: 'modern' | 'classical' | 'chinese' | 'general';  // 国語のみ
  status: 'active' | 'archived' | 'paused';
  priority: number;  // 1=最高
  memo?: string;
  /** 完了したユニット数（0〜totalUnits） */
  completedUnitCount: number;
  createdAt: string;
}

/** テンプレート（プリセット）用の教材定義 */
export interface TextbookPreset {
  name: string;
  subjectCategory: 'english' | 'math' | 'japanese' | 'science' | 'social' | 'info';
  applicableSubjectIds: string[];
  category: TextbookCategory;
  totalUnits: number;
  unitLabel: UnitLabel;
  customUnitLabel?: string;
  minutesPerUnit: number;
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
  /** 夏休み開始日 ISO形式 "2026-07-20"（空文字なら未設定） */
  summerVacationStart?: string;
  /** 夏休み終了日 ISO形式 "2026-08-31"（空文字なら未設定） */
  summerVacationEnd?: string;
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
  /** 教材ベースのタスクの場合 */
  textbookId?: string;
  unitIndex?: number;
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
  /** 生の勉強可能時間（ゆとり適用前） */
  rawAvailableMinutes?: number;
  /** ゆとり分（分） */
  bufferMinutes?: number;
  /** 実効勉強時間（ゆとり適用後）= availableMinutes */
  effectiveMinutes?: number;
  /** 削減があった場合のメッセージ（例: ['理科ブロックを除外', '国語を90分→60分に短縮']） */
  adjustedBlocks?: string[];
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

/**
 * 1日のスケジュール内の学習ブロック
 * 英語1.5h、数学1.5hなどの「ひとまとまり」を表す
 */
export interface StudyBlock {
  subjectCategory: 'english' | 'math' | 'japanese' | 'science' | 'social' | 'info' | 'review';
  subjectIds: string[];
  durationMinutes: number;
  pomodoroCount: number;
  pomodoroWorkMinutes: number;
  label: string;
  order: number;
}

/** 日種別 */
export type DayType =
  | 'weekday_club'
  | 'weekday_no_club'
  | 'weekend_holiday'
  | 'summer_club'
  | 'summer_no_club'
  | 'match_day'
  | 'event_day';

/** 日種別ごとの学習ブロック配置テンプレート */
export interface DayTemplate {
  dayType: DayType;
  blocks: StudyBlock[];
  totalStudyMinutes: number;
  maxReviewMinutes: number;
  description: string;
}

/**
 * 科目ブロック設定（1つの学習ブロックの定義）
 * UI上で追加・削除・変更可能
 */
export interface BlockConfig {
  id: string;
  subjectCategory: 'english' | 'math' | 'japanese' | 'science' | 'social' | 'info';
  durationMinutes: number;
  pomodoroWorkMinutes: number;
  pomodoroBreakMinutes: number;
  order: number;
  label: string;
  enabled: boolean;
}

/**
 * 日種別テンプレート設定
 */
export interface DayTemplateConfig {
  dayType: DayType;
  displayName: string;
  icon: string;
  description: string;
  blocks: BlockConfig[];
  maxReviewMinutes: number;
}

/**
 * フェーズ別の学習内容テンプレート
 */
export interface PhaseContentConfig {
  subjectCategory: 'english' | 'math' | 'japanese' | 'science' | 'social' | 'info';
  phase: PhaseName;
  contents: string[];
}

/**
 * 全体のスケジュール設定
 */
export interface ScheduleRuleConfig {
  version: number;
  dayTemplates: DayTemplateConfig[];
  phaseContents: PhaseContentConfig[];
  forgettingCurve: {
    intervals: number[];
    maxDailyReviewMinutes: number;
    graduationCount: number;
  };
  generalRules: {
    minBlockMinutes: number;
    maxBlockMinutes: number;
    defaultPomodoroWork: number;
    defaultPomodoroBreak: number;
    scienceRotation: boolean;
    socialRotation: boolean;
    mathAlternate: boolean;
    /** ゆとり率（0.0〜0.5）デフォルト: 0.15（15%） */
    bufferRatio: number;
  };
  updatedAt: string;
  /** 変更履歴（直近10件） */
  changeLog?: { date: string; description: string }[];
}

/** 日種別の表示名 */
export const DAY_TYPE_DISPLAY: Record<DayType, string> = {
  weekday_club: '平日・部活あり',
  weekday_no_club: '平日・部活なし',
  weekend_holiday: '土日・休日',
  summer_club: '夏休み・部活あり',
  summer_no_club: '夏休み・部活なし',
  match_day: '試合日',
  event_day: 'イベント日',
};
