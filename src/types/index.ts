// 开发者状态类型
export type DeveloperState = 'focused' | 'fatigued' | 'stuck' | 'frustrated' | 'normal' | 'slacking'

// 活动数据类型
export interface ActivityData {
  typingSpeed: number
  mouseSpeed: number
  clickFrequency: number
  scrollFrequency: number
  idleTime: number
  totalKeystrokes: number
  totalMouseClicks: number
  totalMouseMoves: number
  activeWindow: string
  timestamp: number
}

// 状态分析结果
export interface StateAnalysis {
  state: DeveloperState
  score: number
  confidence: number
  fatigueDuration: number
  stuckDuration: number
  frustrationLevel: number
  continuousWorkTime: number
  indicators: string[]
}

// 当前状态
export interface CurrentStatus {
  state: DeveloperState
  score: number
  lastUpdate: number
  stats: ActivityData
  analysis?: StateAnalysis
}

// 历史记录
export interface StatusSnapshot {
  id?: number
  timestamp: number
  state: DeveloperState
  score: number
  typingSpeed: number
  mouseSpeed: number
  clickFrequency: number
  idleTime: number
}

// 设置
export interface AppSettings {
  notificationsEnabled: boolean
  fatigueThreshold: number
  stuckThreshold: number
  frustrationThreshold: number
  breakReminderInterval: number
  workingHoursStart: number
  workingHoursEnd: number
}

// 状态标签映射
export const STATE_LABELS: Record<DeveloperState, string> = {
  focused: '🎯 专注',
  fatigued: '😴 疲劳',
  stuck: '🤔 卡住',
  frustrated: '😤 烦躁',
  normal: '😐 正常',
  slacking: '☕ 摸鱼'
}

// 状态颜色映射
export const STATE_COLORS: Record<DeveloperState, string> = {
  focused: '#10B981',
  fatigued: '#6366F1',
  stuck: '#F59E0B',
  frustrated: '#EF4444',
  normal: '#6B7280',
  slacking: '#3B82F6'
}