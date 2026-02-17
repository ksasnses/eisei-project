/**
 * 学習フェーズ設定
 * docs/spec.md セクション3-1 に基づく
 */

export type PhaseName = '基礎期' | '実践期' | '直前期';

export interface PhaseTimeAllocation {
  /** 基礎固めの割合（0-1） */
  基礎固め?: number;
  /** 演習の割合 */
  演習?: number;
  /** 共テ形式演習の割合 */
  共テ形式演習?: number;
  /** 復習の割合 */
  復習: number;
  /** 弱点補強の割合 */
  弱点補強?: number;
  /** 本番形式演習の割合 */
  本番形式演習?: number;
  /** 弱点の最終補強の割合 */
  弱点の最終補強?: number;
  /** 暗記科目の最終確認の割合 */
  暗記科目の最終確認?: number;
}

export interface PhaseConfig {
  name: PhaseName;
  /** 残り日数による条件（説明用） */
  condition: string;
  /** 残り日数の下限（この日数以上でこのフェーズ） */
  minDaysLeft: number;
  /** 残り日数の上限（この日数未満で次のフェーズ） */
  maxDaysLeft: number;
  description: string;
  timeAllocation: PhaseTimeAllocation;
  rules: string[];
}

/**
 * フェーズ判定ルール（試験日からの逆算）
 * - 基礎期: 残り120日以上
 * - 実践期: 残り60〜119日
 * - 直前期: 残り30日以内
 */
export const PHASE_CONFIGS: PhaseConfig[] = [
  {
    name: '基礎期',
    condition: '残り120日以上',
    minDaysLeft: 120,
    maxDaysLeft: Infinity,
    description: '教科書レベルの完全理解と基礎知識の定着',
    timeAllocation: {
      基礎固め: 0.6,
      演習: 0.25,
      復習: 0.15,
    },
    rules: [
      '暗記科目は忘却曲線スケジュールを最優先で配置',
      '思考型科目は「理解→演習→確認」の3ステップで',
      '1日の新規学習範囲は狭く、復習を厚めに',
    ],
  },
  {
    name: '実践期',
    condition: '残り60〜119日',
    minDaysLeft: 60,
    maxDaysLeft: 120,
    description: '共テ形式への対応力を鍛える',
    timeAllocation: {
      基礎固め: 0.2,
      共テ形式演習: 0.5,
      復習: 0.2,
      弱点補強: 0.1,
    },
    rules: [
      '共テ過去問・予想問題を週1回は全科目通しで解く',
      '時間を測って解く練習を必ず含める',
      '英語は速読トレーニング（WPM計測）を毎日実施',
      '情報Ⅰのプログラミング演習を週2-3回組み込む',
    ],
  },
  {
    name: '直前期',
    condition: '残り30日以内',
    minDaysLeft: 0,
    maxDaysLeft: 30,
    description: '得点力の最大化と本番シミュレーション',
    timeAllocation: {
      本番形式演習: 0.5,
      弱点の最終補強: 0.25,
      暗記科目の最終確認: 0.25,
    },
    rules: [
      '2週間前：本番と同じ時間割で全教科を通しで解く（仮本番）を実施',
      '1週間前：暗記科目の最終確認に比重を移す',
      '直前3日：軽めの確認のみ。新しいことはやらない',
      '睡眠リズムを本番に合わせる（6:00起床に固定）',
    ],
  },
];

/** 残り日数からフェーズを判定 */
export function getPhaseByDaysLeft(daysLeft: number): PhaseConfig {
  const phase = PHASE_CONFIGS.find(
    (p) => daysLeft >= p.minDaysLeft && daysLeft < p.maxDaysLeft
  );
  return phase ?? PHASE_CONFIGS[PHASE_CONFIGS.length - 1];
}
