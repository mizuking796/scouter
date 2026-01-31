// 首肩ボリューム特徴 - メインエクスポート
// 首から肩にかけてのボリューム感の傾向を数値化
// ※医学的根拠はなく、あくまでエンターテインメント目的

import { calculateShoulderWidth } from './shoulderWidth'
import { calculateShoulderSlope } from './shoulderSlope'
import { calculateShoulderArea } from './shoulderArea'
import { getRank, HIGH_SCORE_COMMENTS, COMMENT_THRESHOLD } from './constants'

// 機能の有効/無効フラグ
export const TRAPEZIUS_ENABLED = true

/**
 * 首肩ボリューム特徴を計算
 * @param {Array} landmarks - 468個のランドマーク
 * @param {Object} baseData - キャリブレーション時のデータ
 * @returns {Object} - スコアと詳細
 */
export function calculateTrapeziusFeatures(landmarks, baseData = null) {
  if (!TRAPEZIUS_ENABLED) {
    return null
  }

  if (!landmarks || landmarks.length < 468) {
    return {
      score: 0,
      rank: 'D',
      width: { score: 0, visible: false },
      slope: { score: 0, visible: false },
      area: { score: 0, visible: false },
      visible: false,
      comment: null
    }
  }

  // 各指標を計算
  const width = calculateShoulderWidth(landmarks, baseData)
  const slope = calculateShoulderSlope(landmarks, baseData)
  const area = calculateShoulderArea(landmarks, baseData)

  // 首・肩が見えているかチェック
  const visible = width.visible && slope.visible && area.visible

  if (!visible) {
    return {
      score: 0,
      rank: 'D',
      width,
      slope,
      area,
      visible: false,
      comment: null
    }
  }

  // 総合スコア（3つの平均）
  const score = Math.round((width.score + slope.score + area.score) / 3)

  // コメント（高スコア時のみ）
  let comment = null
  if (score >= COMMENT_THRESHOLD) {
    const randomIndex = Math.floor(Math.random() * HIGH_SCORE_COMMENTS.length)
    comment = HIGH_SCORE_COMMENTS[randomIndex]
  }

  return {
    score,
    rank: getRank(score),
    width,
    slope,
    area,
    visible: true,
    comment
  }
}

/**
 * キャリブレーション用データを抽出
 * @param {Array} landmarks - 468個のランドマーク
 * @returns {Object} - 基準データ
 */
export function extractTrapeziusBaseData(landmarks) {
  if (!landmarks || landmarks.length < 468) {
    return null
  }

  const width = calculateShoulderWidth(landmarks, null)
  const slope = calculateShoulderSlope(landmarks, null)
  const area = calculateShoulderArea(landmarks, null)

  return {
    shoulderWidth: { ratio: width.ratio },
    shoulderSlope: { angle: slope.angle },
    shoulderArea: { ratio: area.ratio }
  }
}

// 定数のエクスポート
export { COMMENT_THRESHOLD, HIGH_SCORE_COMMENTS }
