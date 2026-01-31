// 耳の厚みproxy（2D）
// 耳輪郭と顔側輪郭の距離から膨らみ感を推定
// ※医学的根拠はなく、あくまでエンターテインメント目的

import {
  LEFT_EAR_LANDMARKS,
  RIGHT_EAR_LANDMARKS,
  FACE_CONTOUR,
  normalizeScore
} from './constants'

/**
 * 耳の厚みproxyを計算
 * @param {Array} landmarks - 468個のランドマーク
 * @param {Array} baseLandmarks - キャリブレーション時のランドマーク（正面）
 * @returns {Object} - { left, right, average }
 */
export function calculateEarThicknessProxy(landmarks, baseLandmarks) {
  if (!landmarks || landmarks.length < 468) {
    return { left: 50, right: 50, average: 50 }
  }

  // 左耳の厚み
  const leftThickness = calculateSideThickness(
    landmarks,
    LEFT_EAR_LANDMARKS,
    FACE_CONTOUR.LEFT
  )

  // 右耳の厚み
  const rightThickness = calculateSideThickness(
    landmarks,
    RIGHT_EAR_LANDMARKS,
    FACE_CONTOUR.RIGHT
  )

  // キャリブレーションデータがある場合は差分も考慮
  let leftScore = leftThickness
  let rightScore = rightThickness

  if (baseLandmarks && baseLandmarks.length >= 468) {
    const baseLeftThickness = calculateSideThickness(
      baseLandmarks,
      LEFT_EAR_LANDMARKS,
      FACE_CONTOUR.LEFT
    )
    const baseRightThickness = calculateSideThickness(
      baseLandmarks,
      RIGHT_EAR_LANDMARKS,
      FACE_CONTOUR.RIGHT
    )

    // 差分が大きいほど膨らみ感がある（動的な変化）
    const leftDiff = Math.abs(leftThickness - baseLeftThickness)
    const rightDiff = Math.abs(rightThickness - baseRightThickness)

    // 元のスコアと差分を組み合わせ
    leftScore = Math.round(leftThickness * 0.7 + normalizeScore(leftDiff, 0, 30) * 0.3)
    rightScore = Math.round(rightThickness * 0.7 + normalizeScore(rightDiff, 0, 30) * 0.3)
  }

  return {
    left: leftScore,
    right: rightScore,
    average: Math.round((leftScore + rightScore) / 2)
  }
}

/**
 * 片側の耳の厚みを計算
 * 耳のランドマークと顔輪郭の平均距離
 */
function calculateSideThickness(landmarks, earLandmarks, faceContourIndices) {
  const earPoint = landmarks[earLandmarks.TRAGION]

  // 顔輪郭の各点との距離を計算
  const distances = faceContourIndices.map(idx => {
    const facePoint = landmarks[idx]
    return Math.sqrt(
      Math.pow(earPoint.x - facePoint.x, 2) +
      Math.pow(earPoint.y - facePoint.y, 2)
    )
  })

  // 最小距離（耳と顔の間の距離）
  const minDistance = Math.min(...distances)

  // 耳の輪郭点同士の距離（耳自体のサイズ）
  const earContour = earLandmarks.CONTOUR.map(idx => landmarks[idx])
  let earWidth = 0
  if (earContour.length >= 2) {
    const xs = earContour.map(p => p.x)
    earWidth = Math.max(...xs) - Math.min(...xs)
  }

  // 耳幅と顔との距離の比率
  // 耳が大きく、顔から離れているほど高スコア
  const ratio = earWidth > 0 ? minDistance / earWidth : 0.5

  // 0.3〜1.0の範囲を0-100にマッピング
  return normalizeScore(ratio, 0.2, 0.8)
}
