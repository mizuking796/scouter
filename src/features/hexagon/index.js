// 六角形（6競技適性）- メインエクスポート
// 固定ロジック（線形＋ファジィ補正）のみを使用
// 学習しない / クラスタリングしない / 重みを最適化しない

import { SPORTS, SPORT_NAMES, BOXING_NORM, MAX_FUZZY_BONUS, APTITUDE_COMMENTS } from './constants'

// 機能の有効/無効フラグ
export const HEXAGON_ENABLED = true

/**
 * 特徴量を抽出（各スコアを0-1に正規化）
 * @param {Object} params - 入力パラメータ
 * @returns {Object} - 正規化された特徴量
 */
function extractFeatures(params) {
  const {
    staticNeckIndex = 0,      // 0-100
    trapeziusData = null,     // { score, width, slope, area }
    jujutsuData = null,       // { score, asymmetry, ... }
    calibrationData = null    // { baseFaceData }
  } = params

  // 基本特徴（0-1に正規化）
  const NS_raw = staticNeckIndex / 100
  const NS_crop = NS_raw  // 同じ値を使用（cropped相当）

  // 首肩ボリューム（trapezius）
  const NV_raw = trapeziusData?.visible ? trapeziusData.score / 100 : 0
  const NV_crop = NV_raw

  // 体幹厚み（trapezius areaを使用）
  const TT_raw = trapeziusData?.visible && trapeziusData.area?.visible
    ? trapeziusData.area.score / 100 : 0
  const TT_crop = TT_raw

  // 肩幅/頭幅比（trapezius widthを使用）
  const SH_raw = trapeziusData?.visible && trapeziusData.width?.visible
    ? trapeziusData.width.score / 100 : 0
  const SH_crop = SH_raw

  // 柔術スコア（耳）
  const EJ_raw = jujutsuData ? jujutsuData.score / 100 : 0
  const EJ_crop = EJ_raw

  // 顔の非対称性（柔術データから）
  const FA_crop = jujutsuData?.asymmetry ? jujutsuData.asymmetry.score / 100 : 0

  // 首顎角度（calibrationデータから推定）
  let NJ_crop = 0
  if (calibrationData?.baseFaceData) {
    // 正規化された値を優先使用（デバイス間で一貫した結果）
    const normalizedJawWidth = calibrationData.baseFaceData.normalizedJawWidth
    const normalizedFaceHeight = calibrationData.baseFaceData.normalizedFaceHeight

    if (normalizedJawWidth && normalizedFaceHeight && normalizedFaceHeight > 0) {
      // 正規化された値を使用
      NJ_crop = Math.min(1, (normalizedJawWidth / normalizedFaceHeight) * 1.5)
    } else {
      // フォールバック: 従来のピクセル値を使用
      const { jawWidth, faceHeight } = calibrationData.baseFaceData
      if (faceHeight > 0) {
        NJ_crop = Math.min(1, (jawWidth / faceHeight) * 1.5)
      }
    }
  }

  return {
    NS_raw, NS_crop,
    NV_raw, NV_crop,
    TT_raw, TT_crop,
    SH_raw, SH_crop,
    EJ_raw, EJ_crop,
    FA_crop, NJ_crop
  }
}

/**
 * 線形スコアを計算（凍結版）
 * @param {Object} features - 抽出された特徴量
 * @returns {Object} - 各競技のrawスコア
 */
function computeLinearScores(features) {
  const {
    NS_raw, NS_crop,
    NV_raw, NV_crop,
    TT_raw, TT_crop,
    SH_raw, SH_crop,
    EJ_raw, EJ_crop,
    FA_crop, NJ_crop
  } = features

  // 柔道（judo）: rawのみ
  const score_judo = 0.45 * NV_raw + 0.35 * NS_raw + 0.20 * SH_raw

  // レスリング（wrestling）: rawのみ
  const score_wrestling = 0.35 * NV_raw + 0.30 * NS_raw + 0.20 * TT_raw + 0.15 * EJ_raw

  // 柔術（BJJ）: croppedのみ
  const score_bjj = 0.40 * EJ_crop + 0.25 * NS_crop + 0.20 * SH_crop + 0.15 * NV_crop

  // MMA: 混合（raw + cropped）
  const score_mma = 0.25 * NV_raw + 0.20 * NS_raw + 0.15 * TT_raw
                  + 0.20 * FA_crop + 0.20 * EJ_crop

  // ボクシング: croppedのみ ※マイナスあり
  const score_boxing = 0.35 * FA_crop + 0.25 * NJ_crop - 0.25 * NV_crop - 0.15 * TT_crop

  // キック／ムエタイ: 混合（raw + cropped）
  const score_kick_muay = 0.30 * NJ_crop + 0.30 * NS_raw + 0.20 * TT_raw + 0.20 * FA_crop

  return {
    judo: score_judo,
    wrestling: score_wrestling,
    bjj: score_bjj,
    mma: score_mma,
    boxing: score_boxing,
    kick_muay: score_kick_muay
  }
}

/**
 * スコアを0-100に正規化
 * @param {Object} rawScores - 線形スコア
 * @returns {Object} - 正規化されたスコア
 */
function normalizeScores(rawScores) {
  const normalized = {}

  for (const sport of SPORTS) {
    let norm
    if (sport === 'boxing') {
      // ボクシングは負を含むため特別扱い
      norm = (rawScores[sport] + BOXING_NORM.shift) / BOXING_NORM.scale
    } else {
      norm = rawScores[sport]
    }
    // 0-1にクリップして0-100に変換
    normalized[sport] = Math.round(Math.max(0, Math.min(1, norm)) * 100)
  }

  return normalized
}

// ============================================================
// ファジィ補正
// ============================================================

/**
 * High メンバーシップ関数（固定閾値版）
 * @param {number} x - 入力値（0-1）
 * @param {number} threshold - High開始閾値（デフォルト0.6）
 * @returns {number} - メンバーシップ度（0-1）
 */
function muHigh(x, threshold = 0.6) {
  if (x <= threshold) return 0
  if (x >= 1.0) return 1
  return (x - threshold) / (1 - threshold)
}

/**
 * High メンバーシップ関数（パーセンタイル版・柔道専用）
 * @param {number} x - 入力値
 * @param {number} p90 - 90thパーセンタイル
 * @param {number} xMax - 最大値
 * @returns {number} - メンバーシップ度（0-1）
 */
function muHighPercentile(x, p90, xMax) {
  if (xMax <= p90) {
    return x >= xMax ? 1 : 0
  }
  if (x <= p90) return 0
  if (x >= xMax) return 1
  return Math.min(1, Math.max(0, (x - p90) / (xMax - p90)))
}

/**
 * Medium メンバーシップ関数
 * @param {number} x - 入力値（0-1）
 * @returns {number} - メンバーシップ度（0-1）
 */
function muMedium(x) {
  if (x <= 0.3 || x >= 0.7) return 0
  if (x < 0.5) return (x - 0.3) / 0.2
  return (0.7 - x) / 0.2
}

/**
 * ファジィ補正を計算
 * @param {Object} features - 抽出された特徴量
 * @param {Object} thresholds - 柔道用パーセンタイル閾値（オプション）
 * @returns {Object} - 各競技のファジィボーナス
 */
function computeFuzzyBonus(features, thresholds = null) {
  const { NV_raw, NS_raw, EJ_raw, EJ_crop } = features
  const bonus = {}

  // ① 柔道（judo）: パーセンタイル方式
  // IF NV_raw is High AND NS_raw is High
  // 実ユーザーの場合、固定閾値を使用（p90=0.5, max=1.0として近似）
  const nv_p90 = thresholds?.nv_p90 ?? 0.5
  const nv_max = thresholds?.nv_max ?? 1.0
  const ns_p90 = thresholds?.ns_p90 ?? 0.5
  const ns_max = thresholds?.ns_max ?? 1.0

  const mu_nv_judo = muHighPercentile(NV_raw, nv_p90, nv_max)
  const mu_ns_judo = muHighPercentile(NS_raw, ns_p90, ns_max)
  bonus.judo = MAX_FUZZY_BONUS * Math.min(mu_nv_judo, mu_ns_judo)

  // ② レスリング（wrestling）: 合算
  // IF NV is High AND NS is High: +6
  // IF EJ is Medium or High: +4
  const mu_nv_wrestling = muHigh(NV_raw, 0.6)
  const mu_ns_wrestling = muHigh(NS_raw, 0.6)
  const wrestling_base = 6 * Math.min(mu_nv_wrestling, mu_ns_wrestling)
  const mu_ej_medium = muMedium(EJ_raw)
  const mu_ej_high = muHigh(EJ_raw, 0.6)
  const wrestling_ear = 4 * Math.max(mu_ej_medium, mu_ej_high)
  bonus.wrestling = Math.min(MAX_FUZZY_BONUS, wrestling_base + wrestling_ear)

  // ③ 柔術（bjj）: IF EJ_crop is High
  bonus.bjj = MAX_FUZZY_BONUS * muHigh(EJ_crop, 0.6)

  // 他の競技は補正なし
  bonus.boxing = 0
  bonus.mma = 0
  bonus.kick_muay = 0

  return bonus
}

/**
 * 最終スコアを計算（線形＋ファジィ補正）
 * @param {Object} linearScores - 線形スコア（0-100）
 * @param {Object} fuzzyBonus - ファジィボーナス
 * @returns {Object} - 最終スコア（0-100）
 */
function applyFuzzyBonus(linearScores, fuzzyBonus) {
  const final = {}
  for (const sport of SPORTS) {
    const linear = linearScores[sport] || 0
    const bonus = fuzzyBonus[sport] || 0
    final[sport] = Math.round(Math.max(0, Math.min(100, linear + bonus)))
  }
  return final
}

/**
 * 適性コメントを生成
 * @param {Object} scores - 最終スコア
 * @returns {string} - コメント
 */
function generateAptitudeComment(scores) {
  // 最高スコアの競技を特定
  let maxSport = 'boxing'
  let maxScore = 0
  for (const sport of SPORTS) {
    if (scores[sport] > maxScore) {
      maxScore = scores[sport]
      maxSport = sport
    }
  }

  // スコア差を確認
  const avgScore = SPORTS.reduce((sum, s) => sum + scores[s], 0) / SPORTS.length
  const variance = SPORTS.reduce((sum, s) => sum + Math.pow(scores[s] - avgScore, 2), 0) / SPORTS.length
  const stdDev = Math.sqrt(variance)

  // コメント選択
  if (stdDev < 5) {
    return APTITUDE_COMMENTS.balanced
  }

  if (maxScore < 30) {
    return APTITUDE_COMMENTS.developing
  }

  // 最高スコア競技に応じたコメント
  const commentKey = `${maxSport}_high`
  if (APTITUDE_COMMENTS[commentKey]) {
    return APTITUDE_COMMENTS[commentKey]
  }

  // MMA/格闘技系の中間
  if (maxSport === 'mma' || (scores.boxing > 40 && scores.wrestling > 40)) {
    return APTITUDE_COMMENTS.mma_balanced
  }

  return APTITUDE_COMMENTS.balanced
}

/**
 * 六角形適性スコアを計算（メインAPI）
 * @param {Object} params - 入力パラメータ
 * @returns {Object} - スコアと詳細
 */
export function calculateHexagonAptitude(params) {
  if (!HEXAGON_ENABLED) {
    return null
  }

  // 特徴量を抽出
  const features = extractFeatures(params)

  // 線形スコアを計算
  const rawScores = computeLinearScores(features)

  // 正規化（0-100）
  const linearScores = normalizeScores(rawScores)

  // ファジィ補正を計算
  const fuzzyBonus = computeFuzzyBonus(features)

  // 最終スコアを計算
  const finalScores = applyFuzzyBonus(linearScores, fuzzyBonus)

  // コメント生成
  const comment = generateAptitudeComment(finalScores)

  // 最高スコアの競技
  let topSport = 'boxing'
  let topScore = 0
  for (const sport of SPORTS) {
    if (finalScores[sport] > topScore) {
      topScore = finalScores[sport]
      topSport = sport
    }
  }

  return {
    scores: finalScores,
    linearScores,
    fuzzyBonus,
    features,
    comment,
    topSport,
    topSportName: SPORT_NAMES[topSport]
  }
}

// 定数のエクスポート
export { SPORTS, SPORT_NAMES, SPORT_COLORS } from './constants'
