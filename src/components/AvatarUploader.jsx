import { useRef, useState } from 'react'
import { Camera, Trash2, Check, X } from 'lucide-react'
import { useAvatar } from '../hooks/useAvatar.js'
import { getInitials, cropImageToSquareBase64 } from '../utils/helpers.js'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/**
 * Profile picture uploader.
 * - 140px circle with red ring border
 * - Hover overlay → opens native file picker
 * - Preview pending image with confirm/cancel
 * - Calls `onToast(msg)` (optional) for error messages
 */
export default function AvatarUploader({ username, onToast }) {
  const { avatar, saveAvatar, removeAvatar } = useAvatar()
  const inputRef = useRef(null)
  const [pending, setPending] = useState(null) // base64 data URL pending confirm
  const [error, setError] = useState('')

  function emitError(msg) {
    setError(msg)
    if (onToast) onToast(msg)
    setTimeout(() => setError(''), 4000)
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    /* Reset value so re-selecting the same file still triggers change. */
    e.target.value = ''

    if (!ACCEPTED_TYPES.includes(file.type)) {
      emitError('Only PNG, JPEG, or WEBP images are allowed.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      emitError(`Image must be under 2 MB (yours is ${(file.size / 1024 / 1024).toFixed(1)} MB).`)
      return
    }

    try {
      const cropped = await cropImageToSquareBase64(file, 400)
      setPending(cropped)
    } catch (err) {
      emitError('Could not process this image. Try another.')
    }
  }

  function confirmUpload() {
    if (!pending) return
    saveAvatar(pending)
    setPending(null)
  }

  function cancelUpload() {
    setPending(null)
  }

  function clickFilePicker() {
    inputRef.current?.click()
  }

  function handleRemove() {
    if (!window.confirm('Remove your profile photo?')) return
    removeAvatar()
  }

  const initials = getInitials(username || 'Player')
  const showAvatar = pending || avatar

  return (
    <div className="flex flex-col items-center">
      {/* Avatar circle */}
      <div className="relative w-[140px] h-[140px]">
        <div className="absolute inset-0 rounded-full ring-4 ring-accent-primary shadow-red-glow-lg pointer-events-none" />
        {showAvatar ? (
          <img
            src={showAvatar}
            alt="Profile"
            className="w-[140px] h-[140px] rounded-full object-cover"
          />
        ) : (
          <div className="w-[140px] h-[140px] rounded-full bg-red-gradient flex items-center justify-center heading text-5xl text-white">
            {initials}
          </div>
        )}

        {/* Hover overlay (only when no preview is pending — preview has its own controls) */}
        {!pending && (
          <button
            type="button"
            onClick={clickFilePicker}
            className="avatar-overlay heading text-xs uppercase tracking-widest text-white"
          >
            <Camera size={20} />
            Change Photo
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Preview confirm/cancel */}
      {pending && (
        <div className="mt-4 flex items-center gap-2 animate-fade-in">
          <button
            onClick={confirmUpload}
            className="btn-red px-4 py-2 rounded-md text-xs uppercase tracking-[0.15em] flex items-center gap-1.5"
          >
            <Check size={14} /> Save Photo
          </button>
          <button
            onClick={cancelUpload}
            className="px-4 py-2 rounded-md text-xs uppercase tracking-[0.15em] heading font-semibold text-text-secondary hover:text-white border border-border hover:border-text-secondary transition-all flex items-center gap-1.5"
          >
            <X size={14} /> Cancel
          </button>
        </div>
      )}

      {/* Remove existing photo */}
      {!pending && avatar && (
        <button
          onClick={handleRemove}
          className="mt-4 px-3 py-1.5 rounded-md text-[10px] uppercase tracking-[0.18em] heading font-semibold text-text-secondary hover:text-accent-secondary transition-all flex items-center gap-1.5"
        >
          <Trash2 size={12} /> Remove photo
        </button>
      )}

      {/* Inline error fallback (also surfaced as toast if onToast provided) */}
      {error && (
        <div className="mt-3 px-3 py-2 text-xs rounded-md bg-[rgba(232,0,28,0.08)] border border-[rgba(232,0,28,0.3)] text-accent-secondary max-w-xs text-center">
          {error}
        </div>
      )}
    </div>
  )
}
