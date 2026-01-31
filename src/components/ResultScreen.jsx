import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js'
import { Radar } from 'react-chartjs-2'
import {
  calculateSmoothness,
  calculateStaticNeckIndex,
  calculateDynamicNeckIndex,
  calculateBalance,
  getRank,
  getRankStaticNeck,
  getRankBalance,
  formatNumber
} from '../utils/calculations'
import {
  adjustStaticNeckScore,
  adjustBalanceScore,
  calculateBaseScore,
  calculateDisplayCombatPower
} from '../features/scoring'
import MainPolygon from './MainPolygon'
import FaceCombatSection from './FaceCombatSection'
import HexagonSection from './HexagonSection'
import './ResultScreen.css'

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip
)

// ひとこと評価を生成
function generateOneLineComment(mainScores) {
  const { smoothness, neckIndex, shoulderVolume, faceFeatures } = mainScores
  const avg = (smoothness + neckIndex + shoulderVolume + faceFeatures) / 4

  // 最も高いスコアを特定
  const scores = [
    { name: 'smoothness', value: smoothness },
    { name: 'neckIndex', value: neckIndex },
    { name: 'shoulderVolume', value: shoulderVolume },
    { name: 'faceFeatures', value: faceFeatures }
  ]
  const top = scores.sort((a, b) => b.value - a.value)[0]

  if (avg >= 70) {
    return '総合的に高い水準の特徴'
  }

  switch (top.name) {
    case 'smoothness':
      return '動作の滑らかさが特徴的'
    case 'neckIndex':
      return '首の安定性・厚みが特徴的'
    case 'shoulderVolume':
      return '首肩まわりの形状が特徴的'
    case 'faceFeatures':
      return '顔の構造的特徴が際立つ'
    default:
      return 'バランス型の特徴'
  }
}

// 軌跡プロットコンポーネント（重心動揺計風）
function TrajectoryPlot({ rightData, leftData, upData }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height
    const centerX = width / 2
    const centerY = height / 2

    // 背景をクリア
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)'
    ctx.fillRect(0, 0, width, height)

    // グリッド描画
    ctx.strokeStyle = 'rgba(0, 255, 65, 0.2)'
    ctx.lineWidth = 1

    // 同心円
    for (let r = 30; r <= 120; r += 30) {
      ctx.beginPath()
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2)
      ctx.stroke()
    }

    // 十字線
    ctx.beginPath()
    ctx.moveTo(centerX, 10)
    ctx.lineTo(centerX, height - 10)
    ctx.moveTo(10, centerY)
    ctx.lineTo(width - 10, centerY)
    ctx.stroke()

    // 方向ラベル
    ctx.fillStyle = 'rgba(0, 255, 65, 0.6)'
    ctx.font = '12px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('上', centerX, 20)
    ctx.fillText('右', width - 15, centerY + 4)
    ctx.fillText('左', 15, centerY + 4)

    // 軌跡を描画する関数
    const drawTrajectory = (data, color) => {
      if (!data || data.length < 2) return

      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()

      data.forEach((point, i) => {
        if (!point.faceData?.landmarks?.nose) return

        const nose = point.faceData.landmarks.nose
        const x = centerX + (nose.x - 320) * 0.8
        const y = centerY + (nose.y - 240) * 0.8

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      ctx.stroke()

      // 終点にマーカー
      if (data.length > 0) {
        const lastPoint = data[data.length - 1]
        if (lastPoint.faceData?.landmarks?.nose) {
          const nose = lastPoint.faceData.landmarks.nose
          const x = centerX + (nose.x - 320) * 0.8
          const y = centerY + (nose.y - 240) * 0.8
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(x, y, 5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    // 各方向の軌跡を描画
    drawTrajectory(rightData, 'rgba(0, 255, 65, 0.8)')
    drawTrajectory(leftData, 'rgba(65, 200, 255, 0.8)')
    drawTrajectory(upData, 'rgba(255, 200, 65, 0.8)')

    // 凡例
    ctx.font = '11px monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(0, 255, 65, 0.8)'
    ctx.fillText('● 右', 10, height - 35)
    ctx.fillStyle = 'rgba(65, 200, 255, 0.8)'
    ctx.fillText('● 左', 10, height - 22)
    ctx.fillStyle = 'rgba(255, 200, 65, 0.8)'
    ctx.fillText('● 上', 10, height - 9)

  }, [rightData, leftData, upData])

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={280}
      className="trajectory-canvas"
    />
  )
}

function ResultScreen({ calibrationData, measurementData, faceCombatData, jujutsuData, trapeziusData }) {
  const [displayPower, setDisplayPower] = useState(0)
  const [showDetails, setShowDetails] = useState(false)

  // スコア計算（内部スコア）
  const scores = useMemo(() => {
    const rightSmoothness = calculateSmoothness(measurementData.right?.angleHistory)
    const leftSmoothness = calculateSmoothness(measurementData.left?.angleHistory)
    const upSmoothness = calculateSmoothness(measurementData.up?.angleHistory)
    const staticNeckIndex = calculateStaticNeckIndex(calibrationData, measurementData)
    const dynamicNeckIndex = calculateDynamicNeckIndex(calibrationData, measurementData.up)
    const shoulderVolume = trapeziusData?.visible ? trapeziusData.score : 0

    return {
      rightSmoothness,
      leftSmoothness,
      upSmoothness,
      staticNeckIndex,
      dynamicNeckIndex,
      shoulderVolume
    }
  }, [calibrationData, measurementData, trapeziusData])

  // 表示用スコア（ガンマ補正適用）
  const displayScores = useMemo(() => {
    return {
      ...scores,
      staticNeckIndex: adjustStaticNeckScore(scores.staticNeckIndex)
    }
  }, [scores])

  const balance = useMemo(() => {
    return calculateBalance(scores.rightSmoothness, scores.leftSmoothness)
  }, [scores])

  const displayBalance = useMemo(() => {
    return {
      ...balance,
      score: adjustBalanceScore(balance.score)
    }
  }, [balance])

  // 戦闘力（指数関数スケーリング）
  const combatPower = useMemo(() => {
    const baseScore = calculateBaseScore(scores)
    return calculateDisplayCombatPower(baseScore)
  }, [scores])

  // メイン多角形用の統合スコア
  const mainScores = useMemo(() => {
    return {
      smoothness: Math.round((scores.rightSmoothness + scores.leftSmoothness + scores.upSmoothness) / 3),
      neckIndex: Math.round((displayScores.staticNeckIndex + scores.dynamicNeckIndex) / 2),
      shoulderVolume: scores.shoulderVolume,
      faceFeatures: faceCombatData?.total?.score || 0
    }
  }, [scores, displayScores, faceCombatData])

  // ひとこと評価
  const oneLineComment = useMemo(() => {
    return generateOneLineComment(mainScores)
  }, [mainScores])

  // 戦闘力カウントアップアニメーション
  useEffect(() => {
    const duration = 2500
    const steps = 50
    let step = 0

    const timer = setInterval(() => {
      step++
      const progress = step / steps
      const easedProgress = progress * progress * progress
      const current = Math.round(combatPower * easedProgress)

      setDisplayPower(current)

      if (step >= steps) {
        setDisplayPower(combatPower)
        clearInterval(timer)
        setTimeout(() => setShowDetails(true), 300)
      }
    }, duration / steps)

    return () => clearInterval(timer)
  }, [combatPower])

  // 詳細スコア用6軸レーダーチャート
  const detailChartData = {
    labels: [
      '右スムーズネス',
      '左スムーズネス',
      '上スムーズネス',
      'ネック指数(静)',
      'ネック指数(動)',
      '首肩ボリューム'
    ],
    datasets: [
      {
        label: 'スコア',
        data: [
          displayScores.rightSmoothness,
          displayScores.leftSmoothness,
          displayScores.upSmoothness,
          displayScores.staticNeckIndex,
          displayScores.dynamicNeckIndex,
          displayScores.shoulderVolume
        ],
        backgroundColor: 'rgba(0, 255, 65, 0.2)',
        borderColor: 'rgba(0, 255, 65, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(0, 255, 65, 1)',
        pointBorderColor: '#fff'
      }
    ]
  }

  const detailChartOptions = {
    scales: {
      r: {
        angleLines: { color: 'rgba(0, 255, 65, 0.3)' },
        grid: { color: 'rgba(0, 255, 65, 0.2)' },
        pointLabels: {
          color: 'rgba(0, 255, 65, 0.8)',
          font: { family: 'Courier New', size: 10 }
        },
        ticks: {
          color: 'rgba(0, 255, 65, 0.5)',
          backdropColor: 'transparent',
          stepSize: 20
        },
        suggestedMin: 0,
        suggestedMax: 100
      }
    },
    plugins: { legend: { display: false } },
    maintainAspectRatio: true
  }

  const scoreItems = [
    { label: '右スムーズネス', value: displayScores.rightSmoothness, rankFn: getRank },
    { label: '左スムーズネス', value: displayScores.leftSmoothness, rankFn: getRank },
    { label: '上スムーズネス', value: displayScores.upSmoothness, rankFn: getRank },
    { label: 'ネック指数(静)', value: displayScores.staticNeckIndex, rankFn: getRankStaticNeck },
    { label: 'ネック指数(動)', value: displayScores.dynamicNeckIndex, rankFn: getRank },
    { label: '首肩ボリューム', value: displayScores.shoulderVolume, rankFn: getRank }
  ]

  return (
    <div className="result-screen">
      {/* ========== ファーストビュー（スクショ用） ========== */}
      <div className="first-view">
        {/* タイトル */}
        <h1 className="result-title scouter-text">戦闘力(仮)</h1>

        {/* 戦闘力 */}
        <div className="combat-power-hero">
          <div className="combat-power-value scouter-text">
            {formatNumber(displayPower)}
          </div>
        </div>

        {/* メイン多角形 + 4項目スコアカード */}
        {showDetails && (
          <div className="main-content-row">
            <div className="polygon-wrapper">
              <MainPolygon
                smoothness={mainScores.smoothness}
                neckIndex={mainScores.neckIndex}
                shoulderVolume={mainScores.shoulderVolume}
                faceFeatures={mainScores.faceFeatures}
              />
            </div>
            <div className="main-scores-card">
              <div className="main-score-item">
                <span className="main-score-label">スムーズネス</span>
                <span className="main-score-value">{mainScores.smoothness}</span>
              </div>
              <div className="main-score-item">
                <span className="main-score-label">ネック指数</span>
                <span className="main-score-value">{mainScores.neckIndex}</span>
              </div>
              <div className="main-score-item">
                <span className="main-score-label">首肩ボリューム</span>
                <span className="main-score-value">{mainScores.shoulderVolume}</span>
              </div>
              <div className="main-score-item">
                <span className="main-score-label">フェイス特徴</span>
                <span className="main-score-value">{mainScores.faceFeatures}</span>
              </div>
            </div>
          </div>
        )}

        {/* ひとこと評価 */}
        {showDetails && (
          <div className="one-line-comment scouter-border">
            <p>{oneLineComment}</p>
          </div>
        )}

        {/* 注意書き */}
        {showDetails && (
          <p className="first-view-disclaimer">
            ※ 468の特徴点を解析した参考値です
          </p>
        )}
      </div>

      {/* ========== セカンドビュー（6競技適性） ========== */}
      {showDetails && (
        <div className="second-view">
          <HexagonSection
            staticNeckIndex={scores.staticNeckIndex}
            trapeziusData={trapeziusData}
            jujutsuData={jujutsuData}
            calibrationData={calibrationData}
          />
        </div>
      )}

      {/* ========== サードビュー（詳細） ========== */}
      {showDetails && (
        <div className="third-view">
          {/* 詳細スコア */}
          <div className="detail-section">
            <h3 className="section-title scouter-text">詳細スコア</h3>

            <div className="detail-chart-container">
              <Radar data={detailChartData} options={detailChartOptions} />
            </div>

            <div className="scores-container">
              {scoreItems.map(item => {
                const rank = item.rankFn(item.value)
                return (
                  <div key={item.label} className="score-item">
                    <span className="score-label">{item.label}</span>
                    <span className="score-value">{item.value}</span>
                    <span className={`score-rank rank-${rank}`}>{rank}</span>
                  </div>
                )
              })}
              <div className="score-item balance-item">
                <span className="score-label">左右バランス</span>
                <span className="score-value">{displayBalance.score}</span>
                <span className={`score-rank rank-${getRankBalance(displayBalance.score)}`}>
                  {getRankBalance(displayBalance.score)}
                </span>
              </div>
            </div>
          </div>

          {/* 回旋軌跡 */}
          <div className="trajectory-section">
            <h3 className="section-title scouter-text">回旋軌跡</h3>
            <div className="trajectory-container">
              <TrajectoryPlot
                rightData={measurementData.right?.angleHistory}
                leftData={measurementData.left?.angleHistory}
                upData={measurementData.up?.angleHistory}
              />
            </div>
          </div>

          {/* 最大回旋角度 */}
          <div className="angles-section">
            <h3 className="section-title scouter-text">最大回旋角度</h3>
            <div className="lr-comparison">
              <div className="lr-bar-container">
                <div className="lr-label left">左</div>
                <div className="lr-bars">
                  <div className="lr-bar-wrapper left">
                    <div
                      className="lr-bar left-bar"
                      style={{ width: `${Math.min((measurementData.left?.maxAngle || 0) / 90 * 100, 100)}%` }}
                    />
                  </div>
                  <div className="lr-center-line" />
                  <div className="lr-bar-wrapper right">
                    <div
                      className="lr-bar right-bar"
                      style={{ width: `${Math.min((measurementData.right?.maxAngle || 0) / 90 * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="lr-label right">右</div>
              </div>
              <div className="lr-values">
                <span className="lr-value">{measurementData.left?.maxAngle?.toFixed(1) || '-'}°</span>
                <span className="lr-diff">
                  差: {Math.abs((measurementData.right?.maxAngle || 0) - (measurementData.left?.maxAngle || 0)).toFixed(1)}°
                </span>
                <span className="lr-value">{measurementData.right?.maxAngle?.toFixed(1) || '-'}°</span>
              </div>
            </div>
            <div className="up-angle">
              <span className="angle-direction">上</span>
              <span className="angle-value">{measurementData.up?.maxAngle?.toFixed(1) || '-'}°</span>
            </div>
          </div>

          {/* 闘争的フェイス特徴 */}
          <FaceCombatSection faceCombatData={faceCombatData} calibrationData={calibrationData} />

          {/* 免責事項 */}
          <div className="final-disclaimer">
            <p>
              ※ 本サービスはエンターテインメント目的の参考指標です。
              医療・能力評価目的ではありません。
            </p>
          </div>

          {/* 技術詳細リンク */}
          <div className="details-link-section">
            <a href="./details.html">
              評価の詳細・技術解説
            </a>
          </div>

          {/* リトライボタン */}
          <button
            className="scouter-button retry-button"
            onClick={() => window.location.reload()}
          >
            RETRY
          </button>
        </div>
      )}
    </div>
  )
}

export default ResultScreen
