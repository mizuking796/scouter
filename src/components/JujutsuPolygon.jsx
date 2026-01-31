// 柔術フェイス特徴 多角形表示コンポーネント
// 4つの指標を四角形のレーダーチャート風に表示

import { useRef, useEffect } from 'react'

const LABELS = ['不規則さ', '左右差', '膨らみ', '連続性']

function JujutsuPolygon({
  contourScore,
  asymmetryScore,
  thicknessScore,
  continuityScore,
  width = 140,
  height = 140
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height
    const centerX = w / 2
    const centerY = h / 2
    const radius = Math.min(w, h) / 2 - 28

    // 背景クリア
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)'
    ctx.fillRect(0, 0, w, h)

    // 4つの軸の角度（上、右、下、左）
    const angles = [
      -Math.PI / 2,      // 上 (不規則さ)
      0,                 // 右 (左右差)
      Math.PI / 2,       // 下 (膨らみ)
      Math.PI,           // 左 (連続性)
    ]

    const scores = [contourScore, asymmetryScore, thicknessScore, continuityScore]

    // グリッド（同心の四角形）
    ctx.strokeStyle = 'rgba(0, 255, 65, 0.15)'
    ctx.lineWidth = 1
    for (let level = 0.25; level <= 1; level += 0.25) {
      ctx.beginPath()
      angles.forEach((angle, i) => {
        const x = centerX + Math.cos(angle) * radius * level
        const y = centerY + Math.sin(angle) * radius * level
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.closePath()
      ctx.stroke()
    }

    // 軸線
    ctx.strokeStyle = 'rgba(0, 255, 65, 0.3)'
    angles.forEach(angle => {
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius)
      ctx.stroke()
    })

    // データの多角形（塗りつぶし）
    ctx.fillStyle = 'rgba(0, 255, 65, 0.25)'
    ctx.beginPath()
    scores.forEach((score, i) => {
      const r = (score / 100) * radius
      const x = centerX + Math.cos(angles[i]) * r
      const y = centerY + Math.sin(angles[i]) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.fill()

    // データの多角形（線）
    ctx.strokeStyle = 'rgba(0, 255, 65, 0.9)'
    ctx.lineWidth = 2
    ctx.shadowColor = 'rgba(0, 255, 65, 0.6)'
    ctx.shadowBlur = 10
    ctx.beginPath()
    scores.forEach((score, i) => {
      const r = (score / 100) * radius
      const x = centerX + Math.cos(angles[i]) * r
      const y = centerY + Math.sin(angles[i]) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.stroke()

    // 頂点のポイント
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(0, 255, 65, 1)'
    scores.forEach((score, i) => {
      const r = (score / 100) * radius
      const x = centerX + Math.cos(angles[i]) * r
      const y = centerY + Math.sin(angles[i]) * r
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
    })

    // ラベルとスコア
    ctx.font = '9px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const labelPositions = [
      { x: centerX, y: 8 },                    // 上
      { x: w - 8, y: centerY },                // 右
      { x: centerX, y: h - 8 },                // 下
      { x: 8, y: centerY },                    // 左
    ]

    LABELS.forEach((label, i) => {
      const pos = labelPositions[i]

      // テキスト配置調整
      if (i === 0) {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
      } else if (i === 1) {
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
      } else if (i === 2) {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
      } else {
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
      }

      // ラベル
      ctx.fillStyle = 'rgba(0, 255, 65, 0.6)'
      ctx.fillText(label, pos.x, pos.y)

      // スコア（ラベルの近くに小さく表示）
      ctx.fillStyle = 'rgba(0, 255, 65, 0.9)'
      const scoreOffset = i === 0 ? 10 : i === 2 ? -10 : 0
      const scoreX = i === 1 ? pos.x + 2 : i === 3 ? pos.x - 2 : pos.x
      const scoreY = pos.y + scoreOffset
      if (i === 0 || i === 2) {
        ctx.fillText(scores[i], scoreX, scoreY)
      }
    })

  }, [contourScore, asymmetryScore, thicknessScore, continuityScore, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="jujutsu-polygon-canvas"
    />
  )
}

export default JujutsuPolygon
