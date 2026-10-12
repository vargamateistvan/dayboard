import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  state: AudioContextState = 'running'
  currentTime = 0
  destination = {}
  close = vi.fn(() => {
    this.state = 'closed'
    return Promise.resolve()
  })
  resume = vi.fn(() => Promise.resolve())
  constructor() {
    FakeAudioContext.instances.push(this)
  }
  createOscillator() {
    return { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), type: 'sine', frequency: { value: 0 } }
  }
  createGain() {
    return {
      connect: vi.fn(),
      gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    }
  }
}

describe('beep', () => {
  beforeEach(() => {
    FakeAudioContext.instances = []
    vi.stubGlobal('AudioContext', FakeAudioContext)
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not close the audio context before the tick tone plays', async () => {
    const { beep } = await import('../beep')
    beep('tick')
    expect(FakeAudioContext.instances[0].close).not.toHaveBeenCalled()
  })

  it('reuses one audio context across beeps', async () => {
    const { beep } = await import('../beep')
    beep('tick')
    beep('tick')
    beep('done')
    expect(FakeAudioContext.instances).toHaveLength(1)
  })

  it('resumes a suspended context', async () => {
    const { beep } = await import('../beep')
    beep('tick')
    const ctx = FakeAudioContext.instances[0]
    ctx.state = 'suspended'
    beep('tick')
    expect(ctx.resume).toHaveBeenCalled()
  })
})
