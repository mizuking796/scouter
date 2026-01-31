import { initAudio } from '../utils/sound'
import './StartScreen.css'

function StartScreen({ onStart }) {
  const handleStart = async () => {
    // ユーザー操作時に音声を有効化（ブラウザ制限対策）
    // 完全に初期化が終わるまで待つ（初回音声遅延防止）
    await initAudio()
    onStart()
  }

  return (
    <div className="start-screen">
      <div className="start-content">
        <h1 className="title scouter-text">戦闘力(仮)スカウター</h1>
        <p className="version">v1.0</p>

        <div className="description scouter-border">
          <p>468の特徴点から</p>
          <p className="highlight">戦闘力(仮)</p>
          <p>を測定します</p>
        </div>

        <div className="method">
          <p className="method-label">測定方法</p>
          <p className="scouter-text blink">向き切って、止まって、戻る</p>
        </div>

        <div className="notice">
          <p>※ 首が見える服装で行ってください</p>
          <p>※ カメラへのアクセスを許可してください</p>
        </div>

        <div className="terms-notice">
          <p>STARTを押すと<a href="/terms.html" target="_blank">利用規約</a>に同意したものとみなします</p>
        </div>

        <button className="scouter-button" onClick={handleStart}>
          START
        </button>
      </div>
    </div>
  )
}

export default StartScreen
