/**
 * 予定の学習内容（ユーザー編集分）を保存するストア
 * 科目×月ごとのカスタム学習項目を保持
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** subjectId -> monthKey(yyyy-MM) -> topics[] */
export type PlannedTopicsMap = Record<string, Record<string, string[]>>;

interface PlannedTopicsState {
  /** ユーザーが編集した予定の学習内容 */
  customTopics: PlannedTopicsMap;

  /** 指定セル（科目×月）の学習項目を設定 */
  setTopics: (subjectId: string, monthKey: string, topics: string[]) => void;

  /** 指定セル（科目×月）の学習項目を取得（未設定なら undefined） */
  getTopics: (subjectId: string, monthKey: string) => string[] | undefined;

  /** 指定セルを削除して算出値に戻す */
  clearCell: (subjectId: string, monthKey: string) => void;

  /** 全セルをクリア */
  clearAll: () => void;
}

export const usePlannedTopicsStore = create<PlannedTopicsState>()(
  persist(
    (set, get) => ({
      customTopics: {},

      setTopics: (subjectId, monthKey, topics) =>
        set((state) => {
          const bySubject = { ...state.customTopics };
          if (!bySubject[subjectId]) bySubject[subjectId] = {};
          const filtered = topics
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
          if (filtered.length === 0) {
            const byMonth = { ...bySubject[subjectId] };
            delete byMonth[monthKey];
            if (Object.keys(byMonth).length === 0) {
              delete bySubject[subjectId];
            } else {
              bySubject[subjectId] = byMonth;
            }
          } else {
            bySubject[subjectId] = { ...bySubject[subjectId], [monthKey]: filtered };
          }
          return { customTopics: bySubject };
        }),

      getTopics: (subjectId, monthKey) => {
        const bySubject = get().customTopics[subjectId];
        return bySubject?.[monthKey];
      },

      clearCell: (subjectId, monthKey) =>
        set((state) => {
          const bySubject = { ...state.customTopics };
          const byMonth = bySubject[subjectId];
          if (!byMonth) return state;
          const next = { ...byMonth };
          delete next[monthKey];
          if (Object.keys(next).length === 0) {
            delete bySubject[subjectId];
          } else {
            bySubject[subjectId] = next;
          }
          return { customTopics: bySubject };
        }),

      clearAll: () => set({ customTopics: {} }),
    }),
    { name: 'eisei-planned-topics-storage' }
  )
);
