import { Card, Typography, Space, Row, Col, Statistic, Segmented, List, Progress } from 'antd'
import {
  LineChartOutlined, PieChartOutlined, AppstoreOutlined, ProfileOutlined
} from '@ant-design/icons'
import { AreaChart, Area, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { formatMinutes } from './RealTimePanel'
import { StatusSnapshot } from '../types'

const { Text } = Typography

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

interface DataAnalysisPanelProps {
  chartData: Array<{ time: string; score: number }>
  pieData: Array<{ name: string; value: number }>
  historyData: StatusSnapshot[]
  todayStats: {
    totalFocusedTime: number
    totalFatiguedTime: number
    totalStuckTime: number
    totalFrustratedTime: number
    totalSlackingTime: number
    averageScore: number
    appUsage?: { name: string; duration: number }[]
  } | null
  totalTime: number
  timeRange: '今日' | '近7天' | '近30天'
  setTimeRange: (range: '今日' | '近7天' | '近30天') => void
}

export default function DataAnalysisPanel({
  chartData, pieData, historyData, todayStats, totalTime, timeRange, setTimeRange
}: DataAnalysisPanelProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text strong style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)' }}>数据分析</Text>
        <Segmented
          value={timeRange}
          onChange={(v) => setTimeRange(v as '今日' | '近7天' | '近30天')}
          options={['今日', '近7天', '近30天']}
          size="small"
        />
      </div>

      {/* 效率趋势 */}
      <Card title={
        <Space size={8}>
          <LineChartOutlined style={{ color: '#818cf8' }} />
          <span>效率分数趋势</span>
        </Space>
      } size="small" style={{ marginBottom: 12 }}>
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

      {/* 饼图 (仅今日可见) */}
      {timeRange === '今日' && (
        <Card title={
          <Space size={8}>
            <PieChartOutlined style={{ color: '#10B981' }} />
            <span>状态分布</span>
          </Space>
        } size="small" style={{ marginBottom: 12 }}>
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
      )}

      {/* 概览 */}
      <Card title={
        <Space size={8}>
          <AppstoreOutlined style={{ color: '#a78bfa' }} />
          <span>今日概览</span>
        </Space>
      } size="small">
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

      {/* 软件使用时间排行榜 */}
      {(todayStats?.appUsage && todayStats.appUsage.length > 0) && (
        <Card title={
          <Space size={8}>
            <ProfileOutlined style={{ color: '#6366f1' }} />
            <span>软件使用排行榜</span>
          </Space>
        } size="small" style={{ marginTop: 12 }}>
          <List
            size="small"
            dataSource={todayStats.appUsage.slice(0, 8)} // 限制最多展示前8名
            renderItem={(item, index) => {
              // 计算进度条百分比，基于第一名
              const maxDuration = todayStats.appUsage![0].duration
              const percent = Math.round((item.duration / maxDuration) * 100)

              return (
                <List.Item style={{ padding: '8px 0', border: 'none' }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                        <Text type="secondary" style={{ marginRight: 8, fontSize: 12 }}>{index + 1}.</Text>
                        {item.name}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{formatMinutes(item.duration)}</Text>
                    </div>
                    <Progress 
                      percent={percent} 
                      showInfo={false} 
                      size="small" 
                      strokeColor="rgba(99, 102, 241, 0.8)" 
                      trailColor="rgba(255,255,255,0.05)"
                      style={{ margin: 0 }}
                    />
                  </div>
                </List.Item>
              )
            }}
          />
        </Card>
      )}
    </div>
  )
}
