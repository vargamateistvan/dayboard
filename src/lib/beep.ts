/**
 * Plays a short beep using the Web Audio API.
 * @param type  'done' — three short ascending tones (countdown/pomodoro complete)
 *              'tick' — single soft blip (last 3 seconds)
 */
export function beep(type: 'done' | 'tick' = 'done'): void {
  try {
    const ctx = new AudioContext()

    if (type === 'tick') {
      playTone(ctx, 880, 0.08, 0, 0.06)
      ctx.close()
      return
    }

    // Three ascending tones: 440 → 660 → 880 Hz
    const notes = [440, 660, 880]
    notes.forEach((freq, i) => {
      playTone(ctx, freq, 0.18, i * 0.18, 0.15)
    })
    // Close context after last tone fades
    setTimeout(() => ctx.close(), 800)
  } catch {
    // Silently ignore if AudioContext is unavailable
  }
}

function playTone(
  ctx: AudioContext,
  freq: number,
  gain: number,
  startOffset: number,
  duration: number,
): void {
  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()

  osc.connect(gainNode)
  gainNode.connect(ctx.destination)

  osc.type = 'sine'
  osc.frequency.value = freq

  const start = ctx.currentTime + startOffset
  gainNode.gain.setValueAtTime(0, start)
  gainNode.gain.linearRampToValueAtTime(gain, start + 0.01)
  gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration)

  osc.start(start)
  osc.stop(start + duration + 0.05)
}
