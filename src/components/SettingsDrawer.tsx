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

          <div>
            <Text type="secondary" style={{ fontSize: 13 }}>摸鱼检测阈值 (分钟)</Text>
            <InputNumber
              value={settings.slackingThreshold}
              onChange={(v) => updateSettings('slackingThreshold', v || 15)}
              min={1} max={60}
              style={{ width: '100%', marginTop: 8 }}
            />
          </div>

          <div>
            <Text type="secondary" style={{ fontSize: 13 }}>专注里程碑提醒 (分钟)</Text>
            <InputNumber
              value={settings.focusedThreshold}
              onChange={(v) => updateSettings('focusedThreshold', v || 60)}
              min={10} max={180}
              style={{ width: '100%', marginTop: 8 }}
            />
          </div>

          <Card size="small" title={<Text style={{ fontSize: 14 }}>🤖 AI 智能提醒辅助</Text>} style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.1)' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 13 }}>启用大模型生成文案</Text>
                <Switch
                  checked={settings.aiEnabled}
                  onChange={(v) => updateSettings('aiEnabled', v)}
                />
              </div>
              
              {settings.aiEnabled && (
                <>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>API Base URL (OpenAI 兼容)</Text>
                    <input
                      type="text"
                      value={settings.aiBaseUrl}
                      onChange={(e) => updateSettings('aiBaseUrl', e.target.value)}
                      placeholder="https://api.openai.com/v1"
                      style={{ width: '100%', marginTop: 4, padding: '4px 8px', background: 'rgba(0,0,0,0.2)', border: '1px solid #434343', color: '#fff', borderRadius: 4 }}
                    />
                  </div>
                  
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>API Key</Text>
                    <input
                      type="password"
                      value={settings.aiApiKey}
                      onChange={(e) => updateSettings('aiApiKey', e.target.value)}
                      placeholder="sk-..."
                      style={{ width: '100%', marginTop: 4, padding: '4px 8px', background: 'rgba(0,0,0,0.2)', border: '1px solid #434343', color: '#fff', borderRadius: 4 }}
                    />
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Model 模型名称</Text>
                    <input
                      type="text"
                      value={settings.aiModel}
                      onChange={(e) => updateSettings('aiModel', e.target.value)}
                      placeholder="gpt-4o-mini"
                      style={{ width: '100%', marginTop: 4, padding: '4px 8px', background: 'rgba(0,0,0,0.2)', border: '1px solid #434343', color: '#fff', borderRadius: 4 }}
                    />
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>AI 人设 / 提示词词云</Text>
                    <textarea
                      value={settings.aiPromptTemplate}
                      onChange={(e) => updateSettings('aiPromptTemplate', e.target.value)}
                      placeholder="可用变量: {state}, {activeWindow}, {duration}"
                      rows={4}
                      style={{ width: '100%', marginTop: 4, padding: '4px 8px', background: 'rgba(0,0,0,0.2)', border: '1px solid #434343', color: '#fff', borderRadius: 4, resize: 'vertical' }}
                    />
                  </div>
                </>
              )}
            </Space>
          </Card>

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
