import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ConfigProvider, theme, Typography, Alert, Steps, Button, Tooltip, Badge
} from 'antd'
import {
  SettingOutlined, SafetyOutlined, DashboardOutlined, BarChartOutlined
} from '@ant-design/icons'
import { CurrentStatus, AppSettings, StatusSnapshot } from './types'

import RealTimePanel from './components/RealTimePanel'
import DataAnalysisPanel from './components/DataAnalysisPanel'
import SettingsDrawer from './components/SettingsDrawer'

const { Title, Text } = Typography

type TabType = '实时状态' | '数据分析'
type TimeRangeType = '今日' | '近7天' | '近30天'

function App() {
  const [status, setStatus] = useState<CurrentStatus | null>(null)
  const [todayStats, setTodayStats] = useState<{
    totalFocusedTime: number
    totalFatiguedTime: number
    totalStuckTime: number
    totalFrustratedTime: number
    totalSlackingTime: number
    averageScore: number
    appUsage?: { name: string; duration: number }[]
  } | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('实时状态')
  const [historyData, setHistoryData] = useState<StatusSnapshot[]>([])
  const [periodChartData, setPeriodChartData] = useState<Array<{ time: string; score: number }>>([])
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRangeType>('今日')

  const fetchStatus = useCallback(async () => {
    try {
      setStatus(await window.electronAPI.getCurrentStatus())
    } catch (e) { console.error(e) }
  }, [])

  const fetchTodayStats = useCallback(async () => {
    try {
      if (timeRange === '今日') {
        const todayData = await window.electronAPI.getTodayStats() as any
        setTodayStats({ ...todayData })
      } else {
        const days = timeRange === '近7天' ? 7 : 30
        const periodData = await window.electronAPI.getPeriodStats(days)
        if (periodData) {
          setTodayStats({
            ...periodData.stats,
            appUsage: periodData.appUsage
          })
          setPeriodChartData(periodData.chartData)
        }
      }
    } catch (e) { console.error(e) }
  }, [timeRange])

  const fetchSettings = useCallback(async () => {
    try {
      setSettings(await window.electronAPI.getSettings())
    } catch (e) { console.error(e) }
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      if (timeRange === '今日') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const start = today.getTime()
        setHistoryData(await window.electronAPI.getHistory(start, start + 86400000))
      }
    } catch (e) { console.error(e) }
  }, [timeRange])

  const fetchPermission = useCallback(async () => {
    try {
      const res = await window.electronAPI.getPermissionStatus()
      setPermissionGranted(res.granted)
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    fetchStatus(); fetchTodayStats(); fetchSettings(); fetchHistory(); fetchPermission()
    const unsubscribe = window.electronAPI.onStatusUpdate((s) => {
      setStatus(s); fetchTodayStats(); fetchHistory(); fetchPermission()
    })
    // 定时检查权限
    const permTimer = setInterval(fetchPermission, 5000)
    return () => { unsubscribe(); clearInterval(permTimer) }
  }, [fetchStatus, fetchTodayStats, fetchSettings, fetchHistory, fetchPermission])

  const updateSettings = async (key: keyof AppSettings, value: unknown) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
    await window.electronAPI.updateSettings({ [key]: value })
  }

  const totalTime = useMemo(() => {
    return todayStats
      ? todayStats.totalFocusedTime + todayStats.totalFatiguedTime +
        todayStats.totalStuckTime + todayStats.totalFrustratedTime +
        todayStats.totalSlackingTime
      : 0
  }, [todayStats])

  const chartData = useMemo(() => {
    if (timeRange === '今日') {
      return historyData.map((item) => {
        const d = new Date(item.timestamp)
        return { time: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`, score: item.score }
      })
    } else {
      return periodChartData
    }
  }, [historyData, periodChartData, timeRange])

  const pieData = useMemo(() => {
    return todayStats ? [
      { name: '专注', value: todayStats.totalFocusedTime },
      { name: '摸鱼', value: todayStats.totalSlackingTime },
      { name: '疲劳', value: todayStats.totalFatiguedTime },
      { name: '卡住', value: todayStats.totalStuckTime },
      { name: '烦躁', value: todayStats.totalFrustratedTime },
    ].filter(d => d.value > 0) : []
  }, [todayStats])



  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#818cf8',
          borderRadius: 12,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
          colorBgContainer: 'rgba(255,255,255,0.03)',
          colorBgElevated: '#131320',
          colorBorderSecondary: 'rgba(255,255,255,0.08)',
        },
        components: {
          Card: { colorBgContainer: 'rgba(255,255,255,0.03)', borderRadius: 16 },
          Drawer: { colorBgElevated: '#0f0f1a' },
        }
      }}
    >
      <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#0f0f1a' }}>
        {/* 左侧侧边栏 */}
        <div style={{ 
          width: 220, 
          borderRight: '1px solid rgba(255,255,255,0.08)', 
          display: 'flex', 
          flexDirection: 'column',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <div style={{ padding: '24px 20px', marginBottom: 8 }}>
            <Title level={4} style={{
              margin: 0,
              background: 'linear-gradient(135deg, #818cf8, #c084fc)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 800
            }}>
              DevMood
            </Title>
            <Text type="secondary" style={{ fontSize: 11, letterSpacing: 2 }}>开发者状态助手</Text>
          </div>

          <div style={{ padding: '0 12px', flex: 1 }}>
            <div 
              style={{
                padding: '10px 16px', 
                borderRadius: 8, 
                cursor: 'pointer',
                background: activeTab === '实时状态' ? 'rgba(129, 140, 248, 0.15)' : 'transparent',
                color: activeTab === '实时状态' ? '#818cf8' : 'rgba(255,255,255,0.65)',
                marginBottom: 8,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}
              onClick={() => setActiveTab('实时状态')}
            >
              <DashboardOutlined style={{ fontSize: 16 }} />
              <span style={{ fontWeight: activeTab === '实时状态' ? 600 : 400 }}>实时状态</span>
            </div>

            <div 
              style={{
                padding: '10px 16px', 
                borderRadius: 8, 
                cursor: 'pointer',
                background: activeTab === '数据分析' ? 'rgba(129, 140, 248, 0.15)' : 'transparent',
                color: activeTab === '数据分析' ? '#818cf8' : 'rgba(255,255,255,0.65)',
                marginBottom: 8,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}
              onClick={() => setActiveTab('数据分析')}
            >
              <BarChartOutlined style={{ fontSize: 16 }} />
              <span style={{ fontWeight: activeTab === '数据分析' ? 600 : 400 }}>数据分析</span>
            </div>
          </div>

          <div style={{ padding: '20px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <Button 
              type="text" 
              block 
              icon={<SettingOutlined />} 
              onClick={() => setShowSettings(true)}
              style={{ 
                textAlign: 'left', 
                color: 'rgba(255,255,255,0.65)', 
                display: 'flex',
                alignItems: 'center',
                padding: '8px 16px',
                height: 40
              }}
            >
              偏好设置
            </Button>
          </div>
        </div>

        {/* 右侧主内容区 */}
        <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
          {/* 权限提示 */}
          {permissionGranted === false && (
            <Alert
              message="需要辅助功能权限"
              description={
                <Steps
                  direction="vertical"
                  size="small"
                  current={0}
                  items={[
                    { title: '打开系统设置', description: '隐私与安全性 → 辅助功能' },
                    { title: '找到 Electron 或 DevMood', description: '勾选开关启用权限' },
                    { title: '权限授予后自动生效', description: '无需重启应用' },
                  ]}
                />
              }
              type="warning"
              showIcon
              icon={<SafetyOutlined />}
              style={{ marginBottom: 24, borderRadius: 12 }}
              closable
            />
          )}

          {activeTab === '实时状态' ? (
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
              <RealTimePanel 
                status={status} 
                todayStats={todayStats} 
                totalTime={totalTime} 
              />
              
              {/* 权限状态 */}
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Tooltip title={permissionGranted ? '全局键鼠监控已激活' : '未获得辅助功能权限，数据可能不准确'}>
                  <Badge
                    status={permissionGranted ? 'success' : 'error'}
                    text={<Text type="secondary" style={{ fontSize: 12 }}>
                      {permissionGranted ? '监控已激活' : '监控未激活'}
                    </Text>}
                  />
                </Tooltip>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
              <DataAnalysisPanel 
                chartData={chartData}
                pieData={pieData}
                historyData={historyData}
                todayStats={todayStats}
                totalTime={totalTime}
                timeRange={timeRange}
                setTimeRange={setTimeRange}
              />
            </div>
          )}
        </div>

        {/* 设置面板 */}
        <SettingsDrawer 
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          settings={settings}
          updateSettings={updateSettings}
          permissionGranted={permissionGranted}
        />
      </div>
    </ConfigProvider>
  )
}

export default App