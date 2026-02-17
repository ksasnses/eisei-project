import {
  getDay,
  addDays,
  format,
  parseISO,
  differenceInDays,
  startOfWeek,
  addWeeks,
  subWeeks,
  isSameDay,
} from 'date-fns';
import { ja } from 'date-fns/locale';

/** 週の開始日（月曜）を返す */
export function getWeekStart(date: Date, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1): Date {
  return startOfWeek(date, { weekStartsOn });
}

/** 週の開始日から7日分の日付配列 */
export function getWeekDates(weekStart: Date): Date[] {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekStart, i));
}

export { addWeeks, subWeeks, isSameDay };

/** 次の共通テスト本番日（次の1月第3土曜日）を返す */
export function getDefaultExamDate(): Date {
  const now = new Date();
  const year =
    now.getMonth() === 0 ? now.getFullYear() : now.getFullYear() + 1;
  let d = new Date(year, 0, 1);
  let saturdays = 0;
  while (saturdays < 3) {
    if (getDay(d) === 6) saturdays++;
    if (saturdays === 3) break;
    d = addDays(d, 1);
  }
  return d;
}

export function formatTimeForInput(date: Date): string {
  return format(date, 'HH:mm');
}

export function formatDateForInput(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** 分を "HH:mm" に変換 */
export function minutesToTimeStr(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 試験日までの残り日数 */
export function daysUntilExam(examDateStr: string): number {
  const exam = typeof examDateStr === 'string' ? parseISO(examDateStr) : examDateStr;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const examStart = new Date(exam);
  examStart.setHours(0, 0, 0, 0);
  return differenceInDays(examStart, today);
}

export { format, parseISO, differenceInDays };
export { ja };
