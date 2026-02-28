/**
 * パスワード認証ストア
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h = h & h;
  }
  return h.toString(36);
}

interface AuthState {
  passwordHash: string | null;
  isUnlocked: boolean;
  setPassword: (password: string) => void;
  verifyPassword: (password: string) => boolean;
  unlock: (password: string) => boolean;
  lock: () => void;
  hasPassword: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      passwordHash: null,
      isUnlocked: false,

      setPassword: (password) =>
        set({
          passwordHash: simpleHash(password),
          isUnlocked: true,
        }),

      verifyPassword: (password) =>
        get().passwordHash === simpleHash(password),

      unlock: (password) => {
        const ok = get().passwordHash === simpleHash(password);
        if (ok) set({ isUnlocked: true });
        return ok;
      },

      lock: () => set({ isUnlocked: false }),

      hasPassword: () => get().passwordHash != null,
    }),
    {
      name: 'eisei-auth-storage',
      partialize: (state) => ({ passwordHash: state.passwordHash }),
    }
  )
);
