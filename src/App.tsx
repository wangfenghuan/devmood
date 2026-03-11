import { useState, useEffect, useCallback } from 'react'
import {
  ConfigProvider, theme, Card, Typography, Tag, Progress,
  Segmented, Statistic, Row, Col, Alert, Steps, Switch,
  InputNumber, Button, Space, Drawer, Tooltip, Badge
} from 'antd'
import {
  SettingOutlined, SafetyOutlined, ThunderboltOutlined,
  CoffeeOutlined, QuestionCircleOutlined, FrownOutlined,
  DashboardOutlined, BarChartOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import { AreaChart, Area, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { DeveloperState, STATE_LABELS, CurrentStatus, AppSettings, StatusSnapshot } from './types'

const { Title, Text, Paragraph } = Typography

// 格式化时间
function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h${mins}m` : `${hours}h`
}

// 状态配置
const STATE_CONFIG: Record<DeveloperState, { emoji: string; color: string; icon: React.ReactNode }> = {
  focused: { emoji: '🎯', color: '#10B981', icon: <ThunderboltOutlined /> },
  fatigued: { emoji: '😴', color: '#818cf8', icon: <CoffeeOutlined /> },
  stuck: { emoji: '🤔', color: '#fbbf24', icon: <QuestionCircleOutlined /> },
  frustrated: { emoji: '😤', color: '#f87171', icon: <FrownOutlined /> },
  normal: { emoji: '😐', color: '#94a3b8', icon: <DashboardOutlined /> }
}

const PIE_COLORS = ['#10B981', '#818cf8', '#fbbf24', '#f87171']

// 自定义Tooltip
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(15, 15, 26, 0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 12,
      }}>
        <Text type="secondary">{label}</Text>
        <div><Text strong style={{ color: '#a78bfa', fontSize: 16 }}>{Math.round(payload[0].value)} 分</Text></div>
      </div>
    )
  }
  return null
}

type TabType = '实时状态' | '数据分析'

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
      setTodayStats(await window.electronAPI.getTodayStats())
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

  const totalTime = todayStats
    ? todayStats.totalFocusedTime + todayStats.totalFatiguedTime +
    todayStats.totalStuckTime + todayStats.totalFrustratedTime
    : 0

  const chartData = historyData.map((item) => {
    const d = new Date(item.timestamp)
    return { time: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`, score: item.score }
  })

  const pieData = todayStats ? [
    { name: '专注', value: todayStats.totalFocusedTime },
    { name: '疲劳', value: todayStats.totalFatiguedTime },
    { name: '卡住', value: todayStats.totalStuckTime },
    { name: '烦躁', value: todayStats.totalFrustratedTime },
  ].filter(d => d.value > 0) : []

  const stateConf = status ? STATE_CONFIG[status.state] : STATE_CONFIG.normal

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#6366f1',
          borderRadius: 12,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
          colorBgContainer: 'rgba(255,255,255,0.04)',
          colorBgElevated: '#1a1a2e',
        },
        components: {
          Card: { colorBgContainer: 'rgba(255,255,255,0.04)' },
          Drawer: { colorBgElevated: '#12122a' },
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
            {/* 状态卡片 */}
            <Card style={{ marginBottom: 12, textAlign: 'center' }} styles={{ body: { padding: '24px 16px' } }}>
              <div style={{ fontSize: 52, marginBottom: 8, lineHeight: 1 }} className="state-emoji">
                {status ? stateConf.emoji : '🔄'}
              </div>
              <Tag
                color={stateConf.color}
                style={{ fontSize: 16, padding: '4px 16px', fontWeight: 700, border: 'none' }}
              >
                {status ? STATE_LABELS[status.state] : '加载中...'}
              </Tag>

              <div style={{ margin: '20px 0' }}>
                <Progress
                  type="dashboard"
                  percent={status?.score || 0}
                  strokeColor={{
                    '0%': '#6366f1',
                    '100%': '#a78bfa',
                  }}
                  format={(p) => (
                    <div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: '#e4e4e7' }}>{p}</div>
                      <div style={{ fontSize: 10, color: '#6b6b80', textTransform: 'uppercase', letterSpacing: 1 }}>效率分数</div>
                    </div>
                  )}
                  size={140}
                />
              </div>

              {/* 指标 */}
              {status?.analysis?.indicators && status.analysis.indicators.length > 0 && (
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  {status.analysis.indicators.map((ind, i) => (
                    <Text key={i} type="secondary" style={{ fontSize: 13 }}>• {ind}</Text>
                  ))}
                </Space>
              )}
            </Card>

            {/* 实时统计 */}
            <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
              <Col span={12}>
                <Card size="small" styles={{ body: { padding: '12px 8px', textAlign: 'center' } }}>
                  <Statistic
                    title={<Text type="secondary" style={{ fontSize: 10 }}>击键/分钟</Text>}
                    value={status?.stats.typingSpeed || 0}
                    valueStyle={{ fontSize: 22, fontWeight: 700 }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" styles={{ body: { padding: '12px 8px', textAlign: 'center' } }}>
                  <Statistic
                    title={<Text type="secondary" style={{ fontSize: 10 }}>点击/分钟</Text>}
                    value={status?.stats.clickFrequency || 0}
                    valueStyle={{ fontSize: 22, fontWeight: 700 }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" styles={{ body: { padding: '12px 8px', textAlign: 'center' } }}>
                  <Statistic
                    title={<Text type="secondary" style={{ fontSize: 10 }}>鼠标速度</Text>}
                    value={Math.round((status?.stats.mouseSpeed || 0) / 1000)}
                    valueStyle={{ fontSize: 22, fontWeight: 700 }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" styles={{ body: { padding: '12px 8px', textAlign: 'center' } }}>
                  <Statistic
                    title={<Text type="secondary" style={{ fontSize: 10 }}>空闲时间</Text>}
                    value={status?.stats.idleTime ? Math.round(status.stats.idleTime / 1000) : 0}
                    suffix="s"
                    valueStyle={{ fontSize: 22, fontWeight: 700 }}
                  />
                </Card>
              </Col>
            </Row>

            {/* 今日状态分布 */}
            {todayStats && totalTime > 0 && (
              <Card title={<Text type="secondary" style={{ fontSize: 12, letterSpacing: 1 }}>今日状态分布</Text>} size="small" style={{ marginBottom: 12 }}>
                {[
                  { label: '🎯 专注', value: todayStats.totalFocusedTime, color: '#10B981', cls: 'focused' },
                  { label: '😴 疲劳', value: todayStats.totalFatiguedTime, color: '#818cf8', cls: 'fatigued' },
                  { label: '🤔 卡住', value: todayStats.totalStuckTime, color: '#fbbf24', cls: 'stuck' },
                  { label: '😤 烦躁', value: todayStats.totalFrustratedTime, color: '#f87171', cls: 'frustrated' },
                ].map((item) => (
                  <div key={item.cls} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Text style={{ width: 64, fontSize: 12 }}>{item.label}</Text>
                    <Progress
                      percent={Math.round((item.value / totalTime) * 100)}
                      strokeColor={item.color}
                      showInfo={false}
                      size="small"
                      style={{ flex: 1 }}
                    />
                    <Text type="secondary" style={{ width: 48, textAlign: 'right', fontSize: 11 }}>
                      {formatMinutes(item.value)}
                    </Text>
                  </div>
                ))}
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    平均分数: <Text strong style={{ color: '#a78bfa' }}>{todayStats.averageScore}</Text>
                  </Text>
                </div>
              </Card>
            )}

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
          /* 数据分析面板 */
          <div>
            {/* 效率趋势 */}
            <Card title="📈 效率分数趋势" size="small" style={{ marginBottom: 12 }}>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#3f3f5c" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis stroke="#3f3f5c" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <ReTooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="score" stroke="#818cf8" strokeWidth={2} fill="url(#scoreGrad)" dot={false} activeDot={{ r: 4, fill: '#a78bfa' }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <Text type="secondary">暂无数据</Text>
                </div>
              )}
            </Card>

            {/* 饼图 */}
            <Card title="🎯 状态分布" size="small" style={{ marginBottom: 12 }}>
              {pieData.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <ResponsiveContainer width="50%" height={140}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value" strokeWidth={0}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <Space direction="vertical" size={6}>
                    {pieData.map((entry, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <Text style={{ fontSize: 12 }}>{entry.name}</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>{formatMinutes(entry.value)}</Text>
                      </div>
                    ))}
                  </Space>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <Text type="secondary">暂无数据</Text>
                </div>
              )}
            </Card>

            {/* 概览 */}
            <Card title="📊 今日概览" size="small">
              <Row gutter={[8, 8]}>
                {[
                  { label: '记录数', value: historyData.length, color: '#818cf8' },
                  { label: '平均分', value: todayStats?.averageScore || 0, color: '#10B981' },
                  { label: '总时长', value: totalTime > 0 ? formatMinutes(totalTime) : '0m', color: '#fbbf24', isStr: true },
                  { label: '专注率', value: totalTime > 0 ? `${Math.round((todayStats!.totalFocusedTime / totalTime) * 100)}%` : '0%', color: '#10B981', isStr: true },
                ].map((item, i) => (
                  <Col span={12} key={i}>
                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                      {item.isStr ? (
                        <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{item.value}</div>
                      ) : (
                        <Statistic value={item.value as number} valueStyle={{ fontSize: 18, fontWeight: 700, color: item.color }} />
                      )}
                      <Text type="secondary" style={{ fontSize: 10 }}>{item.label}</Text>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          </div>
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
        <Drawer
          title="设置"
          placement="right"
          width={320}
          onClose={() => setShowSettings(false)}
          open={showSettings}
          className="clickable"
        >
          {settings && (
            <Space direction="vertical" size={20} style={{ width: '100%' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 13 }}>通知提醒</Text>
                <div style={{ marginTop: 8 }}>
                  <Switch
                    checked={settings.notificationsEnabled}
                    onChange={(v) => updateSettings('notificationsEnabled', v)}
                  />
                </div>
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: 13 }}>休息提醒间隔 (分钟)</Text>
                <InputNumber
                  value={settings.breakReminderInterval}
                  onChange={(v) => updateSettings('breakReminderInterval', v || 60)}
                  min={15} max={180}
                  style={{ width: '100%', marginTop: 8 }}
                />
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: 13 }}>疲劳检测阈值 (分钟)</Text>
                <InputNumber
                  value={settings.fatigueThreshold}
                  onChange={(v) => updateSettings('fatigueThreshold', v || 30)}
                  min={10} max={60}
                  style={{ width: '100%', marginTop: 8 }}
                />
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: 13 }}>卡住检测阈值 (分钟)</Text>
                <InputNumber
                  value={settings.stuckThreshold}
                  onChange={(v) => updateSettings('stuckThreshold', v || 15)}
                  min={5} max={30}
                  style={{ width: '100%', marginTop: 8 }}
                />
              </div>

              <Button
                type="primary"
                block
                onClick={async () => {
                  await window.electronAPI.resetWorkTimer()
                  setShowSettings(false)
                }}
              >
                重置工作计时
              </Button>

              {/* 权限状态 */}
              <Card size="small" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <Space>
                  {permissionGranted
                    ? <CheckCircleOutlined style={{ color: '#10B981' }} />
                    : <ExclamationCircleOutlined style={{ color: '#f87171' }} />
                  }
                  <Text style={{ fontSize: 13 }}>
                    {permissionGranted ? '输入监控已激活' : '输入监控未激活'}
                  </Text>
                </Space>
              </Card>

              <Paragraph type="secondary" style={{ fontSize: 12, lineHeight: 1.6 }}>
                DevMood 通过分析您的键盘和鼠标行为，智能识别工作状态。所有数据均在本地处理，保护隐私。
              </Paragraph>
            </Space>
          )}
        </Drawer>
      </div>
    </ConfigProvider>
  )
}

export default App