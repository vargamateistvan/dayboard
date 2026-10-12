import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { fetchLatestRelease, RELEASES_PAGE_URL, type Release } from '../lib/releases'
import styles from './InfoDialog.module.css'

interface InfoDialogProps {
  readonly onClose: () => void
}

type LatestReleaseState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'loaded'; readonly release: Release | null }

function formatReleaseDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function ReleaseNotes({ release }: { readonly release: Release }) {
  if (release.sections.length === 0) {
    return <p className={styles.hint}>No notes for this release.</p>
  }

  return (
    <>
      {release.sections.map((section) => (
        <div key={section.title} className={styles.releaseSection}>
          <h4 className={styles.releaseSectionTitle}>{section.title}</h4>
          <ul className={styles.list}>
            {section.items.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}

export function InfoDialog({ onClose }: InfoDialogProps) {
  const [releaseState, setReleaseState] = useState<LatestReleaseState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    fetchLatestRelease(controller.signal)
      .then((release) => setReleaseState({ status: 'loaded', release }))
      .catch(() => {
        if (!controller.signal.aborted) {
          setReleaseState({ status: 'error' })
        }
      })
    return () => controller.abort()
  }, [])

  const latestRelease = releaseState.status === 'loaded' ? releaseState.release : null

  return (
    <div className={styles.backdrop}>
      <dialog className={styles.dialog} aria-label="About Dayboard" open>
        <div className={styles.header}>
          <h2 className={styles.title}>About Dayboard</h2>
          <button
            className={styles.close}
            onClick={onClose}
            aria-label="Close about dialog"
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Version</h3>
            {releaseState.status === 'loading' && <p className={styles.hint}>Loading release info…</p>}
            {releaseState.status === 'error' && (
              <p className={styles.hint}>
                Couldn't load release info.{' '}
                <a className={styles.link} href={RELEASES_PAGE_URL} target="_blank" rel="noreferrer">
                  View releases on GitHub
                </a>
              </p>
            )}
            {releaseState.status === 'loaded' && !latestRelease && (
              <p className={styles.hint}>No releases published yet.</p>
            )}
            {latestRelease && (
              <>
                <p className={styles.versionRow}>
                  <a className={styles.version} href={latestRelease.url} target="_blank" rel="noreferrer">
                    v{latestRelease.version}
                  </a>
                  {latestRelease.publishedAt && (
                    <time className={styles.latestReleaseDate} dateTime={latestRelease.publishedAt}>
                      Released {formatReleaseDate(latestRelease.publishedAt)}
                    </time>
                  )}
                </p>
                <ReleaseNotes release={latestRelease} />
                <p className={styles.linkRow}>
                  <a className={styles.link} href={RELEASES_PAGE_URL} target="_blank" rel="noreferrer">
                    All releases on GitHub
                  </a>
                </p>
              </>
            )}
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>How it works</h3>
            <ul className={styles.list}>
              <li>Use the settings button to control widget visibility, layout, themes, and preferences.</li>
              <li>In Settings → Layout, drag widgets from the palette onto the grid, drag a corner to resize, and add or remove rows.</li>
              <li>Settings → Appearance lets you pick a theme, custom colors, and fonts, including any Google Font.</li>
              <li>Settings → Widgets configures each widget: calendar feeds, weather, flights, clocks, finance, sports, music, and more.</li>
              <li>Click the fullscreen button on any widget to focus on just that panel, or make the whole dashboard fullscreen from the header.</li>
              <li>Calendar widgets can use iCal feeds or Google Calendar and will trigger upcoming event notifications.</li>
              <li>The bell in the header keeps a history of notifications; choose how they are delivered in Settings → Notifications.</li>
              <li>Save layouts and settings as presets in Settings → Presets, switch between them from the header, or schedule them to switch automatically.</li>
              <li>Press Ctrl+K (⌘K on Mac) to toggle focus mode, which hides the weather and calendar widgets.</li>
              <li>Your settings are saved in this browser, so they stay put between visits.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Need help?</h3>
            <p className={styles.hint}>
              If something looks wrong or stops working, report it on GitHub:
            </p>
            <p className={styles.linkRow}>
              <a
                className={styles.link}
                href="https://github.com/vargamateistvan/dayboard/issues"
                target="_blank"
                rel="noreferrer"
              >
                github.com/vargamateistvan/dayboard/issues
              </a>
            </p>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Legal</h3>
            <p className={styles.linkRow}>
              <a
                className={styles.link}
                href="/dayboard/privacy.html"
                target="_blank"
                rel="noreferrer"
              >
                Privacy Policy
              </a>
              <span className={styles.sep}>·</span>
              <a
                className={styles.link}
                href="/dayboard/terms.html"
                target="_blank"
                rel="noreferrer"
              >
                Terms of Service
              </a>
            </p>
          </section>
        </div>
      </dialog>
    </div>
  )
}

