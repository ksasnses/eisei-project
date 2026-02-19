/**
 * 教材テンプレート（プリセット）
 * あくまで入力補助用。選んだ後に全ての項目を自由に編集できる。
 */

import type { TextbookPreset } from '../types';

export const TEXTBOOK_PRESETS: TextbookPreset[] = [
  // === 英語 ===
  { name: 'ターゲット1900', subjectCategory: 'english', applicableSubjectIds: ['eng_r', 'eng_l'], category: 'vocabulary', totalUnits: 38, unitLabel: 'section', minutesPerUnit: 15 },
  { name: 'システム英単語', subjectCategory: 'english', applicableSubjectIds: ['eng_r', 'eng_l'], category: 'vocabulary', totalUnits: 40, unitLabel: 'section', minutesPerUnit: 15 },
  { name: '速読英単語 必修編', subjectCategory: 'english', applicableSubjectIds: ['eng_r', 'eng_l'], category: 'vocabulary', totalUnits: 50, unitLabel: 'unit', minutesPerUnit: 20 },
  { name: '鉄壁', subjectCategory: 'english', applicableSubjectIds: ['eng_r', 'eng_l'], category: 'vocabulary', totalUnits: 50, unitLabel: 'section', minutesPerUnit: 20 },
  { name: 'Next Stage 英文法', subjectCategory: 'english', applicableSubjectIds: ['eng_r'], category: 'grammar', totalUnits: 24, unitLabel: 'chapter', minutesPerUnit: 25 },
  { name: 'Vintage 英文法', subjectCategory: 'english', applicableSubjectIds: ['eng_r'], category: 'grammar', totalUnits: 25, unitLabel: 'chapter', minutesPerUnit: 25 },
  { name: 'スクランブル英文法', subjectCategory: 'english', applicableSubjectIds: ['eng_r'], category: 'grammar', totalUnits: 20, unitLabel: 'chapter', minutesPerUnit: 20 },
  { name: 'やっておきたい英語長文300', subjectCategory: 'english', applicableSubjectIds: ['eng_r'], category: 'reading', totalUnits: 30, unitLabel: 'session', minutesPerUnit: 20 },
  { name: 'やっておきたい英語長文500', subjectCategory: 'english', applicableSubjectIds: ['eng_r'], category: 'reading', totalUnits: 20, unitLabel: 'session', minutesPerUnit: 30 },
  { name: '共テリスニング予想問題集', subjectCategory: 'english', applicableSubjectIds: ['eng_l'], category: 'listening', totalUnits: 10, unitLabel: 'session', minutesPerUnit: 30 },
  { name: '共テ英語 過去問', subjectCategory: 'english', applicableSubjectIds: ['eng_r', 'eng_l'], category: 'past_exam', totalUnits: 10, unitLabel: 'session', minutesPerUnit: 80 },

  // === 数学ⅠA ===
  { name: 'チャート式 数学ⅠA 青', subjectCategory: 'math', applicableSubjectIds: ['math1a'], category: 'workbook', totalUnits: 200, unitLabel: 'example', minutesPerUnit: 15 },
  { name: 'チャート式 数学ⅠA 黄', subjectCategory: 'math', applicableSubjectIds: ['math1a'], category: 'workbook', totalUnits: 180, unitLabel: 'example', minutesPerUnit: 15 },
  { name: 'Focus Gold 数学ⅠA', subjectCategory: 'math', applicableSubjectIds: ['math1a'], category: 'workbook', totalUnits: 200, unitLabel: 'example', minutesPerUnit: 15 },
  { name: '基礎問題精講 数学ⅠA', subjectCategory: 'math', applicableSubjectIds: ['math1a'], category: 'workbook', totalUnits: 125, unitLabel: 'example', minutesPerUnit: 15 },
  { name: '共テ数学ⅠA 過去問', subjectCategory: 'math', applicableSubjectIds: ['math1a'], category: 'past_exam', totalUnits: 10, unitLabel: 'session', minutesPerUnit: 70 },

  // === 数学ⅡBC ===
  { name: 'チャート式 数学ⅡBC 青', subjectCategory: 'math', applicableSubjectIds: ['math2bc'], category: 'workbook', totalUnits: 250, unitLabel: 'example', minutesPerUnit: 15 },
  { name: 'チャート式 数学ⅡBC 黄', subjectCategory: 'math', applicableSubjectIds: ['math2bc'], category: 'workbook', totalUnits: 220, unitLabel: 'example', minutesPerUnit: 15 },
  { name: 'Focus Gold 数学ⅡBC', subjectCategory: 'math', applicableSubjectIds: ['math2bc'], category: 'workbook', totalUnits: 250, unitLabel: 'example', minutesPerUnit: 15 },
  { name: '基礎問題精講 数学ⅡBC', subjectCategory: 'math', applicableSubjectIds: ['math2bc'], category: 'workbook', totalUnits: 150, unitLabel: 'example', minutesPerUnit: 15 },
  { name: '共テ数学ⅡBC 過去問', subjectCategory: 'math', applicableSubjectIds: ['math2bc'], category: 'past_exam', totalUnits: 10, unitLabel: 'session', minutesPerUnit: 70 },

  // === 国語（現代文）===
  { name: '現代文読解力の開発講座', subjectCategory: 'japanese', applicableSubjectIds: ['japanese'], category: 'reading', totalUnits: 15, unitLabel: 'lesson', minutesPerUnit: 25 },
  { name: '入試現代文へのアクセス 基本編', subjectCategory: 'japanese', applicableSubjectIds: ['japanese'], category: 'reading', totalUnits: 16, unitLabel: 'lesson', minutesPerUnit: 25 },
  { name: '共テ現代文 過去問', subjectCategory: 'japanese', applicableSubjectIds: ['japanese'], category: 'past_exam', totalUnits: 10, unitLabel: 'session', minutesPerUnit: 35 },

  // === 国語（古文）===
  { name: 'ゴロゴ古文単語', subjectCategory: 'japanese', applicableSubjectIds: ['japanese'], category: 'vocabulary', totalUnits: 12, unitLabel: 'chapter', minutesPerUnit: 15 },
  { name: 'マドンナ古文単語', subjectCategory: 'japanese', applicableSubjectIds: ['japanese'], category: 'vocabulary', totalUnits: 30, unitLabel: 'unit', minutesPerUnit: 10 },
  { name: '古文上達 基礎編', subjectCategory: 'japanese', applicableSubjectIds: ['japanese'], category: 'workbook', totalUnits: 30, unitLabel: 'session', minutesPerUnit: 20 },
  { name: '共テ古文 過去問', subjectCategory: 'japanese', applicableSubjectIds: ['japanese'], category: 'past_exam', totalUnits: 10, unitLabel: 'session', minutesPerUnit: 25 },

  // === 国語（漢文）===
  { name: '漢文句法ドリルと演習', subjectCategory: 'japanese', applicableSubjectIds: ['japanese'], category: 'workbook', totalUnits: 15, unitLabel: 'session', minutesPerUnit: 20 },
  { name: '漢文早覚え速答法', subjectCategory: 'japanese', applicableSubjectIds: ['japanese'], category: 'vocabulary', totalUnits: 10, unitLabel: 'chapter', minutesPerUnit: 20 },
  { name: '共テ漢文 過去問', subjectCategory: 'japanese', applicableSubjectIds: ['japanese'], category: 'past_exam', totalUnits: 10, unitLabel: 'session', minutesPerUnit: 20 },

  // === 物理 ===
  { name: 'セミナー物理', subjectCategory: 'science', applicableSubjectIds: ['physics'], category: 'workbook', totalUnits: 30, unitLabel: 'chapter', minutesPerUnit: 30 },
  { name: '物理のエッセンス 力学・波動', subjectCategory: 'science', applicableSubjectIds: ['physics'], category: 'workbook', totalUnits: 15, unitLabel: 'chapter', minutesPerUnit: 30 },
  { name: '物理のエッセンス 熱・電磁気・原子', subjectCategory: 'science', applicableSubjectIds: ['physics'], category: 'workbook', totalUnits: 15, unitLabel: 'chapter', minutesPerUnit: 30 },
  { name: '良問の風', subjectCategory: 'science', applicableSubjectIds: ['physics'], category: 'workbook', totalUnits: 20, unitLabel: 'chapter', minutesPerUnit: 30 },
  { name: '共テ物理 過去問', subjectCategory: 'science', applicableSubjectIds: ['physics'], category: 'past_exam', totalUnits: 10, unitLabel: 'session', minutesPerUnit: 60 },

  // === 化学 ===
  { name: 'セミナー化学', subjectCategory: 'science', applicableSubjectIds: ['chemistry'], category: 'workbook', totalUnits: 30, unitLabel: 'chapter', minutesPerUnit: 30 },
  { name: '化学の新研究', subjectCategory: 'science', applicableSubjectIds: ['chemistry'], category: 'reference', totalUnits: 25, unitLabel: 'chapter', minutesPerUnit: 30 },
  { name: '重要問題集 化学', subjectCategory: 'science', applicableSubjectIds: ['chemistry'], category: 'workbook', totalUnits: 25, unitLabel: 'chapter', minutesPerUnit: 30 },
  { name: '共テ化学 過去問', subjectCategory: 'science', applicableSubjectIds: ['chemistry'], category: 'past_exam', totalUnits: 10, unitLabel: 'session', minutesPerUnit: 60 },

  // === 生物 ===
  { name: 'セミナー生物', subjectCategory: 'science', applicableSubjectIds: ['biology'], category: 'workbook', totalUnits: 25, unitLabel: 'chapter', minutesPerUnit: 30 },
  { name: '生物基礎・生物の必修整理ノート', subjectCategory: 'science', applicableSubjectIds: ['biology', 'sci_biology_base'], category: 'vocabulary', totalUnits: 20, unitLabel: 'chapter', minutesPerUnit: 20 },
  { name: '共テ生物 過去問', subjectCategory: 'science', applicableSubjectIds: ['biology'], category: 'past_exam', totalUnits: 10, unitLabel: 'session', minutesPerUnit: 60 },

  // === 地学 ===
  { name: 'セミナー地学', subjectCategory: 'science', applicableSubjectIds: ['earth_sci'], category: 'workbook', totalUnits: 20, unitLabel: 'chapter', minutesPerUnit: 30 },
  { name: '共テ地学 過去問', subjectCategory: 'science', applicableSubjectIds: ['earth_sci'], category: 'past_exam', totalUnits: 10, unitLabel: 'session', minutesPerUnit: 60 },

  // === 理科基礎 ===
  { name: '物理基礎の点数が面白いほどとれる本', subjectCategory: 'science', applicableSubjectIds: ['sci_physics_base', 'sci_base'], category: 'reference', totalUnits: 15, unitLabel: 'chapter', minutesPerUnit: 25 },
  { name: '化学基礎の点数が面白いほどとれる本', subjectCategory: 'science', applicableSubjectIds: ['sci_chemistry_base', 'sci_base'], category: 'reference', totalUnits: 15, unitLabel: 'chapter', minutesPerUnit: 25 },
  { name: '生物基礎の点数が面白いほどとれる本', subjectCategory: 'science', applicableSubjectIds: ['sci_biology_base', 'sci_base'], category: 'reference', totalUnits: 15, unitLabel: 'chapter', minutesPerUnit: 25 },
  { name: '地学基礎の点数が面白いほどとれる本', subjectCategory: 'science', applicableSubjectIds: ['sci_earth_base', 'sci_base'], category: 'reference', totalUnits: 15, unitLabel: 'chapter', minutesPerUnit: 25 },
  { name: 'セミナー物理基礎', subjectCategory: 'science', applicableSubjectIds: ['sci_physics_base', 'sci_base'], category: 'workbook', totalUnits: 15, unitLabel: 'chapter', minutesPerUnit: 25 },
  { name: 'セミナー化学基礎', subjectCategory: 'science', applicableSubjectIds: ['sci_chemistry_base', 'sci_base'], category: 'workbook', totalUnits: 15, unitLabel: 'chapter', minutesPerUnit: 25 },
  { name: 'セミナー生物基礎', subjectCategory: 'science', applicableSubjectIds: ['sci_biology_base', 'sci_base'], category: 'workbook', totalUnits: 15, unitLabel: 'chapter', minutesPerUnit: 25 },
  { name: 'セミナー地学基礎', subjectCategory: 'science', applicableSubjectIds: ['sci_earth_base', 'sci_base'], category: 'workbook', totalUnits: 15, unitLabel: 'chapter', minutesPerUnit: 25 },
  { name: '共テ理科基礎 過去問', subjectCategory: 'science', applicableSubjectIds: ['sci_physics_base', 'sci_chemistry_base', 'sci_biology_base', 'sci_earth_base', 'sci_base'], category: 'past_exam', totalUnits: 10, unitLabel: 'session', minutesPerUnit: 30 },

  // === 日本史 ===
  { name: '詳説日本史', subjectCategory: 'social', applicableSubjectIds: ['his_jp'], category: 'textbook', totalUnits: 25, unitLabel: 'chapter', minutesPerUnit: 30 },
  { name: '日本史一問一答', subjectCategory: 'social', applicableSubjectIds: ['his_jp'], category: 'one_by_one', totalUnits: 25, unitLabel: 'chapter', minutesPerUnit: 20 },
  { name: '共テ日本史 過去問', subjectCategory: 'social', applicableSubjectIds: ['his_jp'], category: 'past_exam', totalUnits: 10, unitLabel: 'session', minutesPerUnit: 60 },

  // === 世界史 ===
  { name: '詳説世界史', subjectCategory: 'social', applicableSubjectIds: ['his_wd'], category: 'textbook', totalUnits: 30, unitLabel: 'chapter', minutesPerUnit: 30 },
  { name: '世界史一問一答', subjectCategory: 'social', applicableSubjectIds: ['his_wd'], category: 'one_by_one', totalUnits: 30, unitLabel: 'chapter', minutesPerUnit: 20 },
  { name: '共テ世界史 過去問', subjectCategory: 'social', applicableSubjectIds: ['his_wd'], category: 'past_exam', totalUnits: 10, unitLabel: 'session', minutesPerUnit: 60 },

  // === 地理 ===
  { name: '村瀬のゼロからわかる地理B', subjectCategory: 'social', applicableSubjectIds: ['geo_ex'], category: 'reference', totalUnits: 20, unitLabel: 'chapter', minutesPerUnit: 25 },
  { name: '地理一問一答', subjectCategory: 'social', applicableSubjectIds: ['geo_ex'], category: 'one_by_one', totalUnits: 20, unitLabel: 'chapter', minutesPerUnit: 20 },
  { name: '共テ地理 過去問', subjectCategory: 'social', applicableSubjectIds: ['geo_ex'], category: 'past_exam', totalUnits: 10, unitLabel: 'session', minutesPerUnit: 60 },

  // === 公民（倫理/政治経済）===
  { name: '蔭山の共通テスト倫理', subjectCategory: 'social', applicableSubjectIds: ['civ_eth'], category: 'reference', totalUnits: 15, unitLabel: 'chapter', minutesPerUnit: 25 },
  { name: '蔭山の共通テスト政治経済', subjectCategory: 'social', applicableSubjectIds: ['civ_pol'], category: 'reference', totalUnits: 15, unitLabel: 'chapter', minutesPerUnit: 25 },
  { name: '共テ倫理 過去問', subjectCategory: 'social', applicableSubjectIds: ['civ_eth'], category: 'past_exam', totalUnits: 10, unitLabel: 'session', minutesPerUnit: 60 },
  { name: '共テ政治経済 過去問', subjectCategory: 'social', applicableSubjectIds: ['civ_pol'], category: 'past_exam', totalUnits: 10, unitLabel: 'session', minutesPerUnit: 60 },

  // === 情報Ⅰ ===
  { name: '情報Ⅰの点数が面白いほどとれる本', subjectCategory: 'info', applicableSubjectIds: ['info1'], category: 'reference', totalUnits: 12, unitLabel: 'chapter', minutesPerUnit: 25 },
  { name: '共テ情報Ⅰ 予想問題集', subjectCategory: 'info', applicableSubjectIds: ['info1'], category: 'workbook', totalUnits: 10, unitLabel: 'session', minutesPerUnit: 30 },
];

/** 科目IDでフィルタしてプリセットを取得 */
export function getPresetsForSubject(subjectId: string): TextbookPreset[] {
  return TEXTBOOK_PRESETS.filter((p) => p.applicableSubjectIds.includes(subjectId));
}
