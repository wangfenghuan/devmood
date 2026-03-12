import { ActivityData, StateAnalysis, DeveloperState, AppSettings } from './types'
import MLAnalyzer from './mlAnalyzer'

// 状态分析器 - 根据活动数据识别开发者状态
class StateAnalyzer {
  // 历史数据缓存 (用于检测趋势)
  private activityHistory: ActivityData[] = []
  private stateHistory: { state: DeveloperState; timestamp: number }[] = []
  private readonly HISTORY_SIZE = 30

  // 状态平滑
  private currentState: DeveloperState = 'normal'
  private pendingState: DeveloperState | null = null
  private pendingStateCount: number = 0
  private readonly MIN_STATE_PERSISTENCE = 3

  // 分数平滑
  private smoothedScore: number = 60
  private readonly SCORE_SMOOTHING = 0.3

  // ML 分析器
  private mlAnalyzer: MLAnalyzer

  private settings: AppSettings = {
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

  private workStartTime: number = Date.now()

  constructor() {
    this.mlAnalyzer = new MLAnalyzer()
  }

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

    // 提取 ML 特征
    const mlFeatures = this.mlAnalyzer.extractFeatures(data, this.activityHistory)

    // 规则系统识别状态
    const ruleState = this.identifyState(metrics)

    // ML 预测
    const mlPrediction = this.mlAnalyzer.predict(mlFeatures)

    // 混合决策：ML 置信度足够时用 ML，否则用规则
    let rawState: DeveloperState
    if (mlPrediction && this.mlAnalyzer.shouldUseModel(mlPrediction.confidence)) {
      rawState = mlPrediction.state
    } else {
      rawState = ruleState
    }

    // 用规则系统的标签来训练 ML 模型
    this.mlAnalyzer.addSample(mlFeatures, ruleState)

    // 状态平滑：新状态需要连续出现 MIN_STATE_PERSISTENCE 次才切换
    if (rawState !== this.currentState) {
      if (rawState === this.pendingState) {
        this.pendingStateCount++
        if (this.pendingStateCount >= this.MIN_STATE_PERSISTENCE) {
          this.currentState = rawState
          this.pendingState = null
          this.pendingStateCount = 0
        }
      } else {
        this.pendingState = rawState
        this.pendingStateCount = 1
      }
    } else {
      // 当前状态被再次确认，清除待定状态
      this.pendingState = null
      this.pendingStateCount = 0
    }

    const state = this.currentState

    // 计算原始效率分数
    const rawScore = this.calculateScore(state, metrics)

    // 分数平滑 (指数移动平均)
    this.smoothedScore = Math.round(
      this.SCORE_SMOOTHING * rawScore + (1 - this.SCORE_SMOOTHING) * this.smoothedScore
    )
    const score = this.smoothedScore

    // 计算置信度
    const confidence = this.calculateConfidence(metrics)

    // 计算持续时间
    const durations = this.calculateDurations()

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
      fatigueDuration: durations.fatigueDuration,
      stuckDuration: durations.stuckDuration,
      slackingDuration: durations.slackingDuration,
      focusedDuration: durations.focusedDuration,
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
      activeWindow: data.activeWindow,
      currentTypingSpeed: data.typingSpeed,
      currentClickFrequency: data.clickFrequency,
      currentIdleTime: data.idleTime
    }
  }

  // 识别状态
  private identifyState(metrics: ReturnType<typeof this.calculateMetrics>): DeveloperState {
    const {
      avgTypingSpeed, typingTrend, avgClickFrequency, clickTrend,
      idleRatio, activityVariance, typingRhythm, currentIdleTime, activeWindow
    } = metrics

    const windowLower = (activeWindow || '').toLowerCase()
    
    // 应用分类
    const isIDE = windowLower.includes('code') || windowLower.includes('intellij') || 
                  windowLower.includes('webstorm') || windowLower.includes('cursor') || 
                  windowLower.includes('xcode') || windowLower.includes('studio') || windowLower.includes('terminal') || windowLower.includes('iterm')
                  
    const isBrowser = windowLower.includes('chrome') || windowLower.includes('safari') || 
                      windowLower.includes('edge') || windowLower.includes('firefox') || windowLower.includes('arc')
                      
    const isEntertainment = windowLower.includes('bilibili') || windowLower.includes('youtube') || 
                            windowLower.includes('music') || windowLower.includes('netflix') || 
                            windowLower.includes('tencent') || windowLower.includes('weibo') || windowLower.includes('twitter')

    // 0. 特殊状态优先检测：如果在明确的娱乐软件中
    if (isEntertainment) {
       return 'slacking'
    }

    // 1. 检测疲劳状态
    // 特征：打字速度下降、点击频率下降、空闲时间增加、打字节奏变慢
    if (
      (avgTypingSpeed > 0 && avgTypingSpeed < 30 && typingTrend < -0.2 && !isIDE) ||
      (idleRatio > 0.5 && typingTrend < -0.3) ||
      (currentIdleTime > 2 * 60 * 1000) // 空闲超过2分钟
    ) {
      return 'fatigued'
    }

    // 2. 检测摸鱼/浏览状态 (Slacking) 新增！
    // 特征：非IDE环境下，打字极低，只有高点击和滚动（可能在看别人视频，或者摸鱼乱点）
    if (
      isBrowser && avgTypingSpeed < 10 && avgClickFrequency > 5 && activityVariance < 100
    ) {
      // 进一步通过 title 判断是不是在stackoverflow等学习网站
      if (windowLower.includes('stackoverflow') || windowLower.includes('github') || windowLower.includes('docs') || windowLower.includes('gpt')) {
        return 'stuck' // 在查资料
      }
      return 'slacking' // 纯冲浪
    }

    // 3. 检测卡住状态 (Stuck) 
    // 特征：IDE中低输入但非空闲、频繁切换活动、删除/重试模式
    if (
      (isIDE && avgTypingSpeed < 20 && avgTypingSpeed > 0 && idleRatio < 0.3) ||
      (typingTrend < -0.1 && clickTrend > 0.1) || // 打字减少但点击增加
      (activityVariance > 100 && avgTypingSpeed < 50 && isIDE) // IDE中活动不稳定
    ) {
      return 'stuck'
    }

    // 4. 检测烦躁状态
    // 特征：高频率点击，频繁切窗
    if (
      (avgClickFrequency > 40 && clickTrend > 0.3) ||
      (activityVariance > 200 && avgTypingSpeed > 80) || 
      (typingRhythm < 0.3 && avgTypingSpeed > 60)
    ) {
      return 'frustrated'
    }

    // 5. 检测专注状态
    if (
      (avgTypingSpeed > 50 && typingRhythm > 0.5 && idleRatio < 0.2) ||
      (isIDE && avgTypingSpeed > 40 && typingTrend >= -0.1) // 只要在编辑器里并且维持平稳输入就视为专注
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

      case 'slacking':
        // 摸鱼状态：分数极低
        score = 15
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

  // 计算连续状态持续时间
  private calculateDurations(): { fatigueDuration: number; stuckDuration: number; slackingDuration: number; focusedDuration: number } {
    let fatigueDuration = 0
    let stuckDuration = 0
    let slackingDuration = 0
    let focusedDuration = 0

    // 从最近的记录开始回溯，由于是从数组末尾向前遍历，必须用相同的状态累加
    for (let i = this.stateHistory.length - 1; i >= 0; i--) {
      const record = this.stateHistory[i]

      // 每条记录的时间间隔约 10 秒
      if (record.state === 'fatigued') {
        fatigueDuration += 10 * 1000
      } else if (record.state === 'stuck') {
        stuckDuration += 10 * 1000
      } else if (record.state === 'slacking') {
        slackingDuration += 10 * 1000
      } else if (record.state === 'focused') {
        focusedDuration += 10 * 1000
      } else {
        // 如果遇到了不同状态的快照，直接中断累加，因为“连续性”被打破了
        break
      }
    }

    return { fatigueDuration, stuckDuration, slackingDuration, focusedDuration }
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
        
      case 'slacking':
        if (metrics.activeWindow && metrics.activeWindow !== 'Unknown') {
          // 只保留进程名
          indicators.push(`当前应用：${metrics.activeWindow.split(' - ')[0]}`)
        }
        indicators.push('打字极少，似乎在冲浪')
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

  // 关闭时保存模型
  shutdown(): void {
    this.mlAnalyzer.shutdown()
  }

  // 获取 ML 模型状态
  getMLStatus() {
    return this.mlAnalyzer.getStatus()
  }

  // 获取工作时长 (毫秒)
  getWorkDuration(): number {
    return Date.now() - this.workStartTime
  }
}

export default StateAnalyzer