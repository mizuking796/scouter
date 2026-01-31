// 表情抑制特徴
// 眉・目・口の動きが少ないほど高スコア
// ※医学的根拠はなく、あくまでエンターテインメント目的

import { LANDMARKS, normalizeScore, getRank } from './constants'

// 履歴を保持（最大60フレーム = 約2秒）
const MAX_HISTORY = 60
let expressionHistory = []

/**
 * 表情の変化量を計算
 * @param {Array} landmarks - 468個のランドマーク
 * @returns {Object} - { score, rank, details }
 */
export function calculateExpressionSuppression(landmarks) {
  if (!landmarks || landmarks.length < 468) {
    return { score: 50, rank: 'B', details: {} }
  }

  // 現在の表情特徴を抽出
  const currentFeatures = extractExpressionFeatures(landmarks)

  // 履歴に追加
  expressionHistory.push(currentFeatures)
  if (expressionHistory.length > MAX_HISTORY) {
    expressionHistory.shift()
  }

  // 履歴が十分でない場合はデフォルト値
  if (expressionHistory.length < 10) {
    return { score: 50, rank: 'B', details: { message: '計測中...' } }
  }

  // 変動量を計算
  const variation = calculateVariation(expressionHistory)

  // 変動が少ないほど高スコア（0.0〜0.1 → 100〜0）
  // 小さい変動 = 表情抑制 = 高スコア
  const rawScore = 100 - (variation * 1000)
  const score = Math.max(0, Math.min(100, Math.round(rawScore)))

  return {
    score,
    rank: getRank(score),
    details: {
      variation: variation.toFixed(4),
      eyebrowMovement: currentFeatures.eyebrowHeight.toFixed(3),
      mouthOpenness: currentFeatures.mouthOpenness.toFixed(3)
    }
  }
}

/**
 * 表情特徴を抽出
 */
function extractExpressionFeatures(landmarks) {
  // 眉の高さ（目との相対位置）
  const leftEyebrowHeight = landmarks[LANDMARKS.LEFT_EYEBROW_INNER].y - landmarks[LANDMARKS.LEFT_EYE_TOP].y
  const rightEyebrowHeight = landmarks[LANDMARKS.RIGHT_EYEBROW_INNER].y - landmarks[LANDMARKS.RIGHT_EYE_TOP].y
  const eyebrowHeight = (leftEyebrowHeight + rightEyebrowHeight) / 2

  // 目の開き具合
  const leftEyeOpen = Math.abs(landmarks[LANDMARKS.LEFT_EYE_TOP].y - landmarks[LANDMARKS.LEFT_EYE_BOTTOM].y)
  const rightEyeOpen = Math.abs(landmarks[LANDMARKS.RIGHT_EYE_TOP].y - landmarks[LANDMARKS.RIGHT_EYE_BOTTOM].y)
  const eyeOpenness = (leftEyeOpen + rightEyeOpen) / 2

  // 口の開き具合
  const mouthOpenness = Math.abs(landmarks[LANDMARKS.MOUTH_TOP].y - landmarks[LANDMARKS.MOUTH_BOTTOM].y)

  // 口角の位置
  const mouthWidth = Math.abs(landmarks[LANDMARKS.MOUTH_RIGHT].x - landmarks[LANDMARKS.MOUTH_LEFT].x)

  return {
    eyebrowHeight,
    eyeOpenness,
    mouthOpenness,
    mouthWidth
  }
}

/**
 * 履歴から変動量を計算
 */
function calculateVariation(history) {
  if (history.length < 2) return 0

  let totalVariation = 0
  const features = ['eyebrowHeight', 'eyeOpenness', 'mouthOpenness', 'mouthWidth']

  for (const feature of features) {
    const values = history.map(h => h[feature])
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    totalVariation += Math.sqrt(variance)
  }

  return totalVariation / features.length
}

/**
 * 履歴をリセット
 */
export function resetExpressionHistory() {
  expressionHistory = []
}
