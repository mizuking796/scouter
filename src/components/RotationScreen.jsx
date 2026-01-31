import { useRef, useState, useCallback, useEffect } from 'react'
import { useFaceTracking } from '../hooks/useFaceTracking'
import { playOkSound } from '../utils/sound'
import {
  calculateAllFaceCombatFeatures,
  resetAllFaceCombatHistory,
  FACE_COMBAT_ENABLED
} from '../features/faceCombat'
import {
  calculateJujutsuFeatures,
  FACE_JUJUTSU_ENABLED
} from '../features/faceJujutsu'
import {
  calculateTrapeziusFeatures,
  TRAPEZIUS_ENABLED
} from '../features/trapezius'
import './RotationScreen.css'

// 定数
const MIN_ANGLE_LR = 20 // 左右の最小回旋角度
const MIN_ANGLE_UP = 15 // 上の最小回旋角度
const STILL_THRESHOLD = 30 // 静止判定の角速度閾値（度/秒）- 緩めに設定
const STILL_DURATION = 150 // 静止判定時間（ms）- 短めに
const RETURN_THRESHOLD_YAW = 40 // 正面復帰の閾値（度）- yaw用
const RETURN_THRESHOLD_PITCH = 60 // 正面復帰の閾値（度）- pitch用、さらに緩め
const SUCCESS_DISPLAY_TIME = 1500 // 成功表示時間（ms）

const DIRECTION_CONFIG = {
  right: {
    label: '右',
    getAngle: (angles, baseAngles) => angles.yaw - baseAngles.yaw,
  },
  left: {
    label: '左',
    getAngle: (angles, baseAngles) => -(angles.yaw - baseAngles.yaw),
  },
  up: {
    label: '上',
    getAngle: (angles, baseAngles) => angles.pitch - baseAngles.pitch,
  }
}

// フェーズ
const PHASE = {
  INSTRUCTION: 'instruction', // 最初の指示表示
  READY: 'ready', // 目の位置合わせ待ち
  ROTATING: 'rotating',
  HOLDING: 'holding',
  SUCCESS: 'success',
  RETURN_INSTRUCTION: 'return_instruction', // 正面に戻る指示
  RETURNING: 'returning',
  RECOVERY: 'recovery' // リカバリー（再キャリブレーション待ち）
}

// リカバリー用の定数
const RECOVERY_EYE_THRESHOLD = 0.05 // 目の位置の許容誤差（正規化座標）
const RECOVERY_STILL_DURATION = 1000 // リカバリー時の静止判定時間（ms）
const FACE_LOST_TIMEOUT = 2000 // 顔が見失われてからリカバリーに入るまでの時間（ms）
const RETURN_EYE_THRESHOLD = 0.08 // 正面復帰時の目の位置の許容誤差（少し緩め）

// カウントダウン設定

function RotationScreen({ direction, calibrationData, onComplete }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)


  // 表示用のstate
  const [displayPhase, setDisplayPhase] = useState(PHASE.INSTRUCTION)
  const [currentAngle, setCurrentAngle] = useState(0)
  const [message, setMessage] = useState('')
  const [subMessage, setSubMessage] = useState('')
  const [holdProgress, setHoldProgress] = useState(0)
  const [countdown, setCountdown] = useState(2) // 最初から表示
  const [currentEyePositions, setCurrentEyePositions] = useState(
    calibrationData?.baseEyePositions || null
  ) // 現在の目の位置（初期値はキャリブレーション時の位置）
  const [recoveryProgress, setRecoveryProgress] = useState(0) // リカバリー進捗
  const [readyProgress, setReadyProgress] = useState(0) // 開始前の目の位置合わせ進捗

  // ロジック用のref（クロージャ問題を回避）
  const phaseRef = useRef(PHASE.INSTRUCTION)


  // カウントダウン → 目の位置チェック
  useEffect(() => {
    // refsもリセット
    measurementRef.current = {
      angleHistory: [],
      maxAngle: 0,
      holdStartTime: null,
      startTime: Date.now()
    }
    recoveryRef.current = {
      faceLostTime: null,
      recoveryStartTime: null
    }
    faceCombatRef.current = null
    jujutsuRef.current = null
    trapeziusRef.current = null
    readyStartRef.current = null
    checkAlignmentRef.current = false

    // 闘争的フェイス特徴の履歴をリセット
    if (FACE_COMBAT_ENABLED) {
      resetAllFaceCombatHistory()
    }

    // 最初から2を表示（stateの初期値）
    // 1秒後に1を表示
    const t1 = setTimeout(() => setCountdown(1), 1000)
    // 2秒後にGO!を表示
    const t2 = setTimeout(() => setCountdown('GO!'), 2000)
    // 2.5秒後にチェックフェーズへ（handleResultsで目の位置をチェック）
    const t3 = setTimeout(() => {
      setCountdown(null)
      checkAlignmentRef.current = true // 次のフレームで目の位置をチェック
      phaseRef.current = PHASE.READY
      setDisplayPhase(PHASE.READY)
      setMessage('確認中...')
      setSubMessage('')
    }, 2500)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [])
  const measurementRef = useRef({
    angleHistory: [],
    maxAngle: 0,
    holdStartTime: null,
    startTime: Date.now()
  })
  const recoveryRef = useRef({
    faceLostTime: null,
    recoveryStartTime: null
  })
  const faceCombatRef = useRef(null) // 闘争的フェイス特徴データ
  const jujutsuRef = useRef(null) // 柔術フェイス特徴データ
  const trapeziusRef = useRef(null) // 首肩ボリューム特徴データ
  const readyStartRef = useRef(null) // READY時の目の位置合わせ開始時刻
  const checkAlignmentRef = useRef(false) // カウントダウン後に目の位置チェックが必要か
  const calibrationDataRef = useRef(calibrationData) // 更新可能なキャリブレーションデータ
  calibrationDataRef.current = calibrationData
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete // 常に最新のonCompleteを保持

  const config = DIRECTION_CONFIG[direction]

  // 測定をリセットしてやり直す
  const resetMeasurement = useCallback((newBaseAngles) => {
    measurementRef.current = {
      angleHistory: [],
      maxAngle: 0,
      holdStartTime: null,
      startTime: Date.now()
    }
    recoveryRef.current = {
      faceLostTime: null,
      recoveryStartTime: null
    }
    // 新しいbaseAnglesでキャリブレーションデータを更新
    if (newBaseAngles) {
      calibrationDataRef.current = {
        ...calibrationDataRef.current,
        baseAngles: newBaseAngles
      }
    }
    setCurrentAngle(0)
    setHoldProgress(0)
    setRecoveryProgress(0)
    phaseRef.current = PHASE.ROTATING
    setDisplayPhase(PHASE.ROTATING)
    setMessage(`${config.label}を向き切って！`)
    setSubMessage(direction === 'up' ? '音が鳴ったら完了' : '音が鳴ったら正面に戻って')
  }, [config.label, direction])

  const handleResults = useCallback((results) => {
    const currentPhase = phaseRef.current
    const calData = calibrationDataRef.current

    // 目の位置は常に更新（どのフェーズでも）
    // 顔が検出されない場合は最後の位置を維持（消えないようにする）
    if (results?.faceData?.eyePositions) {
      setCurrentEyePositions(results.faceData.eyePositions)
    }
    // else: 最後の位置を維持（nullにしない）

    // 指示表示中・成功後・戻る指示中は処理しない（READYは処理する）
    if (currentPhase === PHASE.INSTRUCTION || currentPhase === PHASE.SUCCESS || currentPhase === PHASE.RETURN_INSTRUCTION) {
      recoveryRef.current.faceLostTime = null
      return
    }

    // READYフェーズ: 目の位置合わせをチェック
    if (currentPhase === PHASE.READY) {
      // 顔が検出されない場合
      if (!results || !results.faceData?.eyePositions) {
        readyStartRef.current = null
        setReadyProgress(0)
        checkAlignmentRef.current = false
        setMessage('顔をカメラに向けて')
        return
      }

      // キャリブレーションデータがない場合（通常ありえない）
      if (!calData?.baseEyePositions) {
        setMessage('準備中...')
        return
      }

      const currentEyes = results.faceData.eyePositions
      const baseEyes = calData.baseEyePositions

      const leftDist = Math.sqrt(
        Math.pow(currentEyes.left.x - baseEyes.left.x, 2) +
        Math.pow(currentEyes.left.y - baseEyes.left.y, 2)
      )
      const rightDist = Math.sqrt(
        Math.pow(currentEyes.right.x - baseEyes.right.x, 2) +
        Math.pow(currentEyes.right.y - baseEyes.right.y, 2)
      )

      // 上向きの場合は閾値を少し緩める（顔が上を向くと目の検出が不安定になりやすい）
      const threshold = direction === 'up' ? RECOVERY_EYE_THRESHOLD * 1.5 : RECOVERY_EYE_THRESHOLD
      const isAligned = leftDist < threshold && rightDist < threshold

      // カウントダウン直後のチェック: 既に合っていればスキップ
      if (checkAlignmentRef.current) {
        checkAlignmentRef.current = false
        if (isAligned) {
          // 既に目が合っている → READYをスキップして直接ROTATINGへ
          calibrationDataRef.current = {
            ...calibrationDataRef.current,
            baseAngles: {
              yaw: results.angles.yaw,
              pitch: results.angles.pitch
            }
          }
          measurementRef.current.startTime = Date.now()
          phaseRef.current = PHASE.ROTATING
          setDisplayPhase(PHASE.ROTATING)
          setMessage(`${config.label}を向き切って！`)
          setSubMessage(direction === 'up' ? '音が鳴ったら完了' : '音が鳴ったら正面に戻って')
          return
        }
        // 合っていない → READY表示を続行
        setMessage('目を緑の円に合わせて')
        setSubMessage('')
      }

      if (isAligned) {
        if (!readyStartRef.current) {
          readyStartRef.current = Date.now()
        }
        const elapsed = Date.now() - readyStartRef.current
        const progress = Math.min((elapsed / RECOVERY_STILL_DURATION) * 100, 100)
        setReadyProgress(progress)
        setMessage('そのまま...')

        if (elapsed >= RECOVERY_STILL_DURATION) {
          // 準備完了！測定開始
          // baseAnglesを更新して測定開始
          calibrationDataRef.current = {
            ...calibrationDataRef.current,
            baseAngles: {
              yaw: results.angles.yaw,
              pitch: results.angles.pitch
            }
          }
          measurementRef.current.startTime = Date.now()
          phaseRef.current = PHASE.ROTATING
          setDisplayPhase(PHASE.ROTATING)
          setMessage(`${config.label}を向き切って！`)
          setSubMessage(direction === 'up' ? '音が鳴ったら完了' : '音が鳴ったら正面に戻って')
          setReadyProgress(0)
          readyStartRef.current = null
          return
        }
      } else {
        readyStartRef.current = null
        setReadyProgress(0)
        setMessage('目を緑の円に合わせて')
        setSubMessage('')
      }
      return
    }

    // 顔が検出されない場合
    if (!results || !calData) {
      // リカバリーフェーズ以外で顔を見失った
      if (currentPhase !== PHASE.RECOVERY) {
        if (!recoveryRef.current.faceLostTime) {
          recoveryRef.current.faceLostTime = Date.now()
        } else if (Date.now() - recoveryRef.current.faceLostTime > FACE_LOST_TIMEOUT) {
          // 一定時間顔が見えない → リカバリーモードへ
          phaseRef.current = PHASE.RECOVERY
          setDisplayPhase(PHASE.RECOVERY)
          setMessage('顔が見えません')
          setSubMessage('目を緑の円に合わせてください')
          recoveryRef.current.recoveryStartTime = null
        }
      }
      return
    }

    // 顔が検出された
    recoveryRef.current.faceLostTime = null

    // リカバリーフェーズの処理
    if (currentPhase === PHASE.RECOVERY) {
      if (!calData.baseEyePositions || !results.faceData?.eyePositions) return

      const currentEyes = results.faceData.eyePositions
      const baseEyes = calData.baseEyePositions

      // 目の位置が合っているかチェック
      const leftDist = Math.sqrt(
        Math.pow(currentEyes.left.x - baseEyes.left.x, 2) +
        Math.pow(currentEyes.left.y - baseEyes.left.y, 2)
      )
      const rightDist = Math.sqrt(
        Math.pow(currentEyes.right.x - baseEyes.right.x, 2) +
        Math.pow(currentEyes.right.y - baseEyes.right.y, 2)
      )

      const isAligned = leftDist < RECOVERY_EYE_THRESHOLD && rightDist < RECOVERY_EYE_THRESHOLD

      if (isAligned) {
        if (!recoveryRef.current.recoveryStartTime) {
          recoveryRef.current.recoveryStartTime = Date.now()
        }
        const elapsed = Date.now() - recoveryRef.current.recoveryStartTime
        const progress = Math.min((elapsed / RECOVERY_STILL_DURATION) * 100, 100)
        setRecoveryProgress(progress)
        setMessage('そのまま...')
        setSubMessage('')

        if (elapsed >= RECOVERY_STILL_DURATION) {
          // リカバリー完了！新しいbaseAnglesで再開
          playOkSound()
          resetMeasurement({
            yaw: results.angles.yaw,
            pitch: results.angles.pitch
          })
          return
        }
      } else {
        recoveryRef.current.recoveryStartTime = null
        setRecoveryProgress(0)
        setMessage('目を緑の円に合わせてください')
        setSubMessage('')
      }

      return
    }

    const angle = config.getAngle(results.angles, calData.baseAngles)
    const absAngle = Math.abs(angle)

    // 履歴に追加（回旋中のみ、戻り時は不要）
    if (currentPhase === PHASE.ROTATING || currentPhase === PHASE.HOLDING) {
      measurementRef.current.angleHistory.push({
        angle: absAngle,
        timestamp: Date.now(),
        faceData: results.faceData
      })
    }

    // 闘争的フェイス特徴を計算（有効な場合のみ）
    if (FACE_COMBAT_ENABLED && results.landmarks) {
      const features = calculateAllFaceCombatFeatures(results.landmarks, results.aspectRatio)
      // ランドマークデータも保存（結果画面での顔マッピング表示用）
      faceCombatRef.current = {
        ...features,
        landmarks: results.landmarks
      }
    }

    // 柔術フェイス特徴を計算（有効な場合のみ）
    if (FACE_JUJUTSU_ENABLED && results.landmarks) {
      const baseLandmarks = calData?.baseLandmarks || null
      jujutsuRef.current = calculateJujutsuFeatures(results.landmarks, baseLandmarks)
    }

    // 首肩ボリューム特徴を計算（有効な場合のみ）
    if (TRAPEZIUS_ENABLED && results.landmarks) {
      const trapeziusBaseData = calData?.trapeziusBaseData || null
      trapeziusRef.current = calculateTrapeziusFeatures(results.landmarks, trapeziusBaseData)
    }

    setCurrentAngle(absAngle)

    // 回旋中または静止判定中
    if (currentPhase === PHASE.ROTATING || currentPhase === PHASE.HOLDING) {
      // 最大角度更新
      if (absAngle > measurementRef.current.maxAngle) {
        measurementRef.current.maxAngle = absAngle
      }

      const minAngle = direction === 'up' ? MIN_ANGLE_UP : MIN_ANGLE_LR
      const resetThreshold = minAngle * 0.7 // リセット閾値は最小角度の70%（余裕を持たせる）

      // 角度が大きく下がった場合のみリセット（一瞬の検出ブレを許容）
      if (absAngle < resetThreshold) {
        measurementRef.current.holdStartTime = null
        setHoldProgress(0)
        phaseRef.current = PHASE.ROTATING
        setDisplayPhase(PHASE.ROTATING)
        return
      }

      // 最小角度以上ならホールド開始
      if (absAngle >= minAngle) {
        if (!measurementRef.current.holdStartTime) {
          measurementRef.current.holdStartTime = Date.now()
        }

        const holdTime = Date.now() - measurementRef.current.holdStartTime
        const progress = Math.min((holdTime / STILL_DURATION) * 100, 100)
        setHoldProgress(progress)
        setMessage('そのまま！')
        setSubMessage(direction === 'up' ? '音が鳴ったら完了' : '音が鳴ったら正面に戻って')
        phaseRef.current = PHASE.HOLDING
        setDisplayPhase(PHASE.HOLDING)

        if (holdTime >= STILL_DURATION) {
          // 成功！
          phaseRef.current = PHASE.SUCCESS
          setDisplayPhase(PHASE.SUCCESS)
          setMessage('')
          setSubMessage('')
          setHoldProgress(100)

          // OK音を再生
          playOkSound()

          // 上方向の場合は戻るフェーズをスキップして直接完了
          if (direction === 'up') {
            setTimeout(() => {
              const data = {
                direction,
                maxAngle: measurementRef.current.maxAngle,
                angleHistory: measurementRef.current.angleHistory,
                duration: Date.now() - measurementRef.current.startTime,
                timestamp: Date.now()
              }
              onCompleteRef.current(data, faceCombatRef.current, jujutsuRef.current, trapeziusRef.current)
            }, SUCCESS_DISPLAY_TIME)
          } else {
            // 右・左の場合は正面に戻るフェーズへ
            setTimeout(() => {
              phaseRef.current = PHASE.RETURN_INSTRUCTION
              setDisplayPhase(PHASE.RETURN_INSTRUCTION)
            }, SUCCESS_DISPLAY_TIME)

            setTimeout(() => {
              phaseRef.current = PHASE.RETURNING
              setDisplayPhase(PHASE.RETURNING)
              setMessage('正面へ。')
              setSubMessage('')
            }, SUCCESS_DISPLAY_TIME + 1500)
          }
        }
      }
    } else if (currentPhase === PHASE.RETURNING) {
      // まず目の位置をチェック
      let eyesAligned = false
      if (calData.baseEyePositions && results.faceData?.eyePositions) {
        const currentEyes = results.faceData.eyePositions
        const baseEyes = calData.baseEyePositions

        const leftDist = Math.sqrt(
          Math.pow(currentEyes.left.x - baseEyes.left.x, 2) +
          Math.pow(currentEyes.left.y - baseEyes.left.y, 2)
        )
        const rightDist = Math.sqrt(
          Math.pow(currentEyes.right.x - baseEyes.right.x, 2) +
          Math.pow(currentEyes.right.y - baseEyes.right.y, 2)
        )

        eyesAligned = leftDist < RETURN_EYE_THRESHOLD && rightDist < RETURN_EYE_THRESHOLD
      }

      // 目の位置が合っていない場合
      if (!eyesAligned) {
        setMessage('目を緑の円に合わせて')
        setSubMessage('')
        return
      }

      // 目の位置OK、正面復帰判定
      const currentYaw = results.angles.yaw
      const currentPitch = results.angles.pitch
      const baseYaw = calData.baseAngles.yaw
      const basePitch = calData.baseAngles.pitch
      const yawFromBase = Math.abs(currentYaw - baseYaw)
      const pitchFromBase = Math.abs(currentPitch - basePitch)

      setMessage('正面へ。')
      setSubMessage('')

      if (yawFromBase < RETURN_THRESHOLD_YAW && pitchFromBase < RETURN_THRESHOLD_PITCH) {
        // 二重呼び出し防止
        if (phaseRef.current !== PHASE.RETURNING) return
        phaseRef.current = 'COMPLETED'

        // 復帰完了
        const data = {
          direction,
          maxAngle: measurementRef.current.maxAngle,
          angleHistory: measurementRef.current.angleHistory,
          duration: Date.now() - measurementRef.current.startTime,
          timestamp: Date.now()
        }
        console.log('Calling onComplete with direction:', direction)
        onCompleteRef.current(data, faceCombatRef.current, jujutsuRef.current, trapeziusRef.current)
      }
    }
  }, [config, direction, resetMeasurement])

  const { isReady, error } = useFaceTracking(videoRef, canvasRef, handleResults)

  return (
    <div className="rotation-screen">
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

        {/* 中央線 */}
        <div className="center-line" />

        {/* 方向矢印 */}
        {(displayPhase === PHASE.ROTATING || displayPhase === PHASE.HOLDING) && (
          <DirectionArrow
            direction={direction}
            currentAngle={currentAngle}
            minAngle={direction === 'up' ? MIN_ANGLE_UP : MIN_ANGLE_LR}
          />
        )}

        {/* 静止進捗 */}
        {displayPhase === PHASE.HOLDING && (
          <div className="hold-progress-container">
            <div
              className="hold-progress"
              style={{ width: `${holdProgress}%` }}
            />
          </div>
        )}

        {/* 指示オーバーレイ */}
        {displayPhase === PHASE.INSTRUCTION && (
          <div className="instruction-overlay">
            <div className="big-direction">{config.label}を向き切って</div>
            <div className="instruction-sub">体は動かさず、頭だけ</div>
            <div className="instruction-sub">
              {direction === 'up' ? '音が鳴ったら完了' : '音が鳴ったら正面に戻って'}
            </div>
            {countdown && (
              <div className="countdown">{countdown}</div>
            )}
          </div>
        )}

        {/* 成功表示 */}
        {displayPhase === PHASE.SUCCESS && (
          <div className="success-overlay">
            <div className="success-icon pulse">✓</div>
          </div>
        )}

        {/* 正面に戻る指示 */}
        {displayPhase === PHASE.RETURN_INSTRUCTION && (
          <div className="return-overlay">
            <div className="return-message">正面に戻って</div>
            <div className="return-sub">目を緑の円に合わせて</div>
          </div>
        )}

        {/* READYオーバーレイ（目の位置合わせ） */}
        {displayPhase === PHASE.READY && (
          <div className="ready-overlay">
            <div className="ready-arrow">
              <svg width="100" height="100" viewBox="0 0 100 100">
                {direction === 'up' ? (
                  <path d="M50 10 L80 50 L65 50 L65 90 L35 90 L35 50 L20 50 Z" fill="var(--scouter-green)" />
                ) : direction === 'right' ? (
                  <path d="M90 50 L50 20 L50 35 L10 35 L10 65 L50 65 L50 80 Z" fill="var(--scouter-green)" />
                ) : (
                  <path d="M10 50 L50 20 L50 35 L90 35 L90 65 L50 65 L50 80 Z" fill="var(--scouter-green)" />
                )}
              </svg>
            </div>
            <div className="ready-message">目を緑の円に合わせて</div>
            <div className="ready-sub">合ったら{config.label}を向いて</div>
            {readyProgress > 0 && (
              <div className="ready-progress-container">
                <div
                  className="ready-progress"
                  style={{ width: `${readyProgress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* リカバリーオーバーレイ */}
        {displayPhase === PHASE.RECOVERY && (
          <div className="recovery-overlay">
            <div className="recovery-message">目を緑の円に合わせて</div>
            {recoveryProgress > 0 && (
              <div className="recovery-progress-container">
                <div
                  className="recovery-progress"
                  style={{ width: `${recoveryProgress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* 目の位置ガイド（常に表示） */}
        {calibrationData?.baseEyePositions && (
          <div className="eye-guide-container">
            {/* ターゲット位置（キャリブレーション時の目の位置）- 鏡像表示なのでx反転 */}
            <div
              className="eye-target left-eye"
              style={{
                left: `${(1 - calibrationData.baseEyePositions.left.x) * 100}%`,
                top: `${calibrationData.baseEyePositions.left.y * 100}%`
              }}
            />
            <div
              className="eye-target right-eye"
              style={{
                left: `${(1 - calibrationData.baseEyePositions.right.x) * 100}%`,
                top: `${calibrationData.baseEyePositions.right.y * 100}%`
              }}
            />
            {/* 現在の目の位置（常に表示） */}
            {currentEyePositions && (
              <>
                <div
                  className="eye-current left-eye"
                  style={{
                    left: `${(1 - currentEyePositions.left.x) * 100}%`,
                    top: `${currentEyePositions.left.y * 100}%`
                  }}
                />
                <div
                  className="eye-current right-eye"
                  style={{
                    left: `${(1 - currentEyePositions.right.x) * 100}%`,
                    top: `${currentEyePositions.right.y * 100}%`
                  }}
                />
              </>
            )}
          </div>
        )}

        {/* 角度表示 */}
        <div className="angle-display scouter-text">
          {currentAngle.toFixed(1)}°
        </div>
      </div>

      <div className="instruction-panel scouter-border">
        <h2 className="direction-label scouter-text">{config.label}回旋</h2>
        <p className="main-message scouter-text">{message}</p>
        {subMessage && <p className="sub-message">{subMessage}</p>}

        {!isReady && !error && (
          <p className="loading blink">準備中...</p>
        )}

        {error && (
          <p className="error-message">{error}</p>
        )}


        {/* リセットボタン（目の点が消えた時用） */}
        <button
          className="reset-tracking-button"
          onClick={() => window.location.reload()}
        >
          最初から
        </button>
      </div>
    </div>
  )
}

// 方向矢印コンポーネント
function DirectionArrow({ direction, currentAngle, minAngle }) {
  const isRight = direction === 'right'
  const isUp = direction === 'up'

  // 角度に応じて色の濃さを変更（0度で薄く、45度で最も濃く）
  const progress = Math.min(currentAngle / 45, 1)
  const isActive = currentAngle >= minAngle

  // SVGで太い矢印を描画
  const positionClass = isUp ? 'top' : isRight ? 'right' : 'left'

  return (
    <div className={`direction-arrow ${positionClass}`}>
      <svg
        width="120"
        height="120"
        viewBox="0 0 100 100"
        style={{
          filter: isActive
            ? `drop-shadow(0 0 ${20 + progress * 30}px rgba(0, 255, 65, ${0.5 + progress * 0.5}))`
            : `drop-shadow(0 0 10px rgba(0, 255, 65, 0.3))`
        }}
      >
        {isUp ? (
          // 上矢印
          <path
            d="M50 10 L80 50 L65 50 L65 90 L35 90 L35 50 L20 50 Z"
            fill={`rgba(0, 255, 65, ${0.7 + progress * 0.3})`}
            stroke="rgba(0, 255, 65, 1)"
            strokeWidth="3"
          />
        ) : isRight ? (
          // 右矢印
          <path
            d="M90 50 L50 20 L50 35 L10 35 L10 65 L50 65 L50 80 Z"
            fill={`rgba(0, 255, 65, ${0.7 + progress * 0.3})`}
            stroke="rgba(0, 255, 65, 1)"
            strokeWidth="3"
          />
        ) : (
          // 左矢印
          <path
            d="M10 50 L50 20 L50 35 L90 35 L90 65 L50 65 L50 80 Z"
            fill={`rgba(0, 255, 65, ${0.7 + progress * 0.3})`}
            stroke="rgba(0, 255, 65, 1)"
            strokeWidth="3"
          />
        )}
      </svg>
    </div>
  )
}

export default RotationScreen
