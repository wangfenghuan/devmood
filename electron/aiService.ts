import { AppSettings } from './types'

export class AIService {
  private async fetchLLMResponse(
    settings: AppSettings, 
    prompt: string
  ): Promise<string> {
    const { aiBaseUrl, aiApiKey, aiModel } = settings

    try {
      const response = await fetch(`${aiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiApiKey}`
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 50
        }),
        // 配置 5 秒超时时间防止阻断本地进程
        signal: AbortSignal.timeout(5000)
      })

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status}`)
      }

      const data = await response.json()
      return data.choices?.[0]?.message?.content?.trim() || ''
    } catch (err) {
      console.error('AI大模型请求失败:', err)
      return ''
    }
  }

  public async generateNotification(
    settings: AppSettings,
    state: string,
    activeWindow: string,
    durationMinutes: number
  ): Promise<string> {
    if (!settings.aiEnabled || !settings.aiApiKey || !settings.aiBaseUrl) {
      return ''
    }

    const promptText = settings.aiPromptTemplate
      .replace('{state}', state)
      .replace('{activeWindow}', activeWindow || '未知应用')
      .replace('{duration}', durationMinutes.toString())

    return await this.fetchLLMResponse(settings, promptText)
  }
}
