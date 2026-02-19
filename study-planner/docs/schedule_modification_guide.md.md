# 学習計画ソフト修正指示書（Cursor用プロンプト集）
# ============================================================
# 各Stepのコードブロック内をそのままCursorに貼り付けてください
# 必ず Step 1 → 2 → 3 → 4 の順番で進めてください
# ============================================================

---

## 修正の全体方針

### 変更前（旧設計）
全科目を毎日少しずつ配分する方式

### 変更後（新設計）
**曜日・日種別ごとに取り組む科目を固定するブロック方式**

| 日種別 | 英語 | 数学 | 国語 | 理科 | 社会 | 情報 |
|--------|------|------|------|------|------|------|
| 平日（部活あり） | 1.5h | 1.5h | × | × | × | × |
| 平日（部活なし） | 1.5h | 1.5h | 1.5h | × | × | × |
| 土日・休日 | 1.5h | 1.5h | 1.5h | 1h | 1h | 空き時間 |
| 夏休み（部活あり） | 1.5h | 1.5h | 1.5h | 1h | 1h | 空き時間 |
| 夏休み（部活なし） | 1.5h | 1.5h | 1.5h | 1.5h | 1.5h | 0.5h |
| 試合日 | — | — | — | — | — | 暗記確認1h |
| イベント日 | — | — | — | — | — | 復習のみ30分 |

### ポモドーロブロックの定義
- 英語・数学・国語：**1.5時間 = 30分×3ポモドーロ**（間に5分休憩）を「1ブロック」
- 理科・社会：**1時間 = 30分×2ポモドーロ** を「1ブロック」
- 情報：30分〜1時間（1〜2ポモドーロ）

---

## ========================================
## 修正 Step 1：型定義・定数・テンプレート追加
## ========================================

以下をCursorに貼り付けてください：

```
以下の修正を行ってください。既存のコードを壊さないよう注意してください。

### 1. src/types/index.ts に追加

#### DailySchedule に夏休みフィールドを追加
既存の DailySchedule インターフェースに以下の2つのフィールドを追加してください。
既存フィールドは全てそのまま残してください。

summerVacationStart: string   // 夏休み開始日 ISO形式 "2026-07-20"（空文字なら未設定）
summerVacationEnd: string     // 夏休み終了日 ISO形式 "2026-08-31"（空文字なら未設定）

#### 新しい型を追加（既存の型の下に追加）

/**
 * 1日のスケジュール内の学習ブロック
 * 英語1.5h、数学1.5hなどの「ひとまとまり」を表す
 */
export interface StudyBlock {
  subjectCategory: 'english' | 'math' | 'japanese' | 'science' | 'social' | 'info' | 'review';
  subjectIds: string[];          // この枠で取り組む科目ID（例: ['eng_r', 'eng_l']）
  durationMinutes: number;       // ブロックの長さ（分）
  pomodoroCount: number;         // ポモドーロ数
  pomodoroWorkMinutes: number;   // 1ポモドーロの作業時間（分）
  label: string;                 // 表示用ラベル（「英語 1.5h」等）
  order: number;                 // 1日の中での順番（小さいほど先）
}

/**
 * 日種別
 */
export type DayType =
  | 'weekday_club'        // 平日（部活あり）
  | 'weekday_no_club'     // 平日（部活なし）
  | 'weekend_holiday'     // 土日・休日
  | 'summer_club'         // 夏休み（部活あり）
  | 'summer_no_club'      // 夏休み（部活なし）
  | 'match_day'           // 試合日
  | 'event_day';          // イベント日

/**
 * 日種別ごとの学習ブロック配置テンプレート
 */
export interface DayTemplate {
  dayType: DayType;
  blocks: StudyBlock[];
  totalStudyMinutes: number;
  maxReviewMinutes: number;      // 復習タスクの上限（分）
  description: string;
}

### 2. src/constants/dayTemplates.ts を新規作成

以下の内容で新しいファイルを作成してください。

import { DayTemplate, DayType, StudyBlock } from '../types';

/**
 * 科目IDからカテゴリを判定する
 */
export function getSubjectCategory(
  subjectId: string
): 'english' | 'math' | 'japanese' | 'science' | 'social' | 'info' | 'unknown' {
  if (subjectId === 'eng_r' || subjectId === 'eng_l') return 'english';
  if (subjectId === 'math1a' || subjectId === 'math1' || subjectId === 'math2bc') return 'math';
  if (subjectId === 'japanese') return 'japanese';
  if (['physics', 'chemistry', 'biology', 'earth_sci', 'sci_base',
       'sci_physics_base', 'sci_chemistry_base', 'sci_biology_base', 'sci_earth_base'
      ].includes(subjectId)) return 'science';
  if (['geo_ex', 'his_jp', 'his_wd', 'civ_eth', 'civ_pol', 'geo_his_civ'
      ].includes(subjectId)) return 'social';
  if (subjectId === 'info1') return 'info';
  return 'unknown';
}

/**
 * 日種別テンプレートの定義
 */
const DAY_TEMPLATES: Record<DayType, DayTemplate> = {
  weekday_club: {
    dayType: 'weekday_club',
    blocks: [
      {
        subjectCategory: 'english',
        subjectIds: ['eng_r', 'eng_l'],
        durationMinutes: 90,
        pomodoroCount: 3,
        pomodoroWorkMinutes: 30,
        label: '英語 1.5h',
        order: 1,
      },
      {
        subjectCategory: 'math',
        subjectIds: ['math1a', 'math2bc'],
        durationMinutes: 90,
        pomodoroCount: 3,
        pomodoroWorkMinutes: 30,
        label: '数学 1.5h',
        order: 2,
      },
    ],
    totalStudyMinutes: 180,
    maxReviewMinutes: 20,
    description: '🎾 部活あり平日 — 英語＋数学に集中',
  },

  weekday_no_club: {
    dayType: 'weekday_no_club',
    blocks: [
      {
        subjectCategory: 'english',
        subjectIds: ['eng_r', 'eng_l'],
        durationMinutes: 90,
        pomodoroCount: 3,
        pomodoroWorkMinutes: 30,
        label: '英語 1.5h',
        order: 1,
      },
      {
        subjectCategory: 'math',
        subjectIds: ['math1a', 'math2bc'],
        durationMinutes: 90,
        pomodoroCount: 3,
        pomodoroWorkMinutes: 30,
        label: '数学 1.5h',
        order: 2,
      },
      {
        subjectCategory: 'japanese',
        subjectIds: ['japanese'],
        durationMinutes: 90,
        pomodoroCount: 3,
        pomodoroWorkMinutes: 30,
        label: '国語 1.5h',
        order: 3,
      },
    ],
    totalStudyMinutes: 270,
    maxReviewMinutes: 30,
    description: '📚 部活なし平日 — 英語＋数学＋国語',
  },

  weekend_holiday: {
    dayType: 'weekend_holiday',
    blocks: [
      {
        subjectCategory: 'english',
        subjectIds: ['eng_r', 'eng_l'],
        durationMinutes: 90,
        pomodoroCount: 3,
        pomodoroWorkMinutes: 30,
        label: '英語 1.5h',
        order: 1,
      },
      {
        subjectCategory: 'math',
        subjectIds: ['math1a', 'math2bc'],
        durationMinutes: 90,
        pomodoroCount: 3,
        pomodoroWorkMinutes: 30,
        label: '数学 1.5h',
        order: 2,
      },
      {
        subjectCategory: 'japanese',
        subjectIds: ['japanese'],
        durationMinutes: 90,
        pomodoroCount: 3,
        pomodoroWorkMinutes: 30,
        label: '国語 1.5h',
        order: 3,
      },
      {
        subjectCategory: 'science',
        subjectIds: [],   // 生徒の選択科目で動的に埋める
        durationMinutes: 60,
        pomodoroCount: 2,
        pomodoroWorkMinutes: 30,
        label: '理科 1h',
        order: 4,
      },
      {
        subjectCategory: 'social',
        subjectIds: [],   // 生徒の選択科目で動的に埋める
        durationMinutes: 60,
        pomodoroCount: 2,
        pomodoroWorkMinutes: 30,
        label: '社会 1h',
        order: 5,
      },
    ],
    totalStudyMinutes: 390,
    maxReviewMinutes: 30,
    description: '📅 休日 — 全科目バランス学習',
  },

  summer_club: {
    dayType: 'summer_club',
    blocks: [
      {
        subjectCategory: 'english',
        subjectIds: ['eng_r', 'eng_l'],
        durationMinutes: 90,
        pomodoroCount: 3,
        pomodoroWorkMinutes: 30,
        label: '英語 1.5h',
        order: 1,
      },
      {
        subjectCategory: 'math',
        subjectIds: ['math1a', 'math2bc'],
        durationMinutes: 90,
        pomodoroCount: 3,
        pomodoroWorkMinutes: 30,
        label: '数学 1.5h',
        order: 2,
      },
      {
        subjectCategory: 'japanese',
        subjectIds: ['japanese'],
        durationMinutes: 90,
        pomodoroCount: 3,
        pomodoroWorkMinutes: 30,
        label: '国語 1.5h',
        order: 3,
      },
      {
        subjectCategory: 'science',
        subjectIds: [],
        durationMinutes: 60,
        pomodoroCount: 2,
        pomodoroWorkMinutes: 30,
        label: '理科 1h',
        order: 4,
      },
      {
        subjectCategory: 'social',
        subjectIds: [],
        durationMinutes: 60,
        pomodoroCount: 2,
        pomodoroWorkMinutes: 30,
        label: '社会 1h',
        order: 5,
      },
    ],
    totalStudyMinutes: 390,
    maxReviewMinutes: 30,
    description: '🌻🎾 夏休み（部活あり）— 全科目',
  },

  summer_no_club: {
    dayType: 'summer_no_club',
    blocks: [
      {
        subjectCategory: 'english',
        subjectIds: ['eng_r', 'eng_l'],
        durationMinutes: 90,
        pomodoroCount: 3,
        pomodoroWorkMinutes: 30,
        label: '英語 1.5h',
        order: 1,
      },
      {
        subjectCategory: 'math',
        subjectIds: ['math1a', 'math2bc'],
        durationMinutes: 90,
        pomodoroCount: 3,
        pomodoroWorkMinutes: 30,
        label: '数学 1.5h',
        order: 2,
      },
      {
        subjectCategory: 'japanese',
        subjectIds: ['japanese'],
        durationMinutes: 90,
        pomodoroCount: 3,
        pomodoroWorkMinutes: 30,
        label: '国語 1.5h',
        order: 3,
      },
      {
        subjectCategory: 'science',
        subjectIds: [],
        durationMinutes: 90,     // 部活なし夏休みは理科を90分に拡大
        pomodoroCount: 3,
        pomodoroWorkMinutes: 30,
        label: '理科 1.5h',
        order: 4,
      },
      {
        subjectCategory: 'social',
        subjectIds: [],
        durationMinutes: 90,     // 部活なし夏休みは社会を90分に拡大
        pomodoroCount: 3,
        pomodoroWorkMinutes: 30,
        label: '社会 1.5h',
        order: 5,
      },
      {
        subjectCategory: 'info',
        subjectIds: ['info1'],
        durationMinutes: 30,
        pomodoroCount: 1,
        pomodoroWorkMinutes: 30,
        label: '情報 30分',
        order: 6,
      },
    ],
    totalStudyMinutes: 480,
    maxReviewMinutes: 30,
    description: '🌻 夏休み（部活なし）— 全科目じっくり',
  },

  match_day: {
    dayType: 'match_day',
    blocks: [
      {
        subjectCategory: 'review',
        subjectIds: [],
        durationMinutes: 60,
        pomodoroCount: 2,
        pomodoroWorkMinutes: 30,
        label: '暗記確認 1h',
        order: 1,
      },
    ],
    totalStudyMinutes: 60,
    maxReviewMinutes: 60,
    description: '🏆 試合日 — 軽めの暗記確認のみ',
  },

  event_day: {
    dayType: 'event_day',
    blocks: [
      {
        subjectCategory: 'review',
        subjectIds: [],
        durationMinutes: 30,
        pomodoroCount: 1,
        pomodoroWorkMinutes: 30,
        label: '復習 30分',
        order: 1,
      },
    ],
    totalStudyMinutes: 30,
    maxReviewMinutes: 30,
    description: '🎌 イベント日 — 最低限の復習のみ',
  },
};

/**
 * 日種別テンプレートを取得
 */
export function getDayTemplate(dayType: DayType): DayTemplate {
  return DAY_TEMPLATES[dayType];
}

/**
 * 生徒が選択していない科目カテゴリのブロックを除外し、
 * その分の時間を再配分したテンプレートを返す。
 *
 * 再配分ルール：
 * - 英語・数学・国語の90分ブロックは変更しない
 * - 理科・社会・情報の空きを、残っている理科・社会・情報に均等配分
 * - 理科・社会・情報が全てない場合は、余った時間を「自由学習」として表示用に返す
 */
export function getAdjustedTemplate(
  dayType: DayType,
  selectedSubjectIds: string[]
): { template: DayTemplate; extraMinutes: number } {
  const base = { ...getDayTemplate(dayType) };
  const selectedCategories = new Set(
    selectedSubjectIds.map(id => getSubjectCategory(id)).filter(c => c !== 'unknown')
  );

  let removedMinutes = 0;
  const keptBlocks: StudyBlock[] = [];

  for (const block of base.blocks) {
    if (block.subjectCategory === 'review') {
      keptBlocks.push(block);
      continue;
    }
    if (selectedCategories.has(block.subjectCategory)) {
      // 理科・社会は subjectIds を生徒の選択で埋める
      if (block.subjectCategory === 'science' || block.subjectCategory === 'social') {
        const ids = selectedSubjectIds.filter(
          id => getSubjectCategory(id) === block.subjectCategory
        );
        keptBlocks.push({ ...block, subjectIds: ids });
      } else {
        const ids = selectedSubjectIds.filter(
          id => getSubjectCategory(id) === block.subjectCategory
        );
        keptBlocks.push({ ...block, subjectIds: ids.length > 0 ? ids : block.subjectIds });
      }
    } else {
      removedMinutes += block.durationMinutes;
    }
  }

  // 再配分: 理科・社会・情報の残りブロックに均等加算（英数国は固定）
  const redistributable = keptBlocks.filter(
    b => ['science', 'social', 'info'].includes(b.subjectCategory)
  );
  if (redistributable.length > 0 && removedMinutes > 0) {
    const perBlock = Math.floor(removedMinutes / redistributable.length);
    for (const b of redistributable) {
      b.durationMinutes += perBlock;
      b.pomodoroCount = Math.floor(b.durationMinutes / b.pomodoroWorkMinutes);
      b.label = b.label.replace(/[\d.]+h/, (b.durationMinutes / 60).toFixed(1) + 'h');
    }
    removedMinutes = removedMinutes - perBlock * redistributable.length;
  }

  const newTotal = keptBlocks.reduce((sum, b) => sum + b.durationMinutes, 0);
  return {
    template: { ...base, blocks: keptBlocks, totalStudyMinutes: newTotal },
    extraMinutes: removedMinutes,
  };
}

このファイルを作成してください。型のインポートパスは実際のプロジェクト構造に合わせてください。
```

**確認：** `npm run dev` でコンパイルエラーなし → Step 2へ

---

## ========================================
## 修正 Step 2：スケジュールエンジンの改修
## ========================================

```
src/utils/scheduleEngine.ts を以下の方針で改修してください。
既存の関数は残しつつ、新しいブロック方式に対応させます。
src/constants/dayTemplates.ts の getDayTemplate, getAdjustedTemplate, getSubjectCategory を使ってください。

### 1. 日種別判定関数を追加

/**
 * その日の日種別を判定する
 */
function determineDayType(
  profile: StudentProfile,
  events: EventDate[],
  targetDate: string
): DayType

ロジック（上から順に判定、最初にマッチしたものを返す）：
1. events 内に targetDate と一致する tennis_match → 'match_day'
2. events 内に targetDate と一致する school_event, other → 'event_day'
3. 夏休み判定：
   profile.dailySchedule.summerVacationStart と summerVacationEnd が両方設定済み
   かつ targetDate がその期間内 →
     その曜日が clubDays に含まれる → 'summer_club'
     含まれない → 'summer_no_club'
4. targetDate が土曜 or 日曜 → 'weekend_holiday'
5. targetDate の曜日が clubDays に含まれる → 'weekday_club'
6. それ以外 → 'weekday_no_club'

### 2. ブロック→タスク変換関数を追加

/**
 * StudyBlock を具体的な StudyTask の配列に変換する
 */
function blockToTasks(
  block: StudyBlock,
  selectedSubjects: SelectedSubject[],
  phase: '基礎期' | '実践期' | '直前期',
  targetDate: string
): StudyTask[]

ロジック：

■ english ブロック（90分 = 3ポモドーロ）
  生徒が eng_r と eng_l の両方を選択している場合：
    ポモドーロ1: 英単語・語彙（30分）
    ポモドーロ2: リーディング（30分）
    ポモドーロ3: リスニング（30分）
  eng_r のみの場合：
    ポモドーロ1: 英単語・語彙（30分）
    ポモドーロ2: リーディング①（30分）
    ポモドーロ3: リーディング②（30分）

  フェーズ別の content テキスト：
    基礎期: 「英単語暗記」「英文法・精読」「リスニング基礎練習」
    実践期: 「共テ形式 語彙問題」「共テ形式 長文読解」「共テ形式 リスニング演習」
    直前期: 「過去問演習（リーディング）」「速読＋時間配分練習」「過去問演習（リスニング）」

■ math ブロック（90分 = 3ポモドーロ）
  math1a と math2bc の両方を選択している場合：
    日付の偶数/奇数で交互に重点を入れ替え：
    奇数日 → ⅠA重点：ⅠA(30分) + ⅠA(30分) + ⅡBC(30分)
    偶数日 → ⅡBC重点：ⅠA(30分) + ⅡBC(30分) + ⅡBC(30分)
  片方のみの場合：3ポモドーロ全てその科目

  フェーズ別の content テキスト：
    基礎期: 「基本問題演習」
    実践期: 「共テ形式演習（時間を測る）」
    直前期: 「過去問演習」

■ japanese ブロック（90分 = 3ポモドーロ）
    ポモドーロ1: 現代文（30分）
    ポモドーロ2: 古文（30分）
    ポモドーロ3: 漢文（30分）

  フェーズ別：
    基礎期: 「現代文 読解基礎」「古文単語・文法」「漢文 句法暗記」
    実践期: 「共テ形式 現代文演習」「共テ形式 古文演習」「共テ形式 漢文演習」
    直前期: 「過去問 現代文」「過去問 古文」「過去問 漢文」

■ science ブロック（60分 = 2ポモドーロ）
  選択している理科科目が複数ある場合：
    日ごとにローテーション（targetDate から日数を計算し、科目数で割った余りで決定）
    例：物理・化学を選択 → 日数 % 2 === 0 なら物理、1なら化学
  1科目のみの場合：2ポモドーロ全てその科目

  フェーズ別：
    基礎期: 「基本問題演習」
    実践期: 「共テ形式演習」
    直前期: 「過去問演習」

■ social ブロック（60分 = 2ポモドーロ）
  理科と同じローテーション方式

  フェーズ別：
    基礎期: 「教科書確認＋一問一答」
    実践期: 「共テ形式演習」
    直前期: 「過去問＋暗記最終確認」

■ info ブロック（30分 = 1ポモドーロ）
    基礎期: 「基礎知識（2進数、論理回路等）」
    実践期: 「プログラミング問題演習」
    直前期: 「予想問題演習」

■ review ブロック（試合日・イベント日用）
    暗記系科目の復習タスクを配置。
    英単語、古文単語、社会の一問一答など暗記確認系を優先。

各タスクの id は `${subjectId}_${targetDate}_${index}` の形式で一意にしてください。
pomodoroType は科目の studyType（subjects.ts のマスタデータ参照）を使ってください。

### 3. generateDailyPlan を改修

既存の generateDailyPlan を以下のフローに書き換えてください：

function generateDailyPlan(
  profile: StudentProfile,
  events: EventDate[],
  completedTasks: StudyTask[],
  targetDate: string
): DailyPlan

1. const dayType = determineDayType(profile, events, targetDate)
2. const phase = detectPhase(profile.examDate, targetDate)
3. const selectedIds = profile.subjects.map(s => s.subjectId)
4. const { template, extraMinutes } = getAdjustedTemplate(dayType, selectedIds)

5. // 復習タスクを生成
   const reviewTasks = generateReviewTasks(completedTasks, targetDate)
   const reviewMinutes = Math.min(
     reviewTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0),
     template.maxReviewMinutes
   )
   // 復習タスクを上限内に収める
   const cappedReviewTasks = capReviewTasks(reviewTasks, template.maxReviewMinutes)

6. // 各ブロックをタスクに変換
   const blockTasks: StudyTask[] = []
   for (const block of template.blocks) {
     if (block.subjectCategory === 'review') continue  // 復習は別途処理済み
     const tasks = blockToTasks(block, profile.subjects, phase.name, targetDate)
     blockTasks.push(...tasks)
   }

7. // 全タスクを結合: 復習 → ブロックタスク
   const allTasks = [...cappedReviewTasks, ...blockTasks]

8. // 利用可能時間とのキャップ（既存の capTasksToAvailable を使用）
   // ただし availableMinutes は template.totalStudyMinutes + template.maxReviewMinutes とする
   const totalAvailable = template.totalStudyMinutes + template.maxReviewMinutes
   const finalTasks = capTasksToAvailable(allTasks, totalAvailable)

9. return {
     date: targetDate,
     phase: phase.name,
     isClubDay: dayType === 'weekday_club' || dayType === 'summer_club',
     isMatchDay: dayType === 'match_day',
     isEventDay: dayType === 'event_day',
     availableMinutes: template.totalStudyMinutes,
     tasks: finalTasks,
     completionRate: 0,
   }

### 4. 既存の allocateTime は残す

allocateTime 関数は削除せず残してください。
将来的にブロック内の細かい配分（例：英語ブロック内でリーディングとリスニングの
時間比率を苦手度で調整する）に使う可能性があります。
ただし generateDailyPlan からの直接呼び出しは外してください。
```

**確認：** ダッシュボードにブロック単位のタスクが表示される → Step 3へ

---

## ========================================
## 修正 Step 3：夏休み設定UIの追加
## ========================================

```
以下の3つのページを修正してください。

### 1. WizardPage.tsx — 夏休み設定ステップの追加

既存のウィザードのステップ構成に「夏休みの設定」ステップを追加してください。
部活設定の後、試験日設定の前に挿入します。

ステップの内容：
- タイトル：「夏休みの期間」
- 説明：「夏休み中は学校がないため、勉強時間が大幅に増えます。正確な期間を設定してください。」
- 入力項目：
  - 夏休み開始日（日付ピッカー、デフォルト: "2026-07-20"）
  - 夏休み終了日（日付ピッカー、デフォルト: "2026-08-31"）
- 下部に時間の目安を表示：
  「夏休み中のスケジュール目安」
    部活あり日：英語1.5h ＋ 数学1.5h ＋ 国語1.5h ＋ 理科1h ＋ 社会1h ＝ 約6.5時間
    部活なし日：英語1.5h ＋ 数学1.5h ＋ 国語1.5h ＋ 理科1.5h ＋ 社会1.5h ＋ 情報0.5h ＝ 約8時間
- これを色分けした横棒グラフ風に可視化：
  英語=青、数学=赤、国語=緑、理科=紫、社会=オレンジ、情報=グレー
  棒の長さは時間に比例

保存先は profile.dailySchedule.summerVacationStart / summerVacationEnd

### 2. SettingsPage.tsx — 夏休み設定と日種別表示の追加

#### 夏休み期間の変更セクション
「生活スケジュール」セクション内に「夏休み期間」を追加：
- 開始日と終了日の日付ピッカー
- 変更すると「スケジュールが再生成されます」のトースト表示

#### 勉強可能時間の表示を拡張
従来の4パターンに加えて夏休み2パターンを追加表示：

通常期間：
  部活あり平日：3時間（英語＋数学）
  部活なし平日：4.5時間（英語＋数学＋国語）
  土日・休日：6.5時間（全科目）

夏休み期間：
  部活あり日：6.5時間（全科目）
  部活なし日：8時間（全科目じっくり）

各行の右側に、その日に取り組む科目を小さな色付きバッジで並べて表示。

### 3. DashboardPage.tsx — ブロック表示の改修

#### ヘッダーに日種別を表示
determineDayType の結果を使って、ダッシュボードの上部に
その日の日種別を表示してください。

DayTemplate の description をそのまま使えばOKです。
例：「🎾 部活あり平日 — 英語＋数学に集中」

#### タスクリストをブロック単位でグループ化して表示

既存のフラットなタスクリストを、ブロック単位のグループに変更してください。
グルーピングは各タスクの subjectId から getSubjectCategory で判定。

表示イメージ：

  ┌───────────────────────────────────┐
  │ 📖 英語ブロック（1.5h / 3ポモドーロ）  │
  │ ─────────────────────────────     │
  │  🍅 英単語暗記（30分）     [開始]    │
  │  🍅 英文法・精読（30分）   [開始]    │
  │  🍅 リスニング基礎（30分） [開始]    │
  │                     [ブロック完了]   │
  └───────────────────────────────────┘

  ┌───────────────────────────────────┐
  │ 📐 数学ブロック（1.5h / 3ポモドーロ）  │
  │ ─────────────────────────────     │
  │  🍅 数学ⅠA 基本問題（30分） [開始]   │
  │  🍅 数学ⅡBC①（30分）      [開始]   │
  │  🍅 数学ⅡBC②（30分）      [開始]   │
  │                     [ブロック完了]   │
  └───────────────────────────────────┘

各ブロックのカード：
- 左のアクセントカラー：英語=blue-500、数学=red-500、国語=green-500、理科=purple-500、社会=orange-500、情報=gray-500
- ヘッダー：科目カテゴリ名 + 合計時間 + ポモドーロ数
- ブロック内の各タスク：チェックボックス + 内容 + 時間 + 「開始」ボタン
- ブロック下部：「ブロック完了」ボタン（全タスクを一括完了にする）
- ブロック全完了時：カード全体にグリーンの背景 + チェックマーク

復習タスクは別枠で最上部に表示：
  ┌───────────────────────────────────┐
  │ 🔄 復習タスク（最大20分）             │
  │  ・英単語 Section 8 復習3回目（10分）  │
  │  ・古文単語 第5章 復習2回目（10分）    │
  └───────────────────────────────────┘

平日部活ありの日は、国語・理科・社会のブロックは表示されないので
「今日は英語と数学に集中する日です💪」のメッセージを最下部に表示。
```

**確認：** ウィザードで夏休みが設定でき、ダッシュボードにブロック表示が出る → Step 4へ

---

## ========================================
## 修正 Step 4：カレンダーと整合性調整
## ========================================

```
以下の修正を行ってください。

### 1. src/utils/scheduleUtils.ts の修正

#### isSummerVacation 関数を追加

function isSummerVacation(schedule: DailySchedule, dateStr: string): boolean
  - schedule.summerVacationStart と summerVacationEnd が両方とも空でない
  - かつ dateStr がその期間内（開始日以降 かつ 終了日以下）
  - の場合 true を返す

#### getAvailableMinutesForDate の修正

夏休み期間中は学校の時間と通学時間を差し引かないように修正してください。

具体的には：
- isSummerVacation が true の場合：
  base = 起床〜就寝の総時間 − 食事・風呂 − バッファ
  （schoolStart〜schoolEnd と commuteMinutesOneWay×2 は引かない）
- 部活がある日は部活時間のみ引く

#### getStudyMinutesSummary の返り値を拡張

既存の返り値に以下を追加：
  summerClub: number      // 夏休み中・部活あり日
  summerNoClub: number    // 夏休み中・部活なし日

### 2. CalendarPage.tsx の修正

#### 夏休み期間の視覚的区別
- 夏休み期間の日のセルに薄い黄色（bg-amber-50）の背景を適用
- 日種別アイコンを各セルに表示（🎾🌻🏆📅等）

#### 科目ブロックの色分け表示
各日のセル内に、その日のテンプレートのブロックを色分けで表示：
  英語=blue、数学=red、国語=green、理科=purple、社会=orange、情報=gray
ブロックの高さは時間に比例（1.5hブロックは1hブロックの1.5倍の高さ）

平日部活ありの日は英語と数学の2ブロックのみ表示。
土日・夏休みの日は全ブロック表示。
ひと目で「今週はいつ何を勉強するか」が分かるようにしてください。

### 3. 利用可能時間とテンプレートの整合性調整

scheduleEngine.ts の generateDailyPlan 内で、
scheduleUtils の getAvailableMinutesForDate で計算した実際の利用可能時間と
DayTemplate の totalStudyMinutes を比較してください。

■ 実際の利用可能時間 >= テンプレートの合計 の場合：
  テンプレート通りに配置。
  余った時間は DailyPlan の availableMinutes にそのまま反映。

■ 実際の利用可能時間 < テンプレートの合計 の場合：
  ブロックを後ろ（order が大きいもの）から削減：
  削減の優先順位：
    1. 情報（最初に削る or 削除）
    2. 社会（次に削減）
    3. 理科（次に削減）
    4. 国語（次に削減）
    5. 英語・数学は最後まで維持（ただし最低60分=2ポモドーロまで短縮可）

  削減方法：
  - まずブロック丸ごと削除を試みる
  - それでも足りなければ、残ったブロックのポモドーロ数を減らす（3→2）

### 4. 全体の動作確認用：設定→ホーム→カレンダーの一貫性チェック

最後に、以下の3画面で表示される情報が矛盾しないか確認してください：

- 設定タブの「勉強可能時間」の数値
- ホームタブの「今日の勉強可能時間」と日種別表示
- カレンダーの各日のブロック表示

もし矛盾がある場合は、DayTemplate のテンプレート値を正として、
scheduleUtils の計算結果は「実際に取れる時間の上限値」として使い、
テンプレートをその上限内に収める形で統一してください。
```

**確認：** カレンダーに色分けブロックが表示され、夏休み期間が黄色背景で区別される → 完了！

---

## トラブルシューティング

### Q: 「DayType が見つからない」エラー
→ types/index.ts に型が追加されているか確認。インポートパスが正しいか確認。

### Q: テンプレートが空で表示される
→ getAdjustedTemplate に渡す selectedSubjectIds が正しく取得されているか確認。
  profile.subjects.map(s => s.subjectId) で取得できるはず。

### Q: 平日なのに理科・社会が表示される
→ determineDayType が正しく 'weekday_club' や 'weekday_no_club' を返しているか確認。
  console.log で dayType を出力して確認。

### Q: 夏休み期間が反映されない
→ profile.dailySchedule.summerVacationStart / End が保存されているか確認。
  Zustand の persist が正しく動作しているか localStorage を確認。
