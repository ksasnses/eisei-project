# 勉強時間の上限制御＋ゆとり確保 — Cursor用プロンプト
# ============================================================
# 1日の学習科目の合計時間が勉強可能時間を超えないようにし、
# さらにゆとり（バッファ）を持たせる改修
# ============================================================

以下をCursorに貼り付けてください：

```
以下の修正を行ってください。
これは非常に重要なルールです。
「1日のタスク合計時間が、生活スケジュールから計算した勉強可能時間を絶対に超えない」
ことを保証し、さらに余裕を持たせるための改修です。

## 設計原則

1. 勉強可能時間は生活スケジュール（起床・就寝・学校・部活・食事等）から計算する
   → これが「物理的な上限」であり、テンプレートのブロック合計より常に優先する
2. さらに、勉強可能時間の 85% を「実効勉強時間」とし、残り15%をゆとりとする
   → 集中力の切れ目、トイレ、軽い休息、予定のズレを吸収するバッファ
3. テンプレートのブロック合計が実効勉強時間を超える場合は、
   優先度の低いブロックから自動的に削減・除外する

## 1. src/types/index.ts に追加

ScheduleRuleConfig の generalRules に以下を追加してください：

  bufferRatio: number;  // ゆとり率（0.0〜0.5）デフォルト: 0.15（15%）

## 2. src/constants/defaultRuleConfig.ts を修正

DEFAULT_RULE_CONFIG.generalRules に追加：

  bufferRatio: 0.15,

## 3. src/utils/scheduleEngine.ts を修正

### 3-1. 実効勉強時間の計算関数を追加

/**
 * 生活スケジュールから計算した勉強可能時間にゆとりを適用し、
 * 実際にタスクを配置できる「実効勉強時間」を返す
 *
 * @param rawAvailableMinutes - scheduleUtils から取得した生の勉強可能時間（分）
 * @param bufferRatio - ゆとり率（デフォルト 0.15 = 15%）
 * @returns { effectiveMinutes, bufferMinutes, rawMinutes }
 */
function calcEffectiveMinutes(
  rawAvailableMinutes: number,
  bufferRatio: number = 0.15
): {
  effectiveMinutes: number;   // 実際にタスクを配置できる時間
  bufferMinutes: number;      // ゆとり分
  rawMinutes: number;         // 元の勉強可能時間
} {
  const bufferMinutes = Math.ceil(rawAvailableMinutes * bufferRatio);
  const effectiveMinutes = rawAvailableMinutes - bufferMinutes;
  return {
    effectiveMinutes: Math.max(effectiveMinutes, 0),
    bufferMinutes,
    rawMinutes: rawAvailableMinutes,
  };
}

### 3-2. ブロック自動調整関数を追加

/**
 * テンプレートのブロック合計が実効勉強時間を超える場合、
 * 優先度の低いブロックから削減して収める。
 *
 * 削減の優先順位（最初に削るものから）：
 *   1. 情報
 *   2. 社会
 *   3. 理科
 *   4. 国語
 *   5. 数学・英語（最後まで残す。最低60分=2ポモドーロは確保）
 *
 * 削減方法（段階的に実行）：
 *   Phase 1: 優先度の低いブロックを丸ごと除外（enabled: false 扱い）
 *   Phase 2: それでも超える場合、残ったブロックのポモドーロを1つ減らす（90分→60分）
 *   Phase 3: それでも超える場合、英語・数学も60分（2ポモドーロ）に短縮
 */
function fitBlocksToTime(
  blocks: BlockConfig[],
  effectiveMinutes: number,
  maxReviewMinutes: number
): { fittedBlocks: BlockConfig[]; reviewMinutes: number; totalMinutes: number } {

  // 復習は先に確保（ただし effectiveMinutes の 20% 以内に制限）
  const reviewCap = Math.min(maxReviewMinutes, Math.floor(effectiveMinutes * 0.2));
  let remaining = effectiveMinutes - reviewCap;

  // 有効なブロックのみ対象
  let activeBlocks = blocks
    .filter(b => b.enabled)
    .sort((a, b) => a.order - b.order);

  // 現在の合計を計算
  const totalBlockMinutes = activeBlocks.reduce((sum, b) => sum + b.durationMinutes, 0);

  // 収まっている場合はそのまま返す
  if (totalBlockMinutes <= remaining) {
    return {
      fittedBlocks: activeBlocks,
      reviewMinutes: reviewCap,
      totalMinutes: reviewCap + totalBlockMinutes,
    };
  }

  // --- Phase 1: 優先度の低いブロックを丸ごと除外 ---
  const cutOrder = ['info', 'social', 'science', 'japanese'];
  let fitted = [...activeBlocks];

  for (const category of cutOrder) {
    const currentTotal = fitted.reduce((sum, b) => sum + b.durationMinutes, 0);
    if (currentTotal <= remaining) break;
    fitted = fitted.filter(b => b.subjectCategory !== category);
  }

  // --- Phase 2: 残ったブロックのポモドーロを1つ減らす ---
  let currentTotal = fitted.reduce((sum, b) => sum + b.durationMinutes, 0);
  if (currentTotal > remaining) {
    // order の大きい方（後ろのブロック）から削減
    const sorted = [...fitted].sort((a, b) => b.order - a.order);
    for (const block of sorted) {
      if (currentTotal <= remaining) break;
      if (block.pomodoroCount > 2) {
        const reduction = block.pomodoroWorkMinutes; // 1ポモドーロ分削減
        block.durationMinutes -= reduction;
        block.pomodoroCount -= 1;
        block.label = `${getCategoryLabel(block.subjectCategory)} ${(block.durationMinutes / 60).toFixed(1)}h`;
        currentTotal -= reduction;
      }
    }
    fitted = sorted.sort((a, b) => a.order - b.order);
  }

  // --- Phase 3: 英語・数学も最低2ポモドーロに短縮 ---
  currentTotal = fitted.reduce((sum, b) => sum + b.durationMinutes, 0);
  if (currentTotal > remaining) {
    for (const block of fitted) {
      if (currentTotal <= remaining) break;
      if (['english', 'math'].includes(block.subjectCategory) && block.pomodoroCount > 2) {
        const reduction = (block.pomodoroCount - 2) * block.pomodoroWorkMinutes;
        block.durationMinutes = block.pomodoroWorkMinutes * 2;
        block.pomodoroCount = 2;
        block.label = `${getCategoryLabel(block.subjectCategory)} ${(block.durationMinutes / 60).toFixed(1)}h`;
        currentTotal -= reduction;
      }
    }
  }

  const finalTotal = fitted.reduce((sum, b) => sum + b.durationMinutes, 0);

  return {
    fittedBlocks: fitted,
    reviewMinutes: reviewCap,
    totalMinutes: reviewCap + finalTotal,
  };
}

// ヘルパー
function getCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    english: '英語', math: '数学', japanese: '国語',
    science: '理科', social: '社会', info: '情報',
  };
  return map[category] || category;
}

### 3-3. generateDailyPlan を修正

generateDailyPlan のフローを以下に変更してください：

function generateDailyPlan(
  profile: StudentProfile,
  events: EventDate[],
  completedTasks: StudyTask[],
  targetDate: string
): DailyPlan {

  // 1. 日種別を判定
  const dayType = determineDayType(profile, events, targetDate);

  // 2. フェーズを判定
  const phase = detectPhase(profile.examDate, targetDate);

  // 3. 生活スケジュールから「生の勉強可能時間」を取得
  //    ※ scheduleUtils の getAvailableMinutesForDate を使用
  const rawAvailable = getAvailableMinutesForDate(profile.dailySchedule, targetDate);

  // 4. ゆとりを適用して「実効勉強時間」を計算
  const bufferRatio = ruleConfigStore.getState().config.generalRules.bufferRatio;
  const { effectiveMinutes, bufferMinutes } = calcEffectiveMinutes(rawAvailable, bufferRatio);

  // 5. テンプレートを取得
  const selectedIds = profile.subjects.map(s => s.subjectId);
  const { template } = getAdjustedTemplate(dayType, selectedIds);

  // 6. ★ ここが核心 ★
  //    テンプレートのブロックを「実効勉強時間」内に収める
  const { fittedBlocks, reviewMinutes, totalMinutes } = fitBlocksToTime(
    template.blocks.map(b => ({ ...b })),  // ディープコピー（元のテンプレートを壊さない）
    effectiveMinutes,
    template.maxReviewMinutes
  );

  // 7. 復習タスクを生成（上限は fitBlocksToTime で計算した reviewMinutes）
  const reviewTasks = generateReviewTasks(completedTasks, targetDate);
  const cappedReviewTasks = capReviewTasks(reviewTasks, reviewMinutes);

  // 8. ブロック → タスクに変換
  const blockTasks: StudyTask[] = [];
  for (const block of fittedBlocks) {
    if (block.subjectCategory === 'review') continue;
    const tasks = blockToTasks(block, profile.subjects, phase.name, targetDate);
    blockTasks.push(...tasks);
  }

  // 9. 結合
  const allTasks = [...cappedReviewTasks, ...blockTasks];

  // 10. 最終キャップ（念のため：合計 ≤ effectiveMinutes を強制保証）
  const finalTasks = capTasksToAvailable(allTasks, effectiveMinutes);

  return {
    date: targetDate,
    phase: phase.name,
    isClubDay: dayType === 'weekday_club' || dayType === 'summer_club',
    isMatchDay: dayType === 'match_day',
    isEventDay: dayType === 'event_day',
    availableMinutes: effectiveMinutes,  // ★ ゆとり適用後の実効時間を設定
    tasks: finalTasks,
    completionRate: 0,
    // 以下、UIでの表示用に追加情報を持たせる（DailyPlan型に追加が必要）
  };
}

### 3-4. DailyPlan 型にゆとり情報を追加

src/types/index.ts の DailyPlan に以下を追加してください：

  rawAvailableMinutes?: number;   // 生の勉強可能時間（ゆとり適用前）
  bufferMinutes?: number;         // ゆとり分（分）
  effectiveMinutes?: number;      // 実効勉強時間（ゆとり適用後）= availableMinutes
  adjustedBlocks?: string[];      // 削減されたブロックの情報（「理科を除外」等）

generateDailyPlan 内でこれらも設定してください：

  rawAvailableMinutes: rawAvailable,
  bufferMinutes: bufferMinutes,
  effectiveMinutes: effectiveMinutes,
  adjustedBlocks: 削減があった場合のメッセージ配列（例: ['理科ブロックを除外', '国語を90分→60分に短縮']）

## 4. DashboardPage.tsx の表示修正

ダッシュボードに以下の表示を追加してください。

### 4-1. 時間サマリーの表示

タスクリストの上部に、時間情報をコンパクトに表示：

┌──────────────────────────────────────────┐
│  📊 今日の時間配分                          │
│                                          │
│  勉強可能時間   ██████████████████  4h30m  │
│  ├ 実効時間     ███████████████▒▒▒  3h50m  │
│  ├ ゆとり       ▒▒▒              40m      │
│  └ タスク合計   █████████████       3h30m  │
│                                          │
│  ※ 20分のゆとりがあります                   │
└──────────────────────────────────────────┘

表示要素：
- 勉強可能時間（rawAvailableMinutes）：薄いグレーのフルバー
- 実効時間（effectiveMinutes）：青のバー（ゆとり分は薄い青）
- タスク合計（実際のタスク合計分数）：濃い青のバー
- 「ゆとり ◯分」の表示
- タスク合計 < 実効時間 の場合「◯分のゆとりがあります」を表示（安心感を与える）

### 4-2. ブロック調整があった場合の通知

DailyPlan の adjustedBlocks が空でない場合、
以下のようなお知らせを表示してください：

┌──────────────────────────────────────────┐
│  ℹ️ 今日は時間が限られているため、           │
│     以下の調整をしました：                   │
│     ・理科ブロックを除外しました             │
│     ・国語を1.5h → 1hに短縮しました         │
│                                          │
│  ※ 土日に集中して取り組みましょう            │
└──────────────────────────────────────────┘

背景色は薄い黄色（bg-amber-50）、左ボーダーはオレンジ。
調整理由が分かるので、生徒が「なぜ今日は理科がないのか」を理解できる。

## 5. 設定画面（SettingsPage.tsx）にゆとり率の設定を追加

「学習ルール設定」の「詳細設定」セクションに以下を追加：

  ■ ゆとり率: [  15  ]%
    説明：「勉強可能時間のうち◯%を、休息や予定のズレに備えたバッファとして確保します」
    スライダー（5%〜30%、5%刻み）
    - 5%: ほぼ詰め込み（集中力に自信がある場合）
    - 10%: やや余裕あり
    - 15%: 標準（おすすめ）
    - 20%: ゆったり
    - 25%: かなり余裕あり
    - 30%: のんびりペース

  変更すると ruleConfigStore.updateGeneralRules({ bufferRatio: 値/100 }) を呼ぶ

## 6. 設定画面の「曜日別スケジュール設定」にバリデーション追加

各日種別のブロック編集画面で、ブロック合計時間の横に
「生活スケジュールから計算した勉強可能時間」を並べて表示してください。

表示イメージ：

  ブロック合計: 6時間30分
  勉強可能時間: 7時間00分（ゆとり15%適用後: 5時間57分）

  ⚠️ ブロック合計が実効時間を超えています！
     → 自動的に優先度の低いブロックから削減されます

または：

  ブロック合計: 4時間30分
  勉強可能時間: 7時間00分（ゆとり15%適用後: 5時間57分）

  ✅ 1時間27分のゆとりがあります

これにより、設定時点で「このスケジュールは現実的か」が一目で分かる。
オーバーしている場合も警告が出るがエラーにはしない
（自動削減が働くので、設定自体は保存できる）。

## 7. CalendarPage.tsx の表示にも反映

カレンダーの各日のセルに、勉強可能時間とタスク合計の比率を
小さなプログレスバーで表示してください。

  月  |  火  |  水  |  木  |  金  |  土  |  日
  3h  |  3h  |  4.5h|  3h  |  4.5h|  6.5h|  6.5h
  ███▒ | ███▒ | ████▒| ███▒ | ████▒| █████| █████▒

█ = タスクで埋まっている時間
▒ = ゆとり

これにより、1週間の全体像として「どの日が詰まっていて、どの日にゆとりがあるか」が分かる。
```

---

## この改修のポイント

### なぜゆとりが重要か（予備校講師の視点）

努力型の生徒は「やるべきことを全部やらなきゃ」と思いがちです。
スケジュールが100%詰まっていると、1つでも遅れると「今日は失敗した」と
感じてモチベーションが下がります。

15%のバッファがあれば：
- 1つの科目に少し時間がかかっても吸収できる
- 「予定より早く終わった！」という達成感が生まれる
- 急な用事や体調不良にも対応できる
- 長期的にスケジュールを守り続けられる

### 数値の具体例

| 日種別 | 生の勉強可能時間 | ゆとり15% | 実効時間 | テンプレート合計 | 結果 |
|--------|-----------------|-----------|----------|-----------------|------|
| 平日部活あり | 3h00m | 27分 | 2h33m | 3h00m | 数学を90→60分に短縮 |
| 平日部活なし | 5h00m | 45分 | 4h15m | 4h30m | 国語を90→75分に微調整 |
| 土日 | 8h00m | 72分 | 6h48m | 6h30m | そのまま配置。18分余る |
| 夏休み部活なし | 10h00m | 90分 | 8h30m | 8h00m | そのまま配置。30分余る |
