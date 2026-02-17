import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StudentProfile, EventDate } from '../types';

interface StudentState {
  profile: StudentProfile | null;
  events: EventDate[];
  isInitialized: boolean;
  setProfile: (profile: StudentProfile) => void;
  updateProfile: (partial: Partial<StudentProfile>) => void;
  addEvent: (event: EventDate) => void;
  removeEvent: (id: string) => void;
  updateEvent: (id: string, event: Partial<EventDate>) => void;
  resetAll: () => void;
}

const initialState = {
  profile: null as StudentProfile | null,
  events: [] as EventDate[],
  isInitialized: false,
};

export const useStudentStore = create<StudentState>()(
  persist(
    (set) => ({
      ...initialState,

      setProfile: (profile) =>
        set({ profile, isInitialized: true }),

      updateProfile: (partial) =>
        set((state) =>
          state.profile
            ? { profile: { ...state.profile, ...partial } }
            : state
        ),

      addEvent: (event) =>
        set((state) => ({ events: [...state.events, event] })),

      removeEvent: (id) =>
        set((state) => ({
          events: state.events.filter((e) => e.id !== id),
        })),

      updateEvent: (id, event) =>
        set((state) => ({
          events: state.events.map((e) =>
            e.id === id ? { ...e, ...event } : e
          ),
        })),

      resetAll: () => set(initialState),
    }),
    { name: 'eisei-student-storage' }
  )
);
