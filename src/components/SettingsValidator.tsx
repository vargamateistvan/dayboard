import React from 'react'
import { validateSettings, type Settings } from '../lib/settings'
import './SettingsValidator.module.css'

interface SettingsValidatorProps {
  settings: Settings
  onValidationChange?: (valid: boolean, errors: string[]) => void
  compact?: boolean
}

/**
 * Displays validation results for settings with error highlighting
 */
export function SettingsValidator({ settings, onValidationChange, compact = false }: SettingsValidatorProps) {
  const { valid, errors } = validateSettings(settings)

  React.useEffect(() => {
    onValidationChange?.(valid, errors)
  }, [valid, errors, onValidationChange])

  if (valid) {
    return (
      <div className="settings-validator settings-validator--valid">
        <div className="settings-validator__icon">✓</div>
        <div className="settings-validator__message">All settings are valid</div>
      </div>
    )
  }

  return (
    <div className="settings-validator settings-validator--invalid">
      <div className="settings-validator__title">Validation Errors ({errors.length})</div>
      {!compact && (
        <ul className="settings-validator__errors">
          {errors.map((error, index) => (
            <li key={index} className="settings-validator__error">
              {error}
            </li>
          ))}
        </ul>
      )}
      {compact && errors.length > 0 && (
        <div className="settings-validator__compact">
          {errors.slice(0, 3).map((error, index) => (
            <div key={index} className="settings-validator__compact-item">
              {error}
            </div>
          ))}
          {errors.length > 3 && (
            <div className="settings-validator__compact-more">+{errors.length - 3} more</div>
          )}
        </div>
      )}
    </div>
  )
}
