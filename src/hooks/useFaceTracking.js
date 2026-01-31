import { useRef, useEffect, useState, useCallback } from 'react'
import { FaceMesh } from '@mediapipe/face_mesh'
import { Camera } from '@mediapipe/camera_utils'

// 重要なランドマークインデックス
const LANDMARKS = {
  NOSE_TIP: 1,
  NOSE_BRIDGE: 6,
  LEFT_EYE_OUTER: 33,
  LEFT_EYE_INNER: 133,
  RIGHT_EYE_OUTER: 263,
  RIGHT_EYE_INNER: 362,
  LEFT_EAR: 234,
  RIGHT_EAR: 454,
  CHIN: 152,
  FOREHEAD: 10,
  LEFT_CHEEK: 50,
  RIGHT_CHEEK: 280,
  // 顎のライン（首幅推定用）
  JAW_LEFT: 172,
  JAW_RIGHT: 397,
  JAW_BOTTOM: 152,
}

export function useFaceTracking(videoRef, canvasRef, onResults) {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState(null)
  const faceMeshRef = useRef(null)
  const cameraRef = useRef(null)
  const onResultsRef = useRef(onResults)

  // 常に最新のコールバックを保持
  onResultsRef.current = onResults

  // 結果を処理する関数
  const processResults = useCallback((results) => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const { width, height } = canvas

    // 実際のビデオフレームの解像度を取得（MediaPipeのランドマークはこの解像度基準）
    // videoWidthが0や未定義の場合は4:3をデフォルトとする
    let actualAspectRatio = 4 / 3
    if (videoRef.current && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
      actualAspectRatio = videoRef.current.videoWidth / videoRef.current.videoHeight
    }

    // キャンバスをクリア＆状態リセット
    ctx.clearRect(0, 0, width, height)
    ctx.setLineDash([])
    ctx.shadowBlur = 0
    ctx.shadowColor = 'transparent'

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0]

      // 角度を計算
      const angles = calculateAngles(landmarks)

      // 顔の特徴を抽出
      const faceData = extractFaceData(landmarks, width, height)

      // スカウター風のビジュアルを描画（エラーが起きても処理を続行）
      try {
        drawScouterVisuals(ctx, landmarks, width, height)
      } catch (e) {
        console.error('drawScouterVisuals error:', e)
      }

      // コールバックで結果を返す
      if (onResultsRef.current) {
        onResultsRef.current({
          landmarks,
          angles,
          faceData,
          aspectRatio: actualAspectRatio, // 実際のビデオ解像度からのアスペクト比
          timestamp: Date.now()
        })
      }
    } else {
      // 顔が検出されない場合
      if (onResultsRef.current) {
        onResultsRef.current(null)
      }
    }
  }, [canvasRef])

  // 初期化
  useEffect(() => {
    if (!videoRef.current) return

    const faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      }
    })

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    })

    faceMesh.onResults(processResults)

    faceMeshRef.current = faceMesh

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (faceMeshRef.current && videoRef.current) {
          await faceMeshRef.current.send({ image: videoRef.current })
        }
      },
      width: 640,
      height: 480
    })

    cameraRef.current = camera

    camera.start()
      .then(() => {
        setIsReady(true)
      })
      .catch((err) => {
        setError(err.message || 'カメラの起動に失敗しました')
      })

    return () => {
      // カメラを停止
      if (cameraRef.current) {
        cameraRef.current.stop()
        cameraRef.current = null
      }
      // FaceMeshを閉じる
      if (faceMeshRef.current) {
        faceMeshRef.current.close()
        faceMeshRef.current = null
      }
      // キャンバスをクリア
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
  }, [videoRef, processResults])

  return { isReady, error }
}

// 角度計算
function calculateAngles(landmarks) {
  // 鼻と両目の位置から回旋角度を計算
  const nose = landmarks[LANDMARKS.NOSE_TIP]
  const leftEye = landmarks[LANDMARKS.LEFT_EYE_OUTER]
  const rightEye = landmarks[LANDMARKS.RIGHT_EYE_OUTER]
  const leftEar = landmarks[LANDMARKS.LEFT_EAR]
  const rightEar = landmarks[LANDMARKS.RIGHT_EAR]
  const forehead = landmarks[LANDMARKS.FOREHEAD]
  const chin = landmarks[LANDMARKS.CHIN]

  // 水平回旋（左右）: 両目の中心に対する鼻の位置
  const eyeCenter = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2
  }

  // 目の幅
  const eyeWidth = Math.abs(rightEye.x - leftEye.x)

  // 鼻の偏差（正規化）
  const noseDeviation = (nose.x - eyeCenter.x) / eyeWidth

  // 耳の可視性から回旋角度を推定
  // 左回旋 = 右耳が見えなくなる、右回旋 = 左耳が見えなくなる
  const earDistance = Math.abs(rightEar.x - leftEar.x)

  // 水平回旋角度（度数）- シンプルに鼻の偏差から
  // 鏡像表示のため符号反転
  const yawAngle = -noseDeviation * 150

  // 垂直回旋（上下）: 額と顎の位置関係
  const faceHeight = Math.abs(chin.y - forehead.y)
  const noseToEyeRatio = (nose.y - eyeCenter.y) / faceHeight

  // 上向き: 鼻が目より下に行く、下向き: 鼻が目に近づく
  // 正面時: noseToEyeRatio ≈ 0.15-0.2
  const pitchAngle = (noseToEyeRatio - 0.17) * -200 // 大まかな変換係数

  return {
    yaw: yawAngle,       // 左右回旋（+が右、-が左）
    pitch: pitchAngle,   // 上下回旋（+が上、-が下）
    noseDeviation,
    eyeWidth,
    faceHeight
  }
}

// 顔データ抽出
function extractFaceData(landmarks, canvasWidth, canvasHeight) {
  const nose = landmarks[LANDMARKS.NOSE_TIP]
  const chin = landmarks[LANDMARKS.CHIN]
  const forehead = landmarks[LANDMARKS.FOREHEAD]
  const leftCheek = landmarks[LANDMARKS.LEFT_CHEEK]
  const rightCheek = landmarks[LANDMARKS.RIGHT_CHEEK]
  const jawLeft = landmarks[LANDMARKS.JAW_LEFT]
  const jawRight = landmarks[LANDMARKS.JAW_RIGHT]
  const leftEye = landmarks[LANDMARKS.LEFT_EYE_OUTER]
  const rightEye = landmarks[LANDMARKS.RIGHT_EYE_OUTER]

  // 顔幅（頬の幅）- ピクセル値
  const faceWidth = Math.abs(rightCheek.x - leftCheek.x) * canvasWidth

  // 顔の高さ - ピクセル値
  const faceHeight = Math.abs(chin.y - forehead.y) * canvasHeight

  // 顎幅（首幅の推定に使用）- ピクセル値
  const jawWidth = Math.abs(jawRight.x - jawLeft.x) * canvasWidth

  // 正規化された値（0-1範囲、デバイス間で一貫）
  const normalizedFaceWidth = Math.abs(rightCheek.x - leftCheek.x)
  const normalizedFaceHeight = Math.abs(chin.y - forehead.y)
  const normalizedJawWidth = Math.abs(jawRight.x - jawLeft.x)

  // 顔の中心位置
  const centerX = nose.x * canvasWidth
  const centerY = nose.y * canvasHeight

  // 顎の下端（首の開始位置）
  const chinY = chin.y * canvasHeight

  return {
    faceWidth,
    faceHeight,
    jawWidth,
    // 正規化された値（デバイス非依存の計算用）
    normalizedFaceWidth,
    normalizedFaceHeight,
    normalizedJawWidth,
    centerX,
    centerY,
    chinY,
    // 目の位置（正規化座標 0-1）
    eyePositions: {
      left: { x: leftEye.x, y: leftEye.y },
      right: { x: rightEye.x, y: rightEye.y }
    },
    landmarks: {
      nose: { x: nose.x * canvasWidth, y: nose.y * canvasHeight },
      chin: { x: chin.x * canvasWidth, y: chin.y * canvasHeight },
      jawLeft: { x: jawLeft.x * canvasWidth, y: jawLeft.y * canvasHeight },
      jawRight: { x: jawRight.x * canvasWidth, y: jawRight.y * canvasHeight }
    }
  }
}

// スカウター風ビジュアル描画
function drawScouterVisuals(ctx, landmarks, width, height) {
  const jawLeft = landmarks[LANDMARKS.JAW_LEFT]
  const jawRight = landmarks[LANDMARKS.JAW_RIGHT]
  const chin = landmarks[LANDMARKS.CHIN]
  const leftEar = landmarks[LANDMARKS.LEFT_EAR]
  const rightEar = landmarks[LANDMARKS.RIGHT_EAR]

  // 色設定
  const scouterGreen = 'rgba(0, 255, 65, 0.8)'
  const scouterGreenDim = 'rgba(0, 255, 65, 0.4)'
  const scouterGlow = 'rgba(0, 255, 65, 0.3)'

  ctx.save()

  // 鏡像表示のため左右反転
  ctx.translate(width, 0)
  ctx.scale(-1, 1)

  // === 首の外周計測ライン ===
  const neckTop = chin.y * height
  const neckBottom = Math.min(neckTop + 100, height - 10)
  const jawLeftX = jawLeft.x * width
  const jawRightX = jawRight.x * width
  const chinX = chin.x * width
  const jawWidth = jawRightX - jawLeftX

  // 首の外側（顎より広めに）
  const outerOffset = 25
  const neckLeftOuter = jawLeftX - outerOffset
  const neckRightOuter = jawRightX + outerOffset

  ctx.strokeStyle = scouterGreen
  ctx.lineWidth = 2
  ctx.shadowColor = scouterGlow
  ctx.shadowBlur = 15

  // 左側の外周ライン（曲線）
  ctx.beginPath()
  ctx.moveTo(neckLeftOuter, neckTop - 10)
  ctx.quadraticCurveTo(
    neckLeftOuter - 15, neckTop + 40,
    neckLeftOuter - 5, neckBottom
  )
  ctx.stroke()

  // 右側の外周ライン（曲線）
  ctx.beginPath()
  ctx.moveTo(neckRightOuter, neckTop - 10)
  ctx.quadraticCurveTo(
    neckRightOuter + 15, neckTop + 40,
    neckRightOuter + 5, neckBottom
  )
  ctx.stroke()

  // 計測ポイント（小さな四角）
  ctx.fillStyle = scouterGreen
  const markerSize = 4
  // 左側のポイント
  for (let i = 0; i < 4; i++) {
    const t = i / 3
    const y = neckTop + (neckBottom - neckTop) * t
    const x = neckLeftOuter - 10 - Math.sin(t * Math.PI) * 10
    ctx.fillRect(x - markerSize/2, y - markerSize/2, markerSize, markerSize)
  }
  // 右側のポイント
  for (let i = 0; i < 4; i++) {
    const t = i / 3
    const y = neckTop + (neckBottom - neckTop) * t
    const x = neckRightOuter + 10 + Math.sin(t * Math.PI) * 10
    ctx.fillRect(x - markerSize/2, y - markerSize/2, markerSize, markerSize)
  }

  // 首周りの計測線（点線風）
  ctx.strokeStyle = scouterGreenDim
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(neckLeftOuter - 20, neckTop + 30)
  ctx.lineTo(neckRightOuter + 20, neckTop + 30)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(neckLeftOuter - 15, neckTop + 60)
  ctx.lineTo(neckRightOuter + 15, neckTop + 60)
  ctx.stroke()
  ctx.setLineDash([])

  // === 耳のマーカー ===
  const earSize = 15
  ctx.strokeStyle = scouterGreen
  ctx.lineWidth = 2

  // 左耳（ブラケット型マーカー）
  const leftEarX = leftEar.x * width
  const leftEarY = leftEar.y * height
  ctx.beginPath()
  ctx.moveTo(leftEarX - earSize, leftEarY - earSize)
  ctx.lineTo(leftEarX - earSize - 8, leftEarY)
  ctx.lineTo(leftEarX - earSize, leftEarY + earSize)
  ctx.stroke()

  // 左耳の小さな点
  ctx.fillStyle = scouterGreen
  ctx.beginPath()
  ctx.arc(leftEarX - earSize - 12, leftEarY, 3, 0, Math.PI * 2)
  ctx.fill()

  // 右耳（ブラケット型マーカー）
  const rightEarX = rightEar.x * width
  const rightEarY = rightEar.y * height
  ctx.beginPath()
  ctx.moveTo(rightEarX + earSize, rightEarY - earSize)
  ctx.lineTo(rightEarX + earSize + 8, rightEarY)
  ctx.lineTo(rightEarX + earSize, rightEarY + earSize)
  ctx.stroke()

  // 右耳の小さな点
  ctx.beginPath()
  ctx.arc(rightEarX + earSize + 12, rightEarY, 3, 0, Math.PI * 2)
  ctx.fill()

  // === 肩ボリューム計測ライン（軽量版） ===
  try {
    const shoulderY = neckBottom + 10
    const shoulderWidth = jawWidth * 1.6

    ctx.strokeStyle = scouterGreenDim
    ctx.lineWidth = 1
    ctx.shadowBlur = 0

    // 肩のライン
    ctx.beginPath()
    ctx.moveTo(neckLeftOuter - 5, neckBottom)
    ctx.lineTo(chinX - shoulderWidth / 2, shoulderY + 30)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(neckRightOuter + 5, neckBottom)
    ctx.lineTo(chinX + shoulderWidth / 2, shoulderY + 30)
    ctx.stroke()

    // 肩の計測ポイント
    ctx.fillStyle = scouterGreenDim
    ctx.fillRect(chinX - shoulderWidth / 2 - 2, shoulderY + 28, 4, 4)
    ctx.fillRect(chinX + shoulderWidth / 2 - 2, shoulderY + 28, 4, 4)
  } catch (e) {
    // 肩の描画エラーは無視
  }

  ctx.restore()

  // === 顔のランドマーク点（軽量版） ===
  try {
    const facePoints = [10, 152, 33, 263, 1, 61, 291, 66, 296]

    ctx.save()
    ctx.translate(width, 0)
    ctx.scale(-1, 1)
    ctx.fillStyle = 'rgba(0, 255, 65, 0.7)'

    for (let i = 0; i < facePoints.length; i++) {
      const lm = landmarks[facePoints[i]]
      if (lm && typeof lm.x === 'number' && typeof lm.y === 'number') {
        // 円形で描画（より目立つ）
        ctx.beginPath()
        ctx.arc(lm.x * width, lm.y * height, 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    ctx.restore()
  } catch (e) {
    // 顔の描画エラーは無視
  }

  // === 目の現在位置（緑の点）- 別のsave/restoreブロックで描画 ===
  const leftEye = landmarks[LANDMARKS.LEFT_EYE_OUTER]
  const rightEye = landmarks[LANDMARKS.RIGHT_EYE_OUTER]

  if (leftEye && rightEye) {
    ctx.save()
    // 鏡像表示のため左右反転
    ctx.translate(width, 0)
    ctx.scale(-1, 1)

    ctx.fillStyle = 'rgba(0, 255, 65, 1)'
    ctx.shadowColor = 'rgba(0, 255, 65, 0.8)'
    ctx.shadowBlur = 20

    // 左目の点
    const leftX = leftEye.x * width
    const leftY = leftEye.y * height
    ctx.beginPath()
    ctx.arc(leftX, leftY, 14, 0, Math.PI * 2)
    ctx.fill()

    // 右目の点
    const rightX = rightEye.x * width
    const rightY = rightEye.y * height
    ctx.beginPath()
    ctx.arc(rightX, rightY, 14, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }
}

export default useFaceTracking
