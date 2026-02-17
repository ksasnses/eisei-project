/**
 * 共通テスト 科目マスターデータ
 * docs/spec.md セクション2-1・2-3 に基づく
 */

import type { Subject } from '../types';

export const SUBJECTS: Subject[] = [
  // === 1日目 地歴公民 ===
  {
    id: 'geo_ex',
    name: '地理総合・地理探究',
    score: 100,
    time: 60,
    day: 1,
    category: '地歴公民',
    studyType: 'mixed',
    memorizationRatio: 0.5,
    thinkingRatio: 0.5,
    processingSpeedCritical: false,
    dailyPracticeNeeded: false,
    recommendedDailyMin: 20,
    crammingEffective: true,
    tips: [
      '地図・統計資料の読み取りが中心',
      '地域ごとの特徴と因果関係の理解が必要',
      '時事問題と結びついた出題に注意',
    ],
  },
  {
    id: 'his_jp',
    name: '歴史総合・日本史探究',
    score: 100,
    time: 60,
    day: 1,
    category: '地歴公民',
    studyType: 'mixed',
    memorizationRatio: 0.6,
    thinkingRatio: 0.4,
    processingSpeedCritical: false,
    dailyPracticeNeeded: false,
    recommendedDailyMin: 20,
    crammingEffective: true,
    tips: [
      '史料を用いた出題が増加傾向',
      '単純暗記ではなく、因果関係の理解が必要',
      '「なぜその出来事が起きたか」を説明できるレベルで',
    ],
  },
  {
    id: 'his_wd',
    name: '歴史総合・世界史探究',
    score: 100,
    time: 60,
    day: 1,
    category: '地歴公民',
    studyType: 'mixed',
    memorizationRatio: 0.6,
    thinkingRatio: 0.4,
    processingSpeedCritical: false,
    dailyPracticeNeeded: false,
    recommendedDailyMin: 20,
    crammingEffective: true,
    tips: [
      '地域横断・比較の出題が増加',
      '因果関係と流れの理解が重要',
      '史料・地図との組み合わせに慣れる',
    ],
  },
  {
    id: 'civ_eth',
    name: '公共・倫理',
    score: 100,
    time: 60,
    day: 1,
    category: '地歴公民',
    studyType: 'mixed',
    memorizationRatio: 0.5,
    thinkingRatio: 0.5,
    processingSpeedCritical: false,
    dailyPracticeNeeded: false,
    recommendedDailyMin: 20,
    crammingEffective: true,
    tips: [
      '思想家・用語の理解と論述力の両方が必要',
      '現代の倫理問題との関連を意識する',
    ],
  },
  {
    id: 'civ_pol',
    name: '公共・政治・経済',
    score: 100,
    time: 60,
    day: 1,
    category: '地歴公民',
    studyType: 'mixed',
    memorizationRatio: 0.5,
    thinkingRatio: 0.5,
    processingSpeedCritical: false,
    dailyPracticeNeeded: false,
    recommendedDailyMin: 20,
    crammingEffective: true,
    tips: [
      '制度・用語の正確な理解が前提',
      '時事と結びついた資料読解が頻出',
    ],
  },
  {
    id: 'geo_his_civ',
    name: '地理総合/歴史総合/公共',
    score: 100,
    time: 60,
    day: 1,
    category: '地歴公民',
    studyType: 'mixed',
    memorizationRatio: 0.6,
    thinkingRatio: 0.4,
    processingSpeedCritical: false,
    dailyPracticeNeeded: false,
    recommendedDailyMin: 20,
    crammingEffective: true,
    tips: ['3分野から2つ選択。使えない大学が多いので注意'],
    note: '3分野から2つ選択。使えない大学が多いので注意',
  },
  // === 1日目 国語 ===
  {
    id: 'japanese',
    name: '国語',
    score: 200,
    time: 90,
    day: 1,
    category: '国語',
    studyType: 'mixed',
    memorizationRatio: 0.3,
    thinkingRatio: 0.7,
    processingSpeedCritical: true,
    dailyPracticeNeeded: false,
    recommendedDailyMin: 20,
    crammingEffective: false,
    tips: [
      '問3（実用的文章）は新傾向。グラフ・資料の読み取りが含まれる',
      '2026年度は問3の難化が予想される',
      '現代文で時間を使いすぎると古文漢文に影響 — 時間配分が最重要',
    ],
    note:
      '2025年度から90分。問3の実用的文章（新傾向）に注意',
  },
  // === 1日目 外国語 ===
  {
    id: 'eng_r',
    name: '英語リーディング',
    score: 100,
    time: 80,
    day: 1,
    category: '外国語',
    studyType: 'mixed',
    memorizationRatio: 0.4,
    thinkingRatio: 0.6,
    processingSpeedCritical: true,
    dailyPracticeNeeded: true,
    recommendedDailyMin: 30,
    crammingEffective: false,
    tips: [
      '2026年度は語数増加・難化の可能性あり',
      '大問8題構成が継続する見込み',
      '情報検索型の問題が中心 — 全文精読ではなく必要情報をスキャンする力',
      '言い換え(paraphrase)への対応力が重要',
    ],
  },
  {
    id: 'eng_l',
    name: '英語リスニング',
    score: 100,
    time: 60,
    day: 1,
    category: '外国語',
    studyType: 'processing',
    memorizationRatio: 0.3,
    thinkingRatio: 0.3,
    processingSpeedCritical: true,
    dailyPracticeNeeded: true,
    recommendedDailyMin: 15,
    crammingEffective: false,
    tips: [
      '音声は一度しか再生されない問題がある',
      '先読みスキルが得点を大きく左右する',
    ],
    note: '実質解答時間30分。ICプレーヤー操作含む',
  },
  // === 2日目 理科 ===
  {
    id: 'sci_base',
    name: '物理基礎/化学基礎/生物基礎/地学基礎',
    score: 100,
    time: 60,
    day: 2,
    category: '理科',
    studyType: 'mixed',
    memorizationRatio: 0.4,
    thinkingRatio: 0.6,
    processingSpeedCritical: false,
    dailyPracticeNeeded: true,
    recommendedDailyMin: 25,
    crammingEffective: false,
    tips: ['4分野から2つ選択。基礎の理解と演習の両立が重要'],
    note: '4分野から2つ選択',
  },
  {
    id: 'physics',
    name: '物理',
    score: 100,
    time: 60,
    day: 2,
    category: '理科',
    studyType: 'thinking',
    memorizationRatio: 0.2,
    thinkingRatio: 0.8,
    processingSpeedCritical: false,
    dailyPracticeNeeded: true,
    recommendedDailyMin: 25,
    crammingEffective: false,
    tips: [
      '全範囲から偏りなく出題',
      '公式暗記だけでは不可 — 応用力が必要',
    ],
  },
  {
    id: 'chemistry',
    name: '化学',
    score: 100,
    time: 60,
    day: 2,
    category: '理科',
    studyType: 'mixed',
    memorizationRatio: 0.5,
    thinkingRatio: 0.5,
    processingSpeedCritical: false,
    dailyPracticeNeeded: true,
    recommendedDailyMin: 25,
    crammingEffective: false,
    tips: [
      '2025年度は歴代最低点 — グラフ読み取り・応用問題が増加',
      '暗記と思考力の両方が必要',
      '「なぜそうなるか」の根本理解が問われる',
    ],
  },
  {
    id: 'biology',
    name: '生物',
    score: 100,
    time: 60,
    day: 2,
    category: '理科',
    studyType: 'mixed',
    memorizationRatio: 0.5,
    thinkingRatio: 0.5,
    processingSpeedCritical: false,
    dailyPracticeNeeded: true,
    recommendedDailyMin: 25,
    crammingEffective: false,
    tips: [
      '実験・考察問題が中心',
      '用語の正確な理解と論理的な読解の両方が必要',
    ],
  },
  {
    id: 'earth_sci',
    name: '地学',
    score: 100,
    time: 60,
    day: 2,
    category: '理科',
    studyType: 'mixed',
    memorizationRatio: 0.4,
    thinkingRatio: 0.6,
    processingSpeedCritical: false,
    dailyPracticeNeeded: true,
    recommendedDailyMin: 25,
    crammingEffective: false,
    tips: ['地学基礎との連続性を意識。図表の読み取りが重要'],
  },
  // === 2日目 数学 ===
  {
    id: 'math1a',
    name: '数学Ⅰ・A',
    score: 100,
    time: 70,
    day: 2,
    category: '数学',
    studyType: 'thinking',
    memorizationRatio: 0.2,
    thinkingRatio: 0.8,
    processingSpeedCritical: true,
    dailyPracticeNeeded: true,
    recommendedDailyMin: 30,
    crammingEffective: false,
    tips: [
      '新課程でデータの分析が強化（外れ値、仮説検定）',
      '公式丸暗記では対応不可 — 「なぜその公式を使うか」の理解が必要',
      '全範囲からの出題 — 苦手分野を残すと致命的',
    ],
    note: '新課程：データの分析に外れ値・仮説検定が追加',
  },
  {
    id: 'math2bc',
    name: '数学Ⅱ・B・C',
    score: 100,
    time: 70,
    day: 2,
    category: '数学',
    studyType: 'thinking',
    memorizationRatio: 0.2,
    thinkingRatio: 0.8,
    processingSpeedCritical: true,
    dailyPracticeNeeded: true,
    recommendedDailyMin: 30,
    crammingEffective: false,
    tips: [
      '新課程：数学Cのベクトル・複素数平面が追加',
      '統計的な推測（仮説検定）が新たに出題',
      '分量が多く難化傾向 — 選択問題の戦略が重要',
    ],
    note:
      '新課程：数学Cのベクトル・複素数平面、統計的な推測が追加',
  },
  // === 2日目 情報 ===
  {
    id: 'info1',
    name: '情報Ⅰ',
    score: 100,
    time: 60,
    day: 2,
    category: '情報',
    studyType: 'mixed',
    memorizationRatio: 0.4,
    thinkingRatio: 0.6,
    processingSpeedCritical: false,
    dailyPracticeNeeded: false,
    recommendedDailyMin: 15,
    crammingEffective: true,
    tips: [
      '2025年度平均69点 → 2026年度は大幅難化の可能性',
      '特にプログラミング問題の練習が重要',
      '過去問が少ないので予想問題集を活用',
    ],
    note:
      '2025年度新設。プログラミング問題が要対策。2025年度平均点69点→難化予想',
  },
];

/** IDから科目を取得 */
export function getSubjectById(id: string): Subject | undefined {
  return SUBJECTS.find((s) => s.id === id);
}

/** カテゴリで科目一覧を取得 */
export function getSubjectsByCategory(
  category: Subject['category']
): Subject[] {
  return SUBJECTS.filter((s) => s.category === category);
}

/** 日別で科目一覧を取得 */
export function getSubjectsByDay(day: 1 | 2): Subject[] {
  return SUBJECTS.filter((s) => s.day === day);
}

/** 共通テスト 1日目の科目ID順（地歴公民→国語→英語R→英語L） */
export const EXAM_DAY1_ORDER: string[] = [
  'geo_ex', 'his_jp', 'his_wd', 'civ_eth', 'civ_pol', 'geo_his_civ',
  'japanese', 'eng_r', 'eng_l',
];

/** 共通テスト 2日目の科目ID順（理科→数学①→数学②→情報Ⅰ） */
export const EXAM_DAY2_ORDER: string[] = [
  'sci_base', 'physics', 'chemistry', 'biology', 'earth_sci',
  'math1a', 'math2bc', 'info1',
];

const BREAK_BETWEEN_SUBJECTS_MINUTES = 10;

export interface ExamSlot {
  type: 'subject' | 'break';
  subjectId?: string;
  name?: string;
  durationSeconds: number;
}

/** 選択科目のみで仮本番用スロット列を生成（1日分） */
export function getExamSlotsForDay(
  subjectIds: string[],
  dayOrder: string[]
): ExamSlot[] {
  const slots: ExamSlot[] = [];
  const set = new Set(subjectIds);
  for (let i = 0; i < dayOrder.length; i++) {
    const id = dayOrder[i];
    if (!set.has(id)) continue;
    const sub = getSubjectById(id);
    if (sub) {
      if (slots.length > 0) {
        slots.push({
          type: 'break',
          durationSeconds: BREAK_BETWEEN_SUBJECTS_MINUTES * 60,
        });
      }
      slots.push({
        type: 'subject',
        subjectId: id,
        name: sub.name,
        durationSeconds: sub.time * 60,
      });
    }
  }
  return slots;
}
