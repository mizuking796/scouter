import { useMemo } from 'react'
import { Radar } from 'react-chartjs-2'
import { calculateHexagonAptitude, SPORTS, SPORT_NAMES, SPORT_COLORS } from '../features/hexagon'
import './HexagonSection.css'

/**
 * 六角形（6競技適性）表示セクション
 */
function HexagonSection({ staticNeckIndex, trapeziusData, jujutsuData, calibrationData }) {
  // 適性スコアを計算
  const hexagonData = useMemo(() => {
    return calculateHexagonAptitude({
      staticNeckIndex,
      trapeziusData,
      jujutsuData,
      calibrationData
    })
  }, [staticNeckIndex, trapeziusData, jujutsuData, calibrationData])

  if (!hexagonData) {
    return null
  }

  const { scores, comment, topSport, topSportName } = hexagonData

  // レーダーチャートデータ
  const chartData = {
    labels: SPORTS.map(s => SPORT_NAMES[s]),
    datasets: [
      {
        label: '適性スコア',
        data: SPORTS.map(s => scores[s]),
        backgroundColor: 'rgba(255, 165, 0, 0.2)',
        borderColor: 'rgba(255, 165, 0, 0.9)',
        borderWidth: 2,
        pointBackgroundColor: SPORTS.map(s => SPORT_COLORS[s]),
        pointBorderColor: '#fff',
        pointRadius: 5,
        pointHoverRadius: 7
      }
    ]
  }

  const chartOptions = {
    scales: {
      r: {
        angleLines: {
          color: 'rgba(255, 165, 0, 0.3)'
        },
        grid: {
          color: 'rgba(255, 165, 0, 0.2)'
        },
        pointLabels: {
          color: 'rgba(255, 165, 0, 0.9)',
          font: {
            family: 'Courier New',
            size: 11
          }
        },
        ticks: {
          color: 'rgba(255, 165, 0, 0.5)',
          backdropColor: 'transparent',
          stepSize: 20
        },
        suggestedMin: 0,
        suggestedMax: 100
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${context.raw}点`
        }
      }
    },
    maintainAspectRatio: true
  }

  return (
    <div className="hexagon-section scouter-border">
      <h3 className="section-title hexagon-title">6競技適性</h3>

      {/* レーダーチャート */}
      <div className="hexagon-chart-container">
        <Radar data={chartData} options={chartOptions} />
      </div>

      {/* スコア一覧 */}
      <div className="hexagon-scores">
        {SPORTS.map(sport => (
          <div key={sport} className="hexagon-score-item">
            <span
              className="hexagon-sport-dot"
              style={{ backgroundColor: SPORT_COLORS[sport] }}
            />
            <span className="hexagon-sport-name">{SPORT_NAMES[sport]}</span>
            <span className="hexagon-sport-score">{scores[sport]}</span>
          </div>
        ))}
      </div>

      {/* トップ適性 */}
      <div className="hexagon-top-sport">
        <span className="hexagon-top-label">最高適性:</span>
        <span
          className="hexagon-top-value"
          style={{ color: SPORT_COLORS[topSport] }}
        >
          {topSportName}
        </span>
      </div>

      {/* コメント */}
      <div className="hexagon-comment">
        <p>{comment}</p>
      </div>
    </div>
  )
}

export default HexagonSection
