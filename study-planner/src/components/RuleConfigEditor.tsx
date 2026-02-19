/**
 * 学習ルール設定エディタ
 * 曜日別・フェーズ別・復習・詳細設定・バックアップを一元管理
 */

import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Trash2,
  Download,
  Upload,
  RotateCcw,
} from 'lucide-react';
import { useRuleConfigStore } from '../stores/ruleConfigStore';
import { useShallow } from 'zustand/react/shallow';
import { useStudyStore } from '../stores/studyStore';
import { useStudentStore } from '../stores/studentStore';
import { formatDateForInput } from '../utils/dateUtils';
import { getStudyMinutesSummary } from '../utils/scheduleUtils';
import type { DayTemplateConfig, BlockConfig, DayType } from '../types';
import { DAY_TYPE_DISPLAY } from '../types';

const SUBJECT_LABELS: Record<string, string> = {
  english: '英語',
  math: '数学',
  japanese: '国語',
  science: '理科',
  social: '社会',
  info: '情報',
};

const SUBJECT_OPTIONS: { value: BlockConfig['subjectCategory']; label: string }[] = [
  { value: 'english', label: '英語' },
  { value: 'math', label: '数学' },
  { value: 'japanese', label: '国語' },
  { value: 'science', label: '理科' },
  { value: 'social', label: '社会' },
  { value: 'info', label: '情報' },
];

const DURATION_OPTIONS = [30, 45, 60, 75, 90, 105, 120];
const POMODORO_WORK_OPTIONS = [15, 20, 25, 30, 35, 40, 45];
const POMODORO_BREAK_OPTIONS = [3, 5, 7, 10];
const PHASES = ['基礎期', '実践期', '直前期'] as const;

function formatStudyTime(minutes: number): string {
  if (minutes < 60) return `${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}時間${m}分` : `${h}時間`;
}

/** 日種別 → 勉強可能時間のマッピング */
function getAvailableForDayType(
  summary: ReturnType<typeof getStudyMinutesSummary>,
  dayType: DayType
): number {
  switch (dayType) {
    case 'weekday_club': return summary.withClubWeekday;
    case 'weekday_no_club': return summary.noClubWeekday;
    case 'weekend_holiday': return summary.noClubWeekend;
    case 'summer_club': return summary.summerClub;
    case 'summer_no_club': return summary.summerNoClub;
    default: return 0;
  }
}

/** ブロック編集時のバリデーション表示 */
function DayTemplateValidation({
  dayType,
  blockTotalMinutes,
  maxReviewMinutes,
}: {
  dayType: DayType;
  blockTotalMinutes: number;
  maxReviewMinutes: number;
}) {
  const profile = useStudentStore((s) => s.profile);
  const bufferRatio = useRuleConfigStore((s) => s.config.generalRules?.bufferRatio ?? 0.15);
  if (!profile) return null;
  const summary = getStudyMinutesSummary(profile.dailySchedule);
  const rawAvailable = getAvailableForDayType(summary, dayType);
  const bufferMinutes = Math.ceil(rawAvailable * bufferRatio);
  const effectiveMinutes = Math.max(0, rawAvailable - bufferMinutes);
  const reviewCap = Math.min(maxReviewMinutes, Math.floor(effectiveMinutes * 0.2));
  const remainingForBlocks = effectiveMinutes - reviewCap;
  const isOver = blockTotalMinutes > remainingForBlocks;
  const margin = remainingForBlocks - blockTotalMinutes;

  return (
    <div className="mt-4 space-y-1 text-sm">
      <div className="text-slate-600">
        ブロック合計：{formatStudyTime(blockTotalMinutes)}
      </div>
      <div className="text-slate-600">
        勉強可能時間：{formatStudyTime(rawAvailable)}
        （ゆとり{Math.round(bufferRatio * 100)}%適用後：{formatStudyTime(effectiveMinutes)}）
      </div>
      {isOver ? (
        <p className="rounded bg-amber-100 px-2 py-1 text-amber-800">
          ⚠️ ブロック合計が実効時間を超えています！
          <br />
          → 自動的に優先度の低いブロックから削減されます
        </p>
      ) : margin > 0 ? (
        <p className="rounded bg-green-100 px-2 py-1 text-green-800">
          ✅ {formatStudyTime(margin)}のゆとりがあります
        </p>
      ) : null}
      <div className="text-slate-500">
        復習含む最大：{formatStudyTime(blockTotalMinutes + maxReviewMinutes)}
      </div>
    </div>
  );
}

function makeBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultBlock(order: number): BlockConfig {
  return {
    id: makeBlockId(),
    subjectCategory: 'english',
    durationMinutes: 60,
    pomodoroWorkMinutes: 30,
    pomodoroBreakMinutes: 5,
    order,
    label: '英語 1h',
    enabled: true,
  };
}

/** セクション1: 曜日別スケジュール */
function DayTemplatesSection({
  onSaveToast,
}: {
  onSaveToast: () => void;
}) {
  const dayTemplates = useRuleConfigStore(useShallow((s) => s.config.dayTemplates));
  const updateDayTemplate = useRuleConfigStore((s) => s.updateDayTemplate);
  const addChangeLogEntry = useRuleConfigStore((s) => s.addChangeLogEntry);
  const invalidatePlansOnRuleConfigChange = useStudyStore((s) => s.invalidatePlansOnRuleConfigChange);

  const [expandedDayType, setExpandedDayType] = useState<DayType | null>(null);
  const [editState, setEditState] = useState<DayTemplateConfig | null>(null);

  const templates = dayTemplates.filter(
    (t) => t.dayType !== 'match_day' && t.dayType !== 'event_day'
  );
  const specialTemplates = dayTemplates.filter(
    (t) => t.dayType === 'match_day' || t.dayType === 'event_day'
  );

  const getBlockSummary = (t: DayTemplateConfig) => {
    const enabled = t.blocks.filter((b) => b.enabled);
    const total = enabled.reduce((s, b) => s + b.durationMinutes, 0);
    const labels = enabled.map((b) => {
      const sub = SUBJECT_OPTIONS.find((o) => o.value === b.subjectCategory);
      return `${sub?.label ?? b.subjectCategory}${b.durationMinutes >= 60 ? b.durationMinutes / 60 + 'h' : b.durationMinutes + '分'}`;
    });
    return { labels, total };
  };

  const handleOpenEdit = (t: DayTemplateConfig) => {
    setEditState(JSON.parse(JSON.stringify(t)));
    setExpandedDayType(t.dayType);
  };

  const handleCloseEdit = () => {
    setEditState(null);
    setExpandedDayType(null);
  };

  const handleSaveEdit = () => {
    if (!editState) return;
    const blocks = editState.blocks.map((b, i) => ({ ...b, order: i + 1 }));
    updateDayTemplate(editState.dayType, {
      blocks,
      maxReviewMinutes: editState.maxReviewMinutes,
    });
    addChangeLogEntry(`${DAY_TYPE_DISPLAY[editState.dayType]}を更新`);
    invalidatePlansOnRuleConfigChange();
    onSaveToast();
    handleCloseEdit();
  };

  const handleUpdateBlock = (blockId: string, updates: Partial<BlockConfig>) => {
    if (!editState) return;
    const blocks = editState.blocks.map((b) =>
      b.id === blockId ? { ...b, ...updates } : b
    );
    setEditState({ ...editState, blocks });
  };

  const handleAddBlock = () => {
    if (!editState) return;
    const newBlock = createDefaultBlock(editState.blocks.length + 1);
    setEditState({ ...editState, blocks: [...editState.blocks, newBlock] });
  };

  const handleRemoveBlock = (blockId: string) => {
    if (!editState) return;
    setEditState({
      ...editState,
      blocks: editState.blocks.filter((b) => b.id !== blockId),
    });
  };

  const handleMoveBlock = (blockId: string, dir: 'up' | 'down') => {
    if (!editState) return;
    const idx = editState.blocks.findIndex((b) => b.id === blockId);
    if (idx < 0) return;
    const newIdx = dir === 'up' ? Math.max(0, idx - 1) : Math.min(editState.blocks.length - 1, idx + 1);
    if (newIdx === idx) return;
    const arr = [...editState.blocks];
    const [removed] = arr.splice(idx, 1);
    arr.splice(newIdx, 0, removed!);
    setEditState({ ...editState, blocks: arr });
  };

  const editTotalMinutes = editState
    ? editState.blocks.filter((b) => b.enabled).reduce((s, b) => s + b.durationMinutes, 0)
    : 0;

  return (
    <div className="space-y-3">
      {templates.map((t) => {
        const { labels, total } = getBlockSummary(t);
        const isExpanded = expandedDayType === t.dayType;
        const isEditing = isExpanded && editState?.dayType === t.dayType;

        return (
          <div
            key={t.dayType}
            className="rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div
              className="flex cursor-pointer items-center justify-between p-4"
              onClick={() => !isEditing && setExpandedDayType(isExpanded ? null : t.dayType)}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{t.icon}</span>
                <div>
                  <div className="font-medium text-slate-800">{t.displayName}</div>
                  <div className="text-sm text-slate-500">
                    現在：{labels.join(' ＋ ')} ＝ {formatStudyTime(total)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEdit(t);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  編集
                </button>
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-slate-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-500" />
                )}
              </div>
            </div>

            {isEditing && editState && (
              <div className="border-t border-slate-100 p-4">
                <h4 className="mb-4 font-medium text-slate-800">
                  {t.icon} {t.displayName}の編集
                </h4>
                <div className="mb-4">
                  <label className="block text-sm text-slate-600">復習タスク上限（分）</label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={editState.maxReviewMinutes}
                    onChange={(e) =>
                      setEditState({
                        ...editState,
                        maxReviewMinutes: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="mt-1 w-24 rounded-lg border border-slate-200 px-3 py-2"
                  />
                </div>
                <div className="mb-2 text-sm font-medium text-slate-700">ブロック一覧</div>
                <div className="space-y-2">
                  {editState.blocks.map((block, idx) => (
                    <div
                      key={block.id}
                      className={`rounded-lg border p-3 ${
                        block.enabled ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-70'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-sm text-slate-500">
                          <GripVertical className="h-4 w-4" />
                          {idx + 1}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveBlock(block.id, 'up')}
                            disabled={idx === 0}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveBlock(block.id, 'down')}
                            disabled={idx === editState.blocks.length - 1}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveBlock(block.id)}
                            className="rounded p-1 text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div>
                          <label className="block text-xs text-slate-500">科目</label>
                          <select
                            value={block.subjectCategory}
                            onChange={(e) => {
                              const val = e.target.value as BlockConfig['subjectCategory'];
                              const sub = SUBJECT_OPTIONS.find((o) => o.value === val);
                              const m = block.durationMinutes;
                              const suffix = m >= 60 ? (m % 60 === 0 ? m / 60 + 'h' : (m / 60).toFixed(1) + 'h') : m + '分';
                              handleUpdateBlock(block.id, {
                                subjectCategory: val,
                                label: `${sub?.label ?? val} ${suffix}`,
                              });
                            }}
                            className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                          >
                            {SUBJECT_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500">時間（分）</label>
                          <select
                            value={block.durationMinutes}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              const sub = SUBJECT_OPTIONS.find((o) => o.value === block.subjectCategory);
                              const labelSuffix = v >= 60 ? (v % 60 === 0 ? v / 60 + 'h' : (v / 60).toFixed(1) + 'h') : v + '分';
                              handleUpdateBlock(block.id, {
                                durationMinutes: v,
                                label: `${sub?.label ?? block.subjectCategory} ${labelSuffix}`,
                              });
                            }}
                            className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                          >
                            {DURATION_OPTIONS.map((m) => (
                              <option key={m} value={m}>{m}分</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500">作業/休憩（分）</label>
                          <div className="flex gap-1">
                            <select
                              value={block.pomodoroWorkMinutes}
                              onChange={(e) =>
                                handleUpdateBlock(block.id, {
                                  pomodoroWorkMinutes: Number(e.target.value),
                                })
                              }
                              className="mt-0.5 flex-1 rounded border border-slate-200 px-1 py-1.5 text-sm"
                            >
                              {POMODORO_WORK_OPTIONS.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                            <select
                              value={block.pomodoroBreakMinutes}
                              onChange={(e) =>
                                handleUpdateBlock(block.id, {
                                  pomodoroBreakMinutes: Number(e.target.value),
                                })
                              }
                              className="mt-0.5 w-14 rounded border border-slate-200 px-1 py-1.5 text-sm"
                            >
                              {POMODORO_BREAK_OPTIONS.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </div>
                          <span className="text-xs text-slate-400">
                            ×{Math.floor(block.durationMinutes / block.pomodoroWorkMinutes)}回
                          </span>
                        </div>
                        <div className="flex items-end gap-2">
                          <label className="flex cursor-pointer items-center gap-1 text-sm">
                            <input
                              type="checkbox"
                              checked={block.enabled}
                              onChange={(e) =>
                                handleUpdateBlock(block.id, { enabled: e.target.checked })
                              }
                            />
                            有効
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddBlock}
                  className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4" />
                  ブロックを追加
                </button>
                <DayTemplateValidation
                  dayType={editState.dayType}
                  blockTotalMinutes={editTotalMinutes}
                  maxReviewMinutes={editState.maxReviewMinutes}
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCloseEdit}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    保存
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {specialTemplates.map((t) => {
        const { labels, total } = getBlockSummary(t);
        return (
          <div
            key={t.dayType}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{t.icon}</span>
              <div>
                <div className="font-medium text-slate-800">{t.displayName}</div>
                <div className="text-sm text-slate-500">
                  {labels.length ? `${labels.join(' ＋ ')} ＝ ${formatStudyTime(total)}` : t.description}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const PHASE_CONTENTS_EMPTY: { subjectCategory: string; phase: string; contents: string[] }[] = [];

/** セクション2: フェーズ別学習内容 */
function PhaseContentSection({ onSaveToast }: { onSaveToast: () => void }) {
  const phaseContents = useRuleConfigStore(
    useShallow((s) => s.config.phaseContents ?? PHASE_CONTENTS_EMPTY)
  );
  const updatePhaseContent = useRuleConfigStore((s) => s.updatePhaseContent);
  const addChangeLogEntry = useRuleConfigStore((s) => s.addChangeLogEntry);
  const invalidatePlansOnRuleConfigChange = useStudyStore((s) => s.invalidatePlansOnRuleConfigChange);

  const [activeSubject, setActiveSubject] = useState<BlockConfig['subjectCategory']>('english');
  const [draftContents, setDraftContents] = useState<Record<string, string[]>>({});

  const phaseContentsKey = JSON.stringify(phaseContents);
  useEffect(() => {
    const draft: Record<string, string[]> = {};
    phaseContents.forEach((p) => {
      const key = `${p.subjectCategory}:${p.phase}`;
      draft[key] = [...p.contents];
    });
    setDraftContents((prev) => {
      const prevStr = JSON.stringify(prev);
      const nextStr = JSON.stringify(draft);
      if (prevStr === nextStr) return prev;
      return draft;
    });
  }, [phaseContentsKey]);

  const getContents = (phase: string): string[] => {
    const key = `${activeSubject}:${phase}`;
    return draftContents[key] ?? phaseContents.find(
      (p) => p.subjectCategory === activeSubject && p.phase === phase
    )?.contents ?? [];
  };

  const setContents = (phase: string, contents: string[]) => {
    const key = `${activeSubject}:${phase}`;
    setDraftContents((prev) => ({ ...prev, [key]: contents }));
  };

  const handleSave = () => {
    PHASES.forEach((phase) => {
      const contents = getContents(phase);
      if (contents.length > 0) {
        updatePhaseContent(activeSubject, phase, contents);
      }
    });
    addChangeLogEntry(`${SUBJECT_LABELS[activeSubject] ?? activeSubject}のフェーズ別学習内容を変更`);
    invalidatePlansOnRuleConfigChange();
    onSaveToast();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SUBJECT_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setActiveSubject(o.value)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              activeSubject === o.value
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="space-y-6">
        {PHASES.map((phase) => {
          const contents = getContents(phase);
          const arr = contents.length > 0 ? [...contents] : ['', '', ''];
          return (
            <div key={phase} className="rounded-lg border border-slate-200 p-4">
              <h4 className="mb-3 font-medium text-slate-800">
                ■ {phase}
                {phase === '基礎期' && '（120日以上前）'}
                {phase === '実践期' && '（60〜119日前）'}
                {phase === '直前期' && '（30日以内）'}
              </h4>
              <div className="space-y-2">
                {arr.map((c, i) => (
                  <div key={i}>
                    <label className="block text-xs text-slate-500">
                      ポモドーロ{i + 1}の内容
                    </label>
                    <input
                      type="text"
                      value={c}
                      onChange={(e) => {
                        const next = [...arr];
                        next[i] = e.target.value;
                        setContents(phase, next.filter(Boolean).length ? next : ['']);
                      }}
                      className="mt-0.5 w-full rounded-lg border border-slate-200 px-3 py-2"
                      placeholder={`例: ${phase === '基礎期' ? '基本問題演習' : phase === '実践期' ? '共テ形式演習' : '過去問演習'}`}
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setContents(phase, [...arr, ''])}
                className="mt-2 text-sm text-indigo-600 hover:underline"
              >
                ＋ 入力欄を追加
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={handleSave}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        保存
      </button>
    </div>
  );
}

/** セクション3: 復習ルール */
function ForgettingCurveSection({ onSaveToast }: { onSaveToast: () => void }) {
  const forgettingCurve = useRuleConfigStore(
    useShallow((s) => s.config.forgettingCurve)
  );
  const updateForgettingCurve = useRuleConfigStore((s) => s.updateForgettingCurve);
  const addChangeLogEntry = useRuleConfigStore((s) => s.addChangeLogEntry);
  const invalidatePlansOnRuleConfigChange = useStudyStore((s) => s.invalidatePlansOnRuleConfigChange);

  const [intervals, setIntervals] = useState<number[]>(forgettingCurve.intervals);
  const [maxDaily, setMaxDaily] = useState(forgettingCurve.maxDailyReviewMinutes);
  const [gradCount, setGradCount] = useState(forgettingCurve.graduationCount);

  const fcKey = JSON.stringify({
    i: forgettingCurve.intervals,
    m: forgettingCurve.maxDailyReviewMinutes,
    g: forgettingCurve.graduationCount,
  });
  useEffect(() => {
    const { intervals: ci, maxDailyReviewMinutes: cm, graduationCount: cg } = forgettingCurve;
    setIntervals((prev) => (JSON.stringify(prev) === JSON.stringify(ci) ? prev : ci));
    setMaxDaily((prev) => (prev === cm ? prev : cm));
    setGradCount((prev) => (prev === cg ? prev : cg));
  }, [fcKey]);

  const handleSave = () => {
    updateForgettingCurve({
      intervals,
      maxDailyReviewMinutes: maxDaily,
      graduationCount: gradCount,
    });
    addChangeLogEntry('復習ルールを変更');
    invalidatePlansOnRuleConfigChange();
    onSaveToast();
  };

  const handleIntervalChange = (idx: number, v: number) => {
    const next = [...intervals];
    next[idx] = Math.max(1, v);
    setIntervals(next);
  };

  const handleAddInterval = () => setIntervals([...intervals, 30]);
  const handleRemoveInterval = (idx: number) =>
    setIntervals(intervals.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">復習間隔（日後）</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {intervals.map((n, i) => (
            <span key={i} className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                value={n}
                onChange={(e) => handleIntervalChange(i, Number(e.target.value) || 1)}
                className="w-14 rounded border border-slate-200 px-2 py-1 text-center text-sm"
              />
              日
              <button
                type="button"
                onClick={() => handleRemoveInterval(i)}
                className="rounded p-0.5 text-red-500 hover:bg-red-50"
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={handleAddInterval}
            className="flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2 py-1 text-sm text-slate-600"
          >
            <Plus className="h-4 w-4" />追加
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">1日の復習上限（分）</label>
        <input
          type="number"
          min={10}
          max={120}
          value={maxDaily}
          onChange={(e) => setMaxDaily(Math.max(10, Number(e.target.value) || 10))}
          className="mt-1 w-24 rounded-lg border border-slate-200 px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">卒業条件</label>
        <input
          type="number"
          min={2}
          max={5}
          value={gradCount}
          onChange={(e) => setGradCount(Math.max(2, Math.min(5, Number(e.target.value) || 3)))}
          className="mt-1 w-24 rounded-lg border border-slate-200 px-3 py-2"
        />
        <span className="ml-2 text-sm text-slate-500">回連続正解で復習終了</span>
      </div>
      <button
        type="button"
        onClick={handleSave}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        保存
      </button>
    </div>
  );
}

/** セクション4: 詳細設定 */
function GeneralRulesSection({ onSaveToast }: { onSaveToast: () => void }) {
  const gr = useRuleConfigStore(useShallow((s) => s.config.generalRules));
  const updateGeneralRules = useRuleConfigStore((s) => s.updateGeneralRules);
  const addChangeLogEntry = useRuleConfigStore((s) => s.addChangeLogEntry);
  const invalidatePlansOnRuleConfigChange = useStudyStore((s) => s.invalidatePlansOnRuleConfigChange);

  const handleSave = () => {
    addChangeLogEntry('詳細設定を変更');
    invalidatePlansOnRuleConfigChange();
    onSaveToast();
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={gr.scienceRotation}
          onChange={(e) =>
            updateGeneralRules({ scienceRotation: e.target.checked })
          }
        />
        <span>理科の日替わりローテーション</span>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={gr.socialRotation}
          onChange={(e) =>
            updateGeneralRules({ socialRotation: e.target.checked })
          }
        />
        <span>社会の日替わりローテーション</span>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={gr.mathAlternate}
          onChange={(e) =>
            updateGeneralRules({ mathAlternate: e.target.checked })
          }
        />
        <span>数学ⅠA/ⅡBCの日替わり重点切替</span>
      </label>
      <div>
        <label className="block text-sm font-medium text-slate-700">
          ゆとり率（%）
        </label>
        <p className="mt-0.5 text-xs text-slate-500">
          勉強可能時間のうち◯%を、休息や予定のズレに備えたバッファとして確保します
        </p>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="range"
            min={5}
            max={30}
            step={5}
            value={Math.round(((gr.bufferRatio ?? 0.15) * 100))}
            onChange={(e) => {
              const pct = Number(e.target.value);
              updateGeneralRules({ bufferRatio: pct / 100 });
            }}
            className="h-2 flex-1 accent-indigo-600"
          />
          <span className="w-12 tabular-nums text-sm font-medium">
            {Math.round(((gr.bufferRatio ?? 0.15) * 100))}%
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          5%: 詰め込み / 15%: 標準推奨 / 30%: のんびり
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">
          ポモドーロ作業時間のデフォルト（分）
        </label>
        <input
          type="number"
          min={15}
          max={60}
          value={gr.defaultPomodoroWork}
          onChange={(e) =>
            updateGeneralRules({
              defaultPomodoroWork: Math.max(15, Math.min(60, Number(e.target.value) || 30)),
            })
          }
          className="mt-1 w-24 rounded-lg border border-slate-200 px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">
          ポモドーロ休憩時間のデフォルト（分）
        </label>
        <input
          type="number"
          min={3}
          max={15}
          value={gr.defaultPomodoroBreak}
          onChange={(e) =>
            updateGeneralRules({
              defaultPomodoroBreak: Math.max(3, Math.min(15, Number(e.target.value) || 5)),
            })
          }
          className="mt-1 w-24 rounded-lg border border-slate-200 px-3 py-2"
        />
      </div>
      <button
        type="button"
        onClick={handleSave}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        保存
      </button>
    </div>
  );
}

/** セクション5: 設定のバックアップ */
function RuleBackupSection({ onSaveToast }: { onSaveToast: () => void }) {
  const exportConfig = useRuleConfigStore((s) => s.exportConfig);
  const importConfig = useRuleConfigStore((s) => s.importConfig);
  const resetToDefault = useRuleConfigStore((s) => s.resetToDefault);
  const addChangeLogEntry = useRuleConfigStore((s) => s.addChangeLogEntry);
  const invalidatePlansOnRuleConfigChange = useStudyStore((s) => s.invalidatePlansOnRuleConfigChange);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleExport = () => {
    const json = exportConfig();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eisei-rule-config-${formatDateForInput(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importConfig(reader.result as string);
      if (ok) {
        addChangeLogEntry('設定をインポート');
        invalidatePlansOnRuleConfigChange();
        onSaveToast();
      } else {
        setImportError('無効な設定ファイルです');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    resetToDefault();
    addChangeLogEntry('デフォルトに戻した');
    invalidatePlansOnRuleConfigChange();
    onSaveToast();
    setShowResetConfirm(false);
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleExport}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Download className="h-4 w-4" />
        設定をエクスポート（JSON）
      </button>
      <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
        <Upload className="h-4 w-4" />
        設定をインポート
        <input
          type="file"
          accept=".json,application/json"
          onChange={handleImport}
          className="sr-only"
        />
      </label>
      {importError && (
        <p className="text-sm text-red-600">{importError}</p>
      )}
      <button
        type="button"
        onClick={() => setShowResetConfirm(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100"
      >
        <RotateCcw className="h-4 w-4" />
        デフォルトに戻す
      </button>

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">デフォルト設定に戻しますか？</h3>
            <p className="mt-2 text-sm text-slate-600">
              学習ルールが初期値に戻ります。この操作は取り消せません。
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 rounded-lg border border-slate-300 py-2 text-slate-600"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 rounded-lg bg-amber-600 py-2 text-white hover:bg-amber-700"
              >
                戻す
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY_CHANGELOG: { date: string; description: string }[] = [];

/** セクション6: 変更履歴 */
function ChangeLogSection() {
  const changeLog = useRuleConfigStore((s) => s.config.changeLog ?? EMPTY_CHANGELOG);
  const entries = changeLog.slice(0, 10);
  if (entries.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">変更履歴</h3>
      <ul className="space-y-1.5 text-sm text-slate-600">
        {entries.map((e, i) => (
          <li key={i}>
            <span className="tabular-nums text-slate-500">{e.date}</span>
            <span className="ml-2">—</span>
            <span className="ml-2">{e.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** アコーディオンラッパー */
function AccordionSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4 text-left font-medium text-slate-800"
      >
        {title}
        {open ? (
          <ChevronUp className="h-5 w-5" />
        ) : (
          <ChevronDown className="h-5 w-5" />
        )}
      </button>
      {open && <div className="border-t border-slate-100 p-4">{children}</div>}
    </div>
  );
}

export function RuleConfigEditor({
  onSaveToast,
}: {
  onSaveToast: () => void;
}) {
  return (
    <div className="space-y-4">
      <AccordionSection title="1. 曜日別スケジュール設定" defaultOpen>
        <DayTemplatesSection onSaveToast={onSaveToast} />
      </AccordionSection>
      <AccordionSection title="2. フェーズ別学習内容">
        <PhaseContentSection onSaveToast={onSaveToast} />
      </AccordionSection>
      <AccordionSection title="3. 復習ルール設定">
        <ForgettingCurveSection onSaveToast={onSaveToast} />
      </AccordionSection>
      <AccordionSection title="4. 詳細設定">
        <GeneralRulesSection onSaveToast={onSaveToast} />
      </AccordionSection>
      <AccordionSection title="5. 設定のバックアップ">
        <RuleBackupSection onSaveToast={onSaveToast} />
      </AccordionSection>

      <ChangeLogSection />
    </div>
  );
}
