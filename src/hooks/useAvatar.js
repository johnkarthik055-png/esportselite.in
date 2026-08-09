import { useCallback } from 'react'
import { useLocalStorage } from './useLocalStorage.js'
import { STORAGE_KEYS } from '../utils/constants.js'

/**
 * User avatar — single base64 data URL OR null when unset.
 * Used by the Profile uploader and the TopBar to show the same image.
 */
export function useAvatar() {
  const [avatar, setAvatar] = useLocalStorage(STORAGE_KEYS.USER_AVATAR, null)

  const saveAvatar = useCallback(
    (base64) => setAvatar(base64 || null),
    [setAvatar]
  )

  const removeAvatar = useCallback(() => setAvatar(null), [setAvatar])

  return { avatar, saveAvatar, removeAvatar }
}
