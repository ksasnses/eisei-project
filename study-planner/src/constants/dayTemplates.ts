import type { DayTemplate, DayType, StudyBlock, BlockConfig } from '../types';
import { useRuleConfigStore } from '../stores/ruleConfigStore';

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

const DEFAULT_SUBJECT_IDS: Record<string, string[]> = {
  english: ['eng_r', 'eng_l'],
  math: ['math1a', 'math2bc'],
  japanese: ['japanese'],
  science: [],
  social: [],
  info: ['info1'],
};

function blockConfigToStudyBlock(
  b: BlockConfig,
  subjectIds: string[]
): StudyBlock {
  const ids = subjectIds.length > 0 ? subjectIds : (DEFAULT_SUBJECT_IDS[b.subjectCategory] ?? []);
  const pomodoroCount = Math.max(1, Math.floor(b.durationMinutes / b.pomodoroWorkMinutes));
  return {
    subjectCategory: b.subjectCategory,
    subjectIds: ids,
    durationMinutes: b.durationMinutes,
    pomodoroCount,
    pomodoroWorkMinutes: b.pomodoroWorkMinutes,
    label: b.label,
    order: b.order,
  };
}

/**
 * DayTemplateConfig を DayTemplate（StudyBlock形式）に変換
 */
function configToTemplate(
  config: { dayType: DayType; blocks: BlockConfig[]; maxReviewMinutes: number; description: string },
  subjectIdsByCategory: Map<string, string[]>
): DayTemplate {
  const blocks: StudyBlock[] = config.blocks
    .filter((b) => b.enabled)
    .map((b) => {
      const ids = subjectIdsByCategory.get(b.subjectCategory) ?? [];
      return blockConfigToStudyBlock(b, ids);
    });
  const totalStudyMinutes = blocks.reduce((s, b) => s + b.durationMinutes, 0);
  return {
    dayType: config.dayType,
    blocks,
    totalStudyMinutes,
    maxReviewMinutes: config.maxReviewMinutes,
    description: config.description,
  };
}

/**
 * 日種別テンプレートを取得（ruleConfigStore から）
 */
export function getDayTemplate(dayType: DayType): DayTemplate {
  const templateConfig = useRuleConfigStore.getState().getDayTemplate(dayType);
  if (!templateConfig) {
    return {
      dayType,
      blocks: [],
      totalStudyMinutes: 0,
      maxReviewMinutes: 20,
      description: '',
    };
  }
  const subjectIdsByCategory = new Map<string, string[]>();
  return configToTemplate(templateConfig, subjectIdsByCategory);
}

/**
 * 生徒が選択していない科目カテゴリのブロックを除外し、
 * その分の時間を再配分したテンプレートを返す。
 */
export function getAdjustedTemplate(
  dayType: DayType,
  selectedSubjectIds: string[]
): { template: DayTemplate; extraMinutes: number } {
  const templateConfig = useRuleConfigStore.getState().getDayTemplate(dayType);
  if (!templateConfig) {
    return {
      template: { dayType, blocks: [], totalStudyMinutes: 0, maxReviewMinutes: 20, description: '' },
      extraMinutes: 0,
    };
  }

  const selectedCategories = new Set(
    selectedSubjectIds.map((id) => getSubjectCategory(id)).filter((c) => c !== 'unknown')
  );
  const subjectIdsByCategory = new Map<string, string[]>();
  for (const cat of ['english', 'math', 'japanese', 'science', 'social', 'info'] as const) {
    const ids = selectedSubjectIds.filter((id) => getSubjectCategory(id) === cat);
    if (ids.length > 0) subjectIdsByCategory.set(cat, ids);
  }

  const base = configToTemplate(templateConfig, subjectIdsByCategory);
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
        keptBlocks.push({
          ...block,
          subjectIds: ids.length > 0 ? ids : block.subjectIds,
        });
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
  }

  const newTotal = keptBlocks.reduce((sum, b) => sum + b.durationMinutes, 0);
  return {
    template: {
      ...base,
      blocks: keptBlocks,
      totalStudyMinutes: newTotal,
    },
    extraMinutes: removedMinutes,
  };
}
