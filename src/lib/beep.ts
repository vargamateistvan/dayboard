/**
 * Plays a short beep using the Web Audio API.
 * @param type  'done' — three short ascending tones (countdown/pomodoro complete)
 *              'tick' — single soft blip (last 3 seconds)
 */
// One context for the whole app: browsers limit how many can exist, and
// closing one right after scheduling a tone cuts the tone off.
let sharedContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!sharedContext || sharedContext.state === 'closed') {
    sharedContext = new AudioContext()
  }
  if (sharedContext.state === 'suspended') {
    void sharedContext.resume()
  }
  return sharedContext
}

export function beep(type: 'done' | 'tick' = 'done'): void {
  try {
    const ctx = getAudioContext()

    if (type === 'tick') {
      playTone(ctx, 880, 0.08, 0, 0.06)
      return
    }

    // Three ascending tones: 440 → 660 → 880 Hz
    const notes = [440, 660, 880]
    notes.forEach((freq, i) => {
      playTone(ctx, freq, 0.18, i * 0.18, 0.15)
    })
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
