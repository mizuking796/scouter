// 闘争的フェイス特徴 表示セクション
// ※医学的・科学的根拠はなく、エンターテインメント目的

import { FACE_COMBAT_ENABLED, FEATURE_LABELS, FEATURE_DESCRIPTIONS } from '../features/faceCombat'
import FaceLandmarkDisplay from './FaceLandmarkDisplay'
import './FaceCombatSection.css'

function FaceCombatSection({ faceCombatData, calibrationData }) {
  // 機能が無効化されている場合は何も表示しない
  if (!FACE_COMBAT_ENABLED || !faceCombatData) {
    return null
  }

  const features = ['expression', 'gaze', 'fwhr', 'jaw', 'cheekbone']

  // キャリブレーション時のランドマーク（正面）を使用
  const landmarks = calibrationData?.baseLandmarks || faceCombatData.landmarks
  // アスペクト比を取得（デバッグ情報から）
  const aspectRatio = faceCombatData._debug?.aspectRatio
    ? parseFloat(faceCombatData._debug.aspectRatio)
    : 4/3

  return (
    <div className="face-combat-section">
      <h3 className="face-combat-title scouter-text">
        闘争的フェイス特徴
      </h3>

      <div className="face-combat-content">
        {/* 左側：顔のランドマーク表示 */}
        <div className="face-combat-left">
          <FaceLandmarkDisplay
            landmarks={landmarks}
            width={180}
            height={220}
            aspectRatio={aspectRatio}
          />
          <div className="face-combat-total-inline">
            <span className="face-combat-total-label">総合</span>
            <span className="face-combat-total-score">{faceCombatData.total.score}</span>
            <span className={`face-combat-total-rank rank-${faceCombatData.total.rank}`}>
              {faceCombatData.total.rank}
            </span>
          </div>
        </div>

        {/* 右側：スコア表 */}
        <div className="face-combat-right">
          <div className="face-combat-features">
            {features.map(key => {
              const feature = faceCombatData[key]
              if (!feature) return null

              return (
                <div key={key} className="face-combat-item">
                  <div className="face-combat-item-header">
                    <span className="face-combat-label">{FEATURE_LABELS[key]}</span>
                    <span className={`face-combat-rank rank-${feature.rank}`}>
                      {feature.rank}
                    </span>
                  </div>
                  <div className="face-combat-bar-container">
                    <div
                      className="face-combat-bar"
                      style={{ width: `${feature.score}%` }}
                    />
                  </div>
                  <div className="face-combat-score-value">{feature.score}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FaceCombatSection
