import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core'
import { useEffect, useState } from 'react'

export const MIN_PASSWORD_LENGTH = 9
export const MIN_PASSWORD_SCORE = 3

let ready = false
let loadPromise: Promise<void> | null = null
const listeners = new Set<() => void>()

const ensureLoaded = (): Promise<void> => {
  if (!loadPromise) {
    loadPromise = Promise.all([
      import('@zxcvbn-ts/language-common'),
      import('@zxcvbn-ts/language-en'),
    ])
      .then(([common, en]) => {
        zxcvbnOptions.setOptions({
          dictionary: { ...common.dictionary, ...en.dictionary },
          graphs: common.adjacencyGraphs,
          translations: en.translations,
        })
        ready = true
        for (const listener of listeners) listener()
      })
      .catch((err) => {
        console.error('Failed to load zxcvbn language packs', err)
        loadPromise = null
      })
  }
  return loadPromise
}

let lastScoredPassword: string | null = null
let lastScore = 0

export const scorePassword = (password: string): number => {
  if (password.length === 0 || !ready) return 0
  if (password === lastScoredPassword) return lastScore
  lastScore = zxcvbn(password).score
  lastScoredPassword = password
  return lastScore
}

export const isPasswordAcceptable = (password: string): boolean =>
  password.length >= MIN_PASSWORD_LENGTH && scorePassword(password) >= MIN_PASSWORD_SCORE

export const isConfirmMismatch = (password: string, confirm: string): boolean =>
  confirm.length > 0 && password !== confirm

export const isNewPasswordPairValid = (password: string, confirm: string): boolean =>
  isPasswordAcceptable(password) && password === confirm

export const usePasswordStrengthReady = (): boolean => {
  const [isReady, setReady] = useState(ready)
  useEffect(() => {
    if (ready) {
      if (!isReady) setReady(true)
      return
    }
    const listener = (): void => setReady(true)
    listeners.add(listener)
    void ensureLoaded()
    return () => {
      listeners.delete(listener)
    }
  }, [isReady])
  return isReady
}
