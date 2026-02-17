import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  StudentProfile,
  EventDate,
  SelectedSubject,
  ScoreRecord,
  MockExamSchedule,
  MockExamResult,
} from '../types';

interface StudentState {
  profile: StudentProfile | null;
  events: EventDate[];
  scoreRecords: ScoreRecord[];
  mockExamSchedule: MockExamSchedule | null;
  mockExamResults: MockExamResult[];
  isInitialized: boolean;
  setProfile: (profile: StudentProfile) => void;
  updateProfile: (partial: Partial<StudentProfile>) => void;
  updateSubject: (subjectId: string, partial: Partial<SelectedSubject>) => void;
  addEvent: (event: EventDate) => void;
  removeEvent: (id: string) => void;
  updateEvent: (id: string, event: Partial<EventDate>) => void;
  addScoreRecord: (record: ScoreRecord) => void;
  setMockExamSchedule: (schedule: MockExamSchedule | null) => void;
  addMockExamResult: (result: Omit<MockExamResult, 'id'>) => void;
  resetAll: () => void;
}

const initialState = {
  profile: null as StudentProfile | null,
  events: [] as EventDate[],
  scoreRecords: [] as ScoreRecord[],
  mockExamSchedule: null as MockExamSchedule | null,
  mockExamResults: [] as MockExamResult[],
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

      updateSubject: (subjectId, partial) =>
        set((state) => {
          if (!state.profile) return state;
          const subjects = state.profile.subjects.map((s) =>
            s.subjectId === subjectId ? { ...s, ...partial } : s
          );
          return { profile: { ...state.profile, subjects } };
        }),

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

      addScoreRecord: (record) =>
        set((state) => ({
          scoreRecords: [...state.scoreRecords, record].sort(
            (a, b) => a.date.localeCompare(b.date)
          ),
        })),

      setMockExamSchedule: (schedule) =>
        set({ mockExamSchedule: schedule }),

      addMockExamResult: (result) =>
        set((state) => ({
          mockExamResults: [
            ...state.mockExamResults,
            { ...result, id: `mock-${Date.now()}` },
          ].sort(
            (a, b) =>
              new Date(b.completedAt).getTime() -
              new Date(a.completedAt).getTime()
          ),
        })),

      resetAll: () => set(initialState),
    }),
    { name: 'eisei-student-storage' }
  )
);
