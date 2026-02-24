/**
 * 学習フィードバック・振り返りメモ用ストア
 * 息子が記入した内容を保護者が把握できるようにする
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FeedbackEntry {
  date: string; // yyyy-MM-dd
  text: string;
  createdAt: string; // ISO
}

interface FeedbackState {
  entries: FeedbackEntry[];

  /** 指定日のフィードバックを追加・更新 */
  setFeedback: (date: string, text: string) => void;

  /** 指定日のフィードバックを取得 */
  getFeedbackForDate: (date: string) => string;

  /** 指定日以降のフィードバック一覧を取得（日付の新しい順） */
  getFeedbackSince: (date: string) => FeedbackEntry[];

  /** 全削除（リセット時用） */
  clearAll: () => void;
}

export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set, get) => ({
      entries: [],

      setFeedback: (date, text) =>
        set((state) => {
          const filtered = state.entries.filter((e) => e.date !== date);
          const entries =
            text.trim() === ''
              ? filtered
              : [
                  ...filtered,
                  { date, text: text.trim(), createdAt: new Date().toISOString() },
                ];
          return { entries };
        }),

      getFeedbackForDate: (date) => {
        const entry = get().entries.find((e) => e.date === date);
        return entry?.text ?? '';
      },

      getFeedbackSince: (date) =>
        get()
          .entries.filter((e) => e.date >= date)
          .sort((a, b) => b.date.localeCompare(a.date)),

      clearAll: () => set({ entries: [] }),
    }),
    { name: 'eisei-feedback-storage' }
  )
);
