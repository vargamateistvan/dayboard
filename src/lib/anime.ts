const ANIMEJS_CDN_URL = 'https://cdn.jsdelivr.net/npm/animejs/dist/bundles/anime.umd.min.js'
const MOTION_ENABLED_STORAGE_KEY = 'dayboard_motion_enabled'

export interface AnimeJsAnimation {
  cancel?: () => void
}

export interface AnimeJsGlobal {
  animate: (
    targets: Element | Element[] | NodeListOf<Element>,
    parameters: Record<string, unknown>,
  ) => AnimeJsAnimation
  stagger?: (value: number) => unknown
}

let animeJsLoader: Promise<AnimeJsGlobal | null> | null = null

export const MOTION_DURATIONS = {
  quick: 140,
  short: 260,
  medium: 340,
  long: 540,
} as const

export const MOTION_STAGGERS = {
  tight: 26,
  normal: 45,
  loose: 70,
} as const

function getAnimeGlobal() {
  return (window as Window & { anime?: AnimeJsGlobal }).anime
}

export function loadAnimeJs() {
  if (typeof window === 'undefined') {
    return Promise.resolve(null)
  }

  const existingAnime = getAnimeGlobal()
  if (existingAnime) {
    return Promise.resolve(existingAnime)
  }

  if (animeJsLoader) {
    return animeJsLoader
  }

  animeJsLoader = new Promise((resolve) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${ANIMEJS_CDN_URL}"]`)
    if (existingScript) {
      const finish = () => resolve(getAnimeGlobal() ?? null)
      if (getAnimeGlobal()) {
        finish()
        return
      }
      existingScript.addEventListener('load', finish, { once: true })
      existingScript.addEventListener('error', () => resolve(null), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = ANIMEJS_CDN_URL
    script.async = true
    script.onload = () => resolve(getAnimeGlobal() ?? null)
    script.onerror = () => {
      console.warn('Unable to load Anime.js from CDN.')
      resolve(null)
    }
    document.head.appendChild(script)
  })

  return animeJsLoader
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function readMotionEnabledPreference() {
  if (typeof window === 'undefined') {
    return true
  }

  const storedValue = window.localStorage.getItem(MOTION_ENABLED_STORAGE_KEY)
  if (storedValue == null) {
    return true
  }
  return storedValue !== 'false'
}

export function setMotionEnabledPreference(enabled: boolean) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(MOTION_ENABLED_STORAGE_KEY, String(enabled))
}

export function isMotionEnabled() {
  return readMotionEnabledPreference() && !prefersReducedMotion()
}

interface StartAnimeAnimationOptions {
  readonly respectMotionPreference?: boolean
}

export function startAnimeAnimation(
  runner: (anime: AnimeJsGlobal) => AnimeJsAnimation | AnimeJsAnimation[] | null | undefined,
  options: StartAnimeAnimationOptions = {},
) {
  const { respectMotionPreference = true } = options
  if (respectMotionPreference && !isMotionEnabled()) {
    return {
      cancel: () => undefined,
    }
  }

  let cancelled = false
  let activeAnimations: AnimeJsAnimation[] = []

  void loadAnimeJs().then((anime) => {
    if (cancelled || !anime) {
      return
    }

    const result = runner(anime)
    if (!result) {
      return
    }
    activeAnimations = Array.isArray(result) ? result : [result]
  })

  return {
    cancel: () => {
      cancelled = true
      activeAnimations.forEach((animation) => animation.cancel?.())
      activeAnimations = []
    },
  }
}
