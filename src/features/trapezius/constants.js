// 首肩ボリューム特徴 - 定数定義
// ※医学的根拠はなく、あくまでエンターテインメント目的

// ランキング閾値
export const RANK_THRESHOLDS = {
  S: 80,
  A: 60,
  B: 40,
  C: 20,
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

// MediaPipe Face Mesh 肩・首関連ランドマーク
// Face Meshは顔のみなので、顎・耳から肩位置を推定
export const LANDMARKS = {
  // 顎のライン
  CHIN: 152,
  JAW_LEFT: 172,
  JAW_RIGHT: 397,
  JAW_ANGLE_LEFT: 136,
  JAW_ANGLE_RIGHT: 365,

  // 耳（肩の上端推定に使用）
  LEFT_EAR: 234,
  RIGHT_EAR: 454,

  // 顔の輪郭下部（首の付け根推定）
  FACE_BOTTOM_LEFT: 177,
  FACE_BOTTOM_RIGHT: 401,

  // 顔の幅（基準用）
  LEFT_CHEEK: 234,
  RIGHT_CHEEK: 454,
}

// 高スコア時のコメント
export const HIGH_SCORE_COMMENTS = [
  '首から肩が分厚い',
  '構えが重そう',
  '首スカウター的に重量級',
  '肩周りにボリューム感',
  '安定感のある構え',
]

// コメント表示の閾値
export const COMMENT_THRESHOLD = 70
