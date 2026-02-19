import { format } from 'date-fns';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DailyPlan, StudyTask } from '../types';
import { useStudentStore } from './studentStore';
import { generateDailyPlan as generateDailyPlanEngine } from '../utils/scheduleEngine';

interface StudyState {
  dailyPlans: Record<string, DailyPlan>;
  completedTasks: StudyTask[];
  reviewQueue: StudyTask[];
  streakDays: number;
  totalPomodoros: number;
  setDailyPlan: (date: string, plan: DailyPlan) => void;
  completeTask: (taskId: string, actualMinutes: number) => void;
  skipTask: (taskId: string) => void;
  addReviewTask: (task: StudyTask) => void;
  incrementStreak: () => void;
  resetStreak: () => void;
  incrementPomodoros: (count: number) => void;
  generateDailyPlan: (date: string) => DailyPlan;
  /** 設定変更時: 未来をクリア、今日を再生成、過去は保持 */
  invalidatePlansOnRuleConfigChange: () => void;
  resetAll: () => void;
}

function emptyPlan(date: string): DailyPlan {
  return {
    date,
    phase: '基礎期',
    isClubDay: false,
    isMatchDay: false,
    isEventDay: false,
    availableMinutes: 0,
    tasks: [],
    completionRate: 0,
  };
}

const initialState = {
  dailyPlans: {} as Record<string, DailyPlan>,
  completedTasks: [] as StudyTask[],
  reviewQueue: [] as StudyTask[],
  streakDays: 0,
  totalPomodoros: 0,
};

export const useStudyStore = create<StudyState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setDailyPlan: (date, plan) =>
        set((state) => ({
          dailyPlans: { ...state.dailyPlans, [date]: plan },
        })),

      completeTask: (taskId, actualMinutes) =>
        set((state) => {
          const plans = { ...state.dailyPlans };
          let completedTask: StudyTask | null = null;
          const now = new Date().toISOString();

          for (const key of Object.keys(plans)) {
            const plan = plans[key];
            const taskIndex = plan.tasks.findIndex((t) => t.id === taskId);
            if (taskIndex >= 0) {
              const task = plan.tasks[taskIndex];
              completedTask = {
                ...task,
                completed: true,
                actualMinutes,
                completedAt: now,
              };
              plans[key] = {
                ...plan,
                tasks: plan.tasks.map((t) =>
                  t.id === taskId ? completedTask! : t
                ),
              };
              break;
            }
          }

          const completedTasks = completedTask
            ? [...state.completedTasks, completedTask]
            : state.completedTasks;

          const reviewQueue = state.reviewQueue.filter((t) => t.id !== taskId);

          return {
            dailyPlans: plans,
            completedTasks,
            reviewQueue,
          };
        }),

      skipTask: (taskId) =>
        set((state) => {
          const plans = { ...state.dailyPlans };
          for (const key of Object.keys(plans)) {
            const plan = plans[key];
            if (plan.tasks.some((t) => t.id === taskId)) {
              plans[key] = {
                ...plan,
                tasks: plan.tasks.filter((t) => t.id !== taskId),
              };
              break;
            }
          }
          return { dailyPlans: plans };
        }),

      addReviewTask: (task) =>
        set((state) => ({
          reviewQueue: [...state.reviewQueue, task],
        })),

      incrementStreak: () =>
        set((state) => ({ streakDays: state.streakDays + 1 })),

      resetStreak: () => set({ streakDays: 0 }),

      incrementPomodoros: (count) =>
        set((state) => ({ totalPomodoros: state.totalPomodoros + count })),

      generateDailyPlan: (date) => {
        const profile = useStudentStore.getState().profile;
        const events = useStudentStore.getState().events;
        const completedTasks = get().completedTasks;
        if (!profile) {
          const plan = emptyPlan(date);
          get().setDailyPlan(date, plan);
          return plan;
        }
        const plan = generateDailyPlanEngine(
          profile,
          events,
          completedTasks,
          date
        );
        get().setDailyPlan(date, plan);
        return plan;
      },

      invalidatePlansOnRuleConfigChange: () => {
        const today = format(new Date(), 'yyyy-MM-dd');
        set((state) => {
          const plans = { ...state.dailyPlans };
          for (const key of Object.keys(plans)) {
            if (key > today) delete plans[key];
          }
          return { dailyPlans: plans };
        });
        const profile = useStudentStore.getState().profile;
        if (profile) {
          get().generateDailyPlan(today);
        }
      },

      resetAll: () => set(initialState),
    }),
    { name: 'eisei-study-storage' }
  )
);
