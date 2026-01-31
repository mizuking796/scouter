// 輪郭の連続性の破れ
// 耳輪郭の滑らかさを評価（不連続な部分が多いほど高スコア）
// ※医学的根拠はなく、あくまでエンターテインメント目的

import { LEFT_EAR_LANDMARKS, RIGHT_EAR_LANDMARKS, normalizeScore } from './constants'

/**
 * 輪郭の連続性の破れを計算
 * @param {Array} landmarks - 468個のランドマーク
 * @returns {Object} - { left, right, average }
 */
export function calculateEarContinuity(landmarks) {
  if (!landmarks || landmarks.length < 468) {
    return { left: 50, right: 50, average: 50 }
  }

  const leftScore = calculateContinuityBreak(landmarks, LEFT_EAR_LANDMARKS.CONTOUR)
  const rightScore = calculateContinuityBreak(landmarks, RIGHT_EAR_LANDMARKS.CONTOUR)

  return {
    left: leftScore,
    right: rightScore,
    average: Math.round((leftScore + rightScore) / 2)
  }
}

/**
 * 輪郭の連続性の破れを計算
 * 連続する点間の距離のばらつきを測定
 */
function calculateContinuityBreak(landmarks, contourIndices) {
  if (contourIndices.length < 3) return 50

  const points = contourIndices.map(idx => landmarks[idx])
  const distances = []

  // 連続する点間の距離を計算
  for (let i = 0; i < points.length - 1; i++) {
    const dist = Math.sqrt(
      Math.pow(points[i + 1].x - points[i].x, 2) +
      Math.pow(points[i + 1].y - points[i].y, 2)
    )
    distances.push(dist)
  }

  if (distances.length === 0) return 50

  // 距離の変化率を計算（急激な変化 = 連続性の破れ）
  const changes = []
  for (let i = 1; i < distances.length; i++) {
    const change = Math.abs(distances[i] - distances[i - 1])
    const avgDist = (distances[i] + distances[i - 1]) / 2
    if (avgDist > 0) {
      changes.push(change / avgDist)
    }
  }

  if (changes.length === 0) return 50

  // 変化率の平均と最大値を組み合わせ
  const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length
  const maxChange = Math.max(...changes)

  // 複合スコア（平均と最大の重み付け）
  const combinedScore = avgChange * 0.6 + maxChange * 0.4

  // 0.1〜0.8の範囲を0-100にマッピング
  return normalizeScore(combinedScore, 0.05, 0.5)
}
