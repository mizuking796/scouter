# 戦闘力(仮)スカウター 技術実装記録

**形式**: ホワイトペーパー/技術報告書
**対象**: 査読なし論文・社内技術ドキュメント
**最終更新**: 2026年2月

---

## 章構成

```
1. システム構成と技術選定
2. 顔検出・座標処理
3. キャリブレーション設計
4. 回旋測定と品質評価
5. 特徴量計算
6. スコアリングと正規化
7. デバイス間整合性
8. 音声フィードバック
9. UI/UX設計
10. エラーハンドリングとガード
11. 開発中の変更・修正履歴
12. 採用しなかった設計
13. 意図せず重要になった工夫
14. オフラインツール群（概要）
15. 画像収集システム
16. 特徴量抽出システム
17. 六角形算出システム
18. 静的ドキュメント
19. デプロイ構成
```

---

## 1. システム構成と技術選定

### 1.1 採用技術

| 領域 | 技術 | バージョン |
|------|------|-----------|
| フレームワーク | React | 19 |
| ビルド | Vite | 7.3.1 |
| 顔検出 | MediaPipe Face Mesh | tasks-vision 0.10.x |
| チャート | Chart.js | 4.x |
| 音声 | Web Audio API | - |
| デプロイ | GitHub Actions → GitHub Pages | - |

### 1.2 ファイル構成の分離方針

- `components/`: UI表示のみ（状態計算を含まない）
- `features/`: 特徴量計算（UI非依存）
- `hooks/`: カメラ制御・顔追跡（副作用管理）
- `utils/`: 純粋関数（音声生成、スコア計算）

### 1.3 状態管理

- `useState` のみ使用
- Redux/Zustand 等の状態管理ライブラリは不使用
- フェーズ間データは親コンポーネント (`App.jsx`) で保持

### 1.4 ディレクトリ構造

```
src/
├── components/     # UI コンポーネント
│   ├── StartScreen.jsx
│   ├── CalibrationScreen.jsx
│   ├── RotationScreen.jsx
│   ├── ResultScreen.jsx
│   ├── FaceCombatSection.jsx
│   ├── FaceLandmarkDisplay.jsx
│   └── *.css
├── features/       # 特徴量計算ロジック
│   ├── faceCombat/
│   │   ├── index.js
│   │   ├── constants.js
│   │   ├── fwhr.js
│   │   ├── cheekbone.js
│   │   ├── jawLine.js
│   │   ├── gazeStability.js
│   │   └── expressionSuppression.js
│   ├── jujutsu/
│   └── trapezius/
├── hooks/
│   └── useFaceTracking.js
└── utils/
    ├── sound.js
    └── hexagon.js
```

---

## 2. 顔検出・座標処理

### 2.1 MediaPipe 初期化

```javascript
FaceLandmarker.createFromOptions(filesetResolver, {
  baseOptions: { modelAssetPath: CDN_URL, delegate: 'GPU' },
  runningMode: 'VIDEO',
  numFaces: 1,
  outputFaceBlendshapes: false,
  outputFacialTransformationMatrixes: false
})
```

- `outputFaceBlendshapes: false`: 表情係数は不要のため無効化
- `outputFacialTransformationMatrixes: false`: 変換行列も不要

### 2.2 座標系

- MediaPipe出力: 正規化座標 (0.0〜1.0)
- x: 左端=0, 右端=1
- y: 上端=0, 下端=1
- z: 顔の前方向が負値

### 2.3 鏡像処理

- カメラ映像: `transform: scaleX(-1)` でCSS反転
- ランドマーク計算: 反転なし（内部計算は元座標）
- 描画時のみx座標を反転

### 2.4 使用ランドマーク一覧

| 部位 | インデックス | 用途 |
|------|-------------|------|
| 鼻先 | 1 | 顔中心 |
| 左目外側 | 33 | 角度計算 |
| 右目外側 | 263 | 角度計算 |
| 左目内側 | 133 | 目幅計算 |
| 右目内側 | 362 | 目幅計算 |
| 左耳 | 234 | 肩幅推定 |
| 右耳 | 454 | 肩幅推定 |
| 顎中央 | 152 | 顔高さ |
| 額中央 | 10 | 顔高さ |
| 左頬骨 | 123 | fWHR |
| 右頬骨 | 352 | fWHR |
| 顎左 | 172 | 顎幅 |
| 顎右 | 397 | 顎幅 |
| 口上端 | 13 | fWHR高さ |
| 左眉内側 | 107 | fWHR高さ |
| 右眉内側 | 336 | fWHR高さ |
| 左虹彩 | 468 | 視線追跡 |
| 右虹彩 | 473 | 視線追跡 |

---

## 3. キャリブレーション設計

### 3.1 静止検出

- 必要静止時間: 2秒
- 判定: 連続フレームで角度変化 < 閾値

### 3.2 位置・角度の許容範囲

```javascript
const ANGLE_CENTER_THRESHOLD = 25  // 角度 ±25° 以内
const POSITION_CENTER_THRESHOLD = 100  // 中央から100px以内
```

### 3.3 ガイドUI

- 楕円ガイド: `top: 40%` (中央より上)
- 中央線: 縦方向の位置合わせ用
- 目の位置マーカー: キャリブレーション中のみ表示

### 3.4 保存データ

```javascript
calibrationData = {
  baseLandmarks: [...],      // 基準ランドマーク468点
  baseYaw: number,           // 基準Yaw角度
  basePitch: number,         // 基準Pitch角度
  faceWidth: number,         // 顔幅（静的ネック指数用）
  jawWidth: number,          // 顎幅
  staticNeckScore: number    // 静的ネック指数
}
```

### 3.5 開発中の変更

- 当初 `ANGLE_CENTER_THRESHOLD = 15` → 25 に緩和（厳しすぎて開始できない問題）
- 当初 `POSITION_CENTER_THRESHOLD = 80` → 100 に緩和

---

## 4. 回旋測定と品質評価

### 4.1 測定フェーズ

1. **待機**: 正面を向いて開始待ち
2. **回旋中**: 指定方向への回旋を検出
3. **静止検出**: 最大回旋位置で静止
4. **復帰待ち**: 正面への復帰を検出
5. **完了**: 次フェーズへ遷移

### 4.2 回旋検出閾値

| 方向 | 最小角度 | 静止判定時間 | 静止判定速度 |
|------|---------|-------------|-------------|
| 右 | 30° | 0.5秒 | < 2°/s |
| 左 | 30° | 0.5秒 | < 2°/s |
| 上 | 20° | 0.5秒 | < 2°/s |

### 4.3 スムーズネス計算

#### 評価区間の限定

```javascript
// 最大角度の10%〜90%の区間のみ評価
const startThreshold = maxAngle * 0.1
const endThreshold = maxAngle * 0.9
```

- 理由: 開始・終了付近のノイズ除外

#### ガクつき検出 (Jerk Detection)

```javascript
// 条件1: 角速度の符号反転 + 両方の絶対値 > 5°/s
if (v1 * v2 < 0 && Math.abs(v1) > 5 && Math.abs(v2) > 5) jerks++

// 条件2: 角加速度 > 100°/s²
if (Math.abs(acceleration) > 100) jerks++
```

#### 微停止検出 (Micro-Stop Detection)

```javascript
// 一時的に速度が落ちて再び上がる
if (v1 < 0.01 && v2 > 0.05) microStops++
```

#### スコア計算

```javascript
const jerkPenalty = Math.min(jerks * 5, 40)
const stopPenalty = Math.min(microStops * 3, 20)
const score = Math.max(0, 100 - jerkPenalty - stopPenalty)
```

- ペナルティ上限あり（過度な減点防止）

### 4.4 軌跡データ構造

```javascript
trajectory = [
  { angle: number, timestamp: number },
  ...
]
```

---

## 5. 特徴量計算

### 5.1 履歴による平滑化

- 全特徴量で `MAX_HISTORY = 30` フレームの移動平均
- 単発ノイズの影響を軽減

### 5.2 静的ネック指数

```javascript
ratio = jawWidth / faceWidth
```

- 区分線形スコアリング（6区間）

| 比率 | スコア範囲 |
|------|-----------|
| ≤ 0.80 | 0-15 |
| 0.80-0.90 | 15-35 |
| 0.90-1.00 | 35-55 |
| 1.00-1.10 | 55-75 |
| 1.10-1.20 | 75-90 |
| > 1.20 | 90-100 |

### 5.3 動的ネック指数

```javascript
changeRatio = Math.abs(endJawWidth - startJawWidth) / faceWidth
```

- 上向き回旋時の顎幅変化を測定

### 5.4 首肩ボリューム (3指標)

```javascript
// 肩幅推定
estimatedShoulderWidth = earWidth * 1.3 + jawWidth * 0.2
widthRatio = estimatedShoulderWidth / faceWidth

// 肩傾斜（耳から顎への角度）
slopeAngle = atan2(dy, dx)

// 肩面積（三角形近似）
areaRatio = triangleArea / faceArea
```

### 5.5 闘争的フェイス特徴 (5指標)

#### 表情抑制

- 口の開き変化、眉の高さ変化を検出
- 変化が少ないほど高スコア

#### 視線安定

- 虹彩位置の標準偏差を計算
- ブレが少ないほど高スコア

#### fWHR

```javascript
fWHR = (cheekboneWidth / faceHeight) * aspectRatio
// スコア: 1.2〜1.8 を 0〜100 に正規化
```

#### 顎ライン

```javascript
jawAngle = atan2(jawCorner.y - chin.y, jawCorner.x - chin.x)
// 角度が小さいほど（シャープなほど）高スコア
```

#### 頬骨突出度

```javascript
prominence = (zygoWidth - avgLowerFaceWidth) / zygoWidth
// スコア: 0.01〜0.10 を 0〜100 に正規化
```

### 5.6 耳解析 (内部特徴量)

- 輪郭不規則性、左右非対称、局所的膨らみ、輪郭連続性
- UIには非表示
- 6競技適性の入力として使用

---

## 6. スコアリングと正規化

### 6.1 正規化関数

```javascript
function normalizeScore(value, min, max) {
  const clamped = Math.max(min, Math.min(max, value))
  return Math.round(((clamped - min) / (max - min)) * 100)
}
```

### 6.2 ガンマ補正

```javascript
// 静的ネック指数: γ = 1.2
displayScore = Math.pow(rawScore / 100, 1.2) * 100

// 左右バランス: γ = 1.3
displayScore = Math.pow(rawScore / 100, 1.3) * 100
```

- 高スコアを出にくくする調整
- 内部計算には影響なし（表示のみ）

### 6.3 ランク判定

| ランク | 閾値 |
|--------|------|
| S | 80+ |
| A | 60+ |
| B | 40+ |
| C | 20+ |
| D | 0-19 |

### 6.4 6競技適性 (ファジィ推論)

#### 入力特徴量 (正規化 0-1)

| 変数 | 内容 |
|------|------|
| NS_raw | 静的ネック指数 |
| NV_raw | 首肩ボリューム |
| TT_raw | 体幹厚み |
| SH_raw | 肩幅比 |
| EJ_raw | 柔術スコア |
| FA_crop | 顔非対称性 |
| NJ_crop | 首顎角度 |

#### 線形スコアリング（重み固定）

```javascript
score_judo = 0.45×NV + 0.35×NS + 0.20×SH
score_wrestling = 0.35×NV + 0.30×NS + 0.20×TT + 0.15×EJ
score_bjj = 0.40×EJ + 0.25×NS + 0.20×SH + 0.15×NV
score_mma = 0.25×NV + 0.20×NS + 0.15×TT + 0.20×FA + 0.20×EJ
score_boxing = 0.35×FA + 0.25×NJ - 0.25×NV - 0.15×TT
score_kick = 0.30×NJ + 0.30×NS + 0.20×TT + 0.20×FA
```

#### ファジィ補正

- 柔道・レスリング・柔術のみに適用
- 最大ボーナス: 10点
- ボクシング・MMA・キックは補正なし

### 6.5 戦闘力計算

```javascript
baseScore = (right + left + up + staticNeck + dynamicNeck + shoulder) / 6
combatPower = Math.exp(0.13 * baseScore)
```

---

## 7. デバイス間整合性

### 7.1 問題の発見経緯

- PC (横長 1.33) とスマホ (縦長 0.75) で同一人物の計測結果が大きく異なった
- fWHR、頬骨値に顕著な差異

### 7.2 アスペクト比の取得方法

```javascript
// videoRef から実際の映像サイズを取得
let aspectRatio = 4/3  // デフォルト
if (videoRef.current?.videoWidth > 0) {
  aspectRatio = videoRef.current.videoWidth / videoRef.current.videoHeight
}
```

- Canvas サイズではなく Video の実サイズを使用

### 7.3 fWHR のアスペクト比補正

```javascript
// 正規化座標での比率を物理的比率に変換
rawRatio = cheekboneWidth / faceHeight
fwhr = rawRatio * aspectRatio
```

### 7.4 頬骨計算のスケール不変化

```javascript
// 変更前: 絶対差（スケール依存）
prominence = zygoWidth - avgLowerFaceWidth

// 変更後: 比率（スケール不変）
prominence = (zygoWidth - avgLowerFaceWidth) / zygoWidth
```

### 7.5 顔メッシュ描画のアスペクト比補正

```javascript
// FaceLandmarkDisplay.jsx
const transform = (lm) => ({
  x: w - (lm.x * aspectRatio * scale + offsetX),
  y: lm.y * scale + offsetY
})
```

- x座標にアスペクト比を乗算
- PC・スマホで同じ顔形状を表示

### 7.6 補正後の検証結果

| 指標 | 補正前差異 | 補正後差異 |
|------|-----------|-----------|
| fWHR | 0.3+ | 0.02 |
| cheekbone | 0.02 | 0.002 |

---

## 8. 音声フィードバック

### 8.1 Web Audio API 選択理由

- `<audio>` 要素: 遅延が大きい
- Web Audio API: 低遅延で即時再生可能

### 8.2 AudioContext の事前初期化

```javascript
// StartScreen.jsx - STARTボタン押下時
export async function initAudio() {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  if (audioContext.state === 'suspended') {
    await audioContext.resume()
  }
  // ウォームアップ用サイレント音を再生
  playWarmupSound()
}
```

- ユーザー操作起点で初期化（ブラウザ制限対策）
- サイレント音で AudioContext をウォームアップ

### 8.3 ビープ音生成

```javascript
function playOkSound() {
  if (!audioContext || audioContext.state !== 'running') return

  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()

  oscillator.type = 'square'
  oscillator.frequency.setValueAtTime(880, now)
  oscillator.frequency.setValueAtTime(1760, now + 0.1)

  gainNode.gain.setValueAtTime(0.3, now)
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2)

  oscillator.start(now)
  oscillator.stop(now + 0.2)
}
```

### 8.4 開発中の変更

- 当初 `async/await` で再生 → 同期的に即時再生に変更
- 理由: 回旋完了時の音が遅れる問題

### 8.5 再生タイミング

- 回旋完了検出時に即時呼び出し
- 正面復帰時ではなく、最大回旋静止時に再生

---

## 9. UI/UX設計

### 9.1 デザインコンセプト

- スカウター風（ドラゴンボール）
- 蛍光緑 `#00ff41` を基調

### 9.2 CSS変数

```css
:root {
  --scouter-green: #00ff41;
  --scouter-green-dim: #00aa2a;
  --scouter-green-glow: rgba(0, 255, 65, 0.5);
  --scouter-bg: #0a0a0a;
}
```

### 9.3 スキャンラインエフェクト

```css
.scanline-overlay {
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.1) 0px,
    rgba(0, 0, 0, 0.1) 1px,
    transparent 1px,
    transparent 2px
  );
}
```

### 9.4 数値カウントアップアニメーション

```javascript
// 0 から目標値まで徐々に増加
useEffect(() => {
  const interval = setInterval(() => {
    setDisplayPower(prev => {
      const next = prev + Math.ceil((targetPower - prev) / 10)
      return next >= targetPower ? targetPower : next
    })
  }, 50)
}, [targetPower])
```

### 9.5 レスポンシブ対応

| ブレークポイント | 対象 |
|-----------------|------|
| ≤ 380px | 非常に狭いスマホ |
| ≤ 600px portrait | スマホ縦 |
| ≤ 900px landscape | スマホ/タブレット横 |
| > 900px | PC |

### 9.6 横向き警告オーバーレイ

```css
@media (max-width: 900px) and (orientation: landscape) {
  .landscape-warning {
    display: flex;
  }
}
```

- モバイル横向き時のみ表示
- 「📱 縦向きにしてください」

### 9.7 テキスト改行制御

```css
.start-content {
  word-break: keep-all;      /* 日本語の途中で改行しない */
  overflow-wrap: break-word; /* 長い単語は折り返し */
}
```

- 明示的 `<br>` で改行位置を制御

### 9.8 ボタン・パネルの重なり防止

```css
.instruction-panel {
  padding-bottom: 40px; /* 最初からボタン用のスペース */
}
.reset-tracking-button {
  position: absolute;
  bottom: 8px;
  right: 8px;
}
```

---

## 10. エラーハンドリングとガード

### 10.1 カメラアクセス

```javascript
try {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true })
} catch (error) {
  setError('カメラへのアクセスが許可されていません')
}
```

### 10.2 顔検出失敗時のデフォルト値

```javascript
if (!landmarks || landmarks.length < 468) {
  return { score: 50, rank: 'B', details: {} }
}
```

- 中間的なデフォルト値を返却
- UIがクラッシュしない

### 10.3 ゼロ除算防止

```javascript
// fWHR
if (faceHeight < 0.01) return 1.9

// 頬骨
prominence = zygoWidth > 0 ? (zygoWidth - avgLowerFaceWidth) / zygoWidth : 0

// 位置比率
position = faceHeight > 0 ? (zygoY - forehead.y) / faceHeight : 0.4
```

### 10.4 ランドマーク不在チェック

```javascript
if (!leftCheek || !rightCheek) {
  console.warn('fWHR: 頬骨ランドマークが見つかりません')
  return 1.9
}
```

### 10.5 最低スコア保証

```javascript
const score = Math.max(5, rawScore)  // fWHR: 最低5点
const finalScore = Math.max(0, Math.min(100, score))  // 0-100にクリップ
```

### 10.6 videoRef の null チェック

```javascript
if (videoRef.current && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
  actualAspectRatio = videoRef.current.videoWidth / videoRef.current.videoHeight
}
```

### 10.7 履歴配列の上限管理

```javascript
history.push(newValue)
if (history.length > MAX_HISTORY) {
  history.shift()  // 古いデータを削除
}
```

### 10.8 AudioContext 状態チェック

```javascript
if (!audioContext || audioContext.state !== 'running') {
  console.warn('Audio not ready, skipping sound')
  return
}
```

---

## 11. 開発中の変更・修正履歴

### 11.1 キャリブレーション閾値の緩和

| 項目 | 変更前 | 変更後 | 理由 |
|------|-------|-------|------|
| 角度閾値 | 15° | 25° | 厳しすぎて開始不可 |
| 位置閾値 | 80px | 100px | 厳しすぎて開始不可 |

### 11.2 fWHR スコア範囲の変更

| 項目 | 変更前 | 変更後 | 理由 |
|------|-------|-------|------|
| 範囲 | 1.4〜2.4 | 1.2〜1.8 | 実測値に基づく調整 |
| 範囲 | 1.5〜2.1 | 1.2〜1.8 | さらに調整 |

### 11.3 頬骨計算方式の変更

| 項目 | 変更前 | 変更後 |
|------|-------|-------|
| 計算 | 絶対差 | 比率 |
| 範囲 | 0.02〜0.08 | 0.01〜0.10 |

### 11.4 音声再生方式の変更

| 項目 | 変更前 | 変更後 |
|------|-------|-------|
| 方式 | async/await | 同期的即時再生 |
| タイミング | 復帰時 | 回旋完了時 |

### 11.5 顔ガイド楕円の位置調整

| 項目 | 変更前 | 変更後 |
|------|-------|-------|
| top | 50% | 45% |
| top | 45% | 40% |

### 11.6 キャリブレーションメッセージの変更

| 変更前 | 変更後 |
|-------|-------|
| 「真正面を向いてください」 | 「近づいたり離れたり調整してください」 |

---

## 12. 採用しなかった設計

### 12.1 機械学習・ディープラーニング

- 6競技適性: 固定重み線形結合 + ファジィ補正のみ
- 学習済みモデル不使用

### 12.2 サーバーサイド処理

- 全処理をクライアントサイドで完結
- データ送信・保存なし
- ユーザー情報の収集なし

### 12.3 複数顔対応

- `numFaces: 1` で単一顔のみ
- 複数人同時計測は対象外

### 12.4 3D深度情報の本格活用

- z座標は角度計算のみに使用
- 3D再構成・深度マップは未使用

### 12.5 カメラ選択UI

- デフォルトカメラを自動選択
- 手動カメラ切り替えは未実装

### 12.6 結果の保存・共有機能

- ローカル保存機能なし
- SNS共有機能なし
- エクスポート機能なし

### 12.7 画面回転ロック

- Screen Orientation API は iOS Safari 非対応
- 代替: オーバーレイ警告で対応

### 12.8 オフライン対応

- Service Worker 未使用
- PWA化せず
- オンライン前提

### 12.9 多言語対応

- 日本語のみ
- i18n ライブラリ未使用

### 12.10 アクセシビリティ

- ARIA属性: 最小限
- キーボード操作: 部分的のみ
- スクリーンリーダー: 未考慮

### 12.11 自動テスト

- ユニットテスト: 未実装
- E2Eテスト: 未実装
- 手動テストのみ

### 12.12 設定・調整画面

- パラメータ調整UIなし
- 全てハードコード
- 開発者がコード変更で対応

### 12.13 チュートリアル・ヘルプ

- 詳細なチュートリアルなし
- 最小限の説明文のみ
- 「測定の流れ」セクションは削除

### 12.14 履歴・比較機能

- 過去の測定結果保存なし
- 経時変化の追跡なし

---

## 13. 意図せず重要になった工夫

### 13.1 30フレーム履歴の移動平均

- 当初: ノイズ除去のための暫定実装
- 結果: デバイス間整合性にも寄与
- 単発の異常値が平均化され、安定した計測に

### 13.2 アスペクト比の実測取得

- 当初: Canvas サイズから計算
- 変更: Video の実サイズから取得
- 結果: PC での不安定動作を解消

### 13.3 比率ベースの特徴量設計

- 頬骨突出度を比率化した際に発見
- 結果: カメラ距離・顔サイズに非依存
- スケール不変性の確保

### 13.4 スコア範囲の区間制限

- 当初: 理論的な範囲を設定
- 実測後: 実際の値に基づき調整
- 結果: 現実的なスコア分布に

### 13.5 ペナルティ上限の設定

```javascript
const jerkPenalty = Math.min(jerks * 5, 40)  // 上限40
const stopPenalty = Math.min(microStops * 3, 20)  // 上限20
```

- 当初: 上限なし
- 結果: 極端な低スコア防止

### 13.6 デフォルト値の中間設定

- `return { score: 50, rank: 'B', details: {} }`
- 当初: エラー時の暫定対応
- 結果: UIの堅牢性向上

### 13.7 CSS `word-break: keep-all`

- 当初: 特定の改行問題への対応
- 結果: 日本語UIの全体的な品質向上

---

## 14. オフラインツール群（概要）

### 14.1 全体構成

```
neck-scouter/
├── src/                          # Webアプリ本体
├── champion_image_collector/     # Step 1: 画像収集
├── champion_feature_extractor/   # Step 2: 特徴量抽出
└── champion_hexagon/             # Step 3: 六角形算出
```

### 14.2 役割分担

| ツール | 入力 | 出力 | 学習 |
|--------|------|------|------|
| image_collector | Wikidata SPARQL | 画像ファイル + メタデータJSON | なし |
| feature_extractor | 画像ファイル | features_per_image.csv | なし |
| hexagon | CSV | aptitude_scores.csv + PNG | なし |

### 14.3 共通の設計方針

- 各ステップは独立して再実行可能
- 学習・分類・推論は一切行わない
- 出力は全て静的ファイル（CSV, JSON, PNG）

---

## 15. 画像収集システム (champion_image_collector)

### 15.1 データソース制限

- **唯一のソース**: Wikidata / Wikimedia Commons
- 他サイトのスクレイピングは禁止

### 15.2 ライセンスフィルタ

許可ライセンス:
- Public Domain
- CC0
- CC-BY（全バージョン）
- CC-BY-SA（全バージョン）

その他は自動スキップ。

### 15.3 処理フロー

```
fetch_wikidata.py → fetch_commons_meta.py → download_images.py
```

| スクリプト | 処理 |
|-----------|------|
| fetch_wikidata.py | SPARQL で人物・画像URL取得 |
| fetch_commons_meta.py | ライセンス情報取得・フィルタ |
| download_images.py | 許可画像をダウンロード |
| run_all.py | 上記を順次実行 |

### 15.4 メタデータ記録項目

- Wikidata ID
- 人物ラベル
- クラスタ名
- 画像URL
- ライセンス種別
- 著者
- 取得日時
- ローカルパス

### 15.5 技術的ガード

- User-Agent 設定
- リクエスト間sleep（レート制限対策）
- 冪等性（既存画像スキップ）
- エラー時も処理継続

### 15.6 禁止事項

- ❌ ランキングサイト（UFC, BoxRec, Tapology等）のスクレイピング
- ❌ robots.txt / 利用規約違反
- ❌ 著作権不明画像の保存
- ❌ 人物名のUI表示

---

## 16. 特徴量抽出システム (champion_feature_extractor)

### 16.1 目的

- 画像 → 数値特徴量への変換のみ
- 学習・分類・推論は行わない

### 16.2 使用技術

- Python
- OpenCV（画像読み込み）
- MediaPipe Face Mesh（468ランドマーク）
- numpy / pandas

### 16.3 出力特徴量（7種 × 2系統）

| 特徴量 | 説明 |
|--------|------|
| neck_static_index | 顔幅に対する首幅比 |
| neck_shoulder_volume | 首〜肩のボリューム感 |
| ear_jujutsu_score | 柔術フェイス総合スコア |
| neck_jaw_angle | 首〜顎の角度 |
| shoulder_to_head_ratio | 肩幅 / 頭幅 |
| torso_thickness | 体幹厚み |
| face_asymmetry | 顔の左右非対称 |

### 16.4 2系統の特徴量

| 系統 | 説明 | 用途 |
|------|------|------|
| `_raw` | 画像全体から算出 | 背景情報を含む |
| `_cropped` | 顔領域のみから算出 | 背景リーク回避 |

### 16.5 検出フラグ

| フラグ | 説明 |
|--------|------|
| face_detected | 顔検出成功 (0/1) |
| ear_visible | 耳が見える (0/1) |
| shoulder_visible | 肩が見える (0/1) |

### 16.6 欠損値ルール

- 特徴算出不可の場合は **0.0**
- null / NaN は使用しない

### 16.7 正規化

- 全特徴量を 0.0〜1.0 に正規化

### 16.8 モデルファイル

- `face_landmarker.task`（3.7MB）をローカル保持
- CDNからダウンロード可能

### 16.9 学習・評価スクリプト (train_evaluate.py)

- 多クラスロジスティック回帰
- 目的: 精度最大化ではなく解釈可能性
- 混同行列と係数を出力
- **Webアプリには組み込まない**（分析用のみ）

---

## 17. 六角形算出システム (champion_hexagon)

### 17.1 目的

- 6競技適性スコアの算出
- 六角形（レーダーチャート）の可視化

### 17.2 入力

- `features_per_image.csv`
- **cropped版のみ使用**（背景リーク回避）

### 17.3 6競技適性の計算式（固定重み）

```
judo       = 0.45×NV + 0.35×NS + 0.20×SH
wrestling  = 0.35×NV + 0.30×NS + 0.20×TT + 0.15×EJ
bjj        = 0.40×EJ + 0.25×NS + 0.20×SH + 0.15×NV
mma        = 0.25×NV + 0.20×NS + 0.15×TT + 0.20×FA + 0.20×EJ
boxing     = 0.35×FA + 0.25×NJ - 0.25×NV - 0.15×TT
kick_muay  = 0.30×NJ + 0.30×NS + 0.20×TT + 0.20×FA
```

### 17.4 特徴量略号

| 略号 | 特徴量 |
|------|--------|
| NS | neck_static_index_cropped |
| NV | neck_shoulder_volume_cropped |
| EJ | ear_jujutsu_score_cropped |
| NJ | neck_jaw_angle_cropped |
| SH | shoulder_to_head_ratio_cropped |
| TT | torso_thickness_cropped |
| FA | face_asymmetry_cropped |

### 17.5 出力ファイル

| ファイル | 内容 |
|---------|------|
| aptitude_scores.csv | 6競技スコア追加済みCSV |
| hexagon_examples.png | クラスタ別代表例（各5枚） |
| hexagon_by_cluster.png | クラスタ別平均六角形 |

### 17.6 六角形の軸順序（時計回り）

1. boxing
2. kick_muay
3. mma
4. wrestling
5. judo
6. bjj

### 17.7 重要な設計判断

- **学習しない**: 重みは全て手動設定
- **クラスタリングしない**: 固定の競技カテゴリのみ
- **CNNを使わない**: 手設計特徴のみ
- **係数推定もしない**: チューニングなし

---

## 18. 静的ドキュメント

### 18.1 public/terms.html（利用規約）

| 条項 | 内容 |
|------|------|
| 第1条 | サービス説明（エンターテインメント目的） |
| 第2条 | 免責事項（損害・正確性・動作保証なし） |
| 第3条 | 禁止事項（医療目的・能力評価への使用禁止） |
| 第4条 | データ取扱（サーバー送信なし・ブラウザ内完結） |
| 第5条 | サービス変更・終了の可能性 |
| 第6条 | 規約変更の可能性 |
| 第7条 | START押下で同意とみなす |

### 18.2 public/details.html（技術詳細）

- 全アルゴリズムの仕様書
- 計算式・閾値・パラメータを記載
- 目次付き（10章構成）

### 18.3 README.md

- 概要・セットアップ手順
- 注意事項（医療目的でない旨）
- MIT ライセンス

---

## 19. デプロイ構成

### 19.1 GitHub Actions ワークフロー

```yaml
trigger: push to main
steps:
  1. Checkout
  2. Setup Node 20
  3. npm ci
  4. npm run build
  5. Upload artifact (dist/)
  6. Deploy to GitHub Pages
```

### 19.2 ホスティング

- GitHub Pages
- カスタムドメインなし
- HTTPS 自動

### 19.3 ビルド成果物

| ファイル | サイズ（gzip） |
|---------|---------------|
| index.html | 0.4 KB |
| CSS | 4.9 KB |
| JS | 161 KB |

---

## 付録A: ファイル一覧と役割

### Webアプリ (src/)

| ファイル | 行数概算 | 役割 |
|---------|---------|------|
| App.jsx | 110 | フェーズ管理・状態保持 |
| StartScreen.jsx | 55 | 開始画面・音声初期化 |
| CalibrationScreen.jsx | 300 | キャリブレーション |
| RotationScreen.jsx | 780 | 回旋測定 |
| ResultScreen.jsx | 520 | 結果表示 |
| useFaceTracking.js | 400 | 顔追跡フック |
| faceCombat/index.js | 90 | 闘争的フェイス統合 |
| faceCombat/fwhr.js | 115 | fWHR計算 |
| faceCombat/cheekbone.js | 115 | 頬骨計算 |
| faceCombat/jawLine.js | 100 | 顎ライン計算 |
| faceCombat/gazeStability.js | 90 | 視線安定計算 |
| faceCombat/expressionSuppression.js | 100 | 表情抑制計算 |
| hexagon.js | 200 | 6競技適性 |
| sound.js | 80 | 音声生成 |

### オフラインツール

| ファイル | 役割 |
|---------|------|
| champion_image_collector/scripts/fetch_wikidata.py | Wikidata SPARQL クエリ |
| champion_image_collector/scripts/fetch_commons_meta.py | ライセンス取得 |
| champion_image_collector/scripts/download_images.py | 画像ダウンロード |
| champion_feature_extractor/scripts/extract_features.py | 特徴量抽出 |
| champion_feature_extractor/scripts/train_evaluate.py | 分析用学習 |
| champion_hexagon/scripts/compute_hexagon.py | 六角形算出 |

---

## 付録B: 使用ライブラリ

### npm パッケージ

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| react | 19.x | UI フレームワーク |
| react-dom | 19.x | DOM レンダリング |
| @mediapipe/tasks-vision | 0.10.x | 顔検出 |
| chart.js | 4.x | レーダーチャート |
| react-chartjs-2 | 5.x | Chart.js React ラッパー |

### Python パッケージ（オフラインツール）

| パッケージ | 用途 |
|-----------|------|
| requests | HTTP リクエスト |
| opencv-python | 画像処理 |
| mediapipe | 顔ランドマーク検出 |
| numpy | 数値計算 |
| pandas | CSV 処理 |
| matplotlib | 可視化 |
| scikit-learn | ロジスティック回帰（分析用） |

---

以上
