import type { MarketRegime, PredictionOutcome, SetupType } from '@nse/shared'
import { REGIME_LABELS, SETUP_LABELS } from '@nse/shared'

export type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'violet'

export const fmt = (n: number | null | undefined, digits = 2): string =>
  n === null || n === undefined || !Number.isFinite(n) ? '–' : n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const pct = (n: number | null | undefined, digits = 1, sign = false): string => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–'
  const s = n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return `${sign && n > 0 ? '+' : ''}${s}%`
}

export const inr = (n: number | null | undefined, digits = 2): string => (n === null || n === undefined || !Number.isFinite(n) ? '–' : `₹${fmt(n, digits)}`)

export const compact = (n: number | null | undefined): string => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–'
  if (Math.abs(n) >= 1e7) return `${(n / 1e7).toFixed(1)} Cr`
  if (Math.abs(n) >= 1e5) return `${(n / 1e5).toFixed(1)} L`
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)} K`
  return n.toFixed(0)
}

export const dateLong = (iso: string | null | undefined): string => {
  if (!iso) return '–'
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

export const dateShort = (iso: string | null | undefined): string => {
  if (!iso) return '–'
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}

export const timeAgo = (iso: string | null | undefined): string => {
  if (!iso) return '–'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

export const regimeLabel = (r: MarketRegime | string | null | undefined) => (r ? (REGIME_LABELS[r as MarketRegime] ?? r) : '–')
export const setupLabel = (s: SetupType | string | null | undefined) => (s ? (SETUP_LABELS[s as SetupType] ?? s) : '–')

export const regimeTone = (r: MarketRegime | string | null | undefined): Tone => {
  switch (r) {
    case 'STRONG_BULLISH':
      return 'success'
    case 'BULLISH':
      return 'success'
    case 'SIDEWAYS':
      return 'warning'
    case 'BEARISH':
      return 'danger'
    case 'STRONG_BEARISH':
      return 'danger'
    default:
      return 'neutral'
  }
}

export const outcomeTone = (o: PredictionOutcome | string): Tone => {
  switch (o) {
    case 'SUCCESS':
      return 'success'
    case 'FAILURE':
      return 'danger'
    case 'EXPIRED':
      return 'warning'
    case 'NO_FILL':
      return 'neutral'
    default:
      return 'info'
  }
}

export const outcomeLabel = (o: PredictionOutcome | string): string => {
  switch (o) {
    case 'SUCCESS':
      return 'Target hit'
    case 'FAILURE':
      return 'Stop hit'
    case 'EXPIRED':
      return 'Expired'
    case 'NO_FILL':
      return 'No fill'
    default:
      return 'Open'
  }
}

export const setupTone = (s: SetupType | string): Tone => {
  switch (s) {
    case 'BREAKOUT':
      return 'info'
    case 'PULLBACK':
      return 'violet'
    case 'TREND_CONTINUATION':
      return 'success'
    case 'REVERSAL':
      return 'warning'
    default:
      return 'neutral'
  }
}

export const signTone = (n: number | null | undefined): Tone => (n === null || n === undefined || !Number.isFinite(n) ? 'neutral' : n > 0 ? 'success' : n < 0 ? 'danger' : 'neutral')

export const scoreTone = (score: number): Tone => (score >= 80 ? 'success' : score >= 70 ? 'info' : score >= 60 ? 'warning' : 'neutral')

export const todayIso = () => new Date().toISOString().slice(0, 10)
