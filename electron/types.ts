// 开发者状态类型
export type DeveloperState = 'focused' | 'fatigued' | 'stuck' | 'frustrated' | 'normal'

// 活动数据类型
export interface ActivityData {
  typingSpeed: number          // 每分钟击键数
  mouseSpeed: number           // 鼠标移动速度 (像素/秒)
  clickFrequency: number       // 每分钟点击数
  scrollFrequency: number      // 每分钟滚动次数
  idleTime: number            // 空闲时间 (毫秒)
  totalKeystrokes: number     // 总击键数
  totalMouseClicks: number    // 总点击数
  totalMouseMoves: number     // 总移动次数
  activeWindow: string        // 当前活动窗口
  timestamp: number           // 时间戳
}

// 状态分析结果
export interface StateAnalysis {
  state: DeveloperState
  score: number               // 效率分数 0-100
  confidence: number          // 置信度 0-1
  fatigueDuration: number     // 疲劳持续时间
  stuckDuration: number       // 卡住持续时间
  frustrationLevel: number    // 烦躁程度 0-1
  continuousWorkTime: number  // 连续工作时间
  indicators: string[]        // 状态指标说明
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
  fatigueThreshold: number      // 疲劳检测阈值
  stuckThreshold: number        // 卡住检测阈值
  frustrationThreshold: number  // 烦躁检测阈值
  breakReminderInterval: number // 休息提醒间隔 (分钟)
  workingHoursStart: number     // 工作时间开始 (小时)
  workingHoursEnd: number       // 工作时间结束 (小时)
}

// IPC 通道类型
export interface IpcChannels {
  'get-current-status': () => CurrentStatus
  'get-history': (options: { start: number; end: number }) => StatusSnapshot[]
  'get-settings': () => AppSettings
  'update-settings': (settings: Partial<AppSettings>) => void
  'status-update': (status: CurrentStatus) => void
}

// 状态标签映射
export const STATE_LABELS: Record<DeveloperState, string> = {
  focused: '🎯 专注',
  fatigued: '😴 疲劳',
  stuck: '🤔 卡住',
  frustrated: '😤 烦躁',
  normal: '😐 正常'
}

// 状态颜色映射
export const STATE_COLORS: Record<DeveloperState, string> = {
  focused: '#10B981',
  fatigued: '#6366F1',
  stuck: '#F59E0B',
  frustrated: '#EF4444',
  normal: '#6B7280'
}