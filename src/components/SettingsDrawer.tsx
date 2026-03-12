import { Typography, Switch, InputNumber, Button, Space, Drawer, Card } from 'antd'
import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { AppSettings } from '../types'

const { Text, Paragraph } = Typography

interface SettingsDrawerProps {
  showSettings: boolean
  setShowSettings: (show: boolean) => void
  settings: AppSettings | null
  updateSettings: (key: keyof AppSettings, value: unknown) => Promise<void>
  permissionGranted: boolean | null
}

export default function SettingsDrawer({
  showSettings, setShowSettings, settings, updateSettings, permissionGranted
}: SettingsDrawerProps) {
  return (
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
  )
}
