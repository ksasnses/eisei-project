/**
 * 共通テスト 受験テンプレート
 * docs/spec.md セクション2-2 に基づく
 */

import type { ExamTemplate } from '../types';

export const EXAM_TEMPLATES: ExamTemplate[] = [
  {
    id: 'bunkeikokko',
    name: '国公立文系',
    requiredSubjects: ['eng_r', 'eng_l', 'japanese', 'info1'],
    selectGroups: [
      { from: '地歴公民', count: 1 },
      { from: '数学', count: 1, subjectIds: ['math1a', 'math2bc'] },
      {
        from: '理科基礎',
        count: 2,
        subjectIds: ['sci_physics_base', 'sci_chemistry_base', 'sci_biology_base', 'sci_earth_base'],
      },
    ],
    totalScore: 700,
    note: '地歴公民1科目＋数学ⅠAまたはⅡBCのどちらか1つ＋理科基礎から2分野選択',
  },
  {
    id: 'rikeikokko',
    name: '国公立理系',
    requiredSubjects: ['eng_r', 'eng_l', 'japanese', 'math1a', 'math2bc', 'info1'],
    selectGroups: [
      { from: '地歴公民', count: 1 },
      { from: '理科', count: 2, recommended: ['physics', 'chemistry'] },
    ],
    totalScore: 900,
    note: '理科2科目＋地歴公民1科目が一般的',
  },
  {
    id: 'bunkeishiritsu',
    name: '私立文系（共テ利用）',
    requiredSubjects: ['eng_r', 'eng_l'],
    selectGroups: [{ from: '全科目', count: 3 }],
    totalScore: 400,
    note: '英語＋国語＋地歴が多い。2-3科目で大学により異なる',
  },
  {
    id: 'rikeishiritsu',
    name: '私立理系（共テ利用）',
    requiredSubjects: ['eng_r', 'eng_l', 'math1a', 'math2bc'],
    selectGroups: [{ from: '理科', count: 2 }],
    totalScore: 500,
    note: '英語＋数学＋理科が基本。理科は1-2科目で大学により異なる',
  },
];

/** IDからテンプレートを取得 */
export function getExamTemplateById(id: string): ExamTemplate | undefined {
  return EXAM_TEMPLATES.find((t) => t.id === id);
}
