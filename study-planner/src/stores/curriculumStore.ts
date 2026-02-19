/**
 * 教材・カリキュラム管理ストア
 * 科目ごとの教材リストと進捗を保持
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Textbook, UnitLabel, TextbookPreset } from '../types';
function genId(): string {
  return `tb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function unitLabelToDisplay(unitLabel: UnitLabel, custom?: string): string {
  const map: Record<UnitLabel, string> = {
    section: 'Section',
    chapter: '章',
    session: '回',
    unit: 'Unit',
    lesson: 'Lesson',
    example: '例題',
    question: '大問',
    page10: 'ページ範囲（10ページ単位）',
    custom: custom ?? 'カスタム',
  };
  return map[unitLabel] ?? unitLabel;
}

interface CurriculumState {
  /** subjectId -> 教材リスト（順序保持、優先度順） */
  textbooksBySubject: Record<string, Textbook[]>;

  // Actions
  getTextbooks: (subjectId: string) => Textbook[];
  addTextbook: (subjectId: string, input: Omit<Textbook, 'id' | 'subjectId' | 'status' | 'completedUnitCount' | 'createdAt'>) => Textbook;
  updateTextbook: (textbookId: string, partial: Partial<Textbook>) => void;
  removeTextbook: (textbookId: string) => void;
  replaceTextbook: (oldId: string, input: Omit<Textbook, 'id' | 'subjectId' | 'status' | 'completedUnitCount' | 'createdAt'>) => Textbook;
  pauseTextbook: (textbookId: string) => void;
  resumeTextbook: (textbookId: string) => void;
  archiveTextbook: (textbookId: string) => void;
  incrementCompletedUnit: (textbookId: string) => void;
  setCompletedUnitCount: (textbookId: string, count: number) => void;

  /** プリセットから教材を作成（プレビュー用の入力値を返す） */
  createFromPreset: (subjectId: string, preset: TextbookPreset, overrides?: Partial<Textbook>) => Omit<Textbook, 'id' | 'createdAt'>;

  /** 旧 textbooks: string[] から移行 */
  migrateFromLegacyTextbooks: (subjectId: string, names: string[]) => void;
  resetAll: () => void;
}

export const useCurriculumStore = create<CurriculumState>()(
  persist(
    (set, get) => ({
      textbooksBySubject: {},

      getTextbooks: (subjectId) => {
        return (get().textbooksBySubject[subjectId] ?? []).filter(
          (t) => t.status !== 'archived'
        );
      },

      addTextbook: (subjectId, input) => {
        const now = new Date().toISOString();
        const existing = get().textbooksBySubject[subjectId] ?? [];
        const maxPriority = Math.max(0, ...existing.map((t) => t.priority));
        const textbook: Textbook = {
          ...input,
          id: genId(),
          subjectId,
          status: 'active',
          completedUnitCount: 0,
          createdAt: now,
          priority: input.priority ?? maxPriority + 1,
        };
        set((state) => ({
          textbooksBySubject: {
            ...state.textbooksBySubject,
            [subjectId]: [...existing, textbook],
          },
        }));
        return textbook;
      },

      updateTextbook: (textbookId, partial) => {
        set((state) => {
          const next: Record<string, Textbook[]> = {};
          for (const [subId, list] of Object.entries(state.textbooksBySubject)) {
            const idx = list.findIndex((t) => t.id === textbookId);
            if (idx < 0) {
              next[subId] = list;
              continue;
            }
            const t = list[idx]!;
            const updated = { ...t, ...partial };

            // ユニット数変更時の進捗引き継ぎ
            if (partial.totalUnits != null && partial.totalUnits !== t.totalUnits) {
              const oldTotal = t.totalUnits;
              const newTotal = partial.totalUnits;
              if (newTotal < oldTotal) {
                updated.completedUnitCount = Math.min(
                  t.completedUnitCount,
                  newTotal
                );
              }
            }

            const newList = [...list];
            newList[idx] = updated;
            next[subId] = newList;
          }
          return { textbooksBySubject: next };
        });
      },

      removeTextbook: (textbookId) => {
        set((state) => {
          const next: Record<string, Textbook[]> = {};
          for (const [subId, list] of Object.entries(state.textbooksBySubject)) {
            next[subId] = list.filter((t) => t.id !== textbookId);
          }
          return { textbooksBySubject: next };
        });
      },

      replaceTextbook: (oldId, input) => {
        const old = Object.values(get().textbooksBySubject)
          .flat()
          .find((t) => t.id === oldId);
        if (!old) throw new Error('textbook not found');
        const subjectId = old.subjectId;
        get().archiveTextbook(oldId);
        return get().addTextbook(subjectId, input);
      },

      pauseTextbook: (textbookId) => {
        get().updateTextbook(textbookId, { status: 'paused' });
      },

      resumeTextbook: (textbookId) => {
        get().updateTextbook(textbookId, { status: 'active' });
      },

      archiveTextbook: (textbookId) => {
        get().updateTextbook(textbookId, { status: 'archived' });
      },

      incrementCompletedUnit: (textbookId) => {
        set((state) => {
          const next: Record<string, Textbook[]> = {};
          for (const [subId, list] of Object.entries(state.textbooksBySubject)) {
            const idx = list.findIndex((t) => t.id === textbookId);
            if (idx < 0) {
              next[subId] = list;
              continue;
            }
            const t = list[idx]!;
            const count = Math.min(
              t.completedUnitCount + 1,
              t.totalUnits
            );
            const newList = [...list];
            newList[idx] = { ...t, completedUnitCount: count };
            next[subId] = newList;
          }
          return { textbooksBySubject: next };
        });
      },

      setCompletedUnitCount: (textbookId, count) => {
        set((state) => {
          const next: Record<string, Textbook[]> = {};
          for (const [subId, list] of Object.entries(state.textbooksBySubject)) {
            const idx = list.findIndex((t) => t.id === textbookId);
            if (idx < 0) {
              next[subId] = list;
              continue;
            }
            const t = list[idx]!;
            const newList = [...list];
            newList[idx] = {
              ...t,
              completedUnitCount: Math.max(0, Math.min(count, t.totalUnits)),
            };
            next[subId] = newList;
          }
          return { textbooksBySubject: next };
        });
      },

      createFromPreset: (subjectId, preset, overrides) => {
        return {
          name: preset.name,
          subjectId,
          totalUnits: preset.totalUnits,
          unitLabel: preset.unitLabel,
          customUnitLabel: preset.customUnitLabel,
          minutesPerUnit: preset.minutesPerUnit,
          category: preset.category,
          subCategory: overrides?.subCategory,
          status: 'active',
          priority: 1,
          memo: undefined,
          completedUnitCount: 0,
          ...overrides,
        };
      },

      resetAll: () => set({ textbooksBySubject: {} }),

      migrateFromLegacyTextbooks: (subjectId, names) => {
        if (names.length === 0) return;
        const existing = get().textbooksBySubject[subjectId] ?? [];
        if (existing.length > 0) return; // 既に教材がある場合はスキップ
        const now = new Date().toISOString();
        const textbooks: Textbook[] = names.map((name, i) => ({
          id: genId(),
          name,
          subjectId,
          totalUnits: 10,
          unitLabel: 'chapter',
          minutesPerUnit: 25,
          category: 'other',
          status: 'active',
          priority: i + 1,
          completedUnitCount: 0,
          createdAt: now,
        }));
        set((state) => ({
          textbooksBySubject: {
            ...state.textbooksBySubject,
            [subjectId]: textbooks,
          },
        }));
      },
    }),
    { name: 'eisei-curriculum-storage' }
  )
);

export { unitLabelToDisplay };
