// 耳の左右非対称度
// 左右の耳の面積・輪郭長の差を計算
// ※医学的根拠はなく、あくまでエンターテインメント目的

import { LEFT_EAR_LANDMARKS, RIGHT_EAR_LANDMARKS, normalizeScore } from './constants'

/**
 * 耳の左右非対称度を計算
 * @param {Array} landmarks - 468個のランドマーク
 * @returns {Object} - { score, details }
 */
export function calculateEarAsymmetry(landmarks) {
  if (!landmarks || landmarks.length < 468) {
    return { score: 50, details: {} }
  }

  // 左右それぞれの耳の特徴を計算
  const leftFeatures = calculateEarFeatures(landmarks, LEFT_EAR_LANDMARKS.CONTOUR)
  const rightFeatures = calculateEarFeatures(landmarks, RIGHT_EAR_LANDMARKS.CONTOUR)

  // 面積の差
  const areaDiff = Math.abs(leftFeatures.area - rightFeatures.area)
  const avgArea = (leftFeatures.area + rightFeatures.area) / 2
  const areaAsymmetry = avgArea > 0 ? areaDiff / avgArea : 0

  // 輪郭長の差
  const perimeterDiff = Math.abs(leftFeatures.perimeter - rightFeatures.perimeter)
  const avgPerimeter = (leftFeatures.perimeter + rightFeatures.perimeter) / 2
  const perimeterAsymmetry = avgPerimeter > 0 ? perimeterDiff / avgPerimeter : 0

  // 外接矩形サイズの差
  const widthDiff = Math.abs(leftFeatures.width - rightFeatures.width)
  const heightDiff = Math.abs(leftFeatures.height - rightFeatures.height)
  const avgWidth = (leftFeatures.width + rightFeatures.width) / 2
  const avgHeight = (leftFeatures.height + rightFeatures.height) / 2
  const sizeAsymmetry = avgWidth > 0 && avgHeight > 0
    ? (widthDiff / avgWidth + heightDiff / avgHeight) / 2
    : 0

  // 総合非対称度（差が大きいほど高スコア）
  const totalAsymmetry = (areaAsymmetry + perimeterAsymmetry + sizeAsymmetry) / 3

  // 0〜0.3の範囲を0-100にマッピング
  const score = normalizeScore(totalAsymmetry, 0, 0.25)

  return {
    score,
    details: {
      areaAsymmetry: areaAsymmetry.toFixed(3),
      perimeterAsymmetry: perimeterAsymmetry.toFixed(3),
      sizeAsymmetry: sizeAsymmetry.toFixed(3)
    }
  }
}

/**
 * 耳の特徴（面積、輪郭長、外接矩形）を計算
 */
function calculateEarFeatures(landmarks, contourIndices) {
  const points = contourIndices.map(idx => landmarks[idx])

  // 面積（Shoelace formula）
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    area += points[i].x * points[j].y
    area -= points[j].x * points[i].y
  }
  area = Math.abs(area) / 2

  // 輪郭長
  let perimeter = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    perimeter += Math.sqrt(
      Math.pow(points[j].x - points[i].x, 2) +
      Math.pow(points[j].y - points[i].y, 2)
    )
  }

  // 外接矩形
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const width = Math.max(...xs) - Math.min(...xs)
  const height = Math.max(...ys) - Math.min(...ys)

  return { area, perimeter, width, height }
}
