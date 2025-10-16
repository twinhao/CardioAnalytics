class ECGVisualizer {
    constructor() {
        this.canvas = document.getElementById('ecgChart');
        this.ctx = this.canvas.getContext('2d');
        this.allECGData = []; // 儲存已生成的記錄
        this.currentDataIndex = 0; // 當前顯示的記錄索引
        this.sampleRate = 250; // 250 Hz
        this.recordDuration = 5; // 減少為 5 秒（原本是 30 秒）
        this.pointsPerRecord = this.sampleRate * this.recordDuration; // 每筆記錄 1250 個點
        this.amplitude = 1;
        this.totalRecords = 100; // 減少為 100 筆（原本是 3000 筆）
        this.initialLoadCount = 10; // 初始只載入 10 筆
        this.batchSize = 10; // 每批次載入 10 筆
        this.isGenerating = false;
        this.randomCache = []; // 隨機數快取
        this.randomCacheSize = 10000; // 快取大小

        this.initCanvas();
        this.fillRandomCache(); // 預先填充隨機數快取
        this.loadInitialData();
        this.bindEvents();
    }

    // 批次生成隨機數並快取
    fillRandomCache() {
        const buffer = new Uint32Array(this.randomCacheSize);
        crypto.getRandomValues(buffer);
        this.randomCache = Array.from(buffer).map(n => n / (0xFFFFFFFF + 1));
    }

    // 從快取取得隨機數
    getCachedRandom() {
        if (this.randomCache.length === 0) {
            this.fillRandomCache();
        }
        return this.randomCache.pop();
    }

    // 獲取指定範圍內的隨機數
    randomRange(min, max) {
        return min + this.getCachedRandom() * (max - min);
    }

    initCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }

    // 初始載入少量數據
    loadInitialData() {
        document.getElementById('loading').style.display = 'block';

        // 使用 requestAnimationFrame 避免阻塞
        const generateBatch = (startIndex, endIndex) => {
            for (let i = startIndex; i < endIndex && i < this.initialLoadCount; i++) {
                const record = this.generateSingleRecord(i);
                this.allECGData.push(record);
                this.updateLoadingProgress(i, this.initialLoadCount);
            }

            if (endIndex < this.initialLoadCount) {
                requestAnimationFrame(() => generateBatch(endIndex, endIndex + 2));
            } else {
                this.finishInitialLoading();
                // 背景載入剩餘數據
                this.loadRemainingDataInBackground();
            }
        };

        requestAnimationFrame(() => generateBatch(0, 2));
    }

    // 背景漸進式載入剩餘數據
    loadRemainingDataInBackground() {
        if (this.isGenerating) return;
        this.isGenerating = true;

        const generateNextBatch = () => {
            if (this.allECGData.length >= this.totalRecords) {
                this.isGenerating = false;
                console.log(`所有 ${this.totalRecords} 筆記錄已載入完成`);
                return;
            }

            const startIndex = this.allECGData.length;
            const endIndex = Math.min(startIndex + this.batchSize, this.totalRecords);

            // 使用 requestIdleCallback 在空閒時載入
            const idleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 100));

            idleCallback(() => {
                for (let i = startIndex; i < endIndex; i++) {
                    const record = this.generateSingleRecord(i);
                    this.allECGData.push(record);
                }

                // 更新記錄數顯示
                const totalElement = document.querySelector('#currentRecord');
                if (totalElement && totalElement.textContent) {
                    const parts = totalElement.textContent.split('/');
                    if (parts.length === 2) {
                        totalElement.textContent = `${parts[0].trim()} / ${this.allECGData.length}`;
                    }
                }

                // 繼續下一批
                generateNextBatch();
            });
        };

        generateNextBatch();
    }

    generateSingleRecord(recordIndex) {
        const { signalType, baseHeartRate } = this.determineSignalType();
        const heartRateVariation = (this.getCachedRandom() - 0.5) * 10;
        const amplitudeVariation = 0.7 + this.getCachedRandom() * 0.6;

        // 簡化的 ECG 數據生成（減少計算量）
        const ecgRecord = this.generateSimplifiedECGRecord(
            baseHeartRate,
            heartRateVariation,
            amplitudeVariation,
            signalType
        );

        const finalHeartRate = Math.round(baseHeartRate + heartRateVariation);
        const diagnosis = this.getDiagnosis(signalType);
        const workdayTimestamp = this.generateWorkdayTimestamp(recordIndex);

        return {
            data: ecgRecord,
            heartRate: finalHeartRate,
            diagnosis: diagnosis,
            timestamp: workdayTimestamp.toLocaleString(),
            quality: this.getCachedRandom() > 0.15 ? '良好' : '一般'
        };
    }

    // 簡化的 ECG 記錄生成（減少數據點）
    generateSimplifiedECGRecord(baseHeartRate, heartRateVariation, amplitudeVariation, signalType) {
        const ecgRecord = new Float32Array(this.pointsPerRecord); // 使用類型化陣列提升效能
        const adjustedHeartRate = baseHeartRate + heartRateVariation;

        // 預計算常用值
        const beatPeriod = 60 / adjustedHeartRate;
        const samplesPerBeat = Math.floor(beatPeriod * this.sampleRate);

        // 生成一個心跳週期的模板
        const template = this.generateBeatTemplate(samplesPerBeat, signalType);

        // 重複使用模板填充數據
        let pos = 0;
        while (pos < this.pointsPerRecord) {
            const copyLength = Math.min(template.length, this.pointsPerRecord - pos);
            for (let i = 0; i < copyLength; i++) {
                ecgRecord[pos + i] = template[i] * amplitudeVariation + (this.getCachedRandom() - 0.5) * 0.03;
            }
            pos += copyLength;
        }

        return ecgRecord;
    }

    // 生成心跳模板
    generateBeatTemplate(samplesPerBeat, signalType) {
        const template = new Float32Array(samplesPerBeat);

        for (let i = 0; i < samplesPerBeat; i++) {
            const phase = i / samplesPerBeat;
            let value = 0;

            // 簡化的 PQRST 波形
            if (phase >= 0.05 && phase <= 0.15) {
                // P 波
                const pPhase = (phase - 0.05) * 10;
                value = 0.15 * Math.sin(Math.PI * pPhase);
            } else if (phase >= 0.17 && phase <= 0.19) {
                // Q 波
                const qPhase = (phase - 0.17) * 50;
                value = -0.2 * Math.sin(Math.PI * qPhase);
            } else if (phase >= 0.19 && phase <= 0.23) {
                // R 波
                const rPhase = (phase - 0.19) * 25;
                value = 1.5 * Math.sin(Math.PI * rPhase / 2);
            } else if (phase >= 0.23 && phase <= 0.26) {
                // S 波
                const sPhase = (phase - 0.23) * 33.3;
                value = -0.4 * Math.sin(Math.PI * sPhase);
            } else if (phase >= 0.28 && phase <= 0.42) {
                // T 波
                const tPhase = (phase - 0.28) * 7.14;
                value = 0.25 * Math.sin(Math.PI * tPhase);
            }

            // 根據信號類型添加變化
            if (signalType === 'arrhythmia' && this.getCachedRandom() < 0.05) {
                value += (this.getCachedRandom() - 0.5) * 0.3;
            }

            template[i] = value;
        }

        return template;
    }

    determineSignalType() {
        const rand = this.getCachedRandom();
        if (rand < 0.75) {
            return { signalType: 'normal', baseHeartRate: 60 + this.getCachedRandom() * 40 };
        } else if (rand < 0.88) {
            return { signalType: 'tachycardia', baseHeartRate: 100 + this.getCachedRandom() * 50 };
        } else if (rand < 0.96) {
            return { signalType: 'bradycardia', baseHeartRate: 40 + this.getCachedRandom() * 20 };
        } else {
            return { signalType: 'arrhythmia', baseHeartRate: 50 + this.getCachedRandom() * 70 };
        }
    }

    getDiagnosis(signalType) {
        switch (signalType) {
            case 'normal':
                return '正常竇性心律';
            case 'tachycardia':
                return '竇性心動過速';
            case 'bradycardia':
                return '竇性心動過緩';
            case 'arrhythmia':
                return '心律不整';
            default:
                return '正常竇性心律';
        }
    }

    generateWorkdayTimestamp(recordIndex) {
        const today = new Date();
        const baseDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
        const daysToAdd = Math.floor(recordIndex / 10); // 每天約10筆記錄
        const targetDate = new Date(baseDate);
        targetDate.setDate(baseDate.getDate() + daysToAdd);

        // 跳過週末
        while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
            targetDate.setDate(targetDate.getDate() + 1);
        }

        // 工作時間：8:00-18:00
        const workStartHour = 8;
        let randomHour;
        if (this.getCachedRandom() < 0.6) {
            randomHour = workStartHour + this.getCachedRandom() * 4;
        } else {
            randomHour = 12 + this.getCachedRandom() * 6;
        }

        const randomMinute = this.getCachedRandom() * 60;
        const randomSecond = this.getCachedRandom() * 60;

        targetDate.setHours(Math.floor(randomHour), Math.floor(randomMinute), Math.floor(randomSecond));

        return targetDate;
    }

    updateLoadingProgress(current, total) {
        const progress = ((current + 1) / total * 100).toFixed(1);
        const loadingText = document.getElementById('loadingText');
        if (loadingText) {
            loadingText.innerHTML = `
                <div>生成虛擬心電圖數據中...</div>
                <div>進度: ${progress}% (${current + 1}/${total})</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
            `;
        }
    }

    finishInitialLoading() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('currentRecord').textContent = `記錄 1 / ${this.allECGData.length}`;
        this.updateInfoPanel();
        this.draw();
    }

    updateInfoPanel() {
        if (this.allECGData.length === 0) return;

        const record = this.allECGData[this.currentDataIndex];
        document.getElementById('timestamp').textContent = record.timestamp;
        document.getElementById('heartRate').textContent = `${record.heartRate} bpm`;
        document.getElementById('diagnosis').textContent = record.diagnosis;
        document.getElementById('quality').textContent = record.quality;

        // 更新診斷顏色
        const diagnosisElement = document.getElementById('diagnosis');
        diagnosisElement.className = '';
        if (record.diagnosis.includes('過速')) {
            diagnosisElement.classList.add('warning');
        } else if (record.diagnosis.includes('過緩') || record.diagnosis.includes('不整')) {
            diagnosisElement.classList.add('caution');
        }
    }

    bindEvents() {
        document.getElementById('prevBtn').addEventListener('click', () => this.previousRecord());
        document.getElementById('nextBtn').addEventListener('click', () => this.nextRecord());

        // 鍵盤事件
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.previousRecord();
            if (e.key === 'ArrowRight') this.nextRecord();
        });

        window.addEventListener('resize', () => {
            this.initCanvas();
            this.draw();
        });
    }

    previousRecord() {
        if (this.currentDataIndex > 0) {
            this.currentDataIndex--;
            document.getElementById('currentRecord').textContent =
                `記錄 ${this.currentDataIndex + 1} / ${this.allECGData.length}`;
            this.updateInfoPanel();
            this.draw();
        }
    }

    nextRecord() {
        // 檢查是否需要載入更多數據
        if (this.currentDataIndex < this.allECGData.length - 1) {
            this.currentDataIndex++;
            document.getElementById('currentRecord').textContent =
                `記錄 ${this.currentDataIndex + 1} / ${this.allECGData.length}`;
            this.updateInfoPanel();
            this.draw();

            // 如果接近結尾且還有數據未載入，觸發載入
            if (this.currentDataIndex >= this.allECGData.length - 5 &&
                this.allECGData.length < this.totalRecords &&
                !this.isGenerating) {
                this.loadRemainingDataInBackground();
            }
        }
    }

    draw() {
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        // 清空畫布
        this.ctx.clearRect(0, 0, width, height);

        // 繪製背景格線
        this.drawGrid();

        // 繪製心電圖
        if (this.allECGData.length > 0) {
            this.drawECG();
        }
    }

    drawGrid() {
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        this.ctx.strokeStyle = 'rgba(34, 197, 94, 0.1)';
        this.ctx.lineWidth = 0.5;

        // 垂直線
        for (let x = 0; x < width; x += 20) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }

        // 水平線
        for (let y = 0; y < height; y += 20) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
    }

    drawECG() {
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const data = this.allECGData[this.currentDataIndex].data;

        // 顯示完整記錄
        const pointsToShow = data.length;

        this.ctx.strokeStyle = '#22c55e';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();

        for (let i = 0; i < pointsToShow; i++) {
            const x = (i / pointsToShow) * width;
            const y = height / 2 - (data[i] * height * 0.3 * this.amplitude);

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        this.ctx.stroke();
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    new ECGVisualizer();
});