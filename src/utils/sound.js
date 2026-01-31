// 音声管理（シングルトン）
let audioContext = null
let isWarmedUp = false

// ユーザー操作後に呼び出す（ブラウザ制限対策）
export async function initAudio() {
  if (audioContext && audioContext.state === 'running' && isWarmedUp) return

  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)()
      console.log('AudioContext created, state:', audioContext.state)
    }

    // 確実にrunning状態にする
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
      console.log('AudioContext resumed to:', audioContext.state)
    }

    // より確実なウォームアップ: 複数のダミー音を再生
    for (let i = 0; i < 3; i++) {
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      gainNode.gain.value = 0 // 無音
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      oscillator.start(audioContext.currentTime + i * 0.01)
      oscillator.stop(audioContext.currentTime + i * 0.01 + 0.001)
    }

    isWarmedUp = true
    console.log('Audio warmup complete')
  } catch (e) {
    console.error('Failed to init AudioContext:', e)
  }
}

// 音声を事前にウォームアップ（キャリブレーション中などに呼ぶ）
export async function warmupAudio() {
  if (!audioContext) {
    await initAudio()
    return
  }

  if (audioContext.state === 'suspended') {
    try {
      await audioContext.resume()
    } catch (e) {
      console.error('Failed to resume AudioContext:', e)
    }
  }

  // 無音のビープでウォームアップ
  try {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    gainNode.gain.value = 0
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.001)
  } catch (e) {
    console.error('Warmup failed:', e)
  }
}

// OK音を再生（スカウター風のピピッ音）
export async function playOkSound() {
  console.log('playOkSound called, audioContext:', audioContext?.state)

  if (!audioContext) {
    console.warn('Audio not initialized, trying to init now')
    await initAudio()
    if (!audioContext) return
  }

  // suspended状態なら必ずresumeを待つ
  if (audioContext.state === 'suspended') {
    try {
      await audioContext.resume()
      console.log('AudioContext resumed before playing')
    } catch (e) {
      console.error('Failed to resume AudioContext:', e)
      return
    }
  }

  try {
    const now = audioContext.currentTime

    // ピ（高音）
    playBeep(now, 1200, 0.1)
    // ピッ（さらに高音）
    playBeep(now + 0.12, 1500, 0.15)

    console.log('Sound played at', now)
  } catch (e) {
    console.error('Failed to play sound:', e)
  }
}

function playBeep(startTime, frequency, duration) {
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)

  oscillator.frequency.value = frequency
  oscillator.type = 'square'

  gainNode.gain.setValueAtTime(0.5, startTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration)

  oscillator.start(startTime)
  oscillator.stop(startTime + duration)
}
