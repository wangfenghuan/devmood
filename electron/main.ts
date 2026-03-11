import { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage, powerMonitor, systemPreferences, dialog, shell } from 'electron'
import path from 'path'
import { uIOhook } from 'uiohook-napi'
import ActivityMonitor from './activityMonitor'
import StateAnalyzer from './stateAnalyzer'
import AppDatabase from './database'
import { CurrentStatus, StatusSnapshot, AppSettings, STATE_LABELS } from './types'

// 使用全局变量跟踪退出状态
let isQuitting = false
let inputMonitorStarted = false

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let activityMonitor: ActivityMonitor | null = null
let stateAnalyzer: StateAnalyzer | null = null
let database: AppDatabase | null = null

// 当前状态
let currentStatus: CurrentStatus = {
  state: 'normal',
  score: 100,
  lastUpdate: Date.now(),
  stats: {
    typingSpeed: 0,
    mouseSpeed: 0,
    clickFrequency: 0,
    scrollFrequency: 0,
    idleTime: 0,
    totalKeystrokes: 0,
    totalMouseClicks: 0,
    totalMouseMoves: 0,
    activeWindow: 'Unknown',
    timestamp: Date.now()
  }
}

// 上次通知时间 (防止重复通知)
let lastNotificationTime: Record<string, number> = {}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 680,
    minWidth: 380,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    show: false,
    backgroundColor: '#1a1a2e'
  })

  // 开发环境加载 vite 开发服务器
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })
}

function createTray(): void {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAErSURBVDiNpZMxSwNBEIW/TbyQxIA0sVHwAC0sTOzJBNvGxkLwBjqJgv4F/gFfYmHhY2/gAE1sTKx8ATewsLEw8Ao2LgYWdhY2/gGxsQUXwSYWdjYWFrYHBms7MrO7sJAOByTzExmhnNzO/+b+7MwGmDVAQ2hHcDwFFABnBlwCVgEdoR3AcASYAm4DHakBdgE/AQu9IOZDm4D9gNPoB3BZ4Z9gGfAhcB8oMcD9GwFXgKPAX+AT8DFQP0j7ALgC9IcYuAOfAJ+BFuB6jP0nM/cCy4CR4L4HLgMNgQVgYJi5BrgODANXgT3g+RC4BMz0ALsAXOh9FNgAnuwGWAUmpu8C6wXwDjAIGJguI/C62gP8CiYmUJuAN8BrYFVg/RGAaeB8M/AFuAI8SwCXmT1gOfBKKHsAtoC7wFZgL5D9gREI3IeAd8BGYFZi+RIwC9wE9gPfArUlcBL4BjyE5iPwHXhP0v8B/C04l4tMPY4AAAAASUVORK5CYII='
  )

  tray = new Tray(icon)
  updateTrayMenu()

  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

function updateTrayMenu(): void {
  if (!tray) return

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主界面',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      }
    },
    { type: 'separator' },
    {
      label: `当前状态: ${STATE_LABELS[currentStatus.state]}`,
      enabled: false
    },
    {
      label: `效率分数: ${currentStatus.score}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.setToolTip(`DevMood - ${STATE_LABELS[currentStatus.state]}`)
}

// 注册 uiohook 事件监听器并启动钩子
function registerAndStartHook(): boolean {
  if (!activityMonitor || inputMonitorStarted) return inputMonitorStarted

  let keyCount = 0
  let clickCount = 0
  let moveCount = 0

  uIOhook.on('keydown', () => {
    keyCount++
    if (keyCount <= 5 || keyCount % 50 === 0) {
      console.log(`[uiohook] keydown event #${keyCount}`)
    }
    activityMonitor?.recordKeystroke()
  })

  uIOhook.on('click', () => {
    clickCount++
    console.log(`[uiohook] click event #${clickCount}`)
    activityMonitor?.recordMouseClick()
  })

  uIOhook.on('mousemove', (e) => {
    moveCount++
    if (moveCount <= 3 || moveCount % 200 === 0) {
      console.log(`[uiohook] mousemove event #${moveCount} (${e.x}, ${e.y})`)
    }
    activityMonitor?.recordMouseMove(e.x, e.y)
  })

  uIOhook.on('wheel', () => {
    console.log('[uiohook] wheel event')
    activityMonitor?.recordMouseScroll()
  })

  try {
    console.log('[uiohook] Starting global input hook...')
    uIOhook.start()
    inputMonitorStarted = true
    console.log('[uiohook] Global input monitor started successfully!')
    return true
  } catch (err) {
    console.error('[uiohook] Failed to start global input monitor:', err)
    return false
  }
}

// 启动全局键鼠监控 (基于 uiohook-napi)
function startGlobalInputMonitor(): void {
  if (!activityMonitor) return

  // macOS 需要辅助功能权限
  if (process.platform === 'darwin') {
    const isTrusted = systemPreferences.isTrustedAccessibilityClient(false)
    console.log('[uiohook] Accessibility permission:', isTrusted)
    if (isTrusted) {
      registerAndStartHook()
      return
    }

    // 没有权限，弹出引导对话框
    dialog.showMessageBox(mainWindow!, {
      type: 'warning',
      title: 'DevMood 需要辅助功能权限',
      message: 'DevMood 需要「辅助功能」权限来监控键盘和鼠标活动，以分析您的工作状态。',
      detail: '点击「打开系统设置」后，请在列表中找到 DevMood（或 Electron）并勾选开关。\n\n授权后 DevMood 会自动开始监控，无需重启。',
      buttons: ['打开系统设置', '稍后再说'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        // 打开系统偏好设置 → 辅助功能页面
        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility')

        // 轮询等待权限授予，每 2 秒检查一次
        const permCheckTimer = setInterval(() => {
          if (isQuitting) {
            clearInterval(permCheckTimer)
            return
          }

          const granted = systemPreferences.isTrustedAccessibilityClient(false)
          if (granted) {
            clearInterval(permCheckTimer)
            console.log('Accessibility permission granted!')
            registerAndStartHook()
          }
        }, 2000)
      }
    })
    return
  }

  // 非 macOS 平台直接启动
  registerAndStartHook()
}

function initializeComponents(): void {
  // 初始化数据库
  database = new AppDatabase()

  // 清理旧数据
  database.cleanupOldData()

  // 初始化状态分析器
  stateAnalyzer = new StateAnalyzer()
  stateAnalyzer.updateSettings(database.getSettings())

  // 初始化活动监控器
  activityMonitor = new ActivityMonitor()

  // 监听活动数据更新
  activityMonitor.on('activity', (data) => {
    if (!stateAnalyzer || !database) return

    // 分析状态
    const analysis = stateAnalyzer.analyze(data)

    currentStatus = {
      state: analysis.state,
      score: analysis.score,
      lastUpdate: Date.now(),
      stats: data,
      analysis
    }

    // 更新托盘菜单
    updateTrayMenu()

    // 发送状态到渲染进程
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('status-update', currentStatus)
    }

    // 保存到数据库 (每分钟保存一次)
    const snapshot: StatusSnapshot = {
      timestamp: Date.now(),
      state: analysis.state,
      score: analysis.score,
      typingSpeed: data.typingSpeed,
      mouseSpeed: data.mouseSpeed,
      clickFrequency: data.clickFrequency,
      idleTime: data.idleTime
    }
    database.saveStatusSnapshot(snapshot)

    // 检查是否需要提醒
    checkNotifications(analysis)
  })

  // 监听空闲状态变化
  activityMonitor.on('idle-start', () => {
    console.log('User became idle')
  })

  activityMonitor.on('idle-end', (duration: number) => {
    console.log(`User returned after ${Math.round(duration / 1000)}s idle`)
  })

  // 使用 Electron 的 powerMonitor 监测系统空闲
  setInterval(() => {
    if (!activityMonitor) return
    const idleTime = powerMonitor.getSystemIdleTime() * 1000
    if (idleTime > 30000) {
      activityMonitor.recordIdle(idleTime)
    }
  }, 5000)

  // 开始监控
  activityMonitor.start()

  // 启动全局键鼠监控
  startGlobalInputMonitor()
}

function checkNotifications(analysis: CurrentStatus['analysis']): void {
  if (!analysis || !database) return

  const settings = database.getSettings()
  if (!settings.notificationsEnabled) return

  const now = Date.now()
  const minInterval = 5 * 60 * 1000 // 最小通知间隔 5分钟

  // 疲劳提醒
  if (analysis.state === 'fatigued' && analysis.fatigueDuration > 10 * 60 * 1000) {
    if (!lastNotificationTime['fatigue'] || now - lastNotificationTime['fatigue'] > minInterval) {
      showNotification('您似乎有些疲劳了 💤', '建议休息一下，喝杯水或站起来活动活动')
      lastNotificationTime['fatigue'] = now
    }
  }

  // 卡住提醒
  if (analysis.state === 'stuck' && analysis.stuckDuration > 15 * 60 * 1000) {
    if (!lastNotificationTime['stuck'] || now - lastNotificationTime['stuck'] > minInterval) {
      showNotification('检测到您可能遇到了困难 🤔', '休息一下或换个思路可能会有帮助')
      lastNotificationTime['stuck'] = now
    }
  }

  // 烦躁提醒
  if (analysis.state === 'frustrated' && analysis.frustrationLevel > 0.7) {
    if (!lastNotificationTime['frustrated'] || now - lastNotificationTime['frustrated'] > minInterval) {
      showNotification('您看起来有些烦躁 😤', '深呼吸，也许该短暂休息一下了')
      lastNotificationTime['frustrated'] = now
    }
  }

  // 长时间工作提醒
  if (analysis.continuousWorkTime > settings.breakReminderInterval * 60 * 1000) {
    if (!lastNotificationTime['break'] || now - lastNotificationTime['break'] > minInterval) {
      showNotification('已连续工作较长时间 ⏰', '该休息一下了，保护眼睛和身体健康')
      lastNotificationTime['break'] = now
    }
  }
}

function showNotification(title: string, body: string): void {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title,
      body,
      silent: false
    })
    notification.show()
  }
}

// IPC 处理
ipcMain.handle('get-current-status', (): CurrentStatus => {
  return currentStatus
})

ipcMain.handle('get-history', (_event, options: { start: number; end: number }): StatusSnapshot[] => {
  if (!database) return []
  return database.getHistory(options.start, options.end)
})

ipcMain.handle('get-settings', (): AppSettings => {
  if (!database) {
    return {
      notificationsEnabled: true,
      fatigueThreshold: 30,
      stuckThreshold: 15,
      frustrationThreshold: 0.7,
      breakReminderInterval: 60,
      workingHoursStart: 9,
      workingHoursEnd: 18
    }
  }
  return database.getSettings()
})

ipcMain.handle('update-settings', (_event, settings: Partial<AppSettings>): void => {
  if (!database) return
  database.updateSettings(settings)
  stateAnalyzer?.updateSettings(database.getSettings())
})

ipcMain.handle('get-today-stats', () => {
  if (!database) return null
  return database.getTodayStats()
})

ipcMain.handle('reset-work-timer', () => {
  stateAnalyzer?.resetWorkTimer()
})

// 应用生命周期
app.whenReady().then(() => {
  createWindow()
  createTray()
  initializeComponents()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  uIOhook.stop()
  activityMonitor?.stop()
  database?.close()
})
