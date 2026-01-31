// 首から肩への傾斜角
// なだらか（広い）か急峻（狭い）かを推定
// ※医学的根拠はなく、あくまでエンターテインメント目的

import { LANDMARKS, normalizeScore } from './constants'

/**
 * 首肩の傾斜角を計算
 * @param {Array} landmarks - 468個のランドマーク
 * @param {Object} baseData - キャリブレーション時のデータ
 * @returns {Object} - { score, angle, visible }
 */
export function calculateShoulderSlope(landmarks, baseData) {
  if (!landmarks || landmarks.length < 468) {
    return { score: 0, angle: 0, visible: false }
  }

  // 耳と顎から首〜肩のラインを推定
  const leftEar = landmarks[LANDMARKS.LEFT_EAR]
  const rightEar = landmarks[LANDMARKS.RIGHT_EAR]
  const jawLeft = landmarks[LANDMARKS.JAW_ANGLE_LEFT]
  const jawRight = landmarks[LANDMARKS.JAW_ANGLE_RIGHT]
  const chin = landmarks[LANDMARKS.CHIN]

  // 左側の傾斜：顎角から耳への角度
  const leftDx = leftEar.x - jawLeft.x
  const leftDy = leftEar.y - jawLeft.y
  const leftAngle = Math.atan2(leftDy, Math.abs(leftDx)) * (180 / Math.PI)

  // 右側の傾斜
  const rightDx = rightEar.x - jawRight.x
  const rightDy = rightEar.y - jawRight.y
  const rightAngle = Math.atan2(rightDy, Math.abs(rightDx)) * (180 / Math.PI)

  // 平均傾斜角（正の値：なだらか、負の値：急峻）
  const avgAngle = (Math.abs(leftAngle) + Math.abs(rightAngle)) / 2

  // キャリブレーションデータとの比較
  let score = 50
  if (baseData?.shoulderSlope) {
    const baseAngle = baseData.shoulderSlope.angle || 30
    const angleDiff = avgAngle - baseAngle

    // 傾斜がなだらか（角度が大きい）ほど高スコア
    // -10〜+15度の差を0-100に
    score = normalizeScore(angleDiff, -10, 15)
  } else {
    // キャリブレーションデータなし：角度そのものを使用
    // 20〜50度の範囲を想定
    score = normalizeScore(avgAngle, 15, 45)
  }

  return {
    score,
    angle: avgAngle,
    visible: true
  }
}
