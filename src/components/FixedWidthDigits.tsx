import styles from './FixedWidthDigits.module.css'

interface FixedWidthDigitsProps {
  readonly text: string
}

// Renders each digit in a fixed-width cell so the text width stays stable as
// the value changes, even for fonts without tabular figures.
export function FixedWidthDigits({ text }: FixedWidthDigitsProps) {
  return (
    <>
      {Array.from(text).map((char, index) =>
        /\d/.test(char) ? (
          <span key={index} className={styles.digit}>
            {char}
          </span>
        ) : (
          char
        ),
      )}
    </>
  )
}
