import { getDay, addDays, format, parseISO, differenceInDays } from 'date-fns';
import { ja } from 'date-fns/locale';

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
