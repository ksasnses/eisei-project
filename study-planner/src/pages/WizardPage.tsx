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
import {
  getDefaultExamDate,
  formatDateForInput,
  parseTimeToMinutes,
  minutesToTimeStr,
  daysUntilExam,
} from '../utils/dateUtils';

const TOTAL_STEPS = 6;

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
  freeTimeBufferMinutes: 30,
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
          const { required, selectGroups } = availableSubjectsForStep2;
          const requiredSet = new Set(required);
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
    if (step === 4 || step === 5) return true;
    if (step === 6) return true;
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

  const studyMinutesWithClub = useMemo(() => {
    const clubStart = parseTimeToMinutes(schedule.clubStartTime);
    const clubEnd = parseTimeToMinutes(schedule.clubEndTime);
    const clubMinutes = (clubEnd < clubStart ? 24 * 60 : 0) + clubEnd - clubStart;
    return Math.max(0, studyMinutesWithoutClub - clubMinutes);
  }, [schedule, studyMinutesWithoutClub]);

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
          currentScore: 50,
          targetScore: 70,
          difficulty: 3,
          textbooks: [],
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
      toAdd.forEach((id) => {
        next[id] = {
          currentScore: 50,
          targetScore: 70,
          difficulty: 3,
          textbooks: [],
          ...prev[id],
        };
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
    };
    setProfile(profile);
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
                        const subs = getSubjectsByCategory(
                          sg.from as Subject['category']
                        );
                        const rec = sg.recommended
                          ? subs.filter((s) => sg.recommended!.includes(s.id))
                          : subs;
                        rec.slice(0, sg.count).forEach((s) => {
                          if (!initialSelected.includes(s.id))
                            initialSelected.push(s.id);
                        });
                      }
                    }
                    setSelectedSubjectIds(initialSelected);
                    initialSelected.forEach((id) => {
                      setSubjectDetails((prev) => ({
                        ...prev,
                        [id]: {
                          currentScore: 50,
                          targetScore: 70,
                          difficulty: 3,
                          textbooks: [],
                          ...prev[id],
                        },
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
                const selected = selectedSubjectIds.filter((id) =>
                  sg.subjectIds.includes(id)
                );
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
              return (
                <div key={sg.from} className="mt-4">
                  <p className="mb-2 text-sm font-medium text-slate-600">
                    {sg.from}から{sg.count}科目を選択
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sg.subjectIds.map((id) => {
                      const s = getSubjectById(id);
                      if (!s) return null;
                      const checked = selectedInGroup.includes(id);
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-600">部活 開始</label>
                  <select
                    value={schedule.clubStartTime}
                    onChange={(e) =>
                      setSchedule((s) => ({
                        ...s,
                        clubStartTime: e.target.value,
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
                  <label className="text-sm text-slate-600">部活 終了</label>
                  <select
                    value={schedule.clubEndTime}
                    onChange={(e) =>
                      setSchedule((s) => ({
                        ...s,
                        clubEndTime: e.target.value,
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
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-100 px-4 py-4 text-center">
                <div className="text-sm text-slate-600">部活ありの日</div>
                <div className="text-xl font-bold text-slate-700">
                  {Math.floor(studyMinutesWithClub / 60)}時間
                  {studyMinutesWithClub % 60}分
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

        {/* Step 6 */}
        {step === 6 && (
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
