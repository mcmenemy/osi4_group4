import { useCallback, useEffect, useState } from 'react'

// Review state lives in this browser's localStorage; "Export reviews as JSON" is how it gets
// committed. Every storage access is wrapped because storage can be unavailable.

export type ReviewStatus = 'accepted' | 'rejected' | 'pending'

export interface FieldEdit {
  value: string
  unit: string
}

export interface Review {
  status: ReviewStatus
  note: string
  edits: Record<string, FieldEdit>
  reviewed_at: string | null
}

const KEY = 'osi4.reviews.v1'
const REVIEWER_KEY = 'osi4.reviewer'
const EVENT = 'osi4-reviews-changed'

function read(): Record<string, Review> {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Record<string, Review>) : {}
  } catch {
    return {}
  }
}

function write(reviews: Record<string, Review>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(reviews))
  } catch {
    // Storage full or blocked: reviews stay in memory for this session only.
  }
  window.dispatchEvent(new Event(EVENT))
}

export const emptyReview = (): Review => ({ status: 'pending', note: '', edits: {}, reviewed_at: null })

// Module-level copy so reviews survive in memory even when storage is blocked.
let memory: Record<string, Review> = read()

export function useReviews() {
  const [reviews, setReviews] = useState(memory)

  useEffect(() => {
    const sync = () => setReviews(memory)
    const fromOtherTab = () => {
      memory = read()
      sync()
    }
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', fromOtherTab)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', fromOtherTab)
    }
  }, [])

  const update = useCallback((id: string, patch: Partial<Review>) => {
    memory = { ...memory, [id]: { ...emptyReview(), ...memory[id], ...patch, reviewed_at: new Date().toISOString() } }
    write(memory)
  }, [])

  return { reviews, update }
}

export function readReviewer(): string {
  try {
    return window.localStorage.getItem(REVIEWER_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveReviewer(name: string) {
  try {
    window.localStorage.setItem(REVIEWER_KEY, name)
  } catch {
    // Not critical.
  }
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
