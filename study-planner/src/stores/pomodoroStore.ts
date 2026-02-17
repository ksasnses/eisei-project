import { create } from 'zustand';
import type { StudyTask } from '../types';
import type { PomodoroType } from '../types';
import { getPomodoroConfig } from '../constants/pomodoroConfig';
import { useStudyStore } from './studyStore';

interface PomodoroState {
  isRunning: boolean;
  currentTask: StudyTask | null;
  remainingSeconds: number;
  totalSeconds: number;
  startedAt: number | null;
  currentSet: number;
  isBreak: boolean;
  pomodoroType: PomodoroType;
  isCompleted: boolean;
  completedAt: string | null;
  startPomodoro: (task: StudyTask) => void;
  pausePomodoro: () => void;
  resumePomodoro: () => void;
  skipBreak: () => void;
  completePomodoro: () => void;
  abortPomodoro: () => void;
  tick: () => void;
  reset: () => void;
  getEffectiveRemaining: () => number;
}

const initialState = {
  isRunning: false,
  currentTask: null as StudyTask | null,
  remainingSeconds: 0,
  totalSeconds: 0,
  startedAt: null as number | null,
  currentSet: 1,
  isBreak: false,
  pomodoroType: 'thinking' as PomodoroType,
  isCompleted: false,
  completedAt: null as string | null,
};

function getWorkSeconds(task: StudyTask): number {
  const config = getPomodoroConfig(task.pomodoroType);
  const workMin =
    task.pomodoroType === 'exam_practice' && task.estimatedMinutes
      ? task.estimatedMinutes
      : config.workMinutes;
  return workMin * 60;
}

function getBreakSeconds(pomodoroType: PomodoroType): number {
  const config = getPomodoroConfig(pomodoroType);
  return config.breakMinutes * 60;
}

export const usePomodoroStore = create<PomodoroState>()((set, get) => ({
  ...initialState,

  startPomodoro: (task) => {
    const workSec = getWorkSeconds(task);
    set({
      currentTask: task,
      isRunning: true,
      remainingSeconds: workSec,
      totalSeconds: workSec,
      startedAt: Date.now(),
      currentSet: 1,
      isBreak: false,
      pomodoroType: task.pomodoroType,
      isCompleted: false,
      completedAt: null,
    });
  },

  pausePomodoro: () => {
    const state = get();
    const remaining =
      state.startedAt && state.isRunning
        ? Math.max(
            0,
            state.totalSeconds -
              Math.floor((Date.now() - state.startedAt) / 1000)
          )
        : state.remainingSeconds;
    set({ isRunning: false, remainingSeconds: remaining, startedAt: null });
  },

  resumePomodoro: () => {
    const state = get();
    set({
      isRunning: true,
      totalSeconds: state.remainingSeconds,
      startedAt: Date.now(),
    });
  },

  skipBreak: () => {
    const state = get();
    const task = state.currentTask;
    if (!task) return;
    const workSec = getWorkSeconds(task);
    set({
      isBreak: false,
      isRunning: true,
      remainingSeconds: workSec,
      totalSeconds: workSec,
      startedAt: Date.now(),
    });
  },

  completePomodoro: () => {
    const state = get();
    if (!state.isCompleted && state.currentTask) {
      useStudyStore.getState().incrementPomodoros(state.currentTask.pomodoroCount);
      useStudyStore.getState().completeTask(
        state.currentTask.id,
        state.currentTask.estimatedMinutes
      );
    }
    set({ ...initialState });
  },

  abortPomodoro: () => set(initialState),

  getEffectiveRemaining: () => {
    const state = get();
    if (!state.isRunning || state.startedAt == null)
      return state.remainingSeconds;
    const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
    return Math.max(0, state.totalSeconds - elapsed);
  },

  tick: () => {
    const state = get();
    const remaining = state.getEffectiveRemaining();

    if (!state.isRunning && state.startedAt == null) return;

    set({ remainingSeconds: remaining });

    if (remaining > 0) return;

    const task = state.currentTask;
    if (!task) return;

    if (state.isBreak) {
      const nextSet = state.currentSet + 1;
      if (nextSet > task.pomodoroCount) {
        useStudyStore.getState().incrementPomodoros(task.pomodoroCount);
        useStudyStore.getState().completeTask(task.id, task.estimatedMinutes);
        set({
          ...initialState,
          isCompleted: true,
          completedAt: new Date().toISOString(),
          currentTask: task,
        });
      } else {
        const workSec = getWorkSeconds(task);
        set({
          currentSet: nextSet,
          isBreak: false,
          isRunning: true,
          remainingSeconds: workSec,
          totalSeconds: workSec,
          startedAt: Date.now(),
        });
      }
    } else {
      useStudyStore.getState().incrementPomodoros(1);
      const breakSec = getBreakSeconds(state.pomodoroType);
      set({
        isBreak: true,
        isRunning: true,
        remainingSeconds: breakSec,
        totalSeconds: breakSec,
        startedAt: Date.now(),
      });
    }
  },

  reset: () => set(initialState),
}));
