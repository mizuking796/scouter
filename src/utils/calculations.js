// スムーズネス計算
export function calculateSmoothness(angleHistory) {
  if (!angleHistory || angleHistory.length < 10) {
    return 50 // デフォルト値
  }

  // 最大角度を取得
  const maxAngle = Math.max(...angleHistory.map(h => h.angle))

  // 10-90%の区間を抽出
  const startThreshold = maxAngle * 0.1
  const endThreshold = maxAngle * 0.9

  const relevantHistory = angleHistory.filter(h =>
    h.angle >= startThreshold && h.angle <= endThreshold
  )

  if (relevantHistory.length < 5) {
    return 50
  }

  // ガクつき検出
  let jerks = 0

  for (let i = 2; i < relevantHistory.length; i++) {
    const prev2 = relevantHistory[i - 2]
    const prev1 = relevantHistory[i - 1]
    const curr = relevantHistory[i]

    // 時間差
    const dt1 = (prev1.timestamp - prev2.timestamp) / 1000
    const dt2 = (curr.timestamp - prev1.timestamp) / 1000

    if (dt1 === 0 || dt2 === 0) continue

    // 角速度
    const v1 = (prev1.angle - prev2.angle) / dt1
    const v2 = (curr.angle - prev1.angle) / dt2

    // 角速度の符号反転を検出
    if (v1 * v2 < 0 && Math.abs(v1) > 5 && Math.abs(v2) > 5) {
      jerks++
    }

    // 加速度急変を検出
    const accel = (v2 - v1) / ((dt1 + dt2) / 2)
    if (Math.abs(accel) > 100) {
      jerks++
    }
  }

  // 微停止を検出
  let microStops = 0
  for (let i = 1; i < relevantHistory.length - 1; i++) {
    const prev = relevantHistory[i - 1]
    const curr = relevantHistory[i]
    const next = relevantHistory[i + 1]

    const dt1 = curr.timestamp - prev.timestamp
    const dt2 = next.timestamp - curr.timestamp

    if (dt1 > 0 && dt2 > 0) {
      const v1 = Math.abs(curr.angle - prev.angle) / dt1
      const v2 = Math.abs(next.angle - curr.angle) / dt2

      // 一時的に速度が落ちて戻る
      if (v1 < 0.01 && v2 > 0.05) {
        microStops++
      }
    }
  }

  // スコア計算（加点方式）
  // 基準: 100点から減点
  const jerkPenalty = Math.min(jerks * 5, 40)
  const stopPenalty = Math.min(microStops * 3, 20)

  const score = Math.max(0, 100 - jerkPenalty - stopPenalty)

  return Math.round(score)
}

// ネック指数（静的）計算
export function calculateStaticNeckIndex(calibrationData, measurementData) {
  if (!calibrationData || !calibrationData.baseFaceData) {
    return 25
  }

  const { faceWidth, jawWidth } = calibrationData.baseFaceData

  // 顎幅 / 顔幅の比率
  const ratio = jawWidth / faceWidth

  // 厳しめのスコアリング（Sランクは非常に厳しく）
  // 比率0.80以下: 0-15点（細い）
  // 比率0.80-0.90: 15-35点（やや細い）
  // 比率0.90-1.00: 35-55点（普通）
  // 比率1.00-1.10: 55-75点（やや太い）
  // 比率1.10-1.20: 75-90点（太い）
  // 比率1.20以上: 90-100点（かなり太い、S級はここだけ）

  let score
  if (ratio <= 0.80) {
    score = (ratio / 0.80) * 15
  } else if (ratio <= 0.90) {
    score = 15 + ((ratio - 0.80) / 0.10) * 20
  } else if (ratio <= 1.00) {
    score = 35 + ((ratio - 0.90) / 0.10) * 20
  } else if (ratio <= 1.10) {
    score = 55 + ((ratio - 1.00) / 0.10) * 20
  } else if (ratio <= 1.20) {
    score = 75 + ((ratio - 1.10) / 0.10) * 15
  } else {
    score = 90 + Math.min((ratio - 1.20) / 0.15 * 10, 10)
  }

  return Math.round(Math.max(0, Math.min(100, score)))
}

// ネック指数（動的）計算
export function calculateDynamicNeckIndex(calibrationData, upMeasurement) {
  if (!calibrationData || !upMeasurement || !upMeasurement.angleHistory) {
    return 50
  }

  // 上向き時のデータから首の変化を検出
  const history = upMeasurement.angleHistory

  if (history.length < 2) {
    return 50
  }

  // 最初と最後のfaceDataを比較
  const startData = history[0].faceData
  const endData = history[history.length - 1].faceData

  if (!startData || !endData) {
    return 50
  }

  // 顎幅の変化（上を向くと首が見えて幅が変わる）
  const jawWidthChange = Math.abs(endData.jawWidth - startData.jawWidth)
  const faceWidth = calibrationData.baseFaceData.faceWidth

  // 変化率を計算
  const changeRatio = jawWidthChange / faceWidth

  // 甘めのスコアリング（変化が少なくても点数が出やすい）
  // 変化率0.01でも40点、0.05で60点、0.1で80点、0.2以上で100点
  let score
  if (changeRatio <= 0.01) {
    score = 30 + (changeRatio / 0.01) * 10
  } else if (changeRatio <= 0.05) {
    score = 40 + ((changeRatio - 0.01) / 0.04) * 20
  } else if (changeRatio <= 0.1) {
    score = 60 + ((changeRatio - 0.05) / 0.05) * 20
  } else if (changeRatio <= 0.2) {
    score = 80 + ((changeRatio - 0.1) / 0.1) * 20
  } else {
    score = 100
  }

  return Math.round(Math.max(0, Math.min(100, score)))
}

// 左右バランス計算
export function calculateBalance(rightScore, leftScore) {
  const diff = Math.abs(rightScore - leftScore)

  // 差が小さいほど高スコア
  // 差0: 100点、差50: 50点、差100: 0点
  const score = Math.max(0, 100 - diff)

  return {
    score: Math.round(score),
    diff,
    dominant: rightScore > leftScore ? 'right' : rightScore < leftScore ? 'left' : 'balanced'
  }
}

// ランク判定（通常）
export function getRank(score) {
  if (score >= 90) return 'S'
  if (score >= 75) return 'A'
  if (score >= 55) return 'B'
  if (score >= 35) return 'C'
  return 'D'
}

// ランク判定（ネック指数・静 用：S評価を厳しく）
export function getRankStaticNeck(score) {
  if (score >= 98) return 'S'
  if (score >= 90) return 'A'
  if (score >= 55) return 'B'
  if (score >= 35) return 'C'
  return 'D'
}

// ランク判定（左右バランス用：S評価を厳しく）
export function getRankBalance(score) {
  if (score >= 99) return 'S'
  if (score >= 90) return 'A'
  if (score >= 55) return 'B'
  if (score >= 35) return 'C'
  return 'D'
}

// 戦闘力計算
export function calculateCombatPower(scores) {
  // 6軸の平均（0-100）- 首肩ボリュームを含む
  const average = (
    scores.rightSmoothness +
    scores.leftSmoothness +
    scores.upSmoothness +
    scores.staticNeckIndex +
    scores.dynamicNeckIndex +
    (scores.shoulderVolume || 0)
  ) / 6

  // 指数スケーリング: 0-100 → 0-500,000,000
  // 50点で中央値（約2500万）、90点以上で1億以上
  const power = Math.pow(average / 100, 3) * 500000000

  return Math.round(power)
}

// 1行コメント生成
export function generateComment(scores, balance) {
  const comments = []

  // 右スムーズネスが高い
  if (scores.rightSmoothness >= 75 && scores.leftSmoothness >= 75) {
    comments.push('首の制御、かなり仕上がってます')
  } else if (scores.rightSmoothness >= 75) {
    comments.push('右方向の動きに安定感あり')
  } else if (scores.leftSmoothness >= 75) {
    comments.push('左方向の動きに安定感あり')
  }

  // 上スムーズネスが高い
  if (scores.upSmoothness >= 75) {
    comments.push('上方向の安定感が強み')
  }

  // ネック指数（動的）が高い
  if (scores.dynamicNeckIndex >= 70) {
    comments.push('使ったときに首が浮き出るタイプ')
  }

  // ネック指数（静的）が高い
  if (scores.staticNeckIndex >= 70) {
    comments.push('首の存在感、しっかりある')
  }

  // バランスに個性
  if (balance.diff >= 20) {
    comments.push('左右に個性あり。武器にできそう')
  }

  // 首肩ボリュームが高い
  if (scores.shoulderVolume >= 70) {
    comments.push('首から肩のラインに迫力あり')
  }

  // 全体的に高い
  const average = (
    scores.rightSmoothness +
    scores.leftSmoothness +
    scores.upSmoothness +
    scores.staticNeckIndex +
    scores.dynamicNeckIndex +
    (scores.shoulderVolume || 0)
  ) / 6

  if (average >= 80) {
    comments.push('全体的に高水準。やりますね')
  } else if (average >= 60) {
    comments.push('バランスの取れた首の持ち主')
  } else if (average < 40) {
    comments.push('伸びしろ、たっぷりあります')
  }

  // ランダムに1つ選択（優先度順で最初のもの）
  return comments.length > 0 ? comments[0] : '測定完了。データを蓄積中...'
}

// フォーマット関数
export function formatNumber(num) {
  return num.toLocaleString()
}
