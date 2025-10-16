class ECGVisualizer {
    constructor() {
        this.canvas = document.getElementById('ecgChart');
        this.ctx = this.canvas.getContext('2d');
        this.allECGData = []; // 儲存所有3000筆30秒記錄
        this.currentDataIndex = 0; // 當前顯示的是第幾筆記錄
        this.sampleRate = 250; // 250 Hz
        this.recordDuration = 30; // 每筆記錄30秒
        this.pointsPerRecord = this.sampleRate * this.recordDuration; // 每筆記錄7500個點
        this.amplitude = 1;
        this.totalRecords = 3000;

        this.initCanvas();
        this.loadAllECGData();
        this.bindEvents();
        this.draw();
    }

    // 安全的隨機數生成器 - 使用 Web Crypto API
    cryptoRandom() {
        // 獲取一個 0 到 1 之間的加密安全隨機數
        const randomBuffer = new Uint32Array(1);
        crypto.getRandomValues(randomBuffer);
        return randomBuffer[0] / (0xFFFFFFFF + 1);
    }

    // 獲取指定範圍內的安全隨機數
    cryptoRandomRange(min, max) {
        return min + this.cryptoRandom() * (max - min);
    }

    initCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }

    loadAllECGData() {
        document.getElementById('loading').style.display = 'block';

        setTimeout(() => {
            this.allECGData = [];

            for (let recordIndex = 0; recordIndex < this.totalRecords; recordIndex++) {
                const record = this.generateSingleRecord(recordIndex);
                this.allECGData.push(record);
                this.updateLoadingProgress(recordIndex);
            }

            this.finishLoading();
        }, 100);
    }

    generateSingleRecord(recordIndex) {
        const { signalType, baseHeartRate } = this.determineSignalType();
        const heartRateVariation = (this.cryptoRandom() - 0.5) * 10;
        const amplitudeVariation = 0.7 + this.cryptoRandom() * 0.6;

        const ecgRecord = this.generateECGRecord(
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
            quality: this.cryptoRandom() > 0.15 ? '良好' : '一般'
        };
    }

    determineSignalType() {
        const rand = this.cryptoRandom();
        if (rand < 0.75) {
            return { signalType: 'normal', baseHeartRate: 60 + this.cryptoRandom() * 40 };
        } else if (rand < 0.88) {
            return { signalType: 'tachycardia', baseHeartRate: 100 + this.cryptoRandom() * 50 };
        } else if (rand < 0.96) {
            return { signalType: 'bradycardia', baseHeartRate: 40 + this.cryptoRandom() * 20 };
        } else {
            return { signalType: 'arrhythmia', baseHeartRate: 50 + this.cryptoRandom() * 70 };
        }
    }

    generateECGRecord(baseHeartRate, heartRateVariation, amplitudeVariation, signalType) {
        const ecgRecord = [];
        for (let i = 0; i < this.pointsPerRecord; i++) {
            const t = i / this.sampleRate;
            let ecgValue = this.generateECGPoint(t, baseHeartRate + heartRateVariation, signalType);
            ecgValue *= amplitudeVariation;

            // 加入輕微雜訊（使用加密安全的隨機數）
            ecgValue += (this.cryptoRandom() - 0.5) * 0.03;

            ecgRecord.push(ecgValue);
        }
        return ecgRecord;
    }

    generateECGPoint(t, heartRate, signalType) {
        switch (signalType) {
            case 'arrhythmia':
                // 不規則心律
                const normalECG = this.generateNormalECG(t, heartRate);
                if (this.cryptoRandom() < 0.08) {
                    return normalECG + (this.cryptoRandom() - 0.5) * 0.6;
                }
                return normalECG;
            default:
                return this.generateNormalECG(t, heartRate) + (this.cryptoRandom() - 0.5) * 0.05;
        }
    }

    generateNormalECG(t, heartRate) {
        const beatPeriod = 60 / heartRate;
        const beatPhase = (t % beatPeriod) / beatPeriod;

        let value = 0;

        // P波
        if (beatPhase >= 0.05 && beatPhase <= 0.15) {
            const pPhase = (beatPhase - 0.05) * 10;
            value = 0.15 * Math.sin(Math.PI * pPhase);
        }
        // Q波
        else if (beatPhase >= 0.17 && beatPhase <= 0.19) {
            const qPhase = (beatPhase - 0.17) * 50;
            value = -0.2 * Math.sin(Math.PI * qPhase);
        }
        // R波
        else if (beatPhase >= 0.19 && beatPhase <= 0.23) {
            const rPhase = (beatPhase - 0.19) * 25;
            value = 1.5 * Math.sin(Math.PI * rPhase / 2);
        }
        // S波
        else if (beatPhase >= 0.23 && beatPhase <= 0.26) {
            const sPhase = (beatPhase - 0.23) * 33.3;
            value = -0.4 * Math.sin(Math.PI * sPhase);
        }
        // T波
        else if (beatPhase >= 0.28 && beatPhase <= 0.42) {
            const tPhase = (beatPhase - 0.28) * 7.14;
            value = 0.25 * Math.sin(Math.PI * tPhase);
        }

        return value;
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
        const daysToAdd = Math.floor(recordIndex / 30); // 每天約30筆記錄
        const targetDate = new Date(baseDate);
        targetDate.setDate(baseDate.getDate() + daysToAdd);

        // 跳過週末
        while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
            targetDate.setDate(targetDate.getDate() + 1);
        }

        // 工作時間：8:00-18:00，使用加密安全的隨機數
        const workStartHour = 8;
        const workEndHour = 18;
        let randomHour;
        if (this.cryptoRandom() < 0.6) {
            // 60% 在上午
            randomHour = workStartHour + this.cryptoRandom() * 4;
        } else {
            // 40% 在下午
            randomHour = 12 + this.cryptoRandom() * 6;
        }

        const randomMinute = this.cryptoRandom() * 60;
        const randomSecond = this.cryptoRandom() * 60;

        targetDate.setHours(Math.floor(randomHour), Math.floor(randomMinute), Math.floor(randomSecond));

        return targetDate;
    }

    updateLoadingProgress(recordIndex) {
        const progress = ((recordIndex + 1) / this.totalRecords * 100).toFixed(1);
        const loadingText = document.getElementById('loadingText');
        if (loadingText) {
            loadingText.innerHTML = `
                <div>生成虛擬心電圖數據中...</div>
                <div>進度: ${progress}% (${recordIndex + 1}/${this.totalRecords})</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
            `;
        }
    }

    finishLoading() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('currentRecord').textContent = `記錄 ${this.currentDataIndex + 1} / ${this.totalRecords}`;
        this.updateInfoPanel();
    }

    updateInfoPanel() {
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
            document.getElementById('currentRecord').textContent = `記錄 ${this.currentDataIndex + 1} / ${this.totalRecords}`;
            this.updateInfoPanel();
            this.draw();
        }
    }

    nextRecord() {
        if (this.currentDataIndex < this.totalRecords - 1) {
            this.currentDataIndex++;
            document.getElementById('currentRecord').textContent = `記錄 ${this.currentDataIndex + 1} / ${this.totalRecords}`;
            this.updateInfoPanel();
            this.draw();
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
        this.drawECG();
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

        // 顯示5秒的數據
        const displayDuration = 5;
        const pointsToShow = this.sampleRate * displayDuration;
        const startIndex = 0;

        this.ctx.strokeStyle = '#22c55e';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();

        for (let i = 0; i < pointsToShow && i < data.length; i++) {
            const x = (i / pointsToShow) * width;
            const y = height / 2 - (data[startIndex + i] * height * 0.3 * this.amplitude);

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