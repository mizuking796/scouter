// 戦闘力変換レイヤー（表示用のみ）
// 内部スコア・六角形・競技適性には影響しない

import {
  ENABLE_COMBAT_EXP,
  COMBAT_A,
  COMBAT_B
} from './constants'

/**
 * 内部スコアから表示用戦闘力を算出
 *
 * 指数関数スケーリング:
 * combatPower = A * exp(B * baseScore)
 *
 * 例（B=0.13）:
 * - base 10 → 4
 * - base 30 → 50
 * - base 50 → 665
 * - base 70 → 8,800
 * - base 90 → 116,000
 * - base 100 → 3億超
 *
 * @param {number} baseScore - 内部スコア（0-100）
 * @returns {number} - 表示用戦闘力
 */
export function calculateDisplayCombatPower(baseScore) {
  if (!ENABLE_COMBAT_EXP) {
    // 旧方式にフォールバック（既存のcalculateCombatPowerと同等）
    const power = Math.pow(baseScore / 100, 3) * 500000000
    return Math.round(power)
  }

  // 指数関数スケーリング
  const power = COMBAT_A * Math.exp(COMBAT_B * baseScore)

  return Math.round(power)
}

/**
 * 内部スコアを計算（6軸の平均）
 * これは変更しない - 既存ロジックと同等
 *
 * @param {Object} scores - 各指標のスコア
 * @returns {number} - 内部スコア（0-100）
 */
export function calculateBaseScore(scores) {
  const {
    rightSmoothness = 0,
    leftSmoothness = 0,
    upSmoothness = 0,
    staticNeckIndex = 0,
    dynamicNeckIndex = 0,
    shoulderVolume = 0
  } = scores

  const average = (
    rightSmoothness +
    leftSmoothness +
    upSmoothness +
    staticNeckIndex +
    dynamicNeckIndex +
    shoulderVolume
  ) / 6

  return average
}
