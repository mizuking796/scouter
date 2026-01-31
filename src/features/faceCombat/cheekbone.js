// 頬骨特徴
// 頬骨の突出度と位置を評価
// ※医学的根拠はなく、あくまでエンターテインメント目的

import { LANDMARKS, normalizeScore, getRank } from './constants'

// 履歴を保持して平均化
const MAX_HISTORY = 30
let cheekboneHistory = []

/**
 * 頬骨特徴を計算
 * @param {Array} landmarks - 468個のランドマーク
 * @param {number} aspectRatio - キャンバスのアスペクト比（未使用だが一貫性のため受け取る）
 * @returns {Object} - { score, rank, details }
 */
export function calculateCheekbone(landmarks, aspectRatio = 4/3) {
  if (!landmarks || landmarks.length < 468) {
    return { score: 50, rank: 'B', details: {} }
  }

  // 頬骨特徴を抽出
  const cheekboneFeatures = extractCheekboneFeatures(landmarks)

  // 履歴に追加
  cheekboneHistory.push(cheekboneFeatures)
  if (cheekboneHistory.length > MAX_HISTORY) {
    cheekboneHistory.shift()
  }

  // 平均値を計算
  const avgProminence = cheekboneHistory.reduce((sum, c) => sum + c.prominence, 0) / cheekboneHistory.length
  const avgPosition = cheekboneHistory.reduce((sum, c) => sum + c.position, 0) / cheekboneHistory.length

  // スコア計算
  // 突出度: 高いほど良い（0.02〜0.08 → 0〜100）
  const prominenceScore = normalizeScore(avgProminence, 0.02, 0.08)

  // 位置: 高い位置ほど良い（0.3〜0.5 → 0〜100）
  const positionScore = normalizeScore(1 - avgPosition, 0.5, 0.7) // Y座標なので反転

  // 総合スコア
  const score = Math.round((prominenceScore * 0.7 + positionScore * 0.3))
  const finalScore = Math.max(0, Math.min(100, score))

  return {
    score: finalScore,
    rank: getRank(finalScore),
    details: {
      prominence: avgProminence.toFixed(4),
      position: avgPosition.toFixed(3)
    }
  }
}

/**
 * 頬骨特徴を抽出
 */
function extractCheekboneFeatures(landmarks) {
  // 頬骨の位置
  const leftZygo = landmarks[LANDMARKS.ZYGOMATIC_LEFT]
  const rightZygo = landmarks[LANDMARKS.ZYGOMATIC_RIGHT]

  // 頬骨の幅
  const zygoWidth = Math.abs(rightZygo.x - leftZygo.x)

  // 顎幅
  const jawLeft = landmarks[LANDMARKS.JAW_LEFT]
  const jawRight = landmarks[LANDMARKS.JAW_RIGHT]
  const jawWidth = Math.abs(jawRight.x - jawLeft.x)

  // 頬の位置（頬骨と顎の間）
  const leftCheek = landmarks[LANDMARKS.LEFT_CHEEK]
  const rightCheek = landmarks[LANDMARKS.RIGHT_CHEEK]
  const cheekWidth = Math.abs(rightCheek.x - leftCheek.x)

  // 突出度 = 頬骨幅が顎幅と頬幅の平均よりどれだけ大きいか
  const avgLowerFaceWidth = (jawWidth + cheekWidth) / 2
  const prominence = (zygoWidth - avgLowerFaceWidth)

  // 頬骨の高さ位置（顔全体における相対位置）
  const forehead = landmarks[LANDMARKS.FOREHEAD]
  const chin = landmarks[LANDMARKS.CHIN]
  const faceHeight = Math.abs(chin.y - forehead.y)

  const zygoY = (leftZygo.y + rightZygo.y) / 2
  const position = faceHeight > 0 ? (zygoY - forehead.y) / faceHeight : 0.4

  return {
    prominence,
    position,
    zygoWidth,
    jawWidth
  }
}

/**
 * 履歴をリセット
 */
export function resetCheekboneHistory() {
  cheekboneHistory = []
}
