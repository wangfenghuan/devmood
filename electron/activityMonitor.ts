import { EventEmitter } from 'events'
import { exec } from 'child_process'
import { ActivityData } from './types'

// 活动监控器 - 使用 Electron 的 powerMonitor 和模拟的输入监控
class ActivityMonitor extends EventEmitter {
  private isRunning: boolean = false
  private lastActivityTime: number = Date.now()

  // 统计数据
  private keystrokes: number[] = []
  private mouseClicks: number[] = []
  private mouseMoves: number[] = []
  private mouseScrolls: number[] = []
  
  // 新增：特定按键统计
  private backspaces: number[] = []
  private copyPastes: number[] = []
  private lastMousePosition = { x: 0, y: 0 }
  private totalMouseDistance: number = 0

  // 时间窗口 (毫秒)
  private readonly TIME_WINDOW = 60 * 1000 // 1分钟窗口
  private readonly SAMPLE_INTERVAL = 1000 // 1秒采样间隔

  // 空闲检测
  private idleThreshold: number = 30 * 1000 // 30秒无活动视为空闲
  private idleStartTime: number | null = null

  // 模拟活动窗口 - 配合 AppleScript
  private currentWindowProcess: string = 'Unknown'
  private currentWindowTitle: string = ''

  // 定时器
  private sampleTimer?: NodeJS.Timeout
  private reportTimer?: NodeJS.Timeout
  private windowTimer?: NodeJS.Timeout

  constructor() {
    super()
  }

  // 启动监控
  start(): void {
    if (this.isRunning) return

    this.isRunning = true
    this.lastActivityTime = Date.now()

    // 启动采样定时器
    this.sampleTimer = setInterval(() => {
      this.sample()
    }, this.SAMPLE_INTERVAL)

    // 启动报告定时器 (每10秒报告一次)
    this.reportTimer = setInterval(() => {
      this.report()
    }, 10 * 1000)

    // 启动活跃应用获取器 (每2秒轮询 macOS 前台窗口)
    this.windowTimer = setInterval(() => {
      this.fetchActiveWindow()
    }, 2000)

    console.log('Activity monitor started')
  }

  // 停止监控
  stop(): void {
    if (!this.isRunning) return

    this.isRunning = false

    if (this.sampleTimer) {
      clearInterval(this.sampleTimer)
      this.sampleTimer = undefined
    }

    if (this.reportTimer) {
      clearInterval(this.reportTimer)
      this.reportTimer = undefined
    }

    if (this.windowTimer) {
      clearInterval(this.windowTimer)
      this.windowTimer = undefined
    }

    console.log('Activity monitor stopped')
  }

  // 记录键盘事件 (由主进程调用)
  recordKeystroke(keycode?: number): void {
    const now = Date.now()
    this.keystrokes.push(now)
    
    // 粗略识别特定按键模式 (uiohook keycodes: 14=Backspace, 211=Delete, 46=C, 47=V)
    // 注意：这里只做简单识别，如果要严格判断 Ctrl+C 需要维护 modifier key 状态，
    // 为保持性能，只要有 C/V 按下我们也算作一次潜在的操作，或者由 main.ts 判断更准确。
    // 我们在这里提供方法供 main.ts 调用
    this.updateActivity(now)
  }

  // 记录退格/删除
  recordBackspace(): void {
    const now = Date.now()
    this.backspaces.push(now)
    this.updateActivity(now)
  }

  // 记录复制/粘贴
  recordCopyPaste(): void {
    const now = Date.now()
    this.copyPastes.push(now)
    this.updateActivity(now)
  }

  // 记录鼠标点击事件
  recordMouseClick(): void {
    const now = Date.now()
    this.mouseClicks.push(now)
    this.updateActivity(now)
  }

  // 记录鼠标移动事件
  recordMouseMove(x: number, y: number): void {
    const now = Date.now()

    // 计算移动距离
    const distance = Math.sqrt(
      Math.pow(x - this.lastMousePosition.x, 2) +
      Math.pow(y - this.lastMousePosition.y, 2)
    )

    if (distance > 5) { // 忽略微小移动
      this.totalMouseDistance += distance
      this.mouseMoves.push(now)
      this.updateActivity(now)
    }

    this.lastMousePosition = { x, y }
  }

  // 记录鼠标滚动事件
  recordMouseScroll(): void {
    const now = Date.now()
    this.mouseScrolls.push(now)
    this.updateActivity(now)
  }

  // 更新活动时间
  private updateActivity(time: number): void {
    this.lastActivityTime = time

    // 如果之前是空闲状态，现在恢复活动
    if (this.idleStartTime !== null) {
      const idleDuration = time - this.idleStartTime
      this.emit('idle-end', idleDuration)
      this.idleStartTime = null
    }
  }

  // 采样 - 清理过期数据
  private sample(): void {
    const now = Date.now()
    const cutoff = now - this.TIME_WINDOW

    // 清理过期的事件
    this.keystrokes = this.keystrokes.filter(t => t > cutoff)
    this.mouseClicks = this.mouseClicks.filter(t => t > cutoff)
    this.mouseMoves = this.mouseMoves.filter(t => t > cutoff)
    this.mouseScrolls = this.mouseScrolls.filter(t => t > cutoff)
    this.backspaces = this.backspaces.filter(t => t > cutoff)
    this.copyPastes = this.copyPastes.filter(t => t > cutoff)

    // 检测空闲状态
    if (now - this.lastActivityTime > this.idleThreshold && this.idleStartTime === null) {
      this.idleStartTime = this.lastActivityTime
      this.emit('idle-start')
    }
  }

  // 生成报告
  private report(): void {
    const now = Date.now()

    // 计算空闲时间
    let idleTime = 0
    if (this.idleStartTime !== null) {
      idleTime = now - this.idleStartTime
    }

    const activityData: ActivityData = {
      typingSpeed: this.keystrokes.length,
      mouseSpeed: this.calculateMouseSpeed(),
      clickFrequency: this.mouseClicks.length,
      scrollFrequency: this.mouseScrolls.length,
      idleTime: idleTime,
      totalKeystrokes: this.keystrokes.length,
      backspaceCount: this.backspaces.length,
      copyPasteCount: this.copyPastes.length,
      totalMouseClicks: this.mouseClicks.length,
      totalMouseMoves: this.mouseMoves.length,
      activeWindow: this.currentWindowProcess ? `${this.currentWindowProcess} - ${this.currentWindowTitle}` : 'Unknown',
      timestamp: now
    }

    this.emit('activity', activityData)

    // 重置鼠标移动距离，避免累积导致速度指标失真
    this.totalMouseDistance = 0
  }

  // 计算鼠标速度 (像素/秒)
  private calculateMouseSpeed(): number {
    if (this.mouseMoves.length < 2) return 0

    const windowSeconds = this.TIME_WINDOW / 1000
    return Math.round(this.totalMouseDistance / windowSeconds)
  }

  // 获取当前统计数据
  getCurrentStats(): Omit<ActivityData, 'timestamp' | 'activeWindow'> {
    const now = Date.now()
    let idleTime = 0
    if (this.idleStartTime !== null) {
      idleTime = now - this.idleStartTime
    }

    return {
      typingSpeed: this.keystrokes.length,
      mouseSpeed: this.calculateMouseSpeed(),
      clickFrequency: this.mouseClicks.length,
      scrollFrequency: this.mouseScrolls.length,
      idleTime: idleTime,
      totalKeystrokes: this.keystrokes.length,
      backspaceCount: this.backspaces.length,
      copyPasteCount: this.copyPastes.length,
      totalMouseClicks: this.mouseClicks.length,
      totalMouseMoves: this.mouseMoves.length
    }
  }

  // 重置统计数据
  reset(): void {
    this.keystrokes = []
    this.mouseClicks = []
    this.mouseMoves = []
    this.mouseScrolls = []
    this.backspaces = []
    this.copyPastes = []
    this.totalMouseDistance = 0
    this.lastActivityTime = Date.now()
    this.idleStartTime = null
  }

  // 设置空闲阈值
  setIdleThreshold(thresholdMs: number): void {
    this.idleThreshold = thresholdMs
  }

  // 记录系统空闲时间 (由主进程调用)
  recordIdle(idleTime: number): void {
    this.idleStartTime = Date.now() - idleTime
    this.lastActivityTime = Date.now() - idleTime
  }

  // 借助跨平台库 active-win 获取当前活跃的 App 及窗口标题
  private async fetchActiveWindow() {
    try {
      // 动态导入以兼容纯 ESM 包 (active-win >= 8v)
      const { default: activeWin } = await import('active-win')
      const window = await activeWin()
      
      if (window) {
        let processName = window.owner.name

        // 过滤 Electron 宿主进程避免判定漂移
        if (processName.includes('Electron')) {
          processName = 'DevMood'
        }

        this.currentWindowProcess = processName
        this.currentWindowTitle = window.title || ''
      }
    } catch (err) {
      // 静默处理获取失败防止刷屏
    }
  }
}

export default ActivityMonitor