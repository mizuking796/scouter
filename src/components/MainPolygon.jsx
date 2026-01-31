import { Radar } from 'react-chartjs-2'
import './MainPolygon.css'

/**
 * メイン多角形（4軸）
 * ファーストビュー用の統合スコア表示
 */
function MainPolygon({ smoothness, neckIndex, shoulderVolume, faceFeatures }) {
  const chartData = {
    labels: ['スムーズネス', 'ネック指数', '首肩ボリューム', 'フェイス特徴'],
    datasets: [
      {
        label: 'スコア',
        data: [smoothness, neckIndex, shoulderVolume, faceFeatures],
        backgroundColor: 'rgba(0, 255, 65, 0.2)',
        borderColor: 'rgba(0, 255, 65, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(0, 255, 65, 1)',
        pointBorderColor: '#fff',
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ]
  }

  const chartOptions = {
    scales: {
      r: {
        angleLines: {
          color: 'rgba(0, 255, 65, 0.3)'
        },
        grid: {
          color: 'rgba(0, 255, 65, 0.2)'
        },
        pointLabels: {
          color: 'rgba(0, 255, 65, 0.9)',
          font: {
            family: 'Courier New',
            size: 12,
            weight: 'bold'
          }
        },
        ticks: {
          color: 'rgba(0, 255, 65, 0.5)',
          backdropColor: 'transparent',
          stepSize: 25,
          display: false
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
    <div className="main-polygon">
      <Radar data={chartData} options={chartOptions} />
    </div>
  )
}

export default MainPolygon
