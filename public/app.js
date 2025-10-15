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
        const heartRateVariation = (Math.random() - 0.5) * 10;
        const amplitudeVariation = 0.7 + Math.random() * 0.6;

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
            quality: Math.random() > 0.15 ? '良好' : '一般'
        };
    }

    determineSignalType() {
        const rand = Math.random();
        if (rand < 0.75) {
            return { signalType: 'normal', baseHeartRate: 60 + Math.random() * 40 };
        } else if (rand < 0.88) {
            return { signalType: 'tachycardia', baseHeartRate: 100 + Math.random() * 50 };
        } else if (rand < 0.96) {
            return { signalType: 'bradycardia', baseHeartRate: 40 + Math.random() * 20 };
        } else {
            return { signalType: 'arrhythmia', baseHeartRate: 50 + Math.random() * 70 };
        }
    }

    generateECGRecord(baseHeartRate, heartRateVariation, amplitudeVariation, signalType) {
        const ecgRecord = [];

        for (let i = 0; i < this.pointsPerRecord; i++) {
            const t = i / this.sampleRate;
            let ecgValue = this.generateECGPoint(t, baseHeartRate + heartRateVariation, signalType);
            ecgValue *= amplitudeVariation;
            ecgValue = this.applySignalTypeAdjustment(ecgValue, signalType);
            ecgValue += (Math.random() - 0.5) * 0.03; // 加入輕微雜訊
            ecgRecord.push(ecgValue);
        }

        return ecgRecord;
    }

    applySignalTypeAdjustment(ecgValue, signalType) {
        switch (signalType) {
            case 'arrhythmia':
                if (Math.random() < 0.08) {
                    return ecgValue + (Math.random() - 0.5) * 0.6;
                }
                break;
            case 'tachycardia':
                return ecgValue + (Math.random() - 0.5) * 0.05;
            case 'bradycardia':
                return ecgValue * 0.9;
        }
        return ecgValue;
    }

    getDiagnosis(signalType) {
        const diagnosisMap = {
            'normal': '正常心律',
            'tachycardia': '心跳過速',
            'bradycardia': '心跳過緩',
            'arrhythmia': '心律不整'
        };
        return diagnosisMap[signalType] || '正常心律';
    }

    updateLoadingProgress(recordIndex) {
        if (recordIndex % 100 === 0) {
            const progress = Math.floor((recordIndex / this.totalRecords) * 100);
            document.getElementById('dataCount').textContent = `載入中... ${progress}%`;
        }
    }

    finishLoading() {
        document.getElementById('loading').style.display = 'none';
        this.populateRecordSelector();
        this.updateStats();
        this.draw();
    }

    populateRecordSelector() {
        const selector = document.getElementById('recordSelector');
        selector.innerHTML = '';

        for (let i = 0; i < this.totalRecords; i++) {
            const option = document.createElement('option');
            option.value = i;
            const record = this.allECGData[i];
            option.textContent = `記錄 ${i + 1} - ${record.diagnosis} (${record.heartRate} BPM)`;
            selector.appendChild(option);
        }

        selector.selectedIndex = 0;
    }

    generateWorkdayTimestamp(recordIndex) {
        // 設定2025年上半年的日期範圍 (1月1日到6月30日)
        const startDate = new Date(2025, 0, 1); // 2025年1月1日
        const endDate = new Date(2025, 5, 30);   // 2025年6月30日

        // 計算2025年上半年的工作日總數
        let workdays = [];
        let currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            // 只收集工作日 (週一=1 到 週五=5)
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                workdays.push(new Date(currentDate));
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // 將3000筆記錄分散到這些工作日中
        const totalWorkdays = workdays.length;
        const recordsPerDay = Math.ceil(this.totalRecords / totalWorkdays);

        // 計算當前記錄應該在哪一個工作日
        const dayIndex = Math.floor(recordIndex / recordsPerDay);
        const adjustedDayIndex = Math.min(dayIndex, totalWorkdays - 1);
        let targetDate = new Date(workdays[adjustedDayIndex]);

        // 在工作日的上班時間內隨機分配時間
        const workStartHour = 8;  // 早上8點開始

        // 上班時間內的隨機分佈,偏向上午時段
        let randomHour;
        if (Math.random() < 0.6) {
            // 60%機率在上午 (8-12點)
            randomHour = workStartHour + Math.random() * 4;
        } else {
            // 40%機率在下午 (12-18點)
            randomHour = 12 + Math.random() * 6;
        }

        const randomMinute = Math.random() * 60;
        const randomSecond = Math.random() * 60;

        targetDate.setHours(Math.floor(randomHour));
        targetDate.setMinutes(Math.floor(randomMinute));
        targetDate.setSeconds(Math.floor(randomSecond));

        return targetDate;
    }

    generateECGPoint(t, heartRate, signalType = 'normal') {
        // 模擬真實ECG波形：P波、QRS複合波、T波
        const period = 60 / heartRate; // 一個心跳週期的秒數
        const phase = (t % period) / period * 2 * Math.PI;

        let ecgValue = 0;

        // P波 (0.08-0.12秒)
        if (phase >= 0 && phase <= 0.8) {
            ecgValue += 0.1 * Math.sin(phase * 4);
        }

        // QRS複合波 (0.06-0.10秒) - 主要特徵
        if (phase >= 2.5 && phase <= 3.5) {
            const qrsPhase = (phase - 2.5);
            if (qrsPhase <= 0.3) {
                ecgValue += -0.2 * Math.sin(qrsPhase * 10); // Q波
            } else if (qrsPhase <= 0.6) {
                ecgValue += 1.0 * Math.sin((qrsPhase - 0.3) * 10); // R波
            } else {
                ecgValue += -0.3 * Math.sin((qrsPhase - 0.6) * 10); // S波
            }
        }

        // T波 (0.16秒)
        if (phase >= 4.5 && phase <= 5.5) {
            ecgValue += 0.3 * Math.sin((phase - 4.5) * 3);
        }

        return ecgValue;
    }


    bindEvents() {
        const recordSelector = document.getElementById('recordSelector');
        const amplitudeSlider = document.getElementById('amplitudeSlider');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');

        recordSelector.addEventListener('change', (e) => {
            this.currentDataIndex = parseInt(e.target.value);
            this.draw();
            this.updateStats();
        });

        prevBtn.addEventListener('click', () => this.previousRecord());
        nextBtn.addEventListener('click', () => this.nextRecord());

        amplitudeSlider.addEventListener('input', (e) => {
            this.amplitude = parseFloat(e.target.value);
            document.getElementById('amplitudeValue').textContent = this.amplitude.toFixed(1) + 'x';
            this.draw();
        });

        // 鍵盤控制
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowLeft':
                    this.previousRecord();
                    break;
                case 'ArrowRight':
                    this.nextRecord();
                    break;
            }
        });

        window.addEventListener('resize', () => this.initCanvas());
    }


    nextRecord() {
        if (this.allECGData.length === 0) return;
        this.currentDataIndex = (this.currentDataIndex + 1) % this.totalRecords;
        document.getElementById('recordSelector').selectedIndex = this.currentDataIndex;
        this.draw();
        this.updateStats();
    }

    previousRecord() {
        if (this.allECGData.length === 0) return;
        this.currentDataIndex = (this.currentDataIndex - 1 + this.totalRecords) % this.totalRecords;
        document.getElementById('recordSelector').selectedIndex = this.currentDataIndex;
        this.draw();
        this.updateStats();
    }

    draw() {
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        // 清空畫布
        this.ctx.clearRect(0, 0, width, height);

        // 繪製背景網格
        this.drawGrid(width, height);

        // 繪製ECG波形
        this.drawECG(width, height);
    }

    drawGrid(width, height) {
        this.ctx.strokeStyle = '#e9ecef';
        this.ctx.lineWidth = 1;

        // 垂直線
        for (let x = 0; x <= width; x += 25) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }

        // 水平線
        for (let y = 0; y <= height; y += 25) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }

        // 粗網格線
        this.ctx.strokeStyle = '#dee2e6';
        this.ctx.lineWidth = 2;

        for (let x = 0; x <= width; x += 125) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }

        for (let y = 0; y <= height; y += 125) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
    }

    drawECG(width, height) {
        if (this.allECGData.length === 0) return;

        const currentRecord = this.allECGData[this.currentDataIndex];
        const centerY = height / 2;
        const scale = height / 6 * this.amplitude;

        this.ctx.strokeStyle = '#28a745';
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.beginPath();

        // 顯示完整的30秒記錄
        for (let i = 0; i < currentRecord.data.length; i++) {
            const x = (i / currentRecord.data.length) * width;
            const y = centerY - (currentRecord.data[i] * scale);

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        this.ctx.stroke();

        // 顯示記錄資訊
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.fillRect(10, 10, 350, 80);

        this.ctx.fillStyle = '#495057';
        this.ctx.font = 'bold 16px Microsoft JhengHei';
        this.ctx.fillText(`記錄 ${this.currentDataIndex + 1}/${this.totalRecords} - ${currentRecord.diagnosis}`, 20, 30);
        this.ctx.font = '14px Microsoft JhengHei';
        this.ctx.fillText(`時間戳記: ${currentRecord.timestamp}`, 20, 50);
        this.ctx.fillText(`心跳率: ${currentRecord.heartRate} BPM`, 20, 70);
        this.ctx.fillText(`訊號品質: ${currentRecord.quality}`, 250, 70);

        // 顯示時間軸
        this.ctx.fillStyle = '#6c757d';
        this.ctx.font = '12px Microsoft JhengHei';
        for (let i = 0; i <= 30; i += 5) {
            const x = (i / 30) * width;
            this.ctx.fillText(`${i}s`, x - 10, height - 5);

            // 繪製時間刻度線
            this.ctx.strokeStyle = '#dee2e6';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(x, height - 30);
            this.ctx.lineTo(x, height - 20);
            this.ctx.stroke();
        }

        // 顯示提示
        this.ctx.fillStyle = 'rgba(102, 126, 234, 0.8)';
        this.ctx.font = '14px Microsoft JhengHei';
        this.ctx.fillText('提示: 使用 ← → 或下拉選單切換記錄', width - 250, height - 20);
    }

    updateStats() {
        if (this.allECGData.length === 0) return;

        const currentRecord = this.allECGData[this.currentDataIndex];
        document.getElementById('heartRate').textContent = currentRecord.heartRate;
        document.getElementById('dataCount').textContent = `${this.currentDataIndex + 1} / ${this.totalRecords}`;
        document.getElementById('diagnosis').textContent = currentRecord.diagnosis;
        document.getElementById('signalQuality').textContent = currentRecord.quality;
    }
}

// 初始化應用程式
window.addEventListener('load', () => {
    new ECGVisualizer();
});
