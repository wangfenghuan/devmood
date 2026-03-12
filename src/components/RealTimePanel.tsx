import { Card, Typography, Tag, Progress, Row, Col, Statistic, Space } from 'antd'
import {
  ThunderboltOutlined, CoffeeOutlined, QuestionCircleOutlined,
  FrownOutlined, DashboardOutlined, SyncOutlined, SmileOutlined,
  AppstoreOutlined
} from '@ant-design/icons'
import { DeveloperState, CurrentStatus } from '../types'

const { Text } = Typography

// 状态配置
const STATE_CONFIG: Record<DeveloperState, { color: string; icon: React.ReactNode }> = {
  focused: { color: '#10B981', icon: <ThunderboltOutlined /> },
  fatigued: { color: '#818cf8', icon: <CoffeeOutlined /> },
  stuck: { color: '#fbbf24', icon: <QuestionCircleOutlined /> },
  frustrated: { color: '#f87171', icon: <FrownOutlined /> },
  normal: { color: '#94a3b8', icon: <DashboardOutlined /> },
  slacking: { color: '#3b82f6', icon: <SmileOutlined /> }
}

export const STATE_LABELS: Record<DeveloperState, string> = {
  focused: '专注',
  fatigued: '疲劳',
  stuck: '卡住',
  frustrated: '烦躁',
  normal: '一般',
  slacking: '摸鱼'
}

// 格式化时间
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h${mins}m` : `${hours}h`
}

interface RealTimePanelProps {
  status: CurrentStatus | null
  todayStats: {
    totalFocusedTime: number
    totalFatiguedTime: number
    totalStuckTime: number
    totalFrustratedTime: number
    totalSlackingTime: number
    averageScore: number
  } | null
  totalTime: number
}

export default function RealTimePanel({ status, todayStats, totalTime }: RealTimePanelProps) {
  const stateConf = status ? STATE_CONFIG[status.state] : STATE_CONFIG.normal

  return (
    <div>
      {/* 状态卡片 */}
      <Card style={{ marginBottom: 16, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }} styles={{ body: { padding: '28px 20px' } }}>
        <div style={{ fontSize: 56, marginBottom: 12, lineHeight: 1, color: stateConf.color }} className="state-icon">
          {status ? stateConf.icon : <SyncOutlined spin />}
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

        {/* 当前活跃应用 (Active Window) */}
        {status?.stats?.activeWindow && status.stats.activeWindow !== 'Unknown' && (
          <div style={{ marginTop: 8, marginBottom: 16 }}>
            <Tag icon={<AppstoreOutlined />} bordered={false} style={{ background: 'rgba(255,255,255,0.04)', color: '#a1a1aa', borderRadius: 12, padding: '4px 12px' }}>
              {status.stats.activeWindow.split(' - ')[0]}
            </Tag>
          </div>
        )}

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
            { label: '专注', icon: <ThunderboltOutlined />, value: todayStats.totalFocusedTime, color: '#10B981', cls: 'focused' },
            { label: '摸鱼', icon: <SmileOutlined />, value: todayStats.totalSlackingTime || 0, color: '#3b82f6', cls: 'slacking' },
            { label: '疲劳', icon: <CoffeeOutlined />, value: todayStats.totalFatiguedTime, color: '#818cf8', cls: 'fatigued' },
            { label: '卡住', icon: <QuestionCircleOutlined />, value: todayStats.totalStuckTime, color: '#fbbf24', cls: 'stuck' },
            { label: '烦躁', icon: <FrownOutlined />, value: todayStats.totalFrustratedTime, color: '#f87171', cls: 'frustrated' },
          ].map((item) => (
            <div key={item.cls} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Text style={{ width: 64, fontSize: 12 }}>
                <span style={{ color: item.color, marginRight: 4 }}>{item.icon}</span>
                {item.label}
              </Text>
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
          <div style={{ textAlign: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Text type="secondary" style={{ fontSize: 13, letterSpacing: 0.5 }}>
              平均效率分: <Text strong style={{ color: '#c084fc', fontSize: 16 }}>{todayStats.averageScore}</Text>
            </Text>
          </div>
        </Card>
      )}
    </div>
  )
}
