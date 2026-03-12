import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ConfigProvider, theme, Typography, Segmented, Alert, Steps, Button, Tooltip, Badge
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

function App() {
  const [status, setStatus] = useState<CurrentStatus | null>(null)
  const [todayStats, setTodayStats] = useState<{
    totalFocusedTime: number
    totalFatiguedTime: number
    totalStuckTime: number
    totalFrustratedTime: number
    totalSlackingTime: number
    averageScore: number
  } | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('实时状态')
  const [historyData, setHistoryData] = useState<StatusSnapshot[]>([])
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      setStatus(await window.electronAPI.getCurrentStatus())
    } catch (e) { console.error(e) }
  }, [])

  const fetchTodayStats = useCallback(async () => {
    try {
      const todayData = await window.electronAPI.getTodayStats() as any // bypass temporarily if electron boundary not updated
      setTodayStats({ ...todayData })
    } catch (e) { console.error(e) }
  }, [])

  const fetchSettings = useCallback(async () => {
    try {
      setSettings(await window.electronAPI.getSettings())
    } catch (e) { console.error(e) }
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const start = today.getTime()
      setHistoryData(await window.electronAPI.getHistory(start, start + 86400000))
    } catch (e) { console.error(e) }
  }, [])

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
    return historyData.map((item) => {
      const d = new Date(item.timestamp)
      return { time: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`, score: item.score }
    })
  }, [historyData])

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
      <div className="app-container">
        {/* 头部 */}
        <div className="header">
          <Title level={4} style={{
            margin: 0,
            background: 'linear-gradient(135deg, #818cf8, #c084fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            DevMood
          </Title>
          <Text type="secondary" style={{ fontSize: 11, letterSpacing: 2 }}>开发者状态助手</Text>
        </div>

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
            style={{ marginBottom: 16, borderRadius: 12 }}
            closable
          />
        )}

        {/* Tab 切换 */}
        <Segmented
          value={activeTab}
          onChange={(v) => setActiveTab(v as TabType)}
          options={[
            { label: '实时状态', value: '实时状态', icon: <DashboardOutlined /> },
            { label: '数据分析', value: '数据分析', icon: <BarChartOutlined /> },
          ]}
          block
          style={{ marginBottom: 16 }}
        />

        {activeTab === '实时状态' ? (
          <div>
            <RealTimePanel 
              status={status} 
              todayStats={todayStats} 
              totalTime={totalTime} 
            />

            {/* 权限状态 */}
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <Tooltip title={permissionGranted ? '全局键鼠监控已激活' : '未获得辅助功能权限，数据可能不准确'}>
                <Badge
                  status={permissionGranted ? 'success' : 'error'}
                  text={<Text type="secondary" style={{ fontSize: 11 }}>
                    {permissionGranted ? '监控已激活' : '监控未激活'}
                  </Text>}
                />
              </Tooltip>
            </div>
          </div>
        ) : (
          <DataAnalysisPanel 
            chartData={chartData}
            pieData={pieData}
            historyData={historyData}
            todayStats={todayStats}
            totalTime={totalTime}
          />
        )}

        {/* 设置按钮 */}
        <Button
          type="primary"
          shape="circle"
          icon={<SettingOutlined />}
          className="clickable"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 44,
            height: 44,
            zIndex: 50,
          }}
          onClick={() => setShowSettings(true)}
        />

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