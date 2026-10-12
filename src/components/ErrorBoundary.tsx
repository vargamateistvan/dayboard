import React from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import styles from './ErrorBoundary.module.css'

interface BoundaryState {
  error: Error | null
}

interface WidgetErrorBoundaryProps {
  readonly label: string
  readonly children: React.ReactNode
}

// Keeps one crashing widget from blanking the rest of the dashboard.
export class WidgetErrorBoundary extends React.Component<WidgetErrorBoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`${this.props.label} widget crashed`, error, info.componentStack)
  }

  private readonly handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className={styles.widgetFallback} role="alert">
        <AlertTriangle size={20} aria-hidden="true" />
        <p className={styles.message}>{this.props.label} hit an error.</p>
        <button
          className={styles.button}
          type="button"
          onClick={this.handleReset}
          aria-label={`Reload ${this.props.label}`}
        >
          <RotateCcw size={14} aria-hidden="true" />
          Reload widget
        </button>
      </div>
    )
  }
}

interface AppErrorBoundaryProps {
  readonly children: React.ReactNode
}

// Last line of defence: shows a recovery screen instead of a blank page.
export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Dayboard crashed', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className={styles.appFallback} role="alert">
        <AlertTriangle size={32} aria-hidden="true" />
        <h1 className={styles.title}>Something went wrong</h1>
        <p className={styles.message}>Dayboard hit an unexpected error. Reloading usually fixes it.</p>
        <button className={styles.button} type="button" onClick={() => window.location.reload()}>
          <RotateCcw size={14} aria-hidden="true" />
          Reload page
        </button>
      </div>
    )
  }
}
