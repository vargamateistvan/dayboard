import { useMemo, useState } from 'react'
import styles from './QuoteWidget.module.css'

interface QuoteWidgetProps {
  readonly isFullscreen?: boolean
}

interface Quote {
  readonly text: string
  readonly author: string
}

const QUOTES: Quote[] = [
  { text: 'Small steps every day lead to big outcomes.', author: 'Unknown' },
  { text: 'Success is the sum of small efforts repeated day in and day out.', author: 'Robert Collier' },
  { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
  { text: 'Focus on being productive instead of busy.', author: 'Tim Ferriss' },
  { text: 'Done is better than perfect.', author: 'Sheryl Sandberg' },
  { text: 'Consistency is more important than intensity.', author: 'Unknown' },
  { text: 'What gets scheduled gets done.', author: 'Michael Hyatt' },
  { text: 'The future depends on what you do today.', author: 'Mahatma Gandhi' },
]

function getDayIndex(date: Date, total: number): number {
  const utcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return Math.floor(utcMidnight / 86_400_000) % total
}

export function QuoteWidget({ isFullscreen = false }: QuoteWidgetProps) {
  const [offset, setOffset] = useState(0)
  const quote = useMemo(() => {
    const base = getDayIndex(new Date(), QUOTES.length)
    return QUOTES[(base + offset) % QUOTES.length]
  }, [offset])

  return (
    <div className={[styles.widget, isFullscreen ? styles.fullscreen : ''].join(' ')}>
      <p className={styles.label}>Quote of the Day</p>
      <div className={styles.quoteBody}>
        <blockquote className={styles.quote}>“{quote.text}”</blockquote>
        <p className={styles.author}>— {quote.author}</p>
      </div>
      <button className={styles.button} type="button" onClick={() => setOffset((value) => value + 1)}>
        Show another quote
      </button>
    </div>
  )
}
