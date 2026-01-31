// 柔術フェイス特徴 - メインエクスポート
// 耳まわりの形状から、組み技寄りの雰囲気を可視化
// ※医学的根拠はなく、あくまでエンターテインメント目的

import { calculateEarContour } from './earContour'
import { calculateEarAsymmetry } from './earAsymmetry'
import { calculateEarThicknessProxy } from './earThicknessProxy'
import { calculateEarContinuity } from './earContinuity'
import { getRank, HIGH_SCORE_COMMENTS, COMMENT_THRESHOLD } from './constants'

// 機能の有効/無効フラグ
// この値をfalseにすると機能全体が無効化される
export const FACE_JUJUTSU_ENABLED = true

/**
 * 柔術フェイス特徴を計算
 * @param {Array} landmarks - 468個のランドマーク
 * @param {Array} baseLandmarks - キャリブレーション時のランドマーク（オプション）
 * @returns {Object} - スコアと詳細
 */
export function calculateJujutsuFeatures(landmarks, baseLandmarks = null) {
  if (!FACE_JUJUTSU_ENABLED) {
    return null
  }

  if (!landmarks || landmarks.length < 468) {
    return {
      score: 50,
      rank: 'B',
      contour: { left: 50, right: 50, average: 50 },
      asymmetry: { score: 50 },
      thickness: { left: 50, right: 50, average: 50 },
      continuity: { left: 50, right: 50, average: 50 },
      comment: null,
      landmarks
    }
  }

  // 各指標を計算
  const contour = calculateEarContour(landmarks)           // 耳輪郭の不規則さ
  const asymmetry = calculateEarAsymmetry(landmarks)       // 左右の非対称
  const thickness = calculateEarThicknessProxy(landmarks, baseLandmarks)  // 局所的な膨らみ
  const continuity = calculateEarContinuity(landmarks)     // 輪郭の連続性の破れ

  // 総合スコア（4つの平均）
  const score = Math.round(
    (contour.average + asymmetry.score + thickness.average + continuity.average) / 4
  )

  // コメント（高スコア時のみ）
  let comment = null
  if (score >= COMMENT_THRESHOLD) {
    const randomIndex = Math.floor(Math.random() * HIGH_SCORE_COMMENTS.length)
    comment = HIGH_SCORE_COMMENTS[randomIndex]
  }

  return {
    score,
    rank: getRank(score),
    contour,
    asymmetry,
    thickness,
    continuity,
    comment,
    landmarks
  }
}

/**
 * 戦闘力への微影響を計算
 * 条件：柔術スコア70以上 かつ 首指標が高い場合のみ
 * @param {number} jujutsuScore - 柔術フェイス特徴スコア
 * @param {Object} neckScores - 首の各スコア
 * @returns {number} - 戦闘力への補正係数（1.0〜1.03）
 */
export function calculateJujutsuBonus(jujutsuScore, neckScores) {
  if (!FACE_JUJUTSU_ENABLED) return 1.0

  // 柔術スコアが70未満なら補正なし
  if (jujutsuScore < 70) return 1.0

  // 首指標の平均
  const {
    rightSmoothness = 0,
    leftSmoothness = 0,
    staticNeckIndex = 0,
    dynamicNeckIndex = 0
  } = neckScores

  const neckAverage = (rightSmoothness + leftSmoothness + staticNeckIndex + dynamicNeckIndex) / 4

  // 首指標が60以上なら補正適用
  if (neckAverage >= 60) {
    // 2〜3%の補正
    const bonusRate = 0.02 + (jujutsuScore - 70) / 30 * 0.01
    return 1 + Math.min(bonusRate, 0.03)
  }

  return 1.0
}

// 定数のエクスポート
export { COMMENT_THRESHOLD, HIGH_SCORE_COMMENTS }
