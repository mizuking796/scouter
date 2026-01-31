// 顎ライン特徴
// 顎のラインの角度と明確さを評価
// ※医学的根拠はなく、あくまでエンターテインメント目的

import { LANDMARKS, normalizeScore, getRank } from './constants'

// 履歴を保持して平均化
const MAX_HISTORY = 30
let jawHistory = []

/**
 * 顎ライン特徴を計算
 * @param {Array} landmarks - 468個のランドマーク
 * @returns {Object} - { score, rank, details }
 */
export function calculateJawLine(landmarks) {
  if (!landmarks || landmarks.length < 468) {
    return { score: 50, rank: 'B', details: {} }
  }

  // 顎ライン特徴を抽出
  const jawFeatures = extractJawFeatures(landmarks)

  // 履歴に追加
  jawHistory.push(jawFeatures)
  if (jawHistory.length > MAX_HISTORY) {
    jawHistory.shift()
  }

  // 平均値を計算
  const avgAngle = jawHistory.reduce((sum, j) => sum + j.angle, 0) / jawHistory.length
  const avgSharpness = jawHistory.reduce((sum, j) => sum + j.sharpness, 0) / jawHistory.length

  // スコア計算
  // 角度: 90〜130度の範囲で、115度付近が最高（シャープな顎）
  const angleScore = 100 - Math.abs(avgAngle - 115) * 3

  // シャープネス: 高いほど良い（0.5〜1.0 → 0〜100）
  const sharpnessScore = normalizeScore(avgSharpness, 0.5, 1.0)

  // 総合スコア
  const score = Math.round((angleScore * 0.6 + sharpnessScore * 0.4))
  const finalScore = Math.max(0, Math.min(100, score))

  return {
    score: finalScore,
    rank: getRank(finalScore),
    details: {
      jawAngle: avgAngle.toFixed(1),
      sharpness: avgSharpness.toFixed(3)
    }
  }
}

/**
 * 顎ライン特徴を抽出
 */
function extractJawFeatures(landmarks) {
  // 顎の角度を計算（左顎角 - 顎先 - 右顎角のなす角）
  const jawLeft = landmarks[LANDMARKS.JAW_ANGLE_LEFT]
  const jawRight = landmarks[LANDMARKS.JAW_ANGLE_RIGHT]
  const chin = landmarks[LANDMARKS.CHIN]

  // ベクトル計算
  const v1 = { x: jawLeft.x - chin.x, y: jawLeft.y - chin.y }
  const v2 = { x: jawRight.x - chin.x, y: jawRight.y - chin.y }

  // 内積と外積から角度を計算
  const dot = v1.x * v2.x + v1.y * v2.y
  const cross = Math.abs(v1.x * v2.y - v1.y * v2.x)
  const angle = Math.atan2(cross, dot) * (180 / Math.PI)

  // シャープネス（顎先から顎角への直線性）
  // 顎のラインが直線に近いほど高い
  const jawLineLeft = landmarks[LANDMARKS.JAW_LEFT]
  const jawLineRight = landmarks[LANDMARKS.JAW_RIGHT]

  // 顎のラインの幅と顎先の位置関係
  const jawWidth = Math.abs(jawLineRight.x - jawLineLeft.x)
  const chinDrop = chin.y - Math.min(jawLineLeft.y, jawLineRight.y)

  // シャープネス = 幅に対する垂直距離の比率
  const sharpness = jawWidth > 0 ? chinDrop / jawWidth : 0.7

  return {
    angle,
    sharpness
  }
}

/**
 * 履歴をリセット
 */
export function resetJawHistory() {
  jawHistory = []
}
