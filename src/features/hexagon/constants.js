// 六角形（6競技適性）- 定数定義
// 固定ロジック（線形＋ファジィ補正）のみを使用

// 6競技（軸ラベル順序：時計回り）
export const SPORTS = ['boxing', 'kick_muay', 'mma', 'wrestling', 'judo', 'bjj']

// 競技名（日本語）
export const SPORT_NAMES = {
  boxing: 'ボクシング',
  kick_muay: 'キック/ムエタイ',
  mma: 'MMA',
  wrestling: 'レスリング',
  judo: '柔道',
  bjj: '柔術'
}

// 競技カラー
export const SPORT_COLORS = {
  boxing: '#e41a1c',
  kick_muay: '#ff7f00',
  mma: '#984ea3',
  wrestling: '#4daf4a',
  judo: '#377eb8',
  bjj: '#a65628'
}

// ファジィ補正の最大値
export const MAX_FUZZY_BONUS = 10

// ボクシング正規化パラメータ
export const BOXING_NORM = {
  shift: 0.30,
  scale: 0.90
}

// コメントテンプレート
export const APTITUDE_COMMENTS = {
  judo_high: '柔道寄りの首肩バランス',
  wrestling_high: 'レスリング向きの体幹がある',
  bjj_high: '柔術的特徴が条件付きで強い',
  mma_balanced: '打撃と組技の中間タイプ',
  boxing_high: 'ボクシング向きの鋭さあり',
  kick_muay_high: 'キック系に向いた構造',
  balanced: 'バランス型の適性',
  developing: '特徴が発展途上'
}
