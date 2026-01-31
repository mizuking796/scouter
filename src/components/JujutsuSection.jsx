// 柔術フェイス特徴 表示セクション
// 耳まわりの形状から、組み技寄りの雰囲気を可視化
// ※医学的根拠はなく、あくまでエンターテインメント目的

import { FACE_JUJUTSU_ENABLED } from '../features/faceJujutsu'
import JujutsuPolygon from './JujutsuPolygon'
import './JujutsuSection.css'

function JujutsuSection({ jujutsuData }) {
  // 機能が無効化されている場合は何も表示しない
  if (!FACE_JUJUTSU_ENABLED || !jujutsuData) {
    return null
  }

  return (
    <div className="jujutsu-section">
      <h3 className="jujutsu-title scouter-text">
        柔術フェイス特徴
      </h3>
      <p className="jujutsu-disclaimer">
        耳まわりの形状から見た、組み技寄りの雰囲気を示します
      </p>

      <div className="jujutsu-content">
        {/* 左側：多角形チャート */}
        <div className="jujutsu-left">
          <JujutsuPolygon
            contourScore={jujutsuData.contour?.average || 50}
            asymmetryScore={jujutsuData.asymmetry?.score || 50}
            thicknessScore={jujutsuData.thickness?.average || 50}
            continuityScore={jujutsuData.continuity?.average || 50}
            width={130}
            height={130}
          />
        </div>

        {/* 右側：スコア */}
        <div className="jujutsu-right">
          <div className="jujutsu-score-display">
            <span className="jujutsu-score-value">{jujutsuData.score}</span>
            <span className={`jujutsu-rank rank-${jujutsuData.rank}`}>
              {jujutsuData.rank}
            </span>
          </div>

          {/* 高スコア時のコメント */}
          {jujutsuData.comment && (
            <div className="jujutsu-comment">
              「{jujutsuData.comment}」
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default JujutsuSection
