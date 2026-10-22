/**
 * Calls `tick` right after each wall-clock second boundary. A plain
 * setInterval(…, 1000) keeps the phase of whenever it was started, so a clock
 * driven by it can show the previous second for up to a full second.
 * Returns a cleanup function.
 */
export function scheduleEverySecond(tick: () => void): () => void {
  let id: ReturnType<typeof setTimeout>
  const schedule = () => {
    // A few ms of slack so the callback lands just after the boundary, not just before.
    id = setTimeout(() => {
      tick()
      schedule()
    }, 1000 - (Date.now() % 1000) + 5)
  }
  schedule()
  return () => clearTimeout(id)
}
