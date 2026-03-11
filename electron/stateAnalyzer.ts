import { ActivityData, StateAnalysis, DeveloperState, AppSettings } from './types'

// 状态分析器 - 根据活动数据识别开发者状态
class StateAnalyzer {
  // 历史数据缓存 (用于检测趋势)
  private activityHistory: ActivityData[] = []
  private stateHistory: { state: DeveloperState; timestamp: number }[] = []
  private readonly HISTORY_SIZE = 30 // 保留最近30个数据点 (约5分钟)
  
  // 默认设置
  private settings: AppSettings = {
    notificationsEnabled: true,
    fatigueThreshold: 30,
    stuckThreshold: 15,
    frustrationThreshold: 0.7,
    breakReminderInterval: 60,
    workingHoursStart: 9,
    workingHoursEnd: 18
  }

  // 工作开始时间
  private workStartTime: number = Date.now()

  constructor() {}

  // 更新设置
  updateSettings(settings: AppSettings): void {
    this.settings = settings
  }

  // 分析活动数据
  analyze(data: ActivityData): StateAnalysis {
    // 添加到历史
    this.activityHistory.push(data)
    if (this.activityHistory.length > this.HISTORY_SIZE) {
      this.activityHistory.shift()
    }

    // 计算各项指标
    const metrics = this.calculateMetrics(data)
    
    // 识别状态
    const state = this.identifyState(metrics)
    
    // 计算效率分数
    const score = this.calculateScore(state, metrics)
    
    // 计算置信度
    const confidence = this.calculateConfidence(metrics)
    
    // 计算持续时间
    const { fatigueDuration, stuckDuration } = this.calculateDurations()
    
    // 计算烦躁程度
    const frustrationLevel = this.calculateFrustrationLevel(metrics)
    
    // 计算连续工作时间
    const continuousWorkTime = Date.now() - this.workStartTime
    
    // 生成状态指示器
    const indicators = this.generateIndicators(state, metrics)

    // 记录状态历史
    this.stateHistory.push({ state, timestamp: Date.now() })
    if (this.stateHistory.length > this.HISTORY_SIZE) {
      this.stateHistory.shift()
    }

    return {
      state,
      score,
      confidence,
      fatigueDuration,
      stuckDuration,
      frustrationLevel,
      continuousWorkTime,
      indicators
    }
  }

  // 计算各项指标
  private calculateMetrics(data: ActivityData) {
    const history = this.activityHistory
    
    // 平均打字速度
    const avgTypingSpeed = this.average(history.map(h => h.typingSpeed))
    
    // 打字速度趋势 (最近 vs 之前)
    const typingTrend = this.calculateTrend(history.map(h => h.typingSpeed))
    
    // 平均鼠标速度
    const avgMouseSpeed = this.average(history.map(h => h.mouseSpeed))
    
    // 点击频率
    const avgClickFrequency = this.average(history.map(h => h.clickFrequency))
    
    // 点击频率变化率
    const clickTrend = this.calculateTrend(history.map(h => h.clickFrequency))
    
    // 空闲时间比例
    const avgIdleTime = this.average(history.map(h => h.idleTime))
    const idleRatio = avgIdleTime / 60000 // 转换为分钟比例
    
    // 活动变化率 (用于检测烦躁)
    const activityVariance = this.variance(history.map(h => 
      h.typingSpeed + h.clickFrequency + h.scrollFrequency
    ))

    // 打字节奏一致性 (专注时节奏更稳定)
    const typingRhythm = this.calculateRhythm(history.map(h => h.typingSpeed))

    return {
      avgTypingSpeed,
      typingTrend,
      avgMouseSpeed,
      avgClickFrequency,
      clickTrend,
      avgIdleTime,
      idleRatio,
      activityVariance,
      typingRhythm,
      currentTypingSpeed: data.typingSpeed,
      currentClickFrequency: data.clickFrequency,
      currentIdleTime: data.idleTime
    }
  }

  // 识别状态
  private identifyState(metrics: ReturnType<typeof this.calculateMetrics>): DeveloperState {
    const { 
      avgTypingSpeed, typingTrend, avgClickFrequency, clickTrend,
      idleRatio, activityVariance, typingRhythm, currentIdleTime 
    } = metrics

    // 1. 检测疲劳状态
    // 特征：打字速度下降、点击频率下降、空闲时间增加、打字节奏变慢
    if (
      (avgTypingSpeed > 0 && avgTypingSpeed < 30 && typingTrend < -0.2) ||
      (idleRatio > 0.5 && typingTrend < -0.3) ||
      (currentIdleTime > 2 * 60 * 1000) // 空闲超过2分钟
    ) {
      return 'fatigued'
    }

    // 2. 检测卡住状态
    // 特征：低输入但非空闲、频繁切换活动、删除/重试模式
    if (
      (avgTypingSpeed < 20 && avgTypingSpeed > 0 && idleRatio < 0.3) ||
      (typingTrend < -0.1 && clickTrend > 0.1) || // 打字减少但点击增加（可能在浏览文档）
      (activityVariance > 100 && avgTypingSpeed < 50) // 活动不稳定且打字少
    ) {
      return 'stuck'
    }

    // 3. 检测烦躁状态
    // 特征：高频率输入但节奏混乱、频繁点击、鼠标移动过快
    if (
      (avgClickFrequency > 40 && clickTrend > 0.3) ||
      (activityVariance > 200 && avgTypingSpeed > 80) || // 活动非常不稳定
      (typingRhythm < 0.3 && avgTypingSpeed > 60) // 打字快但节奏乱
    ) {
      return 'frustrated'
    }

    // 4. 检测专注状态
    // 特征：稳定的中高速输入、稳定的节奏、低空闲时间
    if (
      avgTypingSpeed > 60 && 
      typingRhythm > 0.6 && 
      idleRatio < 0.2 &&
      typingTrend >= -0.1
    ) {
      return 'focused'
    }

    // 默认：正常状态
    return 'normal'
  }

  // 计算效率分数
  private calculateScore(
    state: DeveloperState, 
    metrics: ReturnType<typeof this.calculateMetrics>
  ): number {
    let score = 50 // 基础分

    switch (state) {
      case 'focused':
        // 专注状态：高分
        score = 80 + Math.min(20, metrics.avgTypingSpeed / 10)
        break
        
      case 'normal':
        // 正常状态：中等分数
        score = 60 + Math.min(15, metrics.avgTypingSpeed / 10)
        break
        
      case 'stuck':
        // 卡住状态：较低分数，但说明在思考
        score = 40 + Math.min(10, metrics.avgClickFrequency / 5)
        break
        
      case 'fatigued':
        // 疲劳状态：低分 (10-30)
        score = 20 + Math.max(0, 10 - metrics.idleRatio * 10)
        break
        
      case 'frustrated':
        // 烦躁状态：较低分数
        score = 35
        break
    }

    // 确保分数在0-100范围内
    return Math.max(0, Math.min(100, Math.round(score)))
  }

  // 计算置信度
  private calculateConfidence(metrics: ReturnType<typeof this.calculateMetrics>): number {
    // 数据越多、越稳定，置信度越高
    const dataPoints = this.activityHistory.length
    const dataConfidence = Math.min(1, dataPoints / 10)
    
    // 指标一致性
    const consistency = 1 - Math.min(1, metrics.activityVariance / 500)
    
    return Math.round((dataConfidence * 0.5 + consistency * 0.5) * 100) / 100
  }

  // 计算持续时间
  private calculateDurations(): { fatigueDuration: number; stuckDuration: number } {
    let fatigueDuration = 0
    let stuckDuration = 0
    
    // 从最近的记录开始，计算连续状态持续时间
    for (let i = this.stateHistory.length - 1; i >= 0; i--) {
      const record = this.stateHistory[i]
      
      if (record.state === 'fatigued') {
        fatigueDuration += 10 * 1000 // 每条记录约10秒
      } else if (record.state === 'stuck') {
        stuckDuration += 10 * 1000
      } else {
        break
      }
    }
    
    return { fatigueDuration, stuckDuration }
  }

  // 计算烦躁程度
  private calculateFrustrationLevel(metrics: ReturnType<typeof this.calculateMetrics>): number {
    const { activityVariance, clickTrend, typingRhythm } = metrics
    
    let level = 0
    
    // 活动变化大 -> 更烦躁
    level += Math.min(0.4, activityVariance / 500)
    
    // 点击频率增加 -> 更烦躁
    level += Math.min(0.3, Math.max(0, clickTrend))
    
    // 打字节奏乱 -> 更烦躁
    level += Math.min(0.3, 1 - typingRhythm)
    
    return Math.min(1, level)
  }

  // 生成状态指示器说明
  private generateIndicators(
    state: DeveloperState, 
    metrics: ReturnType<typeof this.calculateMetrics>
  ): string[] {
    const indicators: string[] = []

    switch (state) {
      case 'focused':
        if (metrics.avgTypingSpeed > 80) {
          indicators.push(`高效打字：${Math.round(metrics.avgTypingSpeed)} 次/分钟`)
        }
        if (metrics.typingRhythm > 0.7) {
          indicators.push('打字节奏稳定')
        }
        indicators.push('进入心流状态')
        break
        
      case 'fatigued':
        if (metrics.idleRatio > 0.5) {
          indicators.push(`空闲时间占比：${Math.round(metrics.idleRatio * 100)}%`)
        }
        if (metrics.typingTrend < -0.2) {
          indicators.push('打字速度下降')
        }
        indicators.push('建议休息一下')
        break
        
      case 'stuck':
        indicators.push('检测到思考或查阅资料')
        if (metrics.avgClickFrequency > metrics.avgTypingSpeed) {
          indicators.push('点击多于打字，可能在浏览')
        }
        indicators.push('换个思路试试？')
        break
        
      case 'frustrated':
        if (metrics.activityVariance > 150) {
          indicators.push('活动模式不稳定')
        }
        if (metrics.clickTrend > 0.2) {
          indicators.push('点击频率上升')
        }
        indicators.push('深呼吸，放松一下')
        break
        
      case 'normal':
        indicators.push('状态正常')
        if (metrics.avgTypingSpeed > 40) {
          indicators.push(`打字速度：${Math.round(metrics.avgTypingSpeed)} 次/分钟`)
        }
        break
    }

    return indicators
  }

  // 辅助函数：计算平均值
  private average(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((a, b) => a + b, 0) / values.length
  }

  // 辅助函数：计算方差
  private variance(values: number[]): number {
    if (values.length < 2) return 0
    const avg = this.average(values)
    return this.average(values.map(v => Math.pow(v - avg, 2)))
  }

  // 辅助函数：计算趋势 (正值表示上升，负值表示下降)
  private calculateTrend(values: number[]): number {
    if (values.length < 3) return 0
    
    const recent = this.average(values.slice(-5))
    const earlier = this.average(values.slice(0, -5))
    
    if (earlier === 0) return recent > 0 ? 1 : 0
    return (recent - earlier) / earlier
  }

  // 辅助函数：计算节奏一致性 (0-1，越高越稳定)
  private calculateRhythm(values: number[]): number {
    if (values.length < 5) return 0.5
    
    const changes: number[] = []
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] > 0) {
        changes.push(Math.abs(values[i] - values[i - 1]) / values[i - 1])
      }
    }
    
    if (changes.length === 0) return 0.5
    const avgChange = this.average(changes)
    return Math.max(0, 1 - avgChange)
  }

  // 重置工作计时
  resetWorkTimer(): void {
    this.workStartTime = Date.now()
    this.activityHistory = []
    this.stateHistory = []
  }

  // 获取工作时长 (毫秒)
  getWorkDuration(): number {
    return Date.now() - this.workStartTime
  }
}

export default StateAnalyzer