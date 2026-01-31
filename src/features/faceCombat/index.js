// 闘争的フェイス特徴 - メインエクスポート
// この機能は首スカウターに統合される副次的な観測機能
// ※医学的・科学的根拠はなく、エンターテインメント目的

import { calculateExpressionSuppression, resetExpressionHistory } from './expressionSuppression'
import { calculateGazeStability, resetGazeHistory } from './gazeStability'
import { calculateFWHR, resetFWHRHistory } from './fwhr'
import { calculateJawLine, resetJawHistory } from './jawLine'
import { calculateCheekbone, resetCheekboneHistory } from './cheekbone'
import { getRank } from './constants'

// 機能の有効/無効フラグ
// この値をfalseにすると機能全体が無効化される
export const FACE_COMBAT_ENABLED = true

/**
 * 全ての闘争的フェイス特徴を計算
 * @param {Array} landmarks - 468個のランドマーク
 * @returns {Object} - 各特徴のスコアと総合スコア
 */
export function calculateAllFaceCombatFeatures(landmarks) {
  if (!FACE_COMBAT_ENABLED) {
    return null
  }

  const expression = calculateExpressionSuppression(landmarks)
  const gaze = calculateGazeStability(landmarks)
  const fwhr = calculateFWHR(landmarks)
  const jaw = calculateJawLine(landmarks)
  const cheekbone = calculateCheekbone(landmarks)

  // 総合スコア（5つの平均）
  const totalScore = Math.round(
    (expression.score + gaze.score + fwhr.score + jaw.score + cheekbone.score) / 5
  )

  return {
    expression,
    gaze,
    fwhr,
    jaw,
    cheekbone,
    total: {
      score: totalScore,
      rank: getRank(totalScore)
    }
  }
}

/**
 * 全ての履歴をリセット
 */
export function resetAllFaceCombatHistory() {
  resetExpressionHistory()
  resetGazeHistory()
  resetFWHRHistory()
  resetJawHistory()
  resetCheekboneHistory()
}

/**
 * 特徴名の日本語ラベル
 */
export const FEATURE_LABELS = {
  expression: '表情抑制',
  gaze: '視線安定',
  fwhr: '顔幅比',
  jaw: '顎ライン',
  cheekbone: '頬骨'
}

/**
 * 特徴の説明（ツールチップ用）
 */
export const FEATURE_DESCRIPTIONS = {
  expression: '表情の変化が少ないほど高スコア',
  gaze: '視線のブレが少ないほど高スコア',
  fwhr: '顔の幅と高さの比率',
  jaw: '顎のラインの角度とシャープさ',
  cheekbone: '頬骨の突出度と位置'
}
