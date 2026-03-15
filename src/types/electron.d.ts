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
    totalSlackingTime: number
    averageScore: number
    appUsage: { name: string; duration: number }[]
  } | null>
  getPeriodStats: (days: number) => Promise<{
    chartData: Array<{ time: string; score: number }>
    stats: {
      totalFocusedTime: number
      totalFatiguedTime: number
      totalStuckTime: number
      totalFrustratedTime: number
      totalSlackingTime: number
      averageScore: number
    }
    appUsage: { name: string; duration: number }[]
  } | null>
  resetWorkTimer: () => Promise<void>
  clearHistory: () => Promise<void>
  exportData: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>
  importData: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>
  getPermissionStatus: () => Promise<{ granted: boolean; platform: string }>
  sendFeedback: (data: { state: string, isAccurate: boolean }) => Promise<{ success: boolean }>
  onStatusUpdate: (callback: (status: CurrentStatus) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export { }