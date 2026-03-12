import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import initSqlJs from 'sql.js'
import { StatusSnapshot, AppSettings } from './types'

class AppDatabase {
  private dbPath: string
  private dataDir: string
  private db: initSqlJs.Database | null = null
  private DB_LOAD_PROMISE: Promise<void> | null = null

  // 默认设置
  private defaultSettings: AppSettings = {
    notificationsEnabled: true,
    fatigueThreshold: 30,
    stuckThreshold: 15,
    frustrationThreshold: 0.7,
    slackingThreshold: 15,
    focusedThreshold: 60,
    breakReminderInterval: 60,
    workingHoursStart: 9,
    workingHoursEnd: 18,
    aiEnabled: false,
    aiBaseUrl: 'https://api.openai.com/v1',
    aiApiKey: '',
    aiModel: 'gpt-4o-mini',
    aiPromptTemplate: '你是一个幽默且毒舌的资深程序员外包监工。用一句话吐槽或鼓励当前这名开发者，语言要求简短、一针见血（字数不超过20字，禁止使用标点符号排比，直接给出回复句子本身无需前缀）。\n当前他的状态是：{state}\n他目前使用的软件是：{activeWindow}\n他已经持续这个状态 {duration} 分钟了。'
  }

  // 缓存设置避免频繁查库
  private cachedSettings: AppSettings | null = null

  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'devmood-data')
    this.dbPath = path.join(this.dataDir, 'database.sqlite')
    this.ensureDir()
  }

  private ensureDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
    }
  }

  // 初始化数据库，由于 sql.js 需要异步加载 WASM
  public async init(): Promise<void> {
    if (this.DB_LOAD_PROMISE) return this.DB_LOAD_PROMISE

    this.DB_LOAD_PROMISE = new Promise(async (resolve, reject) => {
      try {
        const SQL = await initSqlJs()

        if (fs.existsSync(this.dbPath)) {
          const fileBuffer = fs.readFileSync(this.dbPath)
          this.db = new SQL.Database(fileBuffer)
        } else {
          this.db = new SQL.Database()
        }

        // 创建表
        this.db.run(`
          CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            state TEXT NOT NULL,
            score INTEGER NOT NULL,
            confidence REAL NOT NULL,
            indicators TEXT NOT NULL,
            activeWindow TEXT DEFAULT ''
          );
        `)

        // 尝试自动执行结构迁移：如果 history 表没有 activeWindow 列，则补充
        try {
          const tableInfo = this.db.exec("PRAGMA table_info(history)")
          if (tableInfo.length > 0 && tableInfo[0].values) {
            const hasActiveWindow = tableInfo[0].values.some((col: any) => col[1] === 'activeWindow')
            if (!hasActiveWindow) {
              this.db.run("ALTER TABLE history ADD COLUMN activeWindow TEXT DEFAULT ''")
              this.saveDb()
              console.log('[Database] Migrated schema: added activeWindow column to history table')
            }
          }
        } catch (e) {
          console.error('[Database] Schema migration error:', e)
        }

        this.db.run(`
          CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          );
        `)

        // 迁移旧 JSON 数据（如果存在）
        this.migrateFromJson()

        resolve()
      } catch (err) {
        console.error('[Database] Init error:', err)
        reject(err)
      }
    })

    return this.DB_LOAD_PROMISE
  }

  // 从旧版 JSON 迁移数据
  private migrateFromJson() {
    try {
      const oldJsonPath = path.join(this.dataDir, 'data.json')
      if (fs.existsSync(oldJsonPath)) {
        console.log('[Database] Migrating from JSON...')
        const data = JSON.parse(fs.readFileSync(oldJsonPath, 'utf8'))

        // 迁移历史记录
        if (data.history && Array.isArray(data.history) && this.db) {
          const stmt = this.db.prepare(`
            INSERT INTO history (timestamp, state, score, confidence, indicators)
            VALUES (?, ?, ?, ?, ?)
          `)

          this.db.run('BEGIN TRANSACTION;')
          for (const item of data.history) {
            stmt.run([
              item.timestamp,
              item.state,
              item.score,
              item.confidence,
              JSON.stringify(item.indicators || [])
            ])
          }
          this.db.run('COMMIT;')
          stmt.free()
        }

        // 迁移设置
        if (data.settings) {
          this.updateSettings(data.settings)
        }

        // 重命名旧文件作为备份
        fs.renameSync(oldJsonPath, oldJsonPath + '.bak')
        this.saveDb()
        console.log('[Database] Migration complete.')
      }
    } catch (err) {
      console.error('[Database] Migration failed:', err)
      if (this.db) this.db.run('ROLLBACK;')
    }
  }

  // 保存数据库到磁盘
  private saveDb() {
    if (!this.db) return
    const data = this.db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(this.dbPath, buffer)
  }

  // ================= 接口方法 =================

  async saveHistory(snapshot: StatusSnapshot): Promise<void> {
    await this.init()
    if (!this.db) return

    try {
      this.db.run(`
        INSERT INTO history (timestamp, state, score, confidence, indicators, activeWindow)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        snapshot.timestamp,
        snapshot.state,
        snapshot.score,
        snapshot.confidence,
        JSON.stringify(snapshot.indicators),
        snapshot.activeWindow || ''
      ])

      // 每保存 10 条历史或立即写入磁盘（取决于性能考量，此处为简单实现立即保存）
      this.saveDb()
    } catch (err) {
      console.error('[Database] Failed to save history:', err)
    }
  }

  async getHistory(startTime: number, endTime: number): Promise<StatusSnapshot[]> {
    await this.init()
    if (!this.db) return []

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM history 
        WHERE timestamp >= ? AND timestamp <= ? 
        ORDER BY timestamp ASC
      `)

      stmt.bind([startTime, endTime])
      const results: StatusSnapshot[] = []

      while (stmt.step()) {
        const row = stmt.getAsObject()
        results.push({
          timestamp: row.timestamp as number,
          state: row.state as StatusSnapshot['state'],
          score: row.score as number,
          confidence: row.confidence as number,
          indicators: JSON.parse(row.indicators as string),
          activeWindow: row.activeWindow as string
        })
      }

      stmt.free()
      return results
    } catch (err) {
      console.error('[Database] Failed to get history:', err)
      return []
    }
  }

  async clearHistory(): Promise<void> {
    await this.init()
    if (!this.db) return

    try {
      this.db.run('DELETE FROM history;')
      this.saveDb()
    } catch (err) {
      console.error('[Database] Failed to clear history:', err)
    }
  }

  async getTodayStats() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const startTime = today.getTime()
    const endTime = startTime + 86400000

    const history = await this.getHistory(startTime, endTime)

    // 我们仍然使用 JavaScript 处理聚合，因为需要根据时间片段加权
    // 如果用 SQL 会比较复杂 (计算两条记录之间的时间差)
    let totalFocusedTime = 0
    let totalFatiguedTime = 0
    let totalStuckTime = 0
    let totalFrustratedTime = 0
    let totalSlackingTime = 0
    let totalScore = 0
    const appUsage: Record<string, number> = {}

    // 这里采用与之前同样的估算逻辑：每条记录代表 10 秒
    const timePerRecord = 10 * 1000

    for (const record of history) {
      if (record.state === 'focused') totalFocusedTime += timePerRecord
      else if (record.state === 'fatigued') totalFatiguedTime += timePerRecord
      else if (record.state === 'stuck') totalStuckTime += timePerRecord
      else if (record.state === 'frustrated') totalFrustratedTime += timePerRecord
      else if (record.state === 'slacking') totalSlackingTime += timePerRecord

      totalScore += record.score

      if (record.activeWindow && record.activeWindow !== 'Unknown') {
        let appName = record.activeWindow
        if (appName.includes(' - ')) {
          appName = appName.split(' - ')[0]
        }
        appUsage[appName] = (appUsage[appName] || 0) + timePerRecord
      }
    }

    const averageScore = history.length > 0 ? Math.round(totalScore / history.length) : 0

    const appUsageArray = Object.entries(appUsage)
      .map(([name, duration]) => ({ name, duration: Math.ceil(duration / 60000) }))
      .filter(app => app.duration > 0)
      .sort((a, b) => b.duration - a.duration)

    return {
      totalFocusedTime: Math.round(totalFocusedTime / 60000), // 转换为分钟
      totalFatiguedTime: Math.round(totalFatiguedTime / 60000),
      totalStuckTime: Math.round(totalStuckTime / 60000),
      totalFrustratedTime: Math.round(totalFrustratedTime / 60000),
      totalSlackingTime: Math.round(totalSlackingTime / 60000),
      averageScore,
      appUsage: appUsageArray
    }
  }

  async getPeriodStats(days: number) {
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    const endTime = today.getTime()
    
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days + 1)
    startDate.setHours(0, 0, 0, 0)
    const startTime = startDate.getTime()

    const history = await this.getHistory(startTime, endTime)

    // 按天进行聚合
    const dailyStats: Record<string, {
      totalScore: number
      count: number
      states: Record<string, number>
    }> = {}

    // 初始化每天的空数据结构
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      const dateStr = `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
      dailyStats[dateStr] = {
        totalScore: 0,
        count: 0,
        states: {
          focused: 0,
          fatigued: 0,
          stuck: 0,
          slacking: 0,
          frustrated: 0,
          normal: 0
        }
      }
    }

    const timePerRecord = 10 * 1000 // 10秒

    for (const record of history) {
      const d = new Date(record.timestamp)
      const dateStr = `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
      
      if (dailyStats[dateStr]) {
        dailyStats[dateStr].totalScore += record.score
        dailyStats[dateStr].count++
        if (dailyStats[dateStr].states[record.state] !== undefined) {
          dailyStats[dateStr].states[record.state] += timePerRecord
        }
      }
    }

    // 格式化输出为图表所需结构
    const chartData = []
    const aggregateTime = {
      totalFocusedTime: 0,
      totalFatiguedTime: 0,
      totalStuckTime: 0,
      totalSlackingTime: 0,
      totalFrustratedTime: 0,
    }
    let grandTotalScore = 0
    let grandTotalCount = 0

    for (const [date, stats] of Object.entries(dailyStats)) {
      const averageScore = stats.count > 0 ? Math.round(stats.totalScore / stats.count) : 0
      chartData.push({ time: date, score: averageScore })
      
      aggregateTime.totalFocusedTime += stats.states.focused
      aggregateTime.totalFatiguedTime += stats.states.fatigued
      aggregateTime.totalStuckTime += stats.states.stuck
      aggregateTime.totalSlackingTime += stats.states.slacking
      aggregateTime.totalFrustratedTime += stats.states.frustrated
      
      grandTotalScore += stats.totalScore
      grandTotalCount += stats.count
    }

    const averageScore = grandTotalCount > 0 ? Math.round(grandTotalScore / grandTotalCount) : 0

    return {
      chartData,
      stats: {
        totalFocusedTime: Math.round(aggregateTime.totalFocusedTime / 60000),
        totalFatiguedTime: Math.round(aggregateTime.totalFatiguedTime / 60000),
        totalStuckTime: Math.round(aggregateTime.totalStuckTime / 60000),
        totalSlackingTime: Math.round(aggregateTime.totalSlackingTime / 60000),
        totalFrustratedTime: Math.round(aggregateTime.totalFrustratedTime / 60000),
        averageScore
      }
    }
  }

  async getSettings(): Promise<AppSettings> {
    await this.init()
    if (this.cachedSettings) return this.cachedSettings

    if (!this.db) return this.defaultSettings

    try {
      const stmt = this.db.prepare('SELECT key, value FROM settings')
      const settings: Partial<AppSettings> = {}

      while (stmt.step()) {
        const row = stmt.getAsObject()
        const key = row.key as keyof AppSettings
        try {
          // @ts-ignore
          settings[key] = JSON.parse(row.value as string)
        } catch (e) { }
      }
      stmt.free()

      this.cachedSettings = { ...this.defaultSettings, ...settings }
      return this.cachedSettings
    } catch (err) {
      console.error('[Database] Failed to get settings:', err)
      return this.defaultSettings
    }
  }

  async updateSettings(settings: Partial<AppSettings>): Promise<void> {
    await this.init()
    if (!this.db) return

    try {
      this.db.run('BEGIN TRANSACTION;')
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO settings (key, value) 
        VALUES (?, ?)
      `)

      for (const [key, value] of Object.entries(settings)) {
        stmt.run([key, JSON.stringify(value)])
      }

      this.db.run('COMMIT;')
      stmt.free()

      // 更新缓存
      const current = await this.getSettings()
      this.cachedSettings = { ...current, ...settings }

      this.saveDb()
    } catch (err) {
      console.error('[Database] Failed to update settings:', err)
      if (this.db) this.db.run('ROLLBACK;')
    }
  }

  async exportAllData(): Promise<string> {
    await this.init()
    if (!this.db) return '{}'
    
    try {
      // 导出所有历史记录
      const historyStmt = this.db.prepare('SELECT * FROM history ORDER BY timestamp ASC')
      const history = []
      while (historyStmt.step()) {
        const row = historyStmt.getAsObject()
        history.push({
          timestamp: row.timestamp,
          state: row.state,
          score: row.score,
          confidence: row.confidence,
          indicators: JSON.parse(row.indicators as string),
          activeWindow: row.activeWindow
        })
      }
      historyStmt.free()
      
      // 导出所有设置
      const settings = await this.getSettings()
      
      return JSON.stringify({
        version: 1,
        exportedAt: Date.now(),
        settings,
        history
      }, null, 2)
    } catch (err) {
      console.error('[Database] Failed to export data:', err)
      throw err
    }
  }

  async importAllData(jsonData: string): Promise<boolean> {
    await this.init()
    if (!this.db) return false
    
    try {
      const data = JSON.parse(jsonData)
      if (!data.history || !data.settings) return false
      
      this.db.run('BEGIN TRANSACTION;')
      
      // 清空现有数据
      this.db.run('DELETE FROM history;')
      
      // 导入历史记录
      const historyStmt = this.db.prepare(`
        INSERT INTO history (timestamp, state, score, confidence, indicators, activeWindow) 
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      
      for (const record of data.history) {
        historyStmt.run([
          record.timestamp,
          record.state,
          record.score,
          record.confidence,
          JSON.stringify(record.indicators || {}),
          record.activeWindow || ''
        ])
      }
      historyStmt.free()
      
      // 导入设置
      const settingsStmt = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      for (const [key, value] of Object.entries(data.settings)) {
        settingsStmt.run([key, JSON.stringify(value)])
      }
      settingsStmt.free()
      
      this.db.run('COMMIT;')
      
      // 更新缓存
      this.cachedSettings = { ...this.defaultSettings, ...data.settings }
      
      this.saveDb()
      return true
    } catch (err) {
      console.error('[Database] Failed to import data:', err)
      if (this.db) {
        try { this.db.run('ROLLBACK;') } catch(e) {}
      }
      return false
    }
  }

  close(): void {
    if (this.db) {
      this.saveDb() // 确保最后一次写入
      this.db.close()
      this.db = null
    }
  }
}

export default new AppDatabase()