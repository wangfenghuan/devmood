import * as brain from 'brain.js'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { ActivityData, DeveloperState } from './types'

// 训练样本
interface TrainingSample {
    features: number[]
    label: DeveloperState
    timestamp: number
}

// 状态编码 (one-hot)
const STATE_ENCODING: Record<DeveloperState, number[]> = {
    focused: [1, 0, 0, 0, 0],
    fatigued: [0, 1, 0, 0, 0],
    stuck: [0, 0, 1, 0, 0],
    frustrated: [0, 0, 0, 1, 0],
    normal: [0, 0, 0, 0, 1]
}

const STATE_LIST: DeveloperState[] = ['focused', 'fatigued', 'stuck', 'frustrated', 'normal']

// 特征归一化参数 (经验值，会随使用自适应)
const FEATURE_RANGES = {
    typingSpeed: { min: 0, max: 200 },
    mouseSpeed: { min: 0, max: 50000 },
    clickFrequency: { min: 0, max: 60 },
    scrollFrequency: { min: 0, max: 30 },
    idleTime: { min: 0, max: 300000 },  // 5分钟
    typingTrend: { min: -1, max: 1 },
    clickTrend: { min: -1, max: 1 },
    idleRatio: { min: 0, max: 1 },
    activityVariance: { min: 0, max: 500 },
    typingRhythm: { min: 0, max: 1 },
}

/**
 * ML 分析器 — 基于 brain.js 的开发者状态分类
 * 
 * 工作流程：
 * 1. 冷启动：使用规则系统产生标签
 * 2. 收集训练数据：每次规则系统产生标签时保存特征+标签
 * 3. 训练：数据达到阈值后训练神经网络
 * 4. 预测：模型可用时优先用模型，置信度低时回退规则
 */
class MLAnalyzer {
    private net: brain.NeuralNetwork<any, any> | null = null
    private trainingSamples: TrainingSample[] = []
    private isModelReady = false
    private readonly MIN_SAMPLES = 100         // 最少训练样本数
    private readonly MAX_SAMPLES = 5000        // 最大保留样本数
    private readonly CONFIDENCE_THRESHOLD = 0.6 // 模型置信度阈值
    private readonly RETRAIN_INTERVAL = 200     // 每新增200条样本重新训练
    private samplesSinceLastTrain = 0
    private dataDir: string

    constructor() {
        this.dataDir = path.join(app.getPath('userData'), 'ml-data')
        this.ensureDataDir()
        this.loadData()
    }

    // 确保数据目录存在
    private ensureDataDir(): void {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true })
        }
    }

    // 从活动数据中提取归一化特征向量
    extractFeatures(
        data: ActivityData,
        history: ActivityData[]
    ): number[] {
        // 计算趋势和节奏
        const typingTrend = this.calculateTrend(history.map(h => h.typingSpeed))
        const clickTrend = this.calculateTrend(history.map(h => h.clickFrequency))
        const avgIdleTime = this.average(history.map(h => h.idleTime))
        const idleRatio = Math.min(avgIdleTime / 60000, 1)
        const activityVariance = this.variance(
            history.map(h => h.typingSpeed + h.clickFrequency + h.scrollFrequency)
        )
        const typingRhythm = this.calculateRhythm(history.map(h => h.typingSpeed))

        // 原始特征
        const rawFeatures = [
            data.typingSpeed,
            data.mouseSpeed,
            data.clickFrequency,
            data.scrollFrequency,
            data.idleTime,
            typingTrend,
            clickTrend,
            idleRatio,
            activityVariance,
            typingRhythm
        ]

        // 归一化到 [0, 1]
        const ranges = Object.values(FEATURE_RANGES)
        return rawFeatures.map((val, i) => {
            const { min, max } = ranges[i]
            return Math.max(0, Math.min(1, (val - min) / (max - min)))
        })
    }

    // 添加训练样本 (由规则系统标注)
    addSample(features: number[], label: DeveloperState): void {
        this.trainingSamples.push({
            features,
            label,
            timestamp: Date.now()
        })

        // 限制样本数量，移除最早的
        if (this.trainingSamples.length > this.MAX_SAMPLES) {
            this.trainingSamples = this.trainingSamples.slice(-this.MAX_SAMPLES)
        }

        this.samplesSinceLastTrain++

        // 检查是否需要训练
        if (
            this.trainingSamples.length >= this.MIN_SAMPLES &&
            (
                !this.isModelReady ||
                this.samplesSinceLastTrain >= this.RETRAIN_INTERVAL
            )
        ) {
            this.train()
        }

        // 定期保存数据
        if (this.samplesSinceLastTrain % 50 === 0) {
            this.saveData()
        }
    }

    // 训练神经网络
    private train(): void {
        try {
            console.log(`[ML] Training with ${this.trainingSamples.length} samples...`)
            const startTime = Date.now()

            // 准备训练数据
            const trainingData = this.trainingSamples.map(sample => ({
                input: sample.features,
                output: STATE_ENCODING[sample.label]
            }))

            // 创建新网络
            this.net = new brain.NeuralNetwork({
                hiddenLayers: [16, 10],  // 两个隐藏层
                activation: 'sigmoid',
                learningRate: 0.01,
            })

            // 训练
            const result = this.net.train(trainingData, {
                iterations: 500,
                errorThresh: 0.01,
                log: false,
            })

            this.isModelReady = true
            this.samplesSinceLastTrain = 0

            const elapsed = Date.now() - startTime
            console.log(`[ML] Training completed in ${elapsed}ms, error: ${result.error.toFixed(4)}, iterations: ${result.iterations}`)

            // 保存模型
            this.saveModel()
        } catch (err) {
            console.error('[ML] Training failed:', err)
            this.isModelReady = false
        }
    }

    // 预测状态
    predict(features: number[]): { state: DeveloperState; confidence: number } | null {
        if (!this.isModelReady || !this.net) return null

        try {
            const output = this.net.run(features) as number[]

            // 找到最高概率的状态
            let maxIdx = 0
            let maxVal = output[0]
            for (let i = 1; i < output.length; i++) {
                if (output[i] > maxVal) {
                    maxVal = output[i]
                    maxIdx = i
                }
            }

            const confidence = maxVal
            const state = STATE_LIST[maxIdx]

            return { state, confidence }
        } catch (err) {
            console.error('[ML] Prediction failed:', err)
            return null
        }
    }

    // 判断模型是否可用且置信度足够
    shouldUseModel(confidence: number): boolean {
        return this.isModelReady && confidence >= this.CONFIDENCE_THRESHOLD
    }

    // 获取模型状态信息
    getStatus(): {
        isReady: boolean
        sampleCount: number
        minSamplesNeeded: number
    } {
        return {
            isReady: this.isModelReady,
            sampleCount: this.trainingSamples.length,
            minSamplesNeeded: this.MIN_SAMPLES,
        }
    }

    // ========== 持久化 ==========

    private saveData(): void {
        try {
            const dataPath = path.join(this.dataDir, 'training-data.json')
            fs.writeFileSync(dataPath, JSON.stringify(this.trainingSamples), 'utf-8')
            console.log(`[ML] Saved ${this.trainingSamples.length} training samples`)
        } catch (err) {
            console.error('[ML] Failed to save training data:', err)
        }
    }

    private saveModel(): void {
        try {
            if (!this.net) return
            const modelPath = path.join(this.dataDir, 'model.json')
            const modelJSON = this.net.toJSON()
            fs.writeFileSync(modelPath, JSON.stringify(modelJSON), 'utf-8')
            console.log('[ML] Model saved')
        } catch (err) {
            console.error('[ML] Failed to save model:', err)
        }
    }

    private loadData(): void {
        try {
            // 加载训练数据
            const dataPath = path.join(this.dataDir, 'training-data.json')
            if (fs.existsSync(dataPath)) {
                this.trainingSamples = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
                console.log(`[ML] Loaded ${this.trainingSamples.length} training samples`)
            }

            // 加载模型
            const modelPath = path.join(this.dataDir, 'model.json')
            if (fs.existsSync(modelPath)) {
                const modelJSON = JSON.parse(fs.readFileSync(modelPath, 'utf-8'))
                this.net = new brain.NeuralNetwork()
                this.net.fromJSON(modelJSON)
                this.isModelReady = true
                console.log('[ML] Model loaded')
            }
        } catch (err) {
            console.error('[ML] Failed to load data:', err)
        }
    }

    // 应用退出时保存
    shutdown(): void {
        this.saveData()
        if (this.isModelReady) {
            this.saveModel()
        }
    }

    // ========== 辅助方法 ==========

    private calculateTrend(values: number[]): number {
        if (values.length < 3) return 0
        const half = Math.floor(values.length / 2)
        const recent = this.average(values.slice(half))
        const earlier = this.average(values.slice(0, half))
        if (earlier === 0) return 0
        return Math.max(-1, Math.min(1, (recent - earlier) / (earlier + 1)))
    }

    private average(values: number[]): number {
        if (values.length === 0) return 0
        return values.reduce((a, b) => a + b, 0) / values.length
    }

    private variance(values: number[]): number {
        if (values.length < 2) return 0
        const avg = this.average(values)
        return values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length
    }

    private calculateRhythm(values: number[]): number {
        if (values.length < 3) return 0.5
        const avg = this.average(values)
        if (avg === 0) return 0
        const cv = Math.sqrt(this.variance(values)) / avg
        return Math.max(0, Math.min(1, 1 - cv))
    }
}

export default MLAnalyzer
