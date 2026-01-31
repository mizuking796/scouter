// 闘争的フェイス特徴 - 定数定義

// ランキング閾値
export const RANK_THRESHOLDS = {
  S: 80,
  A: 60,
  B: 40,
  C: 20,
  // D: 0-19
}

// スコアからランクを取得
export function getRank(score) {
  if (score >= RANK_THRESHOLDS.S) return 'S'
  if (score >= RANK_THRESHOLDS.A) return 'A'
  if (score >= RANK_THRESHOLDS.B) return 'B'
  if (score >= RANK_THRESHOLDS.C) return 'C'
  return 'D'
}

// スコアを0-100に正規化
export function normalizeScore(value, min, max) {
  const clamped = Math.max(min, Math.min(max, value))
  return Math.round(((clamped - min) / (max - min)) * 100)
}

// MediaPipe Face Mesh ランドマークインデックス
export const LANDMARKS = {
  // 目
  LEFT_EYE_OUTER: 33,
  LEFT_EYE_INNER: 133,
  RIGHT_EYE_OUTER: 263,
  RIGHT_EYE_INNER: 362,
  LEFT_EYE_TOP: 159,
  LEFT_EYE_BOTTOM: 145,
  RIGHT_EYE_TOP: 386,
  RIGHT_EYE_BOTTOM: 374,
  LEFT_IRIS_CENTER: 468,
  RIGHT_IRIS_CENTER: 473,

  // 眉
  LEFT_EYEBROW_INNER: 107,
  LEFT_EYEBROW_OUTER: 46,
  RIGHT_EYEBROW_INNER: 336,
  RIGHT_EYEBROW_OUTER: 276,

  // 鼻
  NOSE_TIP: 1,
  NOSE_BRIDGE: 6,

  // 口
  MOUTH_LEFT: 61,
  MOUTH_RIGHT: 291,
  MOUTH_TOP: 13,
  MOUTH_BOTTOM: 14,
  UPPER_LIP_TOP: 0,
  LOWER_LIP_BOTTOM: 17,

  // 顔の輪郭
  FOREHEAD: 10,
  CHIN: 152,
  LEFT_CHEEK: 50,
  RIGHT_CHEEK: 280,
  LEFT_CHEEKBONE: 123,
  RIGHT_CHEEKBONE: 352,

  // 顎
  JAW_LEFT: 172,
  JAW_RIGHT: 397,
  JAW_ANGLE_LEFT: 136,
  JAW_ANGLE_RIGHT: 365,

  // 耳
  LEFT_EAR: 234,
  RIGHT_EAR: 454,

  // 頬骨の高さ推定用
  ZYGOMATIC_LEFT: 116,
  ZYGOMATIC_RIGHT: 345,
}
