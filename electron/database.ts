import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { StatusSnapshot, AppSettings } from './types'

class AppDatabase {
  private dbPath: string
  private dataPath: string
  private data: {
    history: StatusSnapshot[]
    settings: AppSettings
  }

  constructor() {
    this.dataPath = path.join(app.getPath('userData'), 'devmood-data')
    this.dbPath = path.join(this.dataPath, 'data.json')
    
    // 默认数据
    this.data = {
      history: [],
      settings: {
        notificationsEnabled: true,
        fatigueThreshold: 30,
        stuckThreshold: 15,
        frustrationThreshold: 0.7,
        breakReminderInterval: 60,
        workingHoursStart: 9,
        workingHoursEnd: 18
      }
    }
    
    this.initialize()
  }

  private initialize(): void {
    // 确保目录存在
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true })
    }
    
    // 读取现有数据
    if (fs.existsSync(this.dbPath)) {
      try {
        const content = fs.readFileSync(this.dbPath, 'utf-8')
        this.data = JSON.parse(content)
      } catch (error) {
        console.error('Failed to load data, using defaults:', error)
      }
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2))
    } catch (error) {
      console.error('Failed to save data:', error)
    }
  }

  // 保存状态快照
  saveStatusSnapshot(status: StatusSnapshot): void {
    this.data.history.push(status)
    
    // 只保留最近 1000 条记录
    if (this.data.history.length > 1000) {
      this.data.history = this.data.history.slice(-1000)
    }
    
    this.save()
  }

  // 获取历史记录
  getHistory(start: number, end: number): StatusSnapshot[] {
    return this.data.history.filter(
      (record) => record.timestamp >= start && record.timestamp <= end
    )
  }

  // 获取今日统计
  getTodayStats(): { 
    totalFocusedTime: number
    totalFatiguedTime: number
    totalStuckTime: number
    totalFrustratedTime: number
    averageScore: number
  } {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const startOfDay = today.getTime()
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000

    const todayRecords = this.getHistory(startOfDay, endOfDay)
    
    const stats = {
      totalFocusedTime: 0,
      totalFatiguedTime: 0,
      totalStuckTime: 0,
      totalFrustratedTime: 0,
      averageScore: 0
    }

    let totalScore = 0
    const stateCounts: Record<string, number> = {
      focused: 0,
      fatigued: 0,
      stuck: 0,
      frustrated: 0
    }

    for (const record of todayRecords) {
      totalScore += record.score
      if (stateCounts[record.state] !== undefined) {
        stateCounts[record.state]++
      }
    }

    // 每条记录代表约10秒，转换为分钟
    stats.totalFocusedTime = Math.round(stateCounts.focused * 10 / 60)
    stats.totalFatiguedTime = Math.round(stateCounts.fatigued * 10 / 60)
    stats.totalStuckTime = Math.round(stateCounts.stuck * 10 / 60)
    stats.totalFrustratedTime = Math.round(stateCounts.frustrated * 10 / 60)
    stats.averageScore = todayRecords.length > 0 
      ? Math.round(totalScore / todayRecords.length) 
      : 0

    return stats
  }

  // 获取设置
  getSettings(): AppSettings {
    return this.data.settings
  }

  // 更新设置
  updateSettings(settings: Partial<AppSettings>): void {
    this.data.settings = { ...this.data.settings, ...settings }
    this.save()
  }

  // 清理旧数据（保留30天）
  cleanupOldData(): void {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    this.data.history = this.data.history.filter(
      (record) => record.timestamp >= thirtyDaysAgo
    )
    this.save()
  }

  // 关闭（保存数据）
  close(): void {
    this.save()
  }
}

export default AppDatabase