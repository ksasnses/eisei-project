/**
 * スケジュールから1日の勉強可能時間（分）を計算
 * WizardPage の計算と同一ロジックで、ホーム・学習計画と一致させる
 */

import { parseISO, getDay } from 'date-fns';
import type { StudentProfile, EventDate, DailySchedule } from '../types';
import { parseTimeToMinutes } from './dateUtils';

/** 生活スケジュール・部活スケジュールから算出した「1日の勉強可能時間」の内訳（分） */
export interface StudyMinutesSummary {
  /** 部活のない日（平日：学校あり） */
  noClubWeekday: number;
  /** 部活のない日（土日・休日：学校なし） */
  noClubWeekend: number;
  /** 部活のある日（平日） */
  withClubWeekday: number;
  /** 部活のある日（土日・休日） */
  withClubWeekend: number;
  /** 夏休み中・部活あり日（学校・通学なし、部活のみ引く） */
  summerClub: number;
  /** 夏休み中・部活なし日（学校・通学なし） */
  summerNoClub: number;
}

/**
 * 指定日が夏休み期間内かどうか
 */
export function isSummerVacation(schedule: DailySchedule, dateStr: string): boolean {
  const start = schedule.summerVacationStart?.trim() ?? '';
  const end = schedule.summerVacationEnd?.trim() ?? '';
  if (!start || !end) return false;
  return dateStr >= start && dateStr <= end;
}

/**
 * 設定画面表示用。生活スケジュールと部活スケジュールから
 * 部活の有無・平日/土日別の1日勉強可能時間（分）を計算する。
 */
export function getStudyMinutesSummary(schedule: DailySchedule): StudyMinutesSummary {
  const wake = parseTimeToMinutes(schedule.wakeUpTime);
  const bed = parseTimeToMinutes(schedule.bedTime);
  const schoolStart = parseTimeToMinutes(schedule.schoolStart);
  const schoolEnd = parseTimeToMinutes(schedule.schoolEnd);

  let weekdayMinutes =
    (bed < wake ? 24 * 60 : 0) + bed - wake;
  weekdayMinutes -= schedule.commuteMinutesOneWay * 2;
  weekdayMinutes -=
    (schoolEnd < schoolStart ? 24 * 60 : 0) + schoolEnd - schoolStart;
  weekdayMinutes -= schedule.mealAndBathMinutes;
  weekdayMinutes -= schedule.freeTimeBufferMinutes;
  const noClubWeekday = Math.max(0, weekdayMinutes);

  let weekendMinutes = (bed < wake ? 24 * 60 : 0) + bed - wake;
  weekendMinutes -= schedule.mealAndBathMinutes;
  weekendMinutes -= schedule.freeTimeBufferMinutes;
  const noClubWeekend = Math.max(0, weekendMinutes);

  const clubStart = parseTimeToMinutes(schedule.clubStartTime);
  const clubEnd = parseTimeToMinutes(schedule.clubEndTime);
  const clubMinutesWeekday =
    (clubEnd < clubStart ? 24 * 60 : 0) + clubEnd - clubStart;
  const withClubWeekday = Math.max(0, noClubWeekday - clubMinutesWeekday);

  const start = schedule.clubWeekendStart ?? schedule.clubStartTime;
  const end = schedule.clubWeekendEnd ?? schedule.clubEndTime;
  const clubStartW = parseTimeToMinutes(start);
  const clubEndW = parseTimeToMinutes(end);
  const clubMinutesWeekend =
    (clubEndW < clubStartW ? 24 * 60 : 0) + clubEndW - clubStartW;
  const withClubWeekend = Math.max(0, noClubWeekend - clubMinutesWeekend);

  // 夏休み：学校・通学なし（土日と同じベース）、部活ありなら部活時間を引く
  const summerBase = noClubWeekend;
  const summerNoClub = summerBase;
  const summerClub = Math.max(0, summerBase - clubMinutesWeekend);

  return {
    noClubWeekday,
    noClubWeekend,
    withClubWeekday,
    withClubWeekend,
    summerClub,
    summerNoClub,
  };
}

/**
 * 指定日の「種類」（平日/土日・夏休み・部活有無）に応じた勉強可能時間（分）。
 * 夏休み期間中は学校・通学を引かず、部活がある日のみ部活時間を引く。
 */
export function getAvailableMinutesForDate(
  schedule: DailySchedule,
  targetDate: string
): number {
  const summary = getStudyMinutesSummary(schedule);
  const dayOfWeek = getDay(parseISO(targetDate));
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const clubDay = schedule.clubDays.includes(dayOfWeek);

  if (isSummerVacation(schedule, targetDate)) {
    return clubDay ? summary.summerClub : summary.summerNoClub;
  }
  if (clubDay && isWeekend) return summary.withClubWeekend;
  if (clubDay) return summary.withClubWeekday;
  if (isWeekend) return summary.noClubWeekend;
  return summary.noClubWeekday;
}

function isDateInRange(dateStr: string, event: EventDate): boolean {
  const d = parseISO(dateStr);
  d.setHours(0, 0, 0, 0);
  const start = parseISO(event.date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + event.durationDays);
  end.setHours(0, 0, 0, 0);
  return d >= start && d <= end;
}

/**
 * 指定日の勉強可能時間（分）をスケジュールから計算する。
 * 試合日・イベント日は短くする。勉強開始日前は 0。
 */
export function getAvailableMinutesFromSchedule(
  profile: StudentProfile,
  events: EventDate[],
  targetDate: string
): number {
  const studyStart = profile.studyStartDate
    ? profile.studyStartDate.slice(0, 10)
    : null;
  if (studyStart && targetDate < studyStart) return 0;

  const s = profile.dailySchedule;
  const isMatchDay = events.some(
    (e) => e.type === 'tennis_match' && isDateInRange(targetDate, e)
  );
  const isEventDay = events.some(
    (e) => e.type !== 'tennis_match' && isDateInRange(targetDate, e)
  );

  const baseForDate = getAvailableMinutesForDate(s, targetDate);
  if (isMatchDay) return Math.min(60, Math.floor(baseForDate * 0.25));
  if (isEventDay) return Math.min(30, Math.floor(baseForDate * 0.15));
  return baseForDate;
}
