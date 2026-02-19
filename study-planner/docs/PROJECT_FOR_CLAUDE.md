# eisei project（共通テスト対応 学習計画アプリ）— Claude 用プロジェクト概要

このドキュメントは、別の Claude や開発者にプロジェクトを渡すときの前提知識として使います。プロジェクトルートは `study-planner/` です。

---

## 1. プロジェクトの目的

- **共通テスト（大学入学共通テスト）** に向けた学習計画アプリ（PWA）
- 生徒の生活スケジュール・部活・試験日・勉強開始日を設定し、**1日ごとの勉強可能時間** を計算
- **忘却曲線に基づく復習** と **フェーズ（基礎期・実践期・直前期）に応じた時間配分** で、日次タスクを自動生成
- ポモドーロタイマー・仮本番モード・設定・科目別詳細などで学習を支援

---

## 2. 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | React 19 + TypeScript |
| ビルド | Vite 7 |
| 状態管理 | Zustand（persist で localStorage 永続化） |
| ルーティング | react-router-dom v6 |
| UI | Tailwind CSS, lucide-react, recharts |
| PWA | vite-plugin-pwa |

---

## 3. ディレクトリ構造（抜粋）

```
study-planner/
├── package.json
├── vite.config.ts
├── tsconfig.json, tsconfig.app.json, tsconfig.node.json
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── types/
│   │   └── index.ts          # 全型定義
│   ├── constants/
│   │   ├── subjects.ts       # 科目マスタ・EXAM_DAY1/2_ORDER・getSubjectById
│   │   ├── examTemplates.ts  # 受験テンプレート（国公立文系など）
│   │   ├── phaseConfig.ts    # フェーズ別設定
│   │   └── pomodoroConfig.ts # ポモドーロ長さなど
│   ├── stores/
│   │   ├── studentStore.ts   # プロフィール・イベント・模試結果
│   │   ├── studyStore.ts     # 日次計画・完了タスク・復習キュー
│   │   └── pomodoroStore.ts  # タイマー状態
│   ├── utils/
│   │   ├── scheduleUtils.ts  # 勉強可能時間（getStudyMinutesSummary, getAvailableMinutesForDate, getAvailableMinutesFromSchedule）
│   │   ├── scheduleEngine.ts # 1日計画生成（generateDailyPlan）・キャップ
│   │   ├── timeAllocation.ts # 科目間時間配分（allocateTime）
│   │   ├── phaseDetector.ts  # フェーズ判定（detectPhase）
│   │   ├── forgettingCurve.ts # 復習タスク生成（generateReviewTasks）
│   │   └── dateUtils.ts      # 日付・時間ユーティリティ
│   ├── pages/
│   │   ├── WizardPage.tsx    # 初回設定ウィザード（科目・スケジュール・試験日・勉強開始日）
│   │   ├── DashboardPage.tsx # ホーム（今日の計画・勉強可能時間・タスク一覧）
│   │   ├── CalendarPage.tsx  # カレンダー
│   │   ├── TimerPage.tsx     # ポモドーロ・仮本番
│   │   ├── SettingsPage.tsx  # 設定（スケジュール・部活・勉強可能時間表示）
│   │   ├── SubjectListPage.tsx
│   │   └── SubjectDetailPage.tsx
│   └── components/
│       └── BottomNav.tsx
└── docs/
    ├── kyotsu_test_study_planner_spec.md  # 仕様書
    └── PROJECT_FOR_CLAUDE.md              # 本ファイル
```

---

## 4. 主要な型（types/index.ts）

- **Subject** … 科目マスタ（id, name, score, time, day, category, studyType, memorizationRatio 等）
- **ExamTemplate** … 受験タイプ（requiredSubjects, selectGroups, totalScore）。SelectGroup に `subjectIds` で「この中から count 個」を指定可能
- **SelectedSubject** … 生徒が選んだ科目（subjectId, currentScore, targetScore, difficulty, textbooks）
- **DailySchedule** … 1日の生活（wakeUpTime, bedTime, schoolStart/End, commuteMinutesOneWay, mealAndBathMinutes, clubDays, clubStartTime/EndTime, clubWeekendStart/End, freeTimeBufferMinutes）
- **StudentProfile** … name, examType, subjects, dailySchedule, examDate, studyStartDate（任意）
- **StudyTask** … 1タスク（subjectId, type: new/review/exam_practice/speed_training, content, pomodoroType, pomodoroCount, estimatedMinutes, completed, reviewSource 等）
- **DailyPlan** … date, phase, isClubDay, isMatchDay, isEventDay, availableMinutes, tasks, completionRate
- **EventDate** … 試合・学校行事等（type: tennis_match, school_event, regular_test, mock_exam, other）

---

## 5. 勉強可能時間の計算（設定・ホーム・計画の一致）

- **設定タブ**  
  `getStudyMinutesSummary(dailySchedule)` で次を表示：
  - 部活のない日（平日）
  - 部活のない日（土日・休日）
  - 部活のある日（平日）
  - 部活のある日（土日・休日）

- **ホームタブ**  
  今日の曜日・部活有無に応じて、上記4つのうち1つを選んで表示（`getStudyMinutesSummary` + 曜日・clubDays で同じ値を算出）。

- **計画エンジン**  
  `getAvailableMinutesFromSchedule(profile, events, targetDate)` を使用：
  - 勉強開始日前 → 0
  - 試合日・イベント日 → 短く制限
  - それ以外 → `getAvailableMinutesForDate(schedule, targetDate)`（= getStudyMinutesSummary の同じロジック）で、設定・ホームと同一値を利用。

- **土日は「学校なし」**  
  土日のベースは「起床〜就寝 − 食事・風呂・バッファ」のみ（通学・授業は引かない）。

---

## 6. 1日計画の生成（scheduleEngine.ts）

1. `getAvailableMinutes(profile, events, targetDate)` でその日の **availableMinutes** を取得（上記と一致）。
2. 復習タスクを `generateReviewTasks(completedTasks, targetDate)` で生成。
3. `remainingMinutes = availableMinutes - 復習の合計` を新規用に `allocateTime(profile.subjects, remainingMinutes, phase)` で科目配分。
4. 配分を `allocationToTasks` でタスク化し、`ensureDailyPractice` で英語・数学の最低時間を追加。
5. `orderTasks` で並べ替え（復習 → 思考型 → 処理速度 → 暗記型）。
6. **capTasksToAvailable(tasks, availableMinutes)** で **タスク合計 ≤ 勉強可能時間** に収める。  
   - 復習を優先して維持し、超える分は新規・毎日学習を削る（科目が減ってもよいが、試験日までのノルマは復習で守る設計）。

---

## 7. 受験テンプレート（examTemplates.ts）

- **国公立文系（bunkeikokko）**  
  - 必須: eng_r, eng_l, japanese, info1  
  - 選択: 地歴公民 1 科目、数学 1 科目（subjectIds: math1a, math2bc のどちらか）、理科基礎 2 科目（subjectIds: sci_physics_base, sci_chemistry_base, sci_biology_base, sci_earth_base から2つ）
- 他: 国公立理系、私立文系・理系など。SelectGroup の `subjectIds` で「この中から count 個」を指定可能。

---

## 8. 科目マスタ（subjects.ts）

- 地歴公民・国語・外国語・理科・数学・情報の各科目を定義。
- 理科基礎は **sci_physics_base, sci_chemistry_base, sci_biology_base, sci_earth_base** の4科目を個別に定義（各50点・30分）。従来の「sci_base」も残存。
- **EXAM_DAY1_ORDER / EXAM_DAY2_ORDER** で共通テストの科目順。**getExamSlotsForDay** で仮本番用スロット生成（理科基礎4科目のうち選択分は1スロット60分として表示）。

---

## 9. ルートとガード（App.tsx）

- `/` ホーム、`/wizard` 初回ウィザード、`/calendar`、`/timer`、`/settings`、`/subjects`、`/subjects/:id`
- `isInitialized` が false のときは `/wizard` 以外へは Navigate でリダイレクト。
- Zustand の persist の hydration が終わるまで「読み込み中」表示。

---

## 10. 実行・ビルド

```bash
cd study-planner
npm install
npm run dev    # 開発サーバー
npm run build  # 本番ビルド（dist/）
```

---

## 11. 仕様の詳細

詳細な仕様・フェーズ・時間配分の考え方は **docs/kyotsu_test_study_planner_spec.md** を参照してください。  
このファイルと仕様書を Claude に渡すと、一貫した前提で改修・機能追加ができます。
