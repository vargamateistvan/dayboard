import { useState } from 'react'
import {
  listProfiles,
  saveProfile,
  loadProfile,
  applyProfile,
  deleteProfile,
  renameProfile,
  loadSettings,
  type Settings,
} from '../lib/settings'
import './ProfileManager.module.css'

interface ProfileManagerProps {
  onProfileApply?: (name: string, settings: Settings) => void
  onCancel?: () => void
}

/**
 * Component for managing settings profiles (create, load, rename, delete)
 */
export function ProfileManager({ onProfileApply, onCancel }: ProfileManagerProps) {
  const [profiles, setProfiles] = useState(listProfiles())
  const [newProfileName, setNewProfileName] = useState('')
  const [renamingProfile, setRenamingProfile] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const refreshProfiles = () => {
    setProfiles(listProfiles())
  }

  const handleSaveProfile = () => {
    if (!newProfileName.trim()) {
      setError('Profile name cannot be empty')
      return
    }

    try {
      const settings = loadSettings()
      saveProfile(newProfileName, settings)
      setNewProfileName('')
      setError('')
      setSuccess(`Profile "${newProfileName}" saved`)
      setTimeout(() => setSuccess(''), 2000)
      refreshProfiles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    }
  }

  const handleApplyProfile = (name: string) => {
    try {
      applyProfile(name)
      const settings = loadProfile(name)
      if (settings) {
        onProfileApply?.(name, settings)
      }
      setSuccess(`Profile "${name}" applied`)
      setTimeout(() => setSuccess(''), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply profile')
    }
  }

  const handleDeleteProfile = (name: string) => {
    if (window.confirm(`Delete profile "${name}"?`)) {
      try {
        deleteProfile(name)
        setError('')
        setSuccess(`Profile "${name}" deleted`)
        setTimeout(() => setSuccess(''), 2000)
        refreshProfiles()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete profile')
      }
    }
  }

  const handleRenameProfile = (oldName: string) => {
    if (!renameValue.trim()) {
      setError('Profile name cannot be empty')
      return
    }

    try {
      renameProfile(oldName, renameValue)
      setRenamingProfile(null)
      setRenameValue('')
      setError('')
      setSuccess(`Profile renamed to "${renameValue}"`)
      setTimeout(() => setSuccess(''), 2000)
      refreshProfiles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename profile')
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="profile-manager">
      <div className="profile-manager__header">
        <h3>Settings Profiles</h3>
        <button className="profile-manager__close" onClick={onCancel} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="profile-manager__save-section">
        <h4>Save Current Settings</h4>
        <div className="profile-manager__input-group">
          <input
            type="text"
            className="profile-manager__input"
            placeholder="Profile name (e.g., 'Work', 'Gaming')"
            value={newProfileName}
            onChange={e => setNewProfileName(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSaveProfile()}
          />
          <button className="profile-manager__button profile-manager__button--primary" onClick={handleSaveProfile}>
            Save Profile
          </button>
        </div>
      </div>

      {error && <div className="profile-manager__error">{error}</div>}
      {success && <div className="profile-manager__success">{success}</div>}

      <div className="profile-manager__list">
        <h4>Saved Profiles ({profiles.length})</h4>
        {profiles.length === 0 ? (
          <div className="profile-manager__empty">No profiles saved yet</div>
        ) : (
          <div className="profile-manager__profiles">
            {profiles.map(profile => (
              <div key={profile.name} className="profile-manager__profile">
                {renamingProfile === profile.name ? (
                  <div className="profile-manager__rename-input">
                    <input
                      type="text"
                      className="profile-manager__input"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      autoFocus
                      onKeyPress={e => {
                        if (e.key === 'Enter') handleRenameProfile(profile.name)
                        if (e.key === 'Escape') setRenamingProfile(null)
                      }}
                    />
                    <button
                      className="profile-manager__button profile-manager__button--small"
                      onClick={() => handleRenameProfile(profile.name)}
                    >
                      Save
                    </button>
                    <button
                      className="profile-manager__button profile-manager__button--small"
                      onClick={() => setRenamingProfile(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="profile-manager__profile-info">
                      <div className="profile-manager__profile-name">{profile.name}</div>
                      <div className="profile-manager__profile-date">Updated {formatDate(profile.updatedAt)}</div>
                    </div>
                    <div className="profile-manager__profile-actions">
                      <button
                        className="profile-manager__button profile-manager__button--small profile-manager__button--success"
                        onClick={() => handleApplyProfile(profile.name)}
                        title="Load this profile"
                      >
                        Load
                      </button>
                      <button
                        className="profile-manager__button profile-manager__button--small"
                        onClick={() => {
                          setRenamingProfile(profile.name)
                          setRenameValue(profile.name)
                        }}
                        title="Rename profile"
                      >
                        Rename
                      </button>
                      <button
                        className="profile-manager__button profile-manager__button--small profile-manager__button--danger"
                        onClick={() => handleDeleteProfile(profile.name)}
                        title="Delete profile"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="profile-manager__actions">
        <button className="profile-manager__button" onClick={onCancel}>
          Close
        </button>
      </div>
    </div>
  )
}
