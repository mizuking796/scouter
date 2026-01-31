import { useRef, useState, useCallback } from 'react'
import { useFaceTracking } from '../hooks/useFaceTracking'
import { playOkSound } from '../utils/sound'
import { extractTrapeziusBaseData } from '../features/trapezius'
import './CalibrationScreen.css'

const STILL_THRESHOLD = 5 // 角度変化の閾値（度）
const STILL_DURATION = 2000 // 静止判定時間（ms）- 2秒
const ANGLE_CENTER_THRESHOLD = 15 // 角度の中央判定の閾値（度）
const POSITION_CENTER_THRESHOLD = 80 // 位置の中央判定の閾値（ピクセル）
const CANVAS_CENTER_X = 320 // キャンバス中央X
const CANVAS_CENTER_Y = 240 // キャンバス中央Y
const MAX_FACE_WIDTH = 200 // 顔幅の最大値（これを超えると「離れて」）
const MIN_FACE_WIDTH = 80 // 顔幅の最小値（これ未満だと「近づいて」）

function CalibrationScreen({ onComplete }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [faceData, setFaceData] = useState(null)
  const [stillTime, setStillTime] = useState(0)
  const [message, setMessage] = useState('顔がカメラに映る位置に座ってください。')
  const [subMessage, setSubMessage] = useState('顔の中心を中央線に合わせます。')

  const lastAnglesRef = useRef(null)
  const stillStartRef = useRef(null)
  const calibrationDataRef = useRef([])

  const handleResults = useCallback((results) => {
    if (!results) {
      setFaceData(null)
      stillStartRef.current = null
      setStillTime(0)
      setMessage('顔が検出されません。')
      setSubMessage('カメラに顔を向けてください。')
      return
    }

    setFaceData(results)

    const { yaw, pitch } = results.angles
    const { centerX, centerY, faceWidth } = results.faceData

    // 顔のサイズが適切かチェック（近すぎ・遠すぎ検出）
    if (faceWidth > MAX_FACE_WIDTH) {
      stillStartRef.current = null
      setStillTime(0)
      setMessage('少し離れてください。')
      setSubMessage('顔が枠に収まるように調整します。')
      return
    }

    if (faceWidth < MIN_FACE_WIDTH) {
      stillStartRef.current = null
      setStillTime(0)
      setMessage('もう少し近づいてください。')
      setSubMessage('顔が小さすぎます。')
      return
    }

    // 角度が中央付近かチェック（正面を向いているか）
    const isAngleCentered = Math.abs(yaw) < ANGLE_CENTER_THRESHOLD && Math.abs(pitch) < ANGLE_CENTER_THRESHOLD

    // 位置が中央付近かチェック（画面中央にいるか）
    const distanceFromCenter = Math.sqrt(
      Math.pow(centerX - CANVAS_CENTER_X, 2) +
      Math.pow(centerY - CANVAS_CENTER_Y, 2)
    )
    const isPositionCentered = distanceFromCenter < POSITION_CENTER_THRESHOLD

    if (!isPositionCentered) {
      stillStartRef.current = null
      setStillTime(0)
      setMessage('顔を画面の中央に移動してください。')
      setSubMessage('顔の楕円枠の中心に合わせます。')
      return
    }

    if (!isAngleCentered) {
      stillStartRef.current = null
      setStillTime(0)
      setMessage('正面を向いてください。')
      setSubMessage('')
      return
    }

    // 静止判定
    const now = Date.now()
    if (lastAnglesRef.current) {
      const yawDiff = Math.abs(yaw - lastAnglesRef.current.yaw)
      const pitchDiff = Math.abs(pitch - lastAnglesRef.current.pitch)

      if (yawDiff < STILL_THRESHOLD && pitchDiff < STILL_THRESHOLD) {
        // 静止している
        if (!stillStartRef.current) {
          stillStartRef.current = now
        }

        const elapsed = now - stillStartRef.current
        setStillTime(elapsed)

        // キャリブレーションデータを収集
        calibrationDataRef.current.push(results)

        if (elapsed >= STILL_DURATION) {
          // キャリブレーション完了
          playOkSound()
          const avgData = averageCalibrationData(calibrationDataRef.current)
          onComplete(avgData)
          return
        }

        const remaining = Math.ceil((STILL_DURATION - elapsed) / 1000)
        setMessage('そのまま静止してください。')
        setSubMessage(`あと ${remaining} 秒...`)
      } else {
        // 動いた
        stillStartRef.current = null
        calibrationDataRef.current = []
        setStillTime(0)
        setMessage('準備できたら、2秒静止。')
        setSubMessage('')
      }
    }

    lastAnglesRef.current = { yaw, pitch }
  }, [onComplete])

  const { isReady, error } = useFaceTracking(videoRef, canvasRef, handleResults)

  // キャリブレーションデータの平均を取る
  function averageCalibrationData(dataArray) {
    if (dataArray.length === 0) return null

    const sum = dataArray.reduce((acc, data) => ({
      yaw: acc.yaw + data.angles.yaw,
      pitch: acc.pitch + data.angles.pitch,
      faceWidth: acc.faceWidth + data.faceData.faceWidth,
      faceHeight: acc.faceHeight + data.faceData.faceHeight,
      jawWidth: acc.jawWidth + data.faceData.jawWidth,
      leftEyeX: acc.leftEyeX + data.faceData.eyePositions.left.x,
      leftEyeY: acc.leftEyeY + data.faceData.eyePositions.left.y,
      rightEyeX: acc.rightEyeX + data.faceData.eyePositions.right.x,
      rightEyeY: acc.rightEyeY + data.faceData.eyePositions.right.y
    }), { yaw: 0, pitch: 0, faceWidth: 0, faceHeight: 0, jawWidth: 0, leftEyeX: 0, leftEyeY: 0, rightEyeX: 0, rightEyeY: 0 })

    const count = dataArray.length

    // 最後のフレームのランドマークを保存（正面の顔マッピング表示用）
    const lastData = dataArray[dataArray.length - 1]
    const baseLandmarks = lastData?.landmarks || null

    // 首肩ボリューム特徴の基準データを抽出
    const trapeziusBaseData = baseLandmarks ? extractTrapeziusBaseData(baseLandmarks) : null

    return {
      baseAngles: {
        yaw: sum.yaw / count,
        pitch: sum.pitch / count
      },
      baseFaceData: {
        faceWidth: sum.faceWidth / count,
        faceHeight: sum.faceHeight / count,
        jawWidth: sum.jawWidth / count
      },
      // キャリブレーション時の目の位置（正規化座標 0-1）
      baseEyePositions: {
        left: { x: sum.leftEyeX / count, y: sum.leftEyeY / count },
        right: { x: sum.rightEyeX / count, y: sum.rightEyeY / count }
      },
      // キャリブレーション時のランドマーク（正面の顔）
      baseLandmarks,
      // 首肩ボリューム特徴の基準データ
      trapeziusBaseData,
      timestamp: Date.now()
    }
  }

  const progress = (stillTime / STILL_DURATION) * 100

  return (
    <div className="calibration-screen">
      <div className="camera-container">
        <video
          ref={videoRef}
          className="camera-video"
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="overlay-canvas"
          width={640}
          height={480}
        />

        {/* 顔の枠 */}
        <div className="face-guide">
          <div className="face-oval" />
        </div>

        {/* 中央線 */}
        <div className="center-line" />

        {/* 進捗バー */}
        {stillTime > 0 && (
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* 目の位置マーカー（キャリブレーション中） */}
        {stillTime > 0 && faceData?.faceData?.eyePositions && (
          <div className="eye-guide-container">
            <div
              className="eye-calibration-marker"
              style={{
                left: `${(1 - faceData.faceData.eyePositions.left.x) * 100}%`,
                top: `${faceData.faceData.eyePositions.left.y * 100}%`
              }}
            />
            <div
              className="eye-calibration-marker"
              style={{
                left: `${(1 - faceData.faceData.eyePositions.right.x) * 100}%`,
                top: `${faceData.faceData.eyePositions.right.y * 100}%`
              }}
            />
            <div className="eye-label">目の位置を記録中...</div>
          </div>
        )}
      </div>

      <div className="instruction-panel scouter-border">
        <p className="main-message scouter-text">{message}</p>
        {subMessage && <p className="sub-message">{subMessage}</p>}

        {!isReady && !error && (
          <p className="loading blink">カメラを起動中...</p>
        )}

        {error && (
          <p className="error-message">{error}</p>
        )}
      </div>
    </div>
  )
}

export default CalibrationScreen
