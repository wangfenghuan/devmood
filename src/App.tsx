import { useState, useEffect, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { DeveloperState, STATE_LABELS, CurrentStatus, AppSettings, StatusSnapshot } from './types'

// 格式化时间（分钟转为小时:分钟）
function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}分钟`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`
}

// 获取状态表情
function getStateEmoji(state: DeveloperState): string {
  const emojis: Record<DeveloperState, string> = {
    focused: '🎯',
    fatigued: '😴',
    stuck: '🤔',
    frustrated: '😤',
    normal: '😐'
  }
  return emojis[state]
}

// 状态颜色
const STATE_COLORS: Record<string, string> = {
  focused: '#10B981',
  fatigued: '#818cf8',
  stuck: '#fbbf24',
  frustrated: '#f87171',
  normal: '#94a3b8'
}

// 自定义Tooltip
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(15, 15, 26, 0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: '10px 14px',
        backdropFilter: 'blur(10px)',
        fontSize: 12,
      }}>
        <p style={{ color: '#a1a1b5', marginBottom: 4 }}>{label}</p>
        <p style={{ color: '#a78bfa', fontWeight: 700, fontSize: 16 }}>
          {Math.round(payload[0].value)} 分
        </p>
      </div>
    )
  }
  return null
}

type TabType = 'status' | 'chart'

function App() {
  const [status, setStatus] = useState<CurrentStatus | null>(null)
  const [todayStats, setTodayStats] = useState<{
    totalFocusedTime: number
    totalFatiguedTime: number
    totalStuckTime: number
    totalFrustratedTime: number
    averageScore: number
  } | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('status')
  const [historyData, setHistoryData] = useState<StatusSnapshot[]>([])

  // 获取当前状态
  const fetchStatus = useCallback(async () => {
    try {
      const currentStatus = await window.electronAPI.getCurrentStatus()
      setStatus(currentStatus)
    } catch (error) {
      console.error('Failed to get current status:', error)
    }
  }, [])

  // 获取今日统计
  const fetchTodayStats = useCallback(async () => {
    try {
      const stats = await window.electronAPI.getTodayStats()
      setTodayStats(stats)
    } catch (error) {
      console.error('Failed to get today stats:', error)
    }
  }, [])

  // 获取设置
  const fetchSettings = useCallback(async () => {
    try {
      const appSettings = await window.electronAPI.getSettings()
      setSettings(appSettings)
    } catch (error) {
      console.error('Failed to get settings:', error)
    }
  }, [])

  // 获取历史数据
  const fetchHistory = useCallback(async () => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const start = today.getTime()
      const end = start + 24 * 60 * 60 * 1000
      const history = await window.electronAPI.getHistory(start, end)
      setHistoryData(history)
    } catch (error) {
      console.error('Failed to get history:', error)
    }
  }, [])

  // 初始化
  useEffect(() => {
    fetchStatus()
    fetchTodayStats()
    fetchSettings()
    fetchHistory()

    // 监听状态更新
    const unsubscribe = window.electronAPI.onStatusUpdate((newStatus) => {
      setStatus(newStatus)
      fetchTodayStats()
      fetchHistory()
    })

    return () => {
      unsubscribe()
    }
  }, [fetchStatus, fetchTodayStats, fetchSettings, fetchHistory])

  // 更新设置
  const updateSettings = async (key: keyof AppSettings, value: unknown) => {
    if (!settings) return
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    await window.electronAPI.updateSettings({ [key]: value })
  }

  // 计算今日总时间
  const totalTime = todayStats
    ? todayStats.totalFocusedTime + todayStats.totalFatiguedTime +
    todayStats.totalStuckTime + todayStats.totalFrustratedTime
    : 0

  // 图表数据：效率分数趋势
  const chartData = historyData.map((item) => {
    const date = new Date(item.timestamp)
    return {
      time: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
      score: item.score,
      typingSpeed: item.typingSpeed,
    }
  })

  // 饼图数据：状态分布
  const pieData = todayStats ? [
    { name: '专注', value: todayStats.totalFocusedTime, color: STATE_COLORS.focused },
    { name: '疲劳', value: todayStats.totalFatiguedTime, color: STATE_COLORS.fatigued },
    { name: '卡住', value: todayStats.totalStuckTime, color: STATE_COLORS.stuck },
    { name: '烦躁', value: todayStats.totalFrustratedTime, color: STATE_COLORS.frustrated },
  ].filter(d => d.value > 0) : []

  // 状态分布统计
  const stateDistribution: Record<string, number> = {}
  historyData.forEach(item => {
    stateDistribution[item.state] = (stateDistribution[item.state] || 0) + 1
  })

  return (
    <div className="app-container">
      {/* 头部 */}
      <div className="header">
        <h1>DevMood</h1>
        <p>开发者状态助手</p>
      </div>

      {/* Tab 切换 */}
      <div className="tab-bar clickable">
        <button
          className={`tab-btn clickable ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => setActiveTab('status')}
        >
          实时状态
        </button>
        <button
          className={`tab-btn clickable ${activeTab === 'chart' ? 'active' : ''}`}
          onClick={() => setActiveTab('chart')}
        >
          数据分析
        </button>
      </div>

      {/* Tab 内容 */}
      {activeTab === 'status' ? (
        /* ==================== 实时状态面板 ==================== */
        <div className="fade-in">
          {/* 状态卡片 */}
          <div className="status-card">
            <div className="state-display">
              <div className="state-emoji">{status ? getStateEmoji(status.state) : '🔄'}</div>
              <div className={`state-label ${status?.state || ''}`}>
                {status ? STATE_LABELS[status.state] : '加载中...'}
              </div>
            </div>

            {/* 效率分数 */}
            <div className="score-section">
              <div className="score-value">{status?.score || 0}</div>
              <div className="score-label">效率分数</div>
            </div>

            {/* 指标 */}
            {status?.analysis?.indicators && status.analysis.indicators.length > 0 && (
              <ul className="indicators">
                {status.analysis.indicators.map((indicator, index) => (
                  <li key={index}>{indicator}</li>
                ))}
              </ul>
            )}
          </div>

          {/* 实时统计 */}
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">{status?.stats.typingSpeed || 0}</div>
              <div className="stat-label">击键/分钟</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{status?.stats.clickFrequency || 0}</div>
              <div className="stat-label">点击/分钟</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{Math.round((status?.stats.mouseSpeed || 0) / 1000)}</div>
              <div className="stat-label">鼠标速度</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">
                {status?.stats.idleTime
                  ? Math.round(status.stats.idleTime / 1000)
                  : 0}s
              </div>
              <div className="stat-label">空闲时间</div>
            </div>
          </div>

          {/* 今日统计 */}
          {todayStats && totalTime > 0 && (
            <div className="today-stats fade-in">
              <h3>今日状态分布</h3>
              <div className="time-bars">
                <div className="time-bar-item">
                  <span className="time-bar-label">🎯 专注</span>
                  <div className="time-bar-container">
                    <div
                      className="time-bar-fill focused"
                      style={{ width: `${(todayStats.totalFocusedTime / totalTime) * 100}%` }}
                    />
                  </div>
                  <span className="time-bar-value">{formatMinutes(todayStats.totalFocusedTime)}</span>
                </div>
                <div className="time-bar-item">
                  <span className="time-bar-label">😴 疲劳</span>
                  <div className="time-bar-container">
                    <div
                      className="time-bar-fill fatigued"
                      style={{ width: `${(todayStats.totalFatiguedTime / totalTime) * 100}%` }}
                    />
                  </div>
                  <span className="time-bar-value">{formatMinutes(todayStats.totalFatiguedTime)}</span>
                </div>
                <div className="time-bar-item">
                  <span className="time-bar-label">🤔 卡住</span>
                  <div className="time-bar-container">
                    <div
                      className="time-bar-fill stuck"
                      style={{ width: `${(todayStats.totalStuckTime / totalTime) * 100}%` }}
                    />
                  </div>
                  <span className="time-bar-value">{formatMinutes(todayStats.totalStuckTime)}</span>
                </div>
                <div className="time-bar-item">
                  <span className="time-bar-label">😤 烦躁</span>
                  <div className="time-bar-container">
                    <div
                      className="time-bar-fill frustrated"
                      style={{ width: `${(todayStats.totalFrustratedTime / totalTime) * 100}%` }}
                    />
                  </div>
                  <span className="time-bar-value">{formatMinutes(todayStats.totalFrustratedTime)}</span>
                </div>
              </div>
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <span style={{ color: '#6b6b80', fontSize: 12 }}>
                  平均分数: <span style={{ color: '#a78bfa', fontWeight: 600 }}>{todayStats.averageScore}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ==================== 数据分析面板 ==================== */
        <div className="fade-in">
          {/* 效率分数趋势图 */}
          <div className="chart-card">
            <h3 className="chart-title">📈 效率分数趋势</h3>
            {chartData.length > 0 ? (
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="time"
                      stroke="#3f3f5c"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke="#3f3f5c"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 100]}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#818cf8"
                      strokeWidth={2}
                      fill="url(#scoreGradient)"
                      dot={false}
                      activeDot={{ r: 4, fill: '#a78bfa', stroke: '#0f0f1a', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="chart-empty">
                <p>暂无数据，开始工作后将显示效率趋势</p>
              </div>
            )}
          </div>

          {/* 状态分布饼图 */}
          <div className="chart-card">
            <h3 className="chart-title">🎯 今日状态分布</h3>
            {pieData.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="pie-legend">
                  {pieData.map((entry, index) => (
                    <div key={index} className="pie-legend-item">
                      <span className="pie-legend-dot" style={{ background: entry.color }} />
                      <span className="pie-legend-name">{entry.name}</span>
                      <span className="pie-legend-value">{formatMinutes(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="chart-empty">
                <p>暂无数据</p>
              </div>
            )}
          </div>

          {/* 快速统计 */}
          <div className="chart-card">
            <h3 className="chart-title">📊 今日概览</h3>
            <div className="overview-grid">
              <div className="overview-item">
                <div className="overview-value" style={{ color: '#818cf8' }}>
                  {historyData.length}
                </div>
                <div className="overview-label">记录数</div>
              </div>
              <div className="overview-item">
                <div className="overview-value" style={{ color: '#10B981' }}>
                  {todayStats?.averageScore || 0}
                </div>
                <div className="overview-label">平均分</div>
              </div>
              <div className="overview-item">
                <div className="overview-value" style={{ color: '#fbbf24' }}>
                  {totalTime > 0 ? formatMinutes(totalTime) : '0分钟'}
                </div>
                <div className="overview-label">总计时长</div>
              </div>
              <div className="overview-item">
                <div className="overview-value" style={{ color: '#10B981' }}>
                  {totalTime > 0 ? `${Math.round((todayStats!.totalFocusedTime / totalTime) * 100)}%` : '0%'}
                </div>
                <div className="overview-label">专注率</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 设置按钮 */}
      <button className="settings-btn clickable" onClick={() => setShowSettings(true)}>
        ⚙️
      </button>

      {/* 设置面板 */}
      <div className={`settings-panel ${showSettings ? 'open' : ''}`}>
        <div className="settings-header">
          <h2>设置</h2>
          <button className="close-btn clickable" onClick={() => setShowSettings(false)}>
            ×
          </button>
        </div>

        {settings && (
          <div className="settings-content">
            <div className="setting-item">
              <label>通知提醒</label>
              <div
                className={`toggle-switch clickable ${settings.notificationsEnabled ? 'active' : ''}`}
                onClick={() => updateSettings('notificationsEnabled', !settings.notificationsEnabled)}
              />
            </div>

            <div className="setting-item">
              <label>休息提醒间隔 (分钟)</label>
              <input
                type="number"
                className="setting-input clickable"
                value={settings.breakReminderInterval}
                onChange={(e) => updateSettings('breakReminderInterval', parseInt(e.target.value) || 60)}
                min={15}
                max={180}
              />
            </div>

            <div className="setting-item">
              <label>疲劳检测阈值 (分钟)</label>
              <input
                type="number"
                className="setting-input clickable"
                value={settings.fatigueThreshold}
                onChange={(e) => updateSettings('fatigueThreshold', parseInt(e.target.value) || 30)}
                min={10}
                max={60}
              />
            </div>

            <div className="setting-item">
              <label>卡住检测阈值 (分钟)</label>
              <input
                type="number"
                className="setting-input clickable"
                value={settings.stuckThreshold}
                onChange={(e) => updateSettings('stuckThreshold', parseInt(e.target.value) || 15)}
                min={5}
                max={30}
              />
            </div>

            <div className="setting-item" style={{ marginTop: 32 }}>
              <button
                className="clickable"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none',
                  borderRadius: 8,
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                onClick={async () => {
                  await window.electronAPI.resetWorkTimer()
                  setShowSettings(false)
                }}
              >
                重置工作计时
              </button>
            </div>

            <div style={{ marginTop: 24, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
              <p style={{ fontSize: 12, color: '#6b6b80', lineHeight: 1.6 }}>
                DevMood 通过分析您的键盘和鼠标行为，智能识别您的工作状态。所有数据均在本地处理，保护您的隐私。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App