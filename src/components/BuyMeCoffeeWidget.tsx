import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useSettings } from '../lib/useSettings'
import styles from './BuyMeCoffeeWidget.module.css'

const FALLBACK_ACCENT_COLOR = '#5F7FFF'
const ACCOUNT_ID = 'matt_varga'
const DESCRIPTION = 'Support me on Buy me a coffee!'
const BMC_ICON_URL = 'https://cdn.buymeacoffee.com/widget/assets/coffee%20cup.svg'

function readAccentColor() {
  const accentColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-accent')
    .trim()

  return accentColor || FALLBACK_ACCENT_COLOR
}

export function BuyMeCoffeeWidget() {
  const { settings } = useSettings()
  const [isOpen, setIsOpen] = useState(false)
  const [accentColor, setAccentColor] = useState(() => readAccentColor())

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setAccentColor(readAccentColor())
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [settings.theme, settings.colorScheme, settings.customColors])

  useEffect(() => {
    if (settings.colorScheme !== 'system') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSchemeChange = () => {
      window.requestAnimationFrame(() => {
        setAccentColor(readAccentColor())
      })
    }

    mediaQuery.addEventListener('change', handleSchemeChange)
    return () => mediaQuery.removeEventListener('change', handleSchemeChange)
  }, [settings.colorScheme])

  useEffect(() => {
    if (!settings.showBuyMeACoffeeWidget) {
      setIsOpen(false)
    }
  }, [settings.showBuyMeACoffeeWidget])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const widgetUrl = useMemo(() => {
    const params = new URLSearchParams({
      description: DESCRIPTION,
      color: accentColor,
    })

    return `https://www.buymeacoffee.com/widget/page/${ACCOUNT_ID}?${params.toString()}`
  }, [accentColor])

  if (!settings.showBuyMeACoffeeWidget) {
    return null
  }

  return (
    <>
      {isOpen && (
        <button
          className={styles.backdrop}
          aria-label="Close Buy Me a Coffee widget"
          onClick={() => setIsOpen(false)}
          type="button"
        />
      )}
      {isOpen && (
        <section className={styles.panel} aria-label="Buy Me a Coffee support panel">
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>
              <img className={styles.headerIcon} src={BMC_ICON_URL} alt="" aria-hidden="true" />
              Support me
            </span>
            <button className={styles.closeBtn} aria-label="Close Buy Me a Coffee widget" onClick={() => setIsOpen(false)} type="button">
              <X size={16} />
            </button>
          </div>
          <iframe
            key={widgetUrl}
            className={styles.frame}
            src={widgetUrl}
            title="Buy Me a Coffee"
            allow="payment"
            loading="lazy"
          />
        </section>
      )}

      <button
        className={styles.fab}
        style={{ backgroundColor: accentColor }}
        aria-expanded={isOpen}
        aria-label={`${isOpen ? 'Hide' : 'Open'} Buy Me a Coffee widget`}
        title="Support me on Buy Me a Coffee"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        <img className={styles.fabIcon} src={BMC_ICON_URL} alt="" aria-hidden="true" />
      </button>
    </>
  )
}
