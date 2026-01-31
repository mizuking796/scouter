// 首肩の盛り上がり面積
// 首〜肩の輪郭が作る面積を推定
// ※医学的根拠はなく、あくまでエンターテインメント目的

import { LANDMARKS, normalizeScore } from './constants'

/**
 * 首肩の盛り上がり面積を計算
 * @param {Array} landmarks - 468個のランドマーク
 * @param {Object} baseData - キャリブレーション時のデータ
 * @returns {Object} - { score, area, visible }
 */
export function calculateShoulderArea(landmarks, baseData) {
  if (!landmarks || landmarks.length < 468) {
    return { score: 0, area: 0, visible: false }
  }

  // 首肩エリアのポイントを取得
  const leftEar = landmarks[LANDMARKS.LEFT_EAR]
  const rightEar = landmarks[LANDMARKS.RIGHT_EAR]
  const jawLeft = landmarks[LANDMARKS.JAW_ANGLE_LEFT]
  const jawRight = landmarks[LANDMARKS.JAW_ANGLE_RIGHT]
  const chin = landmarks[LANDMARKS.CHIN]

  // 首〜肩の輪郭を形成するポイント
  // 左耳 → 左顎角 → 顎 → 右顎角 → 右耳 → (想定肩ライン)
  const points = [
    leftEar,
    jawLeft,
    chin,
    jawRight,
    rightEar,
    // 肩の位置を推定（耳より外側・下側）
    { x: rightEar.x + 0.05, y: rightEar.y + 0.08 },
    { x: leftEar.x - 0.05, y: leftEar.y + 0.08 },
  ]

  // 面積を計算（Shoelace formula）
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    area += points[i].x * points[j].y
    area -= points[j].x * points[i].y
  }
  area = Math.abs(area) / 2

  // 顔面積で正規化
  const faceArea = calculateFaceArea(landmarks)
  const areaRatio = faceArea > 0 ? area / faceArea : 0

  // キャリブレーションデータとの比較
  let score = 50
  if (baseData?.shoulderArea) {
    const baseRatio = baseData.shoulderArea.ratio || 0.5
    const relativeRatio = areaRatio / baseRatio

    // 基準より大きいほど高スコア（0.85〜1.3の範囲を0-100に）
    score = normalizeScore(relativeRatio, 0.85, 1.25)
  } else {
    // キャリブレーションデータなし
    score = normalizeScore(areaRatio, 0.3, 0.7)
  }

  return {
    score,
    area,
    ratio: areaRatio,
    visible: true
  }
}

/**
 * 顔の面積を計算（正規化用）
 */
function calculateFaceArea(landmarks) {
  const forehead = landmarks[10]  // FOREHEAD
  const chin = landmarks[152]     // CHIN
  const leftCheek = landmarks[234]
  const rightCheek = landmarks[454]

  const width = Math.abs(rightCheek.x - leftCheek.x)
  const height = Math.abs(chin.y - forehead.y)

  return width * height
}
