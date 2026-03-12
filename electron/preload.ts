import { contextBridge, ipcRenderer } from 'electron'
import { CurrentStatus, StatusSnapshot, AppSettings } from './types'

// 暴露给渲染进程的 API
const electronAPI = {
  // 获取当前状态
  getCurrentStatus: (): Promise<CurrentStatus> => {
    return ipcRenderer.invoke('get-current-status')
  },

  // 获取历史记录
  getHistory: (start: number, end: number): Promise<StatusSnapshot[]> => {
    return ipcRenderer.invoke('get-history', { start, end })
  },

  // 获取设置
  getSettings: (): Promise<AppSettings> => {
    return ipcRenderer.invoke('get-settings')
  },

  // 更新设置
  updateSettings: (settings: Partial<AppSettings>): Promise<void> => {
    return ipcRenderer.invoke('update-settings', settings)
  },

  // 获取今日统计
  getTodayStats: (): Promise<{
    totalFocusedTime: number
    totalFatiguedTime: number
    totalStuckTime: number
    totalFrustratedTime: number
    totalSlackingTime: number
    averageScore: number
  } | null> => {
    return ipcRenderer.invoke('get-today-stats')
  },

  // 获取长期统计数据 (按天聚合)
  getPeriodStats: (days: number): Promise<{
    chartData: Array<{ time: string; score: number }>
    stats: {
      totalFocusedTime: number
      totalFatiguedTime: number
      totalStuckTime: number
      totalFrustratedTime: number
      totalSlackingTime: number
      averageScore: number
    }
  } | null> => {
    return ipcRenderer.invoke('get-period-stats', days)
  },

  // 重置工作计时
  resetWorkTimer: (): Promise<void> => {
    return ipcRenderer.invoke('reset-work-timer')
  },

  // 清空历史记录
  clearHistory: (): Promise<void> => {
    return ipcRenderer.invoke('clear-history')
  },

  // 获取权限状态
  getPermissionStatus: (): Promise<{ granted: boolean; platform: string }> => {
    return ipcRenderer.invoke('get-permission-status')
  },

  // 监听状态更新
  onStatusUpdate: (callback: (status: CurrentStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: CurrentStatus) => {
      callback(status)
    }
    ipcRenderer.on('status-update', listener)

    // 返回取消订阅函数
    return () => {
      ipcRenderer.removeListener('status-update', listener)
    }
  }
}

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// 类型声明
export type ElectronAPI = typeof electronAPI