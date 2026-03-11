import { CurrentStatus, StatusSnapshot, AppSettings } from './index'

export interface ElectronAPI {
  getCurrentStatus: () => Promise<CurrentStatus>
  getHistory: (start: number, end: number) => Promise<StatusSnapshot[]>
  getSettings: () => Promise<AppSettings>
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>
  getTodayStats: () => Promise<{
    totalFocusedTime: number
    totalFatiguedTime: number
    totalStuckTime: number
    totalFrustratedTime: number
    averageScore: number
  } | null>
  resetWorkTimer: () => Promise<void>
  onStatusUpdate: (callback: (status: CurrentStatus) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}