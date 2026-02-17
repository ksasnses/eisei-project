# 共通テスト対応 学習計画ソフト 修正仕様書
## — Cursorへの指示書 —

---

## 1. 前提：このソフトの対象者像

### 生徒プロファイル
- **高校生（テニス部所属）**
- **性格：努力型・コツコツ型**（要領は良くないが、やると決めたことは継続できる）
- **課題：情報処理速度がそこまで速くない、効率的な取捨選択が苦手**
- **強み：反復を厭わない、指示されたことを忠実にやり抜く力がある**

### このプロファイルに基づく設計思想
1. **「何をやるか」を明確に指示する**：曖昧な指示ではなく、「今日の19:00-19:25は英単語ターゲット1900のp.120-125を音読3回→テスト」のように具体的に
2. **タスクを小さく分割する**：大きな目標（「英語を仕上げる」）ではなく、小さな達成可能な単位に分解
3. **反復の仕組みを自動化する**：忘却曲線に基づく復習を「本人が考えなくても」システムが自動配置
4. **「考える勉強」と「覚える勉強」を明確に分離する**：混同すると効率が大幅に下がるため
5. **成功体験の可視化**：努力型の生徒にとって「やった分だけ進んでいる」実感が最大のモチベーション

---

## 2. 共通テスト 2026-2027年度の構造と傾向

### 2-1. 科目構成（7教科21科目体制）

ソフトに以下の科目データをプリセットとして組み込むこと。

```typescript
// 共通テスト科目マスターデータ
const KYOTSU_TEST_SUBJECTS = {
  // === 1日目 ===
  day1: {
    地歴公民: {
      timeSlot: "9:30-11:40（2科目）/ 10:40-11:40（1科目）",
      subjects: [
        { id: "geo_ex", name: "地理総合、地理探究", score: 100, time: 60 },
        { id: "his_jp", name: "歴史総合、日本史探究", score: 100, time: 60 },
        { id: "his_wd", name: "歴史総合、世界史探究", score: 100, time: 60 },
        { id: "civ_eth", name: "公共、倫理", score: 100, time: 60 },
        { id: "civ_pol", name: "公共、政治・経済", score: 100, time: 60 },
        { id: "geo_his_civ", name: "地理総合/歴史総合/公共", score: 100, time: 60,
          note: "3分野から2つ選択。使えない大学が多いので注意" }
      ],
      maxSelect: 2
    },
    国語: {
      timeSlot: "13:00-14:30",
      subjects: [
        { id: "japanese", name: "国語", score: 200, time: 90,
          breakdown: {
            現代文_評論: 45, 現代文_小説: 45, 現代文_実用文: 45,
            古文: 45, 漢文: 45
          },
          note: "2025年度から90分。問3の実用的文章（新傾向）に注意" }
      ],
      maxSelect: 1
    },
    外国語: {
      timeSlot: "15:10-16:30（R）/ 17:10-18:10（L）",
      subjects: [
        { id: "eng_r", name: "英語リーディング", score: 100, time: 80 },
        { id: "eng_l", name: "英語リスニング", score: 100, time: 60,
          note: "実質解答時間30分。ICプレーヤー操作含む" }
      ],
      maxSelect: 1 // 英語なら R+L セット
    }
  },

  // === 2日目 ===
  day2: {
    理科: {
      timeSlot: "9:30-11:40（2科目）/ 10:40-11:40（1科目）",
      subjects: [
        { id: "sci_base", name: "物理基礎/化学基礎/生物基礎/地学基礎", score: 100, time: 60,
          note: "4分野から2つ選択" },
        { id: "physics", name: "物理", score: 100, time: 60 },
        { id: "chemistry", name: "化学", score: 100, time: 60 },
        { id: "biology", name: "生物", score: 100, time: 60 },
        { id: "earth_sci", name: "地学", score: 100, time: 60 }
      ],
      maxSelect: 2
    },
    数学1: {
      timeSlot: "13:00-14:10",
      subjects: [
        { id: "math1a", name: "数学Ⅰ・A", score: 100, time: 70,
          note: "新課程：データの分析に外れ値・仮説検定が追加" },
        { id: "math1", name: "数学Ⅰ", score: 100, time: 70 }
      ],
      maxSelect: 1
    },
    数学2: {
      timeSlot: "15:00-16:10",
      subjects: [
        { id: "math2bc", name: "数学Ⅱ・B・C", score: 100, time: 70,
          note: "新課程：数学Cのベクトル・複素数平面、統計的な推測が追加" }
      ],
      maxSelect: 1
    },
    情報: {
      timeSlot: "17:00-18:00",
      subjects: [
        { id: "info1", name: "情報Ⅰ", score: 100, time: 60,
          note: "2025年度新設。プログラミング問題が要対策。2025年度平均点69点→難化予想" }
      ],
      maxSelect: 1
    }
  }
};
```

### 2-2. 文系・理系テンプレート

```typescript
const EXAM_TEMPLATES = {
  // 国公立文系（6教科8科目 + 情報）
  bunkeikokko: {
    name: "国公立文系",
    required: ["eng_r", "eng_l", "japanese", "math1a", "math2bc", "info1"],
    selectGroup: [
      { from: "地歴公民", count: 2 },
      { from: "理科", count: 1, recommended: ["sci_base"] }
    ],
    totalScore: 900,
    note: "地歴公民2科目＋理科基礎が一般的"
  },

  // 国公立理系（6教科8科目 + 情報）
  rikeikokko: {
    name: "国公立理系",
    required: ["eng_r", "eng_l", "japanese", "math1a", "math2bc", "info1"],
    selectGroup: [
      { from: "地歴公民", count: 1 },
      { from: "理科", count: 2, recommended: ["physics", "chemistry"] }
    ],
    totalScore: 900,
    note: "理科2科目＋地歴公民1科目が一般的"
  },

  // 私立文系（共テ利用）
  bunkeishiritsu: {
    name: "私立文系（共テ利用）",
    required: ["eng_r", "eng_l"],
    selectGroup: [
      { from: "全科目", count: "2-3", note: "大学により異なる" }
    ],
    note: "英語＋国語＋地歴が多い"
  },

  // 私立理系（共テ利用）
  rikeishiritsu: {
    name: "私立理系（共テ利用）",
    required: ["eng_r", "eng_l", "math1a", "math2bc"],
    selectGroup: [
      { from: "理科", count: "1-2" }
    ],
    note: "英語＋数学＋理科が基本"
  }
};
```

### 2-3. 共通テストの出題傾向（アルゴリズムに反映すべき重要事項）

```typescript
// 各科目の学習特性データ（スケジューリングアルゴリズムに使用）
const SUBJECT_CHARACTERISTICS = {
  eng_r: {
    type: "思考＋処理速度",           // 主な力
    memorization_ratio: 0.4,          // 暗記の比重（0-1）
    thinking_ratio: 0.6,              // 思考力の比重（0-1）
    processing_speed_critical: true,  // 処理速度が鍵か
    daily_practice_needed: true,      // 毎日やるべきか
    recommended_daily_min: 30,        // 最低日次学習時間（分）
    cramming_effective: false,        // 直前の詰め込みが効くか
    study_phases: {
      基礎期: {
        focus: "単語・文法・精読",
        tasks: [
          "英単語帳（1日50語 × 忘却曲線で復習）",
          "英文法の基礎固め（参考書1冊を3周）",
          "短い英文の精読（構文把握）"
        ]
      },
      実践期: {
        focus: "速読訓練・共テ形式演習",
        tasks: [
          "速読トレーニング（WPM測定付き、目標140-150WPM）",
          "共テ形式の演習（時間を測る）",
          "資料・グラフ読み取り演習"
        ]
      },
      直前期: {
        focus: "時間配分の最適化・弱点補強",
        tasks: [
          "過去問・予想問題を本番と同じ時間で解く",
          "大問ごとの時間配分を固定する練習"
        ]
      }
    },
    kyotsu_test_tips: [
      "2026年度は語数増加・難化の可能性あり",
      "大問8題構成が継続する見込み",
      "情報検索型の問題が中心 — 全文精読ではなく必要情報をスキャンする力",
      "言い換え(paraphrase)への対応力が重要"
    ]
  },

  eng_l: {
    type: "処理速度＋集中力",
    memorization_ratio: 0.3,
    thinking_ratio: 0.3,
    processing_speed_critical: true,
    daily_practice_needed: true,
    recommended_daily_min: 15,
    cramming_effective: false,
    study_phases: {
      基礎期: { focus: "音声への慣れ、ディクテーション" },
      実践期: { focus: "共テ形式の演習、先読み練習" },
      直前期: { focus: "ICプレーヤー使用の模擬練習" }
    },
    kyotsu_test_tips: [
      "音声は一度しか再生されない問題がある",
      "先読みスキルが得点を大きく左右する"
    ]
  },

  japanese: {
    type: "思考＋読解速度",
    memorization_ratio: 0.3,
    thinking_ratio: 0.7,
    processing_speed_critical: true,
    daily_practice_needed: false,
    recommended_daily_min: 20,
    cramming_effective: false,
    subSubjects: {
      現代文: {
        type: "思考",
        study_phases: {
          基礎期: { focus: "論理的読解法の習得、語彙力強化" },
          実践期: { focus: "問3（新傾向・実用文）対策、資料読み取り演習" },
          直前期: { focus: "時間配分の最適化" }
        }
      },
      古文: {
        type: "暗記＋思考",
        study_phases: {
          基礎期: { focus: "古文単語300語＋助動詞・敬語の暗記" },
          実践期: { focus: "読解演習" },
          直前期: { focus: "頻出テーマの確認" }
        }
      },
      漢文: {
        type: "暗記＋パターン認識",
        study_phases: {
          基礎期: { focus: "句法の暗記（早覚え速答法など）" },
          実践期: { focus: "読解演習" },
          直前期: { focus: "頻出句法の最終確認" }
        }
      }
    },
    kyotsu_test_tips: [
      "問3（実用的文章）は新傾向。グラフ・資料の読み取りが含まれる",
      "2026年度は問3の難化が予想される",
      "現代文で時間を使いすぎると古文漢文に影響 — 時間配分が最重要"
    ]
  },

  math1a: {
    type: "思考＋演習量",
    memorization_ratio: 0.2,
    thinking_ratio: 0.8,
    processing_speed_critical: true,
    daily_practice_needed: true,
    recommended_daily_min: 30,
    cramming_effective: false,
    study_phases: {
      基礎期: { focus: "教科書レベルの完全理解、必須解法の定着" },
      実践期: { focus: "共テ形式演習、データの分析（外れ値・仮説検定）の強化" },
      直前期: { focus: "時間を測った演習、計算速度の向上" }
    },
    kyotsu_test_tips: [
      "新課程でデータの分析が強化（外れ値、仮説検定）",
      "公式丸暗記では対応不可 — 「なぜその公式を使うか」の理解が必要",
      "全範囲からの出題 — 苦手分野を残すと致命的"
    ]
  },

  math2bc: {
    type: "思考＋演習量",
    memorization_ratio: 0.2,
    thinking_ratio: 0.8,
    processing_speed_critical: true,
    daily_practice_needed: true,
    recommended_daily_min: 30,
    cramming_effective: false,
    study_phases: {
      基礎期: { focus: "数学Ⅱの基礎固め、数学B・Cの新分野学習" },
      実践期: { focus: "選択問題の戦略決定、統計的な推測の演習" },
      直前期: { focus: "問題量が多いため時間配分の訓練が最重要" }
    },
    kyotsu_test_tips: [
      "新課程：数学Cのベクトル・複素数平面が追加",
      "統計的な推測（仮説検定）が新たに出題",
      "分量が多く難化傾向 — 選択問題の戦略が重要"
    ]
  },

  // 理科（専門）— 代表例
  physics: {
    type: "思考＋演習量",
    memorization_ratio: 0.2,
    thinking_ratio: 0.8,
    processing_speed_critical: false,
    daily_practice_needed: true,
    recommended_daily_min: 25,
    cramming_effective: false,
    kyotsu_test_tips: [
      "全範囲から偏りなく出題",
      "公式暗記だけでは不可 — 応用力が必要"
    ]
  },

  chemistry: {
    type: "暗記＋思考",
    memorization_ratio: 0.5,
    thinking_ratio: 0.5,
    processing_speed_critical: false,
    daily_practice_needed: true,
    recommended_daily_min: 25,
    cramming_effective: false,
    kyotsu_test_tips: [
      "2025年度は歴代最低点 — グラフ読み取り・応用問題が増加",
      "暗記と思考力の両方が必要",
      "「なぜそうなるか」の根本理解が問われる"
    ]
  },

  // 地歴公民 — 代表例
  his_jp: {
    type: "暗記＋資料読解",
    memorization_ratio: 0.6,
    thinking_ratio: 0.4,
    processing_speed_critical: false,
    daily_practice_needed: false,
    recommended_daily_min: 20,
    cramming_effective: true, // 暗記科目は直前も有効（ただし基礎は早めに）
    kyotsu_test_tips: [
      "史料を用いた出題が増加傾向",
      "単純暗記ではなく、因果関係の理解が必要",
      "「なぜその出来事が起きたか」を説明できるレベルで"
    ]
  },

  info1: {
    type: "思考＋暗記",
    memorization_ratio: 0.4,
    thinking_ratio: 0.6,
    processing_speed_critical: false,
    daily_practice_needed: false,
    recommended_daily_min: 15,
    cramming_effective: true, // 知識問題はある程度効く
    study_phases: {
      基礎期: { focus: "情報の基礎知識（2進数、ネットワーク、セキュリティ等）" },
      実践期: { focus: "プログラミング問題の演習が最重要" },
      直前期: { focus: "予想問題での演習" }
    },
    kyotsu_test_tips: [
      "2025年度平均69点 → 2026年度は大幅難化の可能性",
      "特にプログラミング問題の練習が重要",
      "過去問が少ないので予想問題集を活用"
    ]
  }
};
```

---

## 3. 「努力型生徒」に最適化したスケジューリングアルゴリズム

### 3-1. 学習フェーズの自動判定

ソフトは試験までの残り日数に基づいて、自動的にフェーズを切り替える。

```typescript
const PHASE_CONFIG = {
  // フェーズ判定ルール（試験日からの逆算）
  phases: [
    {
      name: "基礎期",
      condition: "残り120日以上",
      description: "教科書レベルの完全理解と基礎知識の定着",
      timeAllocation: {
        基礎固め: 0.60,  // 60%
        演習: 0.25,       // 25%
        復習: 0.15        // 15%（忘却曲線による自動復習）
      },
      rules: [
        "暗記科目は忘却曲線スケジュールを最優先で配置",
        "思考型科目は「理解→演習→確認」の3ステップで",
        "1日の新規学習範囲は狭く、復習を厚めに"
      ]
    },
    {
      name: "実践期",
      condition: "残り60〜119日",
      description: "共テ形式への対応力を鍛える",
      timeAllocation: {
        基礎固め: 0.20,
        共テ形式演習: 0.50,
        復習: 0.20,
        弱点補強: 0.10
      },
      rules: [
        "共テ過去問・予想問題を週1回は全科目通しで解く",
        "時間を測って解く練習を必ず含める",
        "英語は速読トレーニング（WPM計測）を毎日実施",
        "情報Ⅰのプログラミング演習を週2-3回組み込む"
      ]
    },
    {
      name: "直前期",
      condition: "残り30日以内",
      description: "得点力の最大化と本番シミュレーション",
      timeAllocation: {
        本番形式演習: 0.50,
        弱点の最終補強: 0.25,
        暗記科目の最終確認: 0.25
      },
      rules: [
        "2週間前：本番と同じ時間割で全教科を通しで解く（仮本番）を実施",
        "1週間前：暗記科目の最終確認に比重を移す",
        "直前3日：軽めの確認のみ。新しいことはやらない",
        "睡眠リズムを本番に合わせる（6:00起床に固定）"
      ]
    }
  ]
};
```

### 3-2. 努力型生徒向けポモドーロの改良

標準のポモドーロ（25分+5分）を、科目特性と生徒特性に合わせてカスタマイズする。

```typescript
const POMODORO_CONFIG = {
  // 努力型生徒向け：集中持続のための工夫
  profiles: {
    // 思考型科目（数学・物理など）
    thinking: {
      workMinutes: 30,      // 25→30分（思考の途切れを防ぐ）
      breakMinutes: 7,      // 5→7分（頭をしっかり休める）
      longBreakAfter: 3,    // 3セットで長休憩（4だと疲れすぎる）
      longBreakMinutes: 20,
      maxDailySets: 4,      // 1日最大4セット（それ以上は質が下がる）
      bestTimeSlot: "朝〜午前中", // 脳が最もクリアな時間帯
      tip: "1問に15分以上悩んだら解説を見る → 翌日に再挑戦"
    },

    // 暗記型科目（英単語・古文単語・社会など）
    memorization: {
      workMinutes: 20,      // 短い集中を繰り返す
      breakMinutes: 5,
      longBreakAfter: 4,
      longBreakMinutes: 15,
      maxDailySets: 6,
      bestTimeSlot: "夕方〜夜（寝る前の暗記は定着率が高い）",
      tip: "声に出す→書く→テスト の3ステップで"
    },

    // 処理速度型（英語リーディング・速読など）
    processing: {
      workMinutes: 25,      // 標準
      breakMinutes: 5,
      longBreakAfter: 4,
      longBreakMinutes: 15,
      maxDailySets: 4,
      bestTimeSlot: "午前〜昼",
      tip: "タイマーを常に意識。時間内に終わらなくてもOK、速度を測定し記録"
    },

    // 本番形式演習（過去問・模試）
    exam_practice: {
      workMinutes: null,    // 本番と同じ試験時間を使う
      breakMinutes: 10,     // 科目間の休憩
      tip: "本番と同じ時間帯で解く。解き終わった後、必ず振り返りを30分"
    }
  },

  // 集中力維持のための追加ルール（努力型生徒向け）
  concentrationRules: [
    {
      rule: "開始儀式",
      description: "勉強開始前に「今日の目標」を3つ書き出す（1分）",
      reason: "努力型の生徒は目標が明確だと集中しやすい"
    },
    {
      rule: "難易度の波",
      description: "「易→難→易」の順で科目を配置",
      reason: "最初に簡単な科目で勢いをつけ、集中力のピークで難しい科目に取り組む"
    },
    {
      rule: "スマホ隔離",
      description: "ポモドーロ中はスマホを別の部屋に置く",
      reason: "努力型でも誘惑には勝てない。物理的に排除する"
    },
    {
      rule: "進捗の見える化",
      description: "1ポモドーロ完了するごとに画面上でプログレスバーが進む",
      reason: "「頑張った量」が見えることがモチベーションの源泉"
    }
  ]
};
```

### 3-3. 忘却曲線に基づく復習スケジュール

```typescript
const FORGETTING_CURVE_CONFIG = {
  // エビングハウスの忘却曲線に基づく復習間隔
  reviewIntervals: [1, 3, 7, 14, 30, 60], // 日後に復習

  // 科目特性別の適用ルール
  applicationRules: {
    // 暗記科目（英単語、古文単語、社会の用語、化学の反応式など）
    memorization_heavy: {
      intervals: [1, 3, 7, 14, 30],  // 5回の復習
      reviewMethod: "テスト形式",      // 見直しではなく自己テスト
      passCondition: "3回連続正解で卒業",
      failAction: "間違えたものは間隔をリセット"
    },

    // 理解型科目（数学の解法、物理の考え方など）
    understanding_heavy: {
      intervals: [3, 7, 14, 30],      // 4回の復習
      reviewMethod: "類題演習",        // 同じ問題ではなく類題を解く
      passCondition: "解き方を口頭で説明できたら卒業",
      failAction: "基礎に戻って再学習"
    },

    // 処理速度型（英語長文、データ読み取りなど）
    speed_training: {
      intervals: [7, 14],             // 2回（スキルは比較的保持される）
      reviewMethod: "時間を測って再演習",
      passCondition: "目標時間内に完了",
      failAction: "基礎力不足の可能性 → 基礎に立ち返る"
    }
  },

  // 復習タスクの自動生成ルール
  autoGeneration: {
    priority: "HIGH", // 復習は新規学習より優先的に配置
    placement: "その日の勉強の最初に配置（ウォームアップとして）",
    maxDailyReviewMinutes: 45, // 1日の復習上限（これ以上は新規学習が進まない）
    overflow: "上限を超えた分は翌日に繰り越し（ただし警告表示）"
  }
};
```

---

## 4. 1日のスケジュール自動生成ロジック

### 4-1. 時間帯別の科目配置ルール

```typescript
const DAILY_SCHEDULE_RULES = {
  // 脳科学に基づく時間帯別の最適科目配置
  timeSlots: [
    {
      name: "早朝（起床後1-2時間）",
      typical: "6:00-7:30",
      bestFor: ["暗記の確認テスト", "前日の復習"],
      reason: "睡眠で整理された記憶の定着確認に最適",
      avoid: ["新しい難問"]
    },
    {
      name: "午前（通学後～昼）",
      typical: "学校の授業",
      note: "授業中の集中力を最大化するため、予習を前日に済ませておく"
    },
    {
      name: "放課後〜部活前",
      typical: "15:30-16:00（もし時間があれば）",
      bestFor: ["隙間時間の暗記（英単語アプリ等）"],
      note: "テニス部の練習がある日はこの時間は使えない"
    },
    {
      name: "夕方（部活後〜夕食前）",
      typical: "18:30-19:30",
      bestFor: ["思考型科目（数学・物理）"],
      reason: "運動後は血流が良く、集中力が高まりやすい",
      note: "ただし疲労が強い場合は軽めの科目に変更"
    },
    {
      name: "夜（夕食後〜就寝前）",
      typical: "20:30-23:00",
      bestFor: ["暗記型科目（英単語、社会、古文単語）", "英語リスニング"],
      reason: "寝る前の暗記は睡眠中の記憶定着に効果的",
      avoid: ["重い思考問題（眠れなくなる可能性）"]
    }
  ],

  // 通学時間の活用（往復で使える学習）
  commuteStudy: {
    activities: [
      "英単語アプリ（音声付き）",
      "英語リスニング（共テ形式の音声教材）",
      "古文単語の暗記",
      "社会科目の一問一答",
      "情報Ⅰの知識確認"
    ],
    note: "通学時間は「暗記系のインプット」に限定。思考問題は不向き"
  },

  // テニスの練習がある日 vs ない日
  scheduleVariants: {
    withClub: {
      availableStudyHours: 2.5, // 目安
      structure: "復習(30分) → 思考科目1セット(35分) → 暗記科目2セット(50分) → 暗記確認(15分)"
    },
    withoutClub: {
      availableStudyHours: 4.5, // 目安
      structure: "復習(40分) → 思考科目2セット(70分) → 処理速度練習1セット(30分) → 暗記科目3セット(75分) → 暗記確認(15分)"
    },
    weekendNoEvent: {
      availableStudyHours: 8,   // 休日の目安
      structure: "午前：思考科目（数学・物理） → 昼食・休憩 → 午後前半：共テ演習 → 午後後半：暗記科目 → 夜：復習と翌日準備",
      note: "8時間フルで集中するのは不可能。実質的な勉強時間は6時間程度を想定"
    },
    matchDay: {
      availableStudyHours: 1,   // テニスの試合日
      structure: "軽めの暗記確認のみ。試合に集中させる",
      note: "試合日は休息日として扱い、翌日に調整"
    }
  }
};
```

### 4-2. 科目間の時間配分アルゴリズム

```typescript
const TIME_ALLOCATION_ALGORITHM = {
  description: `
    科目への時間配分は以下の要素を総合的に考慮して自動計算する。
    努力型の生徒にとって重要なのは「均等に少しずつ」ではなく、
    「苦手科目に重点配分しつつ、得意科目の得点力も維持する」バランス。
  `,

  factors: [
    {
      name: "苦手度",
      weight: 0.30,
      logic: "苦手度が高いほど多く配分（ただし上限あり）",
      cap: "1科目に全体の25%以上は配分しない（他科目が疎かになる）"
    },
    {
      name: "配点の重み",
      weight: 0.20,
      logic: "志望校での配点が高い科目を優先"
    },
    {
      name: "伸びしろ",
      weight: 0.25,
      logic: "現在の得点と目標点の差が大きい科目ほど配分を増やす",
      note: "ただし、あまりに基礎が足りない科目は基礎期の配分を手厚く"
    },
    {
      name: "学習効率（時間対効果）",
      weight: 0.15,
      logic: "暗記科目は短期間で伸びやすい → 直前期に配分を増やす。思考型は早期から継続",
      note: "努力型の生徒は暗記科目で確実に点を取る戦略が有効"
    },
    {
      name: "毎日継続の必要性",
      weight: 0.10,
      logic: "英語・数学は毎日最低限の学習を確保。0の日を作らない"
    }
  ],

  // 努力型生徒への特別ルール
  effortTypeRules: [
    "1日に取り組む科目数は最大4科目まで（それ以上は切り替えコストで効率低下）",
    "同じ科目を2日連続で重点的にやる「ペア日」を設ける（深い理解のため）",
    "週に1日は「復習のみの日」を設定（新しいことをやらず、定着に集中）",
    "模試・テスト後は必ず「復習日」を1日設けてから次に進む"
  ]
};
```

---

## 5. UI/UX 修正指示

### 5-1. 追加すべき画面・機能

```typescript
const UI_MODIFICATIONS = {
  screens: [
    {
      name: "初期設定ウィザード",
      description: "最初にステップバイステップで情報を入力させる",
      steps: [
        "Step 1: 志望校タイプの選択（国公立文系/国公立理系/私立文系/私立理系）",
        "Step 2: 受験科目の選択（テンプレートから選んで微調整）",
        "Step 3: 各科目の現在の実力（模試の偏差値 or 直近テストの点数）",
        "Step 4: 各科目の目標点（共テでの目標得点）",
        "Step 5: 日常スケジュール（起床時間、通学時間、部活の曜日、就寝時間）",
        "Step 6: テニスの試合・学校行事の入力"
      ]
    },
    {
      name: "ダッシュボード",
      components: [
        "試験までのカウントダウン",
        "今日のタスク一覧（ポモドーロ単位で、具体的な内容付き）",
        "週間進捗グラフ（予定 vs 実績）",
        "科目別の達成率プログレスバー",
        "本日の復習タスク（忘却曲線から自動生成）",
        "現在のフェーズ表示（基礎期/実践期/直前期）",
        "モチベーション指標（連続学習日数、累計ポモドーロ数）"
      ]
    },
    {
      name: "週間カレンダービュー",
      description: "1週間の学習計画を視覚的に表示",
      features: [
        "各時間帯に科目ブロックが色分けで配置",
        "テニスの試合・行事はアイコン付きで表示",
        "部活のある日/ない日で自動的にレイアウトが変わる",
        "ドラッグ&ドロップで微調整可能",
        "復習タスクは特別な色（例：オレンジ）で強調"
      ]
    },
    {
      name: "科目詳細画面",
      description: "各科目の学習状況を詳しく表示",
      features: [
        "共テの出題傾向と対策ポイント（上記データから自動表示）",
        "現在の得点 → 目標点 のギャップグラフ",
        "忘却曲線の状況（何件の復習タスクが溜まっているか）",
        "学習フェーズに応じた「今やるべきこと」の表示",
        "模試結果の推移グラフ（入力式）"
      ]
    },
    {
      name: "ポモドーロタイマー画面",
      description: "実際の学習時に使うタイマー",
      features: [
        "現在の科目と具体的タスクの表示",
        "残り時間の大きな表示",
        "「完了」「スキップ」「延長」ボタン",
        "完了時の達成感演出（アニメーション等）",
        "次のタスクの予告表示"
      ]
    },
    {
      name: "テニス・イベント管理画面",
      description: "テニスの試合や学校行事を管理",
      features: [
        "試合日・行事日の入力",
        "試合日前後の学習量自動調整",
        "試合前日は軽めのスケジュール（メンタル配慮）",
        "大会期間中の特別スケジュール",
        "定期テスト期間の設定（共テ勉強を一時中断可能）"
      ]
    },
    {
      name: "仮本番シミュレーション画面",
      description: "共テ本番と同じ時間割で模擬演習するための機能",
      features: [
        "本番の時間割を再現したタイマー（科目ごとの制限時間付き）",
        "休憩時間もカウント",
        "全科目の得点入力 → 合計点・科目別分析を自動表示",
        "前回の仮本番との比較グラフ",
        "直前期に月2回の仮本番を自動スケジュール"
      ]
    }
  ]
};
```

### 5-2. 得点戦略シミュレーター

```typescript
const SCORE_STRATEGY = {
  description: `
    努力型の生徒に最も重要なのは「戦略的な得点計画」。
    全科目を均等に伸ばすのではなく、
    「取れるところで確実に取り、苦手科目は最低ラインを確保する」
    という発想が必要。
  `,

  features: [
    "各科目の現在点と目標点を入力",
    "志望校のボーダーラインとの比較表示",
    "「あと〇点をどこで稼ぐか」のシミュレーション",
    "科目ごとの難易度を考慮した現実的な目標設定支援",
    "得点配分の組み合わせを複数パターン提案"
  ],

  // 例：国公立理系、900点満点中の得点計画
  examplePlan: {
    target: "合計720点（80%）",
    strategy: "英語と理科で稼ぎ、国語は最低限確保",
    subjects: {
      "英語R": { current: 55, target: 80, difficulty: "中（速読強化で到達可能）" },
      "英語L": { current: 60, target: 75, difficulty: "中（毎日15分で改善）" },
      "数学ⅠA": { current: 50, target: 75, difficulty: "高（基礎からやり直し必要）" },
      "数学ⅡBC": { current: 45, target: 70, difficulty: "高（時間が最もかかる）" },
      "国語": { current: 110, target: 130, difficulty: "中（古文漢文の暗記で+20点可能）" },
      "物理": { current: 55, target: 80, difficulty: "中（演習量で伸びる）" },
      "化学": { current: 50, target: 75, difficulty: "高（暗記+思考の両面強化）" },
      "地歴公民": { current: 60, target: 75, difficulty: "低（暗記で比較的伸びやすい）" },
      "情報Ⅰ": { current: 50, target: 70, difficulty: "中（プログラミング練習で対応）" }
    }
  }
};
```

---

## 6. データ構造（ローカルストレージ or JSON）

```typescript
interface StudentProfile {
  name: string;
  examType: "bunkeikokko" | "rikeikokko" | "bunkeishiritsu" | "rikeishiritsu";
  subjects: SelectedSubject[];
  dailySchedule: DailySchedule;
  clubDays: string[];          // ["月", "火", "水", "木", "金"]
  tennisMatches: EventDate[];  // テニスの試合
  schoolEvents: EventDate[];   // 学校行事
  regularTests: EventDate[];   // 定期テスト
  examDate: Date;              // 共テ本番日
  wakeUpTime: string;          // "06:00"
  bedTime: string;             // "23:30"
  commuteMinutes: number;      // 片道の通学時間
}

interface SelectedSubject {
  id: string;                  // "math1a" etc.
  currentScore: number;        // 現在の得点（100点満点換算）
  targetScore: number;         // 目標得点
  difficulty: 1 | 2 | 3 | 4 | 5;  // 本人の苦手度
  textbooks: string[];         // 使用教材名
}

interface StudyTask {
  id: string;
  subjectId: string;
  type: "new" | "review" | "exam_practice" | "speed_training";
  specificContent: string;     // "ターゲット1900 Section12 p.120-125"
  pomodoroType: "thinking" | "memorization" | "processing" | "exam_practice";
  pomodoroCount: number;
  reviewSource?: {             // 忘却曲線で生成された場合
    originalDate: Date;
    reviewNumber: number;      // 何回目の復習か
  };
  completed: boolean;
  actualMinutes?: number;      // 実際にかかった時間
}

interface DailyPlan {
  date: Date;
  phase: "基礎期" | "実践期" | "直前期";
  isClubDay: boolean;
  isMatchDay: boolean;
  isEventDay: boolean;
  availableMinutes: number;
  tasks: StudyTask[];
  reviewTasks: StudyTask[];    // 忘却曲線から自動生成
  completionRate: number;      // その日の達成率
}
```

---

## 7. Cursorへの段階的実装指示

以下の順番でCursorに指示してください。

### Phase A: 科目マスターデータの実装
「上記の KYOTSU_TEST_SUBJECTS と EXAM_TEMPLATES のデータを使って、初期設定ウィザードを作成してください。ユーザーが文系/理系を選ぶと、推奨科目がプリセットされ、個別に変更も可能にしてください」

### Phase B: 学習特性データの組み込み
「SUBJECT_CHARACTERISTICS のデータを使って、各科目の詳細画面に『共テの傾向と対策ポイント』を表示してください。また、科目ごとの学習タイプ（思考型/暗記型/処理速度型）に応じてポモドーロの設定を自動切替してください」

### Phase C: フェーズ自動判定とスケジュール生成
「試験日までの残り日数に応じて学習フェーズを自動判定し、フェーズごとの時間配分ルールに基づいて週間スケジュールを自動生成する機能を実装してください」

### Phase D: 忘却曲線の実装
「学習完了したタスクに対して、忘却曲線に基づく復習タスクを自動生成してください。復習タスクは毎日の計画の冒頭に配置し、1日45分を上限としてください」

### Phase E: 得点戦略シミュレーター
「現在の得点と目標得点を入力すると、科目ごとの伸びしろと学習時間配分の提案を自動計算する機能を追加してください」

### Phase F: イベント管理と調整
「テニスの試合、学校行事、定期テストを登録すると、前後の学習計画を自動調整する機能を実装してください。試合日は学習量を最小にし、翌日に調整分を配分してください」

### Phase G: 仮本番シミュレーション
「共テ本番と同じ時間割でタイマー付きの模擬演習ができる画面を作成してください。結果を記録し、過去の仮本番結果と比較できるグラフも表示してください」

---

## 8. 最重要ポイントまとめ（これだけは必ず実装すること）

1. **具体的なタスク指示**：「数学を勉強する」ではなく「数学ⅠA チャート式 例題45-52を解く（35分）」レベルの具体性
2. **忘却曲線の自動復習**：努力型の生徒は「やったのに忘れた」が最大のストレス。復習を自動化して「やった分は確実に定着する」体験を
3. **毎日の英語・数学の最低保証**：この2科目だけは0の日を作らない仕組み
4. **処理速度トレーニング**：共テは時間との勝負。英語の速読、数学の計算速度を測定・記録する機能
5. **テニスとの両立**：部活を否定せず、限られた時間を最大化する設計
6. **進捗の可視化**：連続学習日数、累計ポモドーロ数、科目別達成率など、「努力が報われている」ことを実感できるUI
7. **仮本番の自動スケジュール**：直前期に月2回、本番と同じ形式で全科目を通しで解く日を自動配置
