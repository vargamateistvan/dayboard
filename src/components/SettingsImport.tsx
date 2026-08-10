import React, { useState } from 'react'
import { importSettings, saveSettings, type Settings } from '../lib/settings'
import { SettingsValidator } from './SettingsValidator'
import './SettingsImport.module.css'

interface SettingsImportProps {
  onImport?: (settings: Settings) => void
  onCancel?: () => void
}

/**
 * Component for importing settings from JSON file or pasted JSON
 */
export function SettingsImport({ onImport, onCancel }: SettingsImportProps) {
  const [json, setJson] = useState('')
  const [importedSettings, setImportedSettings] = useState<Settings | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'paste' | 'file'>('paste')

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJson(e.target.value)
    setError('')
    const settings = importSettings(e.target.value)
    setImportedSettings(settings)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = event => {
      const content = event.target?.result as string
      setJson(content)
      setError('')
      const settings = importSettings(content)
      setImportedSettings(settings)
    }
    reader.onerror = () => {
      setError('Failed to read file')
      setImportedSettings(null)
    }
    reader.readAsText(file)
  }

  const handleImport = () => {
    if (!importedSettings) {
      setError('Invalid settings format')
      return
    }

    saveSettings(importedSettings)
    onImport?.(importedSettings)
    setJson('')
    setImportedSettings(null)
  }

  const handleReset = () => {
    setJson('')
    setImportedSettings(null)
    setError('')
  }

  return (
    <div className="settings-import">
      <div className="settings-import__header">
        <h3>Import Settings</h3>
        <button className="settings-import__close" onClick={onCancel} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="settings-import__modes">
        <button
          className={`settings-import__mode ${mode === 'paste' ? 'settings-import__mode--active' : ''}`}
          onClick={() => {
            setMode('paste')
            handleReset()
          }}
        >
          Paste JSON
        </button>
        <button
          className={`settings-import__mode ${mode === 'file' ? 'settings-import__mode--active' : ''}`}
          onClick={() => {
            setMode('file')
            handleReset()
          }}
        >
          Upload File
        </button>
      </div>

      {mode === 'paste' && (
        <textarea
          className="settings-import__textarea"
          placeholder="Paste your settings JSON here..."
          value={json}
          onChange={handleJsonChange}
          rows={8}
        />
      )}

      {mode === 'file' && (
        <div className="settings-import__file-input">
          <input type="file" accept=".json,.txt" onChange={handleFileSelect} />
          {json && <div className="settings-import__file-info">File loaded ({json.length} chars)</div>}
        </div>
      )}

      {error && <div className="settings-import__error">{error}</div>}

      {importedSettings && (
        <div className="settings-import__preview">
          <h4>Preview</h4>
          <SettingsValidator settings={importedSettings} compact />
        </div>
      )}

      <div className="settings-import__actions">
        <button className="settings-import__action settings-import__action--secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="settings-import__action settings-import__action--primary"
          onClick={handleImport}
          disabled={!importedSettings}
        >
          Import Settings
        </button>
      </div>
    </div>
  )
}
