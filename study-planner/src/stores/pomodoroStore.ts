import { create } from 'zustand';
import type { StudyTask } from '../types';
import type { PomodoroType } from '../types';
import { getPomodoroConfig } from '../constants/pomodoroConfig';

interface PomodoroState {
  isRunning: boolean;
  currentTask: StudyTask | null;
  remainingSeconds: number;
  currentSet: number;
  isBreak: boolean;
  pomodoroType: PomodoroType;
  startPomodoro: (task: StudyTask) => void;
  pausePomodoro: () => void;
  resumePomodoro: () => void;
  skipBreak: () => void;
  completePomodoro: () => void;
  tick: () => void;
  reset: () => void;
}

const initialState = {
  isRunning: false,
  currentTask: null as StudyTask | null,
  remainingSeconds: 0,
  currentSet: 1,
  isBreak: false,
  pomodoroType: 'thinking' as PomodoroType,
};

export const usePomodoroStore = create<PomodoroState>()((set) => ({
  ...initialState,

  startPomodoro: (task) => {
    const config = getPomodoroConfig(task.pomodoroType);
    const workMinutes =
      task.pomodoroType === 'exam_practice' && task.estimatedMinutes
        ? task.estimatedMinutes
        : config.workMinutes;
    set({
      currentTask: task,
      isRunning: true,
      remainingSeconds: workMinutes * 60,
      currentSet: 1,
      isBreak: false,
      pomodoroType: task.pomodoroType,
    });
  },

  pausePomodoro: () => set({ isRunning: false }),

  resumePomodoro: () => set({ isRunning: true }),

  skipBreak: () =>
    set((state) => {
      const config = getPomodoroConfig(state.pomodoroType);
      const workMinutes =
        state.currentTask?.pomodoroType === 'exam_practice' &&
        state.currentTask?.estimatedMinutes
          ? state.currentTask.estimatedMinutes
          : config.workMinutes;
      return {
        isBreak: false,
        isRunning: true,
        remainingSeconds: workMinutes * 60,
      };
    }),

  completePomodoro: () => set(initialState),

  tick: () =>
    set((state) => {
      if (!state.isRunning) return state;
      const next = state.remainingSeconds - 1;
      if (next <= 0) {
        return {
          ...state,
          remainingSeconds: 0,
          isRunning: false,
          isBreak: !state.isBreak,
        };
      }
      return { ...state, remainingSeconds: next };
    }),

  reset: () => set(initialState),
}));
