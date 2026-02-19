import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { EXAM_TEMPLATES, getExamTemplateById } from '../constants/examTemplates';
import {
  SUBJECTS,
  getSubjectById,
  getSubjectsByCategory,
} from '../constants/subjects';
import type { Subject } from '../types';
import type {
  StudentProfile,
  DailySchedule,
  SelectedSubject,
} from '../types';
import { useStudentStore } from '../stores/studentStore';
import { useRuleConfigStore } from '../stores/ruleConfigStore';
import { useStudyStore } from '../stores/studyStore';
import {
  getDefaultExamDate,
  formatDateForInput,
  parseTimeToMinutes,
  daysUntilExam,
} from '../utils/dateUtils';

const TOTAL_STEPS = 7;

type SubjectDetail = {
  currentScore: number;
  targetScore: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  textbooks: string[];
};

const defaultSchedule: DailySchedule = {
  wakeUpTime: '06:30',
  bedTime: '23:30',
  schoolStart: '08:30',
  schoolEnd: '15:30',
  commuteMinutesOneWay: 30,
  mealAndBathMinutes: 90,
  clubDays: [],
  clubStartTime: '15:30',
  clubEndTime: '18:00',
  clubWeekendStart: '09:00',
  clubWeekendEnd: '12:00',
  freeTimeBufferMinutes: 30,
  summerVacationStart: '',
  summerVacationEnd: '',
};

const TIME_OPTIONS = (() => {
  const opts: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return opts;
})();

export function WizardPage() {
  const navigate = useNavigate();
  const setProfile = useStudentStore((s) => s.setProfile);
  const syncTemplatesBySelectedSubjects = useRuleConfigStore((s) => s.syncTemplatesBySelectedSubjects);
  const invalidatePlansOnRuleConfigChange = useStudyStore((s) => s.invalidatePlansOnRuleConfigChange);

  const [step, setStep] = useState(1);
  const [examTypeId, setExamTypeId] = useState<string>('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [subjectDetails, setSubjectDetails] = useState<
    Record<string, SubjectDetail>
  >({});
  const [schedule, setSchedule] = useState<DailySchedule>(defaultSchedule);
  const [examDate, setExamDate] = useState<string>(() =>
    formatDateForInput(getDefaultExamDate())
  );
  const [studyStartDate, setStudyStartDate] = useState<string>(() =>
    formatDateForInput(new Date())
  );
  const [name, setName] = useState('');

  const template = examTypeId ? getExamTemplateById(examTypeId) : null;

  const availableSubjectsForStep2 = useMemo(() => {
    if (!template) return { required: [], selectGroups: [] };
    const required = template.requiredSubjects;
    const selectGroups = template.selectGroups.map((sg) => {
      if (sg.from === '全科目') {
        const optionalIds = SUBJECTS.filter((s) => !required.includes(s.id)).map(
          (s) => s.id
        );
        return { from: sg.from, count: sg.count, subjectIds: optionalIds };
      }
      if (sg.subjectIds && sg.subjectIds.length > 0) {
        return {
          from: sg.from,
          count: sg.count,
          subjectIds: sg.subjectIds,
          recommended: sg.recommended,
        };
      }
      const subjects = getSubjectsByCategory(
        sg.from as Subject['category']
      );
      return {
        from: sg.from,
        count: sg.count,
        subjectIds: subjects.map((s) => s.id),
        recommended: sg.recommended,
      };
    });
    return { required, selectGroups };
  }, [template]);

  const selectedSubjects = useMemo(
    () =>
      selectedSubjectIds
        .map((id) => getSubjectById(id))
        .filter((s): s is Subject => s != null),
    [selectedSubjectIds]
  );

  const totalScore = useMemo(
    () => selectedSubjects.reduce((sum, s) => sum + s.score, 0),
    [selectedSubjects]
  );

  const hasGeoHisCivWarning = selectedSubjectIds.includes('geo_his_civ');

  const canGoNext = () => {
    if (step === 1) return !!examTypeId;
    if (step === 2)
      return (
        selectedSubjectIds.length > 0 &&
        (() => {
          const { selectGroups } = availableSubjectsForStep2;
          for (const sg of selectGroups) {
            const selectedInGroup = selectedSubjectIds.filter((id) =>
              sg.subjectIds.includes(id)
            );
            const need = sg.count;
            if (sg.from === '全科目') {
              if (selectedInGroup.length < 2 || selectedInGroup.length > 3)
                return false;
            } else if (selectedInGroup.length !== need) return false;
          }
          return true;
        })()
      );
    if (step === 3) return selectedSubjectIds.length > 0;
    if (step === 4 || step === 5 || step === 6) return true;
    if (step === 7) return true;
    return false;
  };

  const studyMinutesWithoutClub = useMemo(() => {
    const wake = parseTimeToMinutes(schedule.wakeUpTime);
    const bed = parseTimeToMinutes(schedule.bedTime);
    const schoolStart = parseTimeToMinutes(schedule.schoolStart);
    const schoolEnd = parseTimeToMinutes(schedule.schoolEnd);
    let dayMinutes = (bed < wake ? 24 * 60 : 0) + bed - wake;
    dayMinutes -= schedule.commuteMinutesOneWay * 2;
    dayMinutes -=
      (schoolEnd < schoolStart ? 24 * 60 : 0) + schoolEnd - schoolStart;
    dayMinutes -= schedule.mealAndBathMinutes;
    dayMinutes -= schedule.freeTimeBufferMinutes;
    return Math.max(0, dayMinutes);
  }, [schedule]);

  const studyMinutesWithClubWeekday = useMemo(() => {
    const clubStart = parseTimeToMinutes(schedule.clubStartTime);
    const clubEnd = parseTimeToMinutes(schedule.clubEndTime);
    const clubMinutes = (clubEnd < clubStart ? 24 * 60 : 0) + clubEnd - clubStart;
    return Math.max(0, studyMinutesWithoutClub - clubMinutes);
  }, [schedule, studyMinutesWithoutClub]);

  const studyMinutesWithClubWeekend = useMemo(() => {
    // 土日・休日は「学校がない」前提で再計算（学校滞在時間は引かない）
    const wake = parseTimeToMinutes(schedule.wakeUpTime);
    const bed = parseTimeToMinutes(schedule.bedTime);
    let dayMinutes = (bed < wake ? 24 * 60 : 0) + bed - wake;
    // 休日は通学・授業時間を除外し、生活時間だけ差し引く
    dayMinutes -= schedule.mealAndBathMinutes;
    dayMinutes -= schedule.freeTimeBufferMinutes;

    const start = schedule.clubWeekendStart ?? schedule.clubStartTime;
    const end = schedule.clubWeekendEnd ?? schedule.clubEndTime;
    const clubStart = parseTimeToMinutes(start);
    const clubEnd = parseTimeToMinutes(end);
    const clubMinutes = (clubEnd < clubStart ? 24 * 60 : 0) + clubEnd - clubStart;
    return Math.max(0, dayMinutes - clubMinutes);
  }, [schedule]);

  const handleStep2Toggle = (id: string, checked: boolean) => {
    const { required, selectGroups } = availableSubjectsForStep2;
    if (required.includes(id)) return;
    if (checked) {
      if (selectGroups.some((sg) => sg.from === '全科目')) {
        const inOptional = selectedSubjectIds.filter((id) =>
          selectGroups.find((s) => s.subjectIds.includes(id))
        );
        if (inOptional.length >= 3) return;
      }
      setSelectedSubjectIds((prev) => [...prev, id]);
      setSubjectDetails((prev) => ({
        ...prev,
        [id]: {
          ...{
            currentScore: 50,
            targetScore: 70,
            difficulty: 3,
            textbooks: [] as string[],
          },
          ...prev[id],
        },
      }));
    } else {
      setSelectedSubjectIds((prev) => prev.filter((x) => x !== id));
    }
  };

  const handleStep2SelectGroup = (category: string, subjectIds: string[]) => {
    const sg = availableSubjectsForStep2.selectGroups.find(
      (s) => s.from === category
    );
    if (!sg) return;
    const others = selectedSubjectIds.filter(
      (id) => !sg.subjectIds.includes(id)
    );
    const toAdd = subjectIds.slice(0, sg.count);
    setSelectedSubjectIds([...others, ...toAdd]);
    setSubjectDetails((prev) => {
      const next = { ...prev };
      const defaults = {
        currentScore: 50,
        targetScore: 70,
        difficulty: 3,
        textbooks: [] as string[],
      };
      toAdd.forEach((id) => {
        next[id] = { ...defaults, ...prev[id] };
      });
      return next;
    });
  };

  const updateSubjectDetail = (
    subjectId: string,
    patch: Partial<SubjectDetail>
  ) => {
    setSubjectDetails((prev) => ({
      ...prev,
      [subjectId]: { ...prev[subjectId], ...patch } as SubjectDetail,
    }));
  };

  const handleComplete = () => {
    const subjects: SelectedSubject[] = selectedSubjectIds.map((id) => ({
      subjectId: id,
      currentScore: subjectDetails[id]?.currentScore ?? 50,
      targetScore: subjectDetails[id]?.targetScore ?? 70,
      difficulty: subjectDetails[id]?.difficulty ?? 3,
      textbooks: subjectDetails[id]?.textbooks?.filter(Boolean) ?? [],
    }));

    const profile: StudentProfile = {
      name: name.trim() || '受験生',
      examType: examTypeId,
      subjects,
      dailySchedule: schedule,
      examDate: new Date(examDate).toISOString(),
      studyStartDate: new Date(studyStartDate).toISOString().slice(0, 10),
    };
    setProfile(profile);
    syncTemplatesBySelectedSubjects(selectedSubjectIds);
    invalidatePlansOnRuleConfigChange();
    navigate('/', { replace: true });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24">
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
          <span>Step {step}/{TOTAL_STEPS}</span>
          <span>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full ${
                i + 1 <= step ? 'bg-blue-500' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="min-h-[320px]">
        {/* Step 1 */}
        {step === 1 && (
          <div>
            <h2 className="mb-2 text-xl font-semibold text-slate-800">
              志望校タイプを選んでください
            </h2>
            <p className="mb-6 text-sm text-slate-500">
              共通テストの受験パターンに合わせて科目が自動で提案されます
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {EXAM_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setExamTypeId(t.id);
                    const required = t.requiredSubjects;
                    const initialSelected = [...required];
                    if (t.selectGroups.length > 0 && t.selectGroups[0].from !== '全科目') {
                      for (const sg of t.selectGroups) {
                        const toAdd = sg.subjectIds
                          ? sg.subjectIds.slice(0, sg.count)
                          : (() => {
                              const subs = getSubjectsByCategory(
                                sg.from as Subject['category']
                              );
                              const rec = sg.recommended
                                ? subs.filter((s) => sg.recommended!.includes(s.id))
                                : subs;
                              return rec.slice(0, sg.count).map((s) => s.id);
                            })();
                        toAdd.forEach((id) => {
                          if (!initialSelected.includes(id)) initialSelected.push(id);
                        });
                      }
                    }
                    setSelectedSubjectIds(initialSelected);
                    const defaults = {
                      currentScore: 50,
                      targetScore: 70,
                      difficulty: 3,
                      textbooks: [] as string[],
                    };
                    initialSelected.forEach((id) => {
                      setSubjectDetails((prev) => ({
                        ...prev,
                        [id]: { ...defaults, ...prev[id] },
                      }));
                    });
                  }}
                  className={`rounded-xl border-2 p-4 text-left transition ${
                    examTypeId === t.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-blue-200'
                  }`}
                >
                  <div className="font-semibold text-slate-800">{t.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{t.note}</div>
                  <div className="mt-2 text-sm text-blue-600">
                    満点 {t.totalScore}点
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && template && (
          <div>
            <h2 className="mb-2 text-xl font-semibold text-slate-800">
              受験科目を選択
            </h2>
            <p className="mb-6 text-sm text-slate-500">{template.note}</p>

            {template.requiredSubjects.map((id) => {
              const s = getSubjectById(id);
              if (!s) return null;
              return (
                <label
                  key={id}
                  className="flex cursor-default items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <input
                    type="checkbox"
                    checked
                    readOnly
                    className="h-4 w-4 rounded border-slate-300 text-blue-500"
                  />
                  <span className="font-medium text-slate-800">{s.name}</span>
                  <span className="text-xs text-slate-400">
                    {s.score}点 / {s.time}分
                  </span>
                </label>
              );
            })}

            {availableSubjectsForStep2.selectGroups.map((sg) => {
              if (sg.from === '全科目') {
                return (
                  <div key={sg.from} className="mt-4">
                    <p className="mb-2 text-sm font-medium text-slate-600">
                      追加で2〜3科目を選択
                    </p>
                    <div className="space-y-2">
                      {sg.subjectIds.map((id) => {
                        const s = getSubjectById(id);
                        if (!s) return null;
                        const checked = selectedSubjectIds.includes(id);
                        return (
                          <label
                            key={id}
                            className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                handleStep2Toggle(id, e.target.checked)
                              }
                              className="h-4 w-4 rounded border-slate-300 text-blue-500"
                            />
                            <span className="text-slate-800">{s.name}</span>
                            <span className="text-xs text-slate-400">
                              {s.score}点 / {s.time}分
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              const selectedInGroup = selectedSubjectIds.filter((id) =>
                sg.subjectIds.includes(id)
              );
              const isOneOfMany =
                sg.from === '数学' && sg.subjectIds.length >= 2 && sg.count === 1;
              const isSciBase =
                sg.from === '理科基礎' &&
                sg.subjectIds.some((id) =>
                  ['sci_physics_base', 'sci_chemistry_base', 'sci_biology_base', 'sci_earth_base'].includes(id)
                );
              const groupLabel = isOneOfMany
                ? '数学ⅠA と 数学ⅡBC のどちらか1つを選択'
                : isSciBase
                  ? '物理基礎・化学基礎・生物基礎・地学基礎のうち2つを選択'
                  : `${sg.from}から${sg.count}科目を選択`;
              return (
                <div key={sg.from} className="mt-4">
                  <p className="mb-2 text-sm font-medium text-slate-600">
                    {groupLabel}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sg.subjectIds.map((id) => {
                      const s = getSubjectById(id);
                      if (!s) return null;
                      const checked = selectedInGroup.includes(id);
                      if (sg.count === 1) {
                        return (
                          <label
                            key={id}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                              checked
                                ? 'border-blue-500 bg-blue-50 text-blue-800'
                                : 'border-slate-200 hover:border-blue-200'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`step2-${sg.from}`}
                              checked={checked}
                              onChange={() =>
                                handleStep2SelectGroup(sg.from, [id])
                              }
                              className="h-3.5 w-3.5 border-slate-300 text-blue-500"
                            />
                            {s.name}
                            <span className="text-xs text-slate-400">
                              {s.score}点/{s.time}分
                            </span>
                          </label>
                        );
                      }
                      return (
                        <label
                          key={id}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                            checked
                              ? 'border-blue-500 bg-blue-50 text-blue-800'
                              : 'border-slate-200 hover:border-blue-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const next = [...selectedInGroup, id].slice(
                                  -sg.count
                                );
                                handleStep2SelectGroup(sg.from, next);
                              } else {
                                handleStep2SelectGroup(
                                  sg.from,
                                  selectedInGroup.filter((x) => x !== id)
                                );
                              }
                            }}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-500"
                          />
                          {s.name}
                          <span className="text-xs text-slate-400">
                            {s.score}点/{s.time}分
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {hasGeoHisCivWarning && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                ⚠ 地理総合/歴史総合/公共は使えない大学が多いので注意
              </div>
            )}

            <div className="mt-6 rounded-lg bg-slate-100 px-4 py-3 text-center">
              <span className="text-slate-600">選択科目の合計配点</span>
              <div className="text-2xl font-bold text-blue-600">
                {totalScore}
                <span className="text-base font-normal text-slate-500">点</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div>
            <h2 className="mb-2 text-xl font-semibold text-slate-800">
              現在の実力と目標
            </h2>
            <p className="mb-6 text-sm text-slate-500">
              各科目の得点と苦手度を入力してください
            </p>
            <div className="space-y-6">
              {selectedSubjects.map((s) => {
                const d = subjectDetails[s.id] ?? {
                  currentScore: 50,
                  targetScore: 70,
                  difficulty: 3,
                  textbooks: [],
                };
                const gap = d.targetScore - d.currentScore;
                return (
                  <div
                    key={s.id}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="mb-3 font-medium text-slate-800">
                      {s.name}
                      <span className="ml-2 text-xs text-slate-400">
                        {s.score}点満点
                      </span>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-xs text-slate-500">
                          現在の得点 {d.currentScore}
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={d.currentScore}
                          onChange={(e) =>
                            updateSubjectDetail(s.id, {
                              currentScore: Number(e.target.value),
                            })
                          }
                          className="mt-1 h-2 w-full accent-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">
                          目標得点 {d.targetScore}
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={d.targetScore}
                          onChange={(e) =>
                            updateSubjectDetail(s.id, {
                              targetScore: Number(e.target.value),
                            })
                          }
                          className="mt-1 h-2 w-full accent-blue-500"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-slate-500">苦手度</span>
                      {([1, 2, 3, 4, 5] as const).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() =>
                            updateSubjectDetail(s.id, { difficulty: n })
                          }
                          className={`text-lg ${
                            d.difficulty >= n
                              ? 'text-amber-400'
                              : 'text-slate-200'
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <div className="mt-3">
                      <label className="text-xs text-slate-500">
                        使用教材（任意）
                      </label>
                      <input
                        type="text"
                        value={d.textbooks.join(', ')}
                        onChange={(e) =>
                          updateSubjectDetail(s.id, {
                            textbooks: e.target.value
                              .split(',')
                              .map((t) => t.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="例：ターゲット1900、チャート式"
                        className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="w-20 shrink-0 text-xs text-slate-500">
                        {d.currentScore} → {d.targetScore}
                      </span>
                      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="absolute left-0 top-0 h-full rounded-full bg-slate-300"
                          style={{ width: `${d.currentScore}%` }}
                        />
                        <div
                          className={`absolute top-0 h-full rounded-full ${
                            gap > 30
                              ? 'bg-red-400'
                              : gap > 15
                                ? 'bg-amber-400'
                                : 'bg-green-500'
                          }`}
                          style={{
                            left: `${d.currentScore}%`,
                            width: `${Math.min(100 - d.currentScore, gap)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div>
            <h2 className="mb-2 text-xl font-semibold text-slate-800">
              1日の生活スケジュール
            </h2>
            <p className="mb-6 text-sm text-slate-500">
              勉強可能時間を自動計算します
            </p>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-600">起床時間</label>
                  <select
                    value={schedule.wakeUpTime}
                    onChange={(e) =>
                      setSchedule((s) => ({ ...s, wakeUpTime: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-600">就寝時間</label>
                  <select
                    value={schedule.bedTime}
                    onChange={(e) =>
                      setSchedule((s) => ({ ...s, bedTime: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-600">学校 始業</label>
                  <select
                    value={schedule.schoolStart}
                    onChange={(e) =>
                      setSchedule((s) => ({
                        ...s,
                        schoolStart: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-600">学校 終業</label>
                  <select
                    value={schedule.schoolEnd}
                    onChange={(e) =>
                      setSchedule((s) => ({ ...s, schoolEnd: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-600">
                  片道の通学時間（分）
                </label>
                <input
                  type="number"
                  min={0}
                  max={180}
                  value={schedule.commuteMinutesOneWay}
                  onChange={(e) =>
                    setSchedule((s) => ({
                      ...s,
                      commuteMinutesOneWay: Number(e.target.value) || 0,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
              <div>
                <label className="text-sm text-slate-600">
                  食事・風呂の合計時間（分）
                </label>
                <input
                  type="number"
                  min={0}
                  max={240}
                  value={schedule.mealAndBathMinutes}
                  onChange={(e) =>
                    setSchedule((s) => ({
                      ...s,
                      mealAndBathMinutes: Number(e.target.value) || 0,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
              <div>
                <label className="text-sm text-slate-600">
                  自由時間バッファ（分）
                </label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={schedule.freeTimeBufferMinutes}
                  onChange={(e) =>
                    setSchedule((s) => ({
                      ...s,
                      freeTimeBufferMinutes: Number(e.target.value) || 0,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
            </div>
            <div className="mt-6 rounded-xl bg-blue-50 px-4 py-4 text-center">
              <div className="text-sm text-slate-600">1日の勉強可能時間</div>
              <div className="text-2xl font-bold text-blue-600">
                {Math.floor(studyMinutesWithoutClub / 60)}時間
                {studyMinutesWithoutClub % 60}分
              </div>
            </div>
          </div>
        )}

        {/* Step 5 */}
        {step === 5 && (
          <div>
            <h2 className="mb-2 text-xl font-semibold text-slate-800">
              部活（テニス）の設定
            </h2>
            <p className="mb-6 text-sm text-slate-500">
              部活のある曜日を選ぶと、その日の勉強可能時間が自動で計算されます
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-600">
                  部活のある曜日（0=日〜6=土）
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    [0, '日'],
                    [1, '月'],
                    [2, '火'],
                    [3, '水'],
                    [4, '木'],
                    [5, '金'],
                    [6, '土'],
                  ].map(([n, label]) => (
                    <label
                      key={n}
                      className={`flex cursor-pointer items-center rounded-lg border px-4 py-2 ${
                        schedule.clubDays.includes(n as number)
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={schedule.clubDays.includes(n as number)}
                        onChange={(e) => {
                          const num = n as number;
                          setSchedule((s) => ({
                            ...s,
                            clubDays: e.target.checked
                              ? [...s.clubDays, num].sort((a, b) => a - b)
                              : s.clubDays.filter((d) => d !== num),
                          }));
                        }}
                        className="mr-2 h-4 w-4 rounded border-slate-300 text-blue-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-600">平日（月〜金）の部活時間</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-500">開始</label>
                      <select
                        value={schedule.clubStartTime}
                        onChange={(e) =>
                          setSchedule((s) => ({ ...s, clubStartTime: e.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">終了</label>
                      <select
                        value={schedule.clubEndTime}
                        onChange={(e) =>
                          setSchedule((s) => ({ ...s, clubEndTime: e.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-600">土日・休日の部活時間</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-500">開始</label>
                      <select
                        value={schedule.clubWeekendStart ?? schedule.clubStartTime}
                        onChange={(e) =>
                          setSchedule((s) => ({ ...s, clubWeekendStart: e.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">終了</label>
                      <select
                        value={schedule.clubWeekendEnd ?? schedule.clubEndTime}
                        onChange={(e) =>
                          setSchedule((s) => ({ ...s, clubWeekendEnd: e.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-100 px-4 py-4 text-center">
                <div className="text-sm text-slate-600">部活ありの日（平日）</div>
                <div className="text-xl font-bold text-slate-700">
                  {Math.floor(studyMinutesWithClubWeekday / 60)}時間
                  {studyMinutesWithClubWeekday % 60}分
                </div>
              </div>
              <div className="rounded-xl bg-slate-100 px-4 py-4 text-center">
                <div className="text-sm text-slate-600">部活ありの日（土日・休日）</div>
                <div className="text-xl font-bold text-slate-700">
                  {Math.floor(studyMinutesWithClubWeekend / 60)}時間
                  {studyMinutesWithClubWeekend % 60}分
                </div>
              </div>
              <div className="rounded-xl bg-blue-50 px-4 py-4 text-center">
                <div className="text-sm text-slate-600">部活なしの日</div>
                <div className="text-xl font-bold text-blue-600">
                  {Math.floor(studyMinutesWithoutClub / 60)}時間
                  {studyMinutesWithoutClub % 60}分
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 6: 夏休みの期間 */}
        {step === 6 && (
          <div>
            <h2 className="mb-2 text-xl font-semibold text-slate-800">
              夏休みの期間
            </h2>
            <p className="mb-6 text-sm text-slate-500">
              夏休み中は学校がないため、勉強時間が大幅に増えます。正確な期間を設定してください。
            </p>
            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm text-slate-600">夏休み開始日</label>
                <input
                  type="date"
                  value={schedule.summerVacationStart || '2026-07-20'}
                  onChange={(e) =>
                    setSchedule((s) => ({ ...s, summerVacationStart: e.target.value || '' }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600">夏休み終了日</label>
                <input
                  type="date"
                  value={schedule.summerVacationEnd || '2026-08-31'}
                  onChange={(e) =>
                    setSchedule((s) => ({ ...s, summerVacationEnd: e.target.value || '' }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
            </div>
            <p className="mb-3 text-sm font-medium text-slate-700">夏休み中のスケジュール目安</p>
            {/* 部活あり日: 英語90+数学90+国語90+理科60+社会60 = 390分 = 6.5h */}
            <div className="mb-4">
              <div className="mb-1 text-xs text-slate-500">部活あり日：約6.5時間</div>
              <div className="flex h-8 overflow-hidden rounded-lg border border-slate-200">
                <div className="bg-blue-500" style={{ width: '23%' }} title="英語 1.5h" />
                <div className="bg-red-500" style={{ width: '23%' }} title="数学 1.5h" />
                <div className="bg-green-500" style={{ width: '23%' }} title="国語 1.5h" />
                <div className="bg-purple-500" style={{ width: '15%' }} title="理科 1h" />
                <div className="bg-orange-500" style={{ width: '15%' }} title="社会 1h" />
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-blue-500" />英語1.5h</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-red-500" />数学1.5h</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-green-500" />国語1.5h</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-purple-500" />理科1h</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-orange-500" />社会1h</span>
              </div>
            </div>
            {/* 部活なし日: 英語90+数学90+国語90+理科90+社会90+情報30 = 480分 = 8h */}
            <div>
              <div className="mb-1 text-xs text-slate-500">部活なし日：約8時間</div>
              <div className="flex h-8 overflow-hidden rounded-lg border border-slate-200">
                <div className="bg-blue-500" style={{ width: '18.75%' }} title="英語 1.5h" />
                <div className="bg-red-500" style={{ width: '18.75%' }} title="数学 1.5h" />
                <div className="bg-green-500" style={{ width: '18.75%' }} title="国語 1.5h" />
                <div className="bg-purple-500" style={{ width: '18.75%' }} title="理科 1.5h" />
                <div className="bg-orange-500" style={{ width: '18.75%' }} title="社会 1.5h" />
                <div className="bg-gray-500" style={{ width: '6.25%' }} title="情報 0.5h" />
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-blue-500" />英語1.5h</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-red-500" />数学1.5h</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-green-500" />国語1.5h</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-purple-500" />理科1.5h</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-orange-500" />社会1.5h</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-gray-500" />情報0.5h</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 7: 試験日の設定 */}
        {step === 7 && (
          <div>
            <h2 className="mb-2 text-xl font-semibold text-slate-800">
              試験日の設定
            </h2>
            <p className="mb-6 text-sm text-slate-500">
              共通テスト本番日を選択してください
            </p>
            <div className="mb-6">
              <label className="text-sm text-slate-600">お名前（任意）</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="受験生"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
            <div className="mb-6">
              <label className="text-sm text-slate-600">
                共通テスト本番日
              </label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
            <div className="mb-6">
              <label className="text-sm text-slate-600">
                試験勉強を開始する日
              </label>
              <input
                type="date"
                value={studyStartDate}
                onChange={(e) => setStudyStartDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <p className="mt-1 text-xs text-slate-500">
                この日以降に学習計画が生成されます
              </p>
            </div>
            <div className="rounded-xl bg-blue-600 px-6 py-8 text-center text-white">
              <div className="text-sm opacity-90">試験まであと</div>
              <div className="text-4xl font-bold">
                {daysUntilExam(examDate)}
                <span className="ml-1 text-xl font-normal">日</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-between border-t border-slate-200 pt-6">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-slate-600 disabled:opacity-40"
        >
          戻る
        </button>
        {step < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canGoNext()}
            className="rounded-lg bg-blue-500 px-5 py-2.5 font-medium text-white disabled:opacity-50"
          >
            次へ
          </button>
        ) : (
          <button
            type="button"
            onClick={handleComplete}
            className="rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white"
          >
            設定完了
          </button>
        )}
      </div>
    </div>
  );
}
