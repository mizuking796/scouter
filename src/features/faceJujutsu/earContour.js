// 耳輪郭の凹凸度
// 輪郭曲率のばらつきを計算
// ※医学的根拠はなく、あくまでエンターテインメント目的

import { LEFT_EAR_LANDMARKS, RIGHT_EAR_LANDMARKS, normalizeScore } from './constants'

/**
 * 耳の輪郭凹凸度を計算
 * @param {Array} landmarks - 468個のランドマーク
 * @returns {Object} - { left, right, average }
 */
export function calculateEarContour(landmarks) {
  if (!landmarks || landmarks.length < 468) {
    return { left: 50, right: 50, average: 50 }
  }

  const leftScore = calculateContourRoughness(landmarks, LEFT_EAR_LANDMARKS.CONTOUR)
  const rightScore = calculateContourRoughness(landmarks, RIGHT_EAR_LANDMARKS.CONTOUR)

  return {
    left: leftScore,
    right: rightScore,
    average: Math.round((leftScore + rightScore) / 2)
  }
}

/**
 * 輪郭の凹凸度を計算
 * 連続する3点間の角度変化のばらつきを測定
 */
function calculateContourRoughness(landmarks, contourIndices) {
  if (contourIndices.length < 3) return 50

  const points = contourIndices.map(idx => landmarks[idx])
  const angles = []

  // 連続する3点間の角度を計算
  for (let i = 1; i < points.length - 1; i++) {
    const p1 = points[i - 1]
    const p2 = points[i]
    const p3 = points[i + 1]

    const angle = calculateAngle(p1, p2, p3)
    angles.push(angle)
  }

  if (angles.length === 0) return 50

  // 角度の標準偏差を計算（凹凸度の指標）
  const mean = angles.reduce((a, b) => a + b, 0) / angles.length
  const variance = angles.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / angles.length
  const stdDev = Math.sqrt(variance)

  // 標準偏差を0-100にマッピング
  // 標準偏差が大きいほど凹凸が激しい
  // 0.1〜0.5ラジアンの範囲を想定
  return normalizeScore(stdDev, 0.05, 0.4)
}

/**
 * 3点間の角度を計算（ラジアン）
 */
function calculateAngle(p1, p2, p3) {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y }
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y }

  const dot = v1.x * v2.x + v1.y * v2.y
  const cross = v1.x * v2.y - v1.y * v2.x

  return Math.abs(Math.atan2(cross, dot))
}
