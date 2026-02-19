/**
 * 教材関連の表示ラベル
 */

import type { TextbookCategory, UnitLabel } from '../types';

export const UNIT_LABEL_OPTIONS: { value: UnitLabel; label: string }[] = [
  { value: 'section', label: 'Section' },
  { value: 'chapter', label: '章' },
  { value: 'session', label: '回' },
  { value: 'unit', label: 'Unit' },
  { value: 'lesson', label: 'Lesson' },
  { value: 'example', label: '例題' },
  { value: 'question', label: '大問' },
  { value: 'page10', label: 'ページ範囲（10ページ単位）' },
  { value: 'custom', label: '自分で入力' },
];

export const TEXTBOOK_CATEGORY_OPTIONS: { value: TextbookCategory; label: string }[] = [
  { value: 'vocabulary', label: '単語帳' },
  { value: 'grammar', label: '文法書・文法問題集' },
  { value: 'reading', label: '読解問題集' },
  { value: 'listening', label: 'リスニング教材' },
  { value: 'textbook', label: '教科書' },
  { value: 'reference', label: '参考書' },
  { value: 'workbook', label: '問題集・ワーク' },
  { value: 'one_by_one', label: '一問一答' },
  { value: 'past_exam', label: '過去問・予想問題集' },
  { value: 'other', label: 'その他' },
];

export const JAPANESE_SUBCATEGORY_OPTIONS: { value: 'modern' | 'classical' | 'chinese' | 'general'; label: string }[] = [
  { value: 'modern', label: '現代文' },
  { value: 'classical', label: '古文' },
  { value: 'chinese', label: '漢文' },
  { value: 'general', label: '国語全般' },
];

export function getUnitLabelDisplay(unitLabel: UnitLabel, custom?: string): string {
  const opt = UNIT_LABEL_OPTIONS.find((o) => o.value === unitLabel);
  if (unitLabel === 'custom' && custom) return custom;
  return opt?.label ?? unitLabel;
}

export function getCategoryDisplay(cat: TextbookCategory): string {
  return TEXTBOOK_CATEGORY_OPTIONS.find((o) => o.value === cat)?.label ?? cat;
}
