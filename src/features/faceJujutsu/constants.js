// 柔術フェイス特徴 - 定数定義
// ※医学的根拠はなく、あくまでエンターテインメント目的

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

// MediaPipe Face Mesh 耳関連ランドマークインデックス
// 左耳（画面右側、鏡像表示時）
export const LEFT_EAR_LANDMARKS = {
  // 耳の主要ポイント
  TRAGION: 234,  // 耳珠点
  // 耳周辺の輪郭ポイント
  CONTOUR: [234, 227, 137, 177, 215, 138, 135, 169, 170, 140, 171, 175],
  // 耳の上部
  TOP: 127,
  // 耳の下部（耳たぶ付近）
  BOTTOM: 234,
}

// 右耳（画面左側、鏡像表示時）
export const RIGHT_EAR_LANDMARKS = {
  TRAGION: 454,
  CONTOUR: [454, 447, 366, 401, 435, 367, 364, 394, 395, 369, 396, 400],
  TOP: 356,
  BOTTOM: 454,
}

// 顔の輪郭（耳の厚み計算用）
export const FACE_CONTOUR = {
  LEFT: [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152],
  RIGHT: [454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152],
}

// 高スコア時のコメント（ランダム選択）
export const HIGH_SCORE_COMMENTS = [
  '道場の匂いがします',
  '組み技寄りのオーラ',
  '耳が語っている',
  'マットの記憶を感じる',
  '畳の上の戦士感',
]

// コメント表示の閾値
export const COMMENT_THRESHOLD = 60
