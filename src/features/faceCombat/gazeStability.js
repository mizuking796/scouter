// 視線安定特徴
// 視線のブレが少ないほど高スコア
// ※医学的根拠はなく、あくまでエンターテインメント目的

import { LANDMARKS, normalizeScore, getRank } from './constants'

// 履歴を保持（最大60フレーム = 約2秒）
const MAX_HISTORY = 60
let gazeHistory = []

/**
 * 視線安定度を計算
 * @param {Array} landmarks - 468個のランドマーク
 * @returns {Object} - { score, rank, details }
 */
export function calculateGazeStability(landmarks) {
  if (!landmarks || landmarks.length < 478) {
    // 虹彩ランドマークがない場合（refineLandmarks: falseの場合）
    return { score: 50, rank: 'B', details: { message: '虹彩検出不可' } }
  }

  // 虹彩の相対位置を計算
  const gazeData = extractGazeData(landmarks)

  // 履歴に追加
  gazeHistory.push(gazeData)
  if (gazeHistory.length > MAX_HISTORY) {
    gazeHistory.shift()
  }

  // 履歴が十分でない場合はデフォルト値
  if (gazeHistory.length < 10) {
    return { score: 50, rank: 'B', details: { message: '計測中...' } }
  }

  // 視線のブレを計算
  const stability = calculateStability(gazeHistory)

  // ブレが少ないほど高スコア（0.0〜0.05 → 100〜0）
  const rawScore = 100 - (stability * 2000)
  const score = Math.max(0, Math.min(100, Math.round(rawScore)))

  return {
    score,
    rank: getRank(score),
    details: {
      stability: stability.toFixed(4),
      leftIrisX: gazeData.leftIris.x.toFixed(3),
      leftIrisY: gazeData.leftIris.y.toFixed(3),
      rightIrisX: gazeData.rightIris.x.toFixed(3),
      rightIrisY: gazeData.rightIris.y.toFixed(3)
    }
  }
}

/**
 * 視線データを抽出（虹彩の相対位置）
 */
function extractGazeData(landmarks) {
  // 左目の虹彩位置（目の中心からの相対位置）
  const leftEyeCenter = {
    x: (landmarks[LANDMARKS.LEFT_EYE_INNER].x + landmarks[LANDMARKS.LEFT_EYE_OUTER].x) / 2,
    y: (landmarks[LANDMARKS.LEFT_EYE_TOP].y + landmarks[LANDMARKS.LEFT_EYE_BOTTOM].y) / 2
  }
  const leftIris = landmarks[LANDMARKS.LEFT_IRIS_CENTER]
  const leftRelative = {
    x: leftIris.x - leftEyeCenter.x,
    y: leftIris.y - leftEyeCenter.y
  }

  // 右目の虹彩位置（目の中心からの相対位置）
  const rightEyeCenter = {
    x: (landmarks[LANDMARKS.RIGHT_EYE_INNER].x + landmarks[LANDMARKS.RIGHT_EYE_OUTER].x) / 2,
    y: (landmarks[LANDMARKS.RIGHT_EYE_TOP].y + landmarks[LANDMARKS.RIGHT_EYE_BOTTOM].y) / 2
  }
  const rightIris = landmarks[LANDMARKS.RIGHT_IRIS_CENTER]
  const rightRelative = {
    x: rightIris.x - rightEyeCenter.x,
    y: rightIris.y - rightEyeCenter.y
  }

  return {
    leftIris: leftRelative,
    rightIris: rightRelative,
    timestamp: Date.now()
  }
}

/**
 * 視線の安定度を計算（標準偏差ベース）
 */
function calculateStability(history) {
  if (history.length < 2) return 0

  // 左右の虹彩のX, Y座標それぞれの変動を計算
  const features = ['leftIris.x', 'leftIris.y', 'rightIris.x', 'rightIris.y']
  let totalVariation = 0

  for (const feature of features) {
    const [obj, prop] = feature.split('.')
    const values = history.map(h => h[obj][prop])
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    totalVariation += Math.sqrt(variance)
  }

  return totalVariation / features.length
}

/**
 * 履歴をリセット
 */
export function resetGazeHistory() {
  gazeHistory = []
}
