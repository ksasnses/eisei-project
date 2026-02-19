import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ScheduleRuleConfig,
  DayTemplateConfig,
  BlockConfig,
  DayType,
} from '../types';

function subjectIdToCategory(
  subjectId: string
): 'english' | 'math' | 'japanese' | 'science' | 'social' | 'info' | null {
  if (subjectId === 'eng_r' || subjectId === 'eng_l') return 'english';
  if (subjectId === 'math1a' || subjectId === 'math1' || subjectId === 'math2bc') return 'math';
  if (subjectId === 'japanese') return 'japanese';
  if (['physics', 'chemistry', 'biology', 'earth_sci', 'sci_base',
       'sci_physics_base', 'sci_chemistry_base', 'sci_biology_base', 'sci_earth_base'].includes(subjectId))
    return 'science';
  if (['geo_ex', 'his_jp', 'his_wd', 'civ_eth', 'civ_pol', 'geo_his_civ'].includes(subjectId))
    return 'social';
  if (subjectId === 'info1') return 'info';
  return null;
}
import { DEFAULT_RULE_CONFIG } from '../constants/defaultRuleConfig';

function setUpdatedAt(config: ScheduleRuleConfig): ScheduleRuleConfig {
  return { ...config, updatedAt: new Date().toISOString() };
}

function addChangeLog(
  config: ScheduleRuleConfig,
  description: string
): ScheduleRuleConfig {
  const log = config.changeLog ?? [];
  const entry = { date: new Date().toISOString().slice(0, 10), description };
  const next = [entry, ...log].slice(0, 10);
  return { ...config, changeLog: next };
}

interface RuleConfigState {
  config: ScheduleRuleConfig;

  getDayTemplate: (dayType: DayType) => DayTemplateConfig | undefined;
  updateDayTemplate: (dayType: DayType, template: Partial<DayTemplateConfig>) => void;

  addBlock: (dayType: DayType, block: BlockConfig) => void;
  updateBlock: (dayType: DayType, blockId: string, updates: Partial<BlockConfig>) => void;
  removeBlock: (dayType: DayType, blockId: string) => void;
  reorderBlocks: (dayType: DayType, blockIds: string[]) => void;

  updatePhaseContent: (
    subjectCategory: string,
    phase: string,
    contents: string[]
  ) => void;

  updateForgettingCurve: (
    updates: Partial<ScheduleRuleConfig['forgettingCurve']>
  ) => void;

  updateGeneralRules: (
    updates: Partial<ScheduleRuleConfig['generalRules']>
  ) => void;

  resetToDefault: () => void;
  exportConfig: () => string;
  importConfig: (json: string) => boolean;
  /** 選択科目に基づき未選択カテゴリのブロックを enabled: false に設定 */
  syncTemplatesBySelectedSubjects: (selectedSubjectIds: string[]) => void;
  /** 変更履歴に1件追加（UIから呼ぶ） */
  addChangeLogEntry: (description: string) => void;
}

export const useRuleConfigStore = create<RuleConfigState>()(
  persist(
    (set, get) => ({
      config: DEFAULT_RULE_CONFIG,

      getDayTemplate: (dayType) =>
        get().config.dayTemplates.find((t) => t.dayType === dayType),

      updateDayTemplate: (dayType, partial) =>
        set((state) => {
          const dayTemplates = state.config.dayTemplates.map((t) =>
            t.dayType === dayType ? { ...t, ...partial } : t
          );
          const config = setUpdatedAt({ ...state.config, dayTemplates });
          return { config };
        }),

      addBlock: (dayType, block) =>
        set((state) => {
          const dayTemplates = state.config.dayTemplates.map((t) => {
            if (t.dayType !== dayType) return t;
            return { ...t, blocks: [...t.blocks, block] };
          });
          const config = setUpdatedAt({ ...state.config, dayTemplates });
          return { config };
        }),

      updateBlock: (dayType, blockId, updates) =>
        set((state) => {
          const dayTemplates = state.config.dayTemplates.map((t) => {
            if (t.dayType !== dayType) return t;
            const blocks = t.blocks.map((b) =>
              b.id === blockId ? { ...b, ...updates } : b
            );
            return { ...t, blocks };
          });
          const config = setUpdatedAt({ ...state.config, dayTemplates });
          return { config };
        }),

      removeBlock: (dayType, blockId) =>
        set((state) => {
          const dayTemplates = state.config.dayTemplates.map((t) => {
            if (t.dayType !== dayType) return t;
            const blocks = t.blocks.filter((b) => b.id !== blockId);
            return { ...t, blocks };
          });
          const config = setUpdatedAt({ ...state.config, dayTemplates });
          return { config };
        }),

      reorderBlocks: (dayType, blockIds) =>
        set((state) => {
          const dayTemplates = state.config.dayTemplates.map((t) => {
            if (t.dayType !== dayType) return t;
            const idToBlock = new Map(t.blocks.map((b) => [b.id, b]));
            const blocks = blockIds
              .map((id) => idToBlock.get(id))
              .filter((b): b is BlockConfig => b != null);
            const remaining = t.blocks.filter((b) => !blockIds.includes(b.id));
            return { ...t, blocks: [...blocks, ...remaining] };
          });
          const config = setUpdatedAt({ ...state.config, dayTemplates });
          return { config };
        }),

      updatePhaseContent: (subjectCategory, phase, contents) =>
        set((state) => {
          const phaseContents = state.config.phaseContents.map((p) =>
            p.subjectCategory === subjectCategory && p.phase === phase
              ? { ...p, contents }
              : p
          );
          const config = setUpdatedAt({ ...state.config, phaseContents });
          return { config };
        }),

      updateForgettingCurve: (updates) =>
        set((state) => {
          const forgettingCurve = { ...state.config.forgettingCurve, ...updates };
          const config = setUpdatedAt({ ...state.config, forgettingCurve });
          return { config };
        }),

      updateGeneralRules: (updates) =>
        set((state) => {
          const generalRules = { ...state.config.generalRules, ...updates };
          const config = setUpdatedAt({ ...state.config, generalRules });
          return { config };
        }),

      resetToDefault: () =>
        set({
          config: setUpdatedAt({ ...DEFAULT_RULE_CONFIG }),
        }),

      exportConfig: () =>
        JSON.stringify(get().config, null, 2),

      importConfig: (json: string): boolean => {
        try {
          const parsed = JSON.parse(json) as ScheduleRuleConfig;
          if (typeof parsed.version !== 'number') return false;
          set({ config: setUpdatedAt(parsed) });
          return true;
        } catch {
          return false;
        }
      },

      syncTemplatesBySelectedSubjects: (selectedSubjectIds) =>
        set((state) => {
          const selectedCategories = new Set(
            selectedSubjectIds.map((id) => subjectIdToCategory(id)).filter((c): c is NonNullable<typeof c> => c != null)
          );
          const dayTemplates = state.config.dayTemplates.map((t) => ({
            ...t,
            blocks: t.blocks.map((b) => ({
              ...b,
              enabled: selectedCategories.has(b.subjectCategory) ? b.enabled : false,
            })),
          }));
          const config = setUpdatedAt({ ...state.config, dayTemplates });
          return { config };
        }),

      addChangeLogEntry: (description) =>
        set((state) => ({
          config: setUpdatedAt(addChangeLog(state.config, description)),
        })),
    }),
    {
      name: 'schedule-rule-config',
      merge: (persisted, current) => {
        const p = persisted as { config?: ScheduleRuleConfig } | undefined;
        if (!p?.config) return { ...current, ...p };
        let config = p.config;
        if (config.generalRules && config.generalRules.bufferRatio == null) {
          config = { ...config, generalRules: { ...config.generalRules, bufferRatio: 0.15 } };
        }
        if ((config.version ?? 1) < 3) {
          config = { ...config, version: 3, dayTemplates: DEFAULT_RULE_CONFIG.dayTemplates };
        }
        // 平日は英語・数学のみにする（version 4 移行）
        const weekdayOnly = ['english', 'math'];
        let changed = false;
        const dayTemplates = config.dayTemplates.map((t) => {
          if (t.dayType !== 'weekday_club' && t.dayType !== 'weekday_no_club') return t;
          const hasNonWeekday = t.blocks.some(
            (b) => !weekdayOnly.includes(b.subjectCategory)
          );
          if (!hasNonWeekday) return t;
          changed = true;
          const defaultT = DEFAULT_RULE_CONFIG.dayTemplates.find((d) => d.dayType === t.dayType);
          return defaultT ? { ...t, blocks: defaultT.blocks, description: defaultT.description } : t;
        });
        if (changed) {
          config = { ...config, version: 4, dayTemplates };
        }
        return { ...current, config };
      },
    }
  )
);
