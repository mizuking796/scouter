// 顔ランドマーク表示コンポーネント
// MediaPipe Face Meshのランドマークを緑の点で描画

import { useRef, useEffect } from 'react'

// 重要なランドマークのみをハイライト表示
const HIGHLIGHT_LANDMARKS = {
  // 目
  leftEye: [33, 133, 159, 145, 468],
  rightEye: [263, 362, 386, 374, 473],
  // 眉
  leftEyebrow: [46, 52, 53, 55, 107],
  rightEyebrow: [276, 282, 283, 285, 336],
  // 鼻
  nose: [1, 2, 6, 168, 195],
  // 口
  mouth: [0, 13, 14, 17, 61, 291, 78, 308],
  // 顔の輪郭
  faceContour: [10, 152, 234, 454, 127, 356],
  // 頬骨
  cheekbone: [116, 123, 345, 352],
  // 顎
  jaw: [136, 150, 172, 365, 379, 397],
}

// 全ランドマークのフラットリスト
const ALL_HIGHLIGHT_INDICES = Object.values(HIGHLIGHT_LANDMARKS).flat()

function FaceLandmarkDisplay({ landmarks, width = 200, height = 250 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !landmarks || landmarks.length < 468) return

    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height

    // 背景クリア
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)'
    ctx.fillRect(0, 0, w, h)

    // ランドマークの境界を計算してスケーリング
    let minX = 1, maxX = 0, minY = 1, maxY = 0
    for (const lm of landmarks) {
      if (lm.x < minX) minX = lm.x
      if (lm.x > maxX) maxX = lm.x
      if (lm.y < minY) minY = lm.y
      if (lm.y > maxY) maxY = lm.y
    }

    const padding = 20
    const faceWidth = maxX - minX
    const faceHeight = maxY - minY
    const scale = Math.min(
      (w - padding * 2) / faceWidth,
      (h - padding * 2) / faceHeight
    )
    const offsetX = (w - faceWidth * scale) / 2 - minX * scale
    const offsetY = (h - faceHeight * scale) / 2 - minY * scale

    // 座標変換関数（鏡像表示）
    const transform = (lm) => ({
      x: w - (lm.x * scale + offsetX), // X軸反転で鏡像
      y: lm.y * scale + offsetY
    })

    // 全ランドマークを薄い点で描画
    ctx.fillStyle = 'rgba(0, 255, 65, 0.15)'
    for (let i = 0; i < landmarks.length; i++) {
      const pos = transform(landmarks[i])
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2)
      ctx.fill()
    }

    // 重要なランドマークを明るい点で描画
    ctx.fillStyle = 'rgba(0, 255, 65, 0.8)'
    ctx.shadowColor = 'rgba(0, 255, 65, 0.5)'
    ctx.shadowBlur = 5
    for (const idx of ALL_HIGHLIGHT_INDICES) {
      if (idx >= landmarks.length) continue
      const pos = transform(landmarks[idx])
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2)
      ctx.fill()
    }

    // 顔の輪郭線を薄く描画
    ctx.strokeStyle = 'rgba(0, 255, 65, 0.3)'
    ctx.lineWidth = 1
    ctx.shadowBlur = 0

    // 顔の輪郭（メッシュの外周）
    const contourIndices = [
      10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
      397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
      172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10
    ]
    ctx.beginPath()
    for (let i = 0; i < contourIndices.length; i++) {
      const pos = transform(landmarks[contourIndices[i]])
      if (i === 0) {
        ctx.moveTo(pos.x, pos.y)
      } else {
        ctx.lineTo(pos.x, pos.y)
      }
    }
    ctx.stroke()

    // 目の輪郭
    const drawEyeContour = (indices) => {
      ctx.beginPath()
      for (let i = 0; i < indices.length; i++) {
        const pos = transform(landmarks[indices[i]])
        if (i === 0) ctx.moveTo(pos.x, pos.y)
        else ctx.lineTo(pos.x, pos.y)
      }
      ctx.closePath()
      ctx.stroke()
    }

    const leftEyeContour = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33]
    const rightEyeContour = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466, 263]
    drawEyeContour(leftEyeContour)
    drawEyeContour(rightEyeContour)

    // 口の輪郭
    const mouthContour = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185, 61]
    ctx.beginPath()
    for (let i = 0; i < mouthContour.length; i++) {
      const pos = transform(landmarks[mouthContour[i]])
      if (i === 0) ctx.moveTo(pos.x, pos.y)
      else ctx.lineTo(pos.x, pos.y)
    }
    ctx.stroke()

    // 眉の線
    const leftBrowIndices = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46]
    const rightBrowIndices = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276]
    ctx.strokeStyle = 'rgba(0, 255, 65, 0.4)'

    ctx.beginPath()
    for (let i = 0; i < leftBrowIndices.length; i++) {
      const pos = transform(landmarks[leftBrowIndices[i]])
      if (i === 0) ctx.moveTo(pos.x, pos.y)
      else ctx.lineTo(pos.x, pos.y)
    }
    ctx.stroke()

    ctx.beginPath()
    for (let i = 0; i < rightBrowIndices.length; i++) {
      const pos = transform(landmarks[rightBrowIndices[i]])
      if (i === 0) ctx.moveTo(pos.x, pos.y)
      else ctx.lineTo(pos.x, pos.y)
    }
    ctx.stroke()

    // スキャンラインエフェクト
    ctx.fillStyle = 'rgba(0, 255, 65, 0.03)'
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1)
    }

  }, [landmarks, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="face-landmark-canvas"
    />
  )
}

export default FaceLandmarkDisplay
