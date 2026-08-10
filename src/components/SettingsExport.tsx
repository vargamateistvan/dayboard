import { useState } from 'react'
import { exportSettings } from '../lib/settings'
import './SettingsExport.module.css'

interface SettingsExportProps {
  onCancel?: () => void
}

/**
 * Component for exporting settings as JSON
 */
export function SettingsExport({ onCancel }: SettingsExportProps) {
  const [copied, setCopied] = useState(false)
  const [pretty, setPretty] = useState(true)

  const json = exportSettings(pretty)

  const handleCopy = () => {
    navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `settings-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="settings-export">
      <div className="settings-export__header">
        <h3>Export Settings</h3>
        <button className="settings-export__close" onClick={onCancel} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="settings-export__options">
        <label className="settings-export__option">
          <input type="checkbox" checked={pretty} onChange={e => setPretty(e.target.checked)} />
          <span>Pretty print (formatted)</span>
        </label>
      </div>

      <div className="settings-export__preview">
        <h4>Preview</h4>
        <pre className="settings-export__code">{json}</pre>
      </div>

      <div className="settings-export__info">
        {json.length} characters • {(json.length / 1024).toFixed(2)} KB
      </div>

      <div className="settings-export__actions">
        <button className="settings-export__action settings-export__action--secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="settings-export__action" onClick={handleCopy}>
          {copied ? '✓ Copied' : 'Copy to Clipboard'}
        </button>
        <button className="settings-export__action settings-export__action--primary" onClick={handleDownload}>
          Download as JSON
        </button>
      </div>
    </div>
  )
}
