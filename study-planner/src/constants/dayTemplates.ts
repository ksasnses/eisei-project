import type { DayTemplate, DayType, StudyBlock } from '../types';

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
        durationMinutes: 90,
        pomodoroCount: 3,
        pomodoroWorkMinutes: 30,
        label: '理科 1.5h',
        order: 4,
      },
      {
        subjectCategory: 'social',
        subjectIds: [],
        durationMinutes: 90,
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
    selectedSubjectIds.map((id) => getSubjectCategory(id)).filter((c) => c !== 'unknown')
  );

  let removedMinutes = 0;
  const keptBlocks: StudyBlock[] = [];

  for (const block of base.blocks) {
    if (block.subjectCategory === 'review') {
      keptBlocks.push(block);
      continue;
    }
    if (selectedCategories.has(block.subjectCategory)) {
      if (block.subjectCategory === 'science' || block.subjectCategory === 'social') {
        const ids = selectedSubjectIds.filter(
          (id) => getSubjectCategory(id) === block.subjectCategory
        );
        keptBlocks.push({ ...block, subjectIds: ids });
      } else {
        const ids = selectedSubjectIds.filter(
          (id) => getSubjectCategory(id) === block.subjectCategory
        );
        keptBlocks.push({ ...block, subjectIds: ids.length > 0 ? ids : block.subjectIds });
      }
    } else {
      removedMinutes += block.durationMinutes;
    }
  }

  const redistributable = keptBlocks.filter((b) =>
    ['science', 'social', 'info'].includes(b.subjectCategory)
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
