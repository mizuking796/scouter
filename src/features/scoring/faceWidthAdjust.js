// スコア補正（表示用のみ）
// 内部スコア・六角形・競技適性には影響しない

import {
  ENABLE_FACE_WIDTH_GAMMA,
  STATIC_NECK_GAMMA,
  BALANCE_GAMMA
} from './constants'

/**
 * 静的ネック指数をガンマ補正する（表示用）
 * γ > 1 でスコアを抑える
 *
 * @param {number} rawScore - 元スコア（0-100）
 * @returns {number} - 補正後スコア（0-100）
 */
export function adjustStaticNeckScore(rawScore) {
  if (!ENABLE_FACE_WIDTH_GAMMA) {
    return rawScore
  }

  // 0-1 に正規化
  const normalized = rawScore / 100

  // ガンマ補正（γ > 1 で抑制）
  const adjusted = Math.pow(normalized, STATIC_NECK_GAMMA)

  // 0-100 に戻す
  return Math.round(adjusted * 100)
}

/**
 * 左右バランスをガンマ補正する（表示用）
 * γ > 1 でスコアを抑える
 *
 * @param {number} rawScore - 元スコア（0-100）
 * @returns {number} - 補正後スコア（0-100）
 */
export function adjustBalanceScore(rawScore) {
  if (!ENABLE_FACE_WIDTH_GAMMA) {
    return rawScore
  }

  // 0-1 に正規化
  const normalized = rawScore / 100

  // ガンマ補正（γ > 1 で抑制）
  const adjusted = Math.pow(normalized, BALANCE_GAMMA)

  // 0-100 に戻す
  return Math.round(adjusted * 100)
}
