// 表示スコア調整 - メインエクスポート
// 内部スコアは変更せず、表示用の変換のみを行う
//
// 設計原則:
// - 既存ロジックに副作用を出さない
// - 差分だけで調整できる
// - 1ファイル・1関数で完結
// - ON/OFF フラグで切り替え可能

export {
  ENABLE_FACE_WIDTH_GAMMA,
  ENABLE_COMBAT_EXP,
  STATIC_NECK_GAMMA,
  BALANCE_GAMMA,
  COMBAT_A,
  COMBAT_B
} from './constants'

export {
  adjustStaticNeckScore,
  adjustBalanceScore
} from './faceWidthAdjust'

export {
  calculateDisplayCombatPower,
  calculateBaseScore
} from './combatPower'
