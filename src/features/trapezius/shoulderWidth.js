// 首肩の幅
// 首付け根〜肩ラインの横幅を推定
// ※医学的根拠はなく、あくまでエンターテインメント目的

import { LANDMARKS, normalizeScore } from './constants'

/**
 * 首肩の幅を計算
 * @param {Array} landmarks - 468個のランドマーク
 * @param {Object} baseData - キャリブレーション時のデータ
 * @returns {Object} - { score, width, ratio }
 */
export function calculateShoulderWidth(landmarks, baseData) {
  if (!landmarks || landmarks.length < 468) {
    return { score: 0, width: 0, ratio: 0, visible: false }
  }

  // 耳の位置から肩幅を推定
  const leftEar = landmarks[LANDMARKS.LEFT_EAR]
  const rightEar = landmarks[LANDMARKS.RIGHT_EAR]

  // 顎の位置
  const jawLeft = landmarks[LANDMARKS.JAW_ANGLE_LEFT]
  const jawRight = landmarks[LANDMARKS.JAW_ANGLE_RIGHT]

  // 耳から下方向に延長して肩の位置を推定
  // 耳の間隔 + 顎幅から首肩の幅を推定
  const earWidth = Math.abs(rightEar.x - leftEar.x)
  const jawWidth = Math.abs(jawRight.x - jawLeft.x)

  // 首肩の推定幅（耳幅より広い）
  const estimatedShoulderWidth = earWidth * 1.3 + jawWidth * 0.2

  // 顔幅との比率
  const faceWidth = Math.abs(landmarks[LANDMARKS.RIGHT_CHEEK].x - landmarks[LANDMARKS.LEFT_CHEEK].x)
  const widthRatio = faceWidth > 0 ? estimatedShoulderWidth / faceWidth : 1

  // キャリブレーションデータとの比較
  let score = 50
  if (baseData?.shoulderWidth) {
    const baseRatio = baseData.shoulderWidth.ratio || 1
    const relativeRatio = widthRatio / baseRatio

    // 基準より広いほど高スコア（0.9〜1.2の範囲を0-100に）
    score = normalizeScore(relativeRatio, 0.9, 1.15)
  } else {
    // キャリブレーションデータなし：比率そのものを使用
    score = normalizeScore(widthRatio, 1.2, 1.6)
  }

  return {
    score,
    width: estimatedShoulderWidth,
    ratio: widthRatio,
    visible: true
  }
}
