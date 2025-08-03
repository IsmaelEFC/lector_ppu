// utils.js - Utilidades avanzadas para la PWA Detector de Patentes

/**
 * Generador de iconos dinámicos para PWA
 */
class IconGenerator {
    static generateIcon(size = 192, color = '#2563eb') {
        const svg = `
            <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#667eea;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <rect width="${size}" height="${size}" rx="20" fill="url(#grad)"/>
                <rect x="${size*0.2}" y="${size*0.3}" width="${size*0.6}" height="${size*0.15}" 
                      rx="8" fill="white" opacity="0.9"/>
                <text x="${size/2}" y="${size*0.42}" text-anchor="middle" 
                      fill="#333" font-size="${size*0.08}" font-weight="bold">CHILE</text>
                <circle cx="${size*0.3}" cy="${size*0.7}" r="${size*0.05}" fill="white" opacity="0.8"/>
                <circle cx="${size*0.7}" cy="${size*0.7}" r="${size*0.05}" fill="white" opacity="0.8"/>
                <rect x="${size*0.25}" y="${size*0.65}" width="${size*0.5}" height="${size*0.1}" 
                      rx="4" fill="white" opacity="0.6"/>
            </svg>
        `;
        return `data:image/svg+xml;base64,${btoa(svg)}`;
    }

    static async generateIconFile(size = 192) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = size;
        canvas.height = size;

        // Fondo con gradiente
        const gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, '#2563eb');
        gradient.addColorStop(1, '#667eea');
        ctx.fillStyle = gradient;
        ctx.roundRect(0, 0, size, size, 20);
        ctx.fill();

        // Placa
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.roundRect(size*0.2, size*0.3, size*0.6, size*0.15, 8);
        ctx.fill();

        // Texto CHILE
        ctx.fillStyle = '#333';
        ctx.font = `bold ${size*0.08}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('CHILE', size/2, size*0.42);

        // Ruedas
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(size*0.3, size*0.7, size*0.05, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(size*0.7, size*0.7, size*0.05, 0, 2 * Math.PI);
        ctx.fill();

        // Chasis
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.roundRect(size*0.25, size*0.65, size*0.5, size*0.1, 4);
        ctx.fill();

        return canvas.toDataURL('image/png');
    }
}

/**
 * Mejorador de OCR con preprocessamiento de imagen
 */
class OCREnhancer {
    static preprocessImage(canvas, ctx, video) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // 1. Convertir a escala de grises
        for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
        }

        // 2. Aplicar detección de bordes (Sobel)
        this.applySobelEdgeDetection(data, canvas.width, canvas.height);

        // 3. Aplicar threshold adaptativo
        this.applyAdaptiveThreshold(data, canvas.width, canvas.height);

        // 4. Noise reduction
        this.reduceNoise(data, canvas.width, canvas.height);

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    static applySobelEdgeDetection(data, width, height) {
        const output = new Uint8ClampedArray(data.length);
        const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let sumX = 0, sumY = 0;
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4;
                        const pixel = data[idx];
                        const kIndex = (ky + 1) * 3 + (kx + 1);
                        sumX += pixel * kernelX[kIndex];
                        sumY += pixel * kernelY[kIndex];
                    }
                }
                const idx = (y * width + x) * 4;
                const magnitude = Math.sqrt(sumX * sumX + sumY * sumY);
                output[idx] = output[idx + 1] = output[idx + 2] = Math.min(255, magnitude);
                output[idx + 3] = data[idx + 3];
            }
        }
        data.set(output);
    }

    static applyAdaptiveThreshold(data, width, height) {
        const threshold = 128;
        for (let i = 0; i < data.length; i += 4) {
            const value = data[i] > threshold ? 255 : 0;
            data[i] = value;
            data[i + 1] = value;
            data[i + 2] = value;
        }
    }

    static reduceNoise(data, width, height) {
        const newData = new Uint8ClampedArray(data);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                const neighbors = [];
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nIdx = ((y + dy) * width + (x + dx)) * 4;
                        neighbors.push(data[nIdx]);
                    }
                }
                neighbors.sort((a, b) => a - b);
                const median = neighbors[4];
                newData[idx] = median;
                newData[idx + 1] = median;
                newData[idx + 2] = median;
            }
        }
        data.set(newData);
    }

    static enhanceForPlates(imageData) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        ctx.putImageData(imageData, 0, 0);
        ctx.filter = 'contrast(150%) brightness(110%)';
        ctx.drawImage(canvas, 0, 0);
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
}

/**
 * Validador avanzado de placas chilenas
 */
class ChileanPlateValidator {
    static patterns = [
        /^[A-Z]{4}[0-9]{2}$/,  // LLLL00 (nuevo formato)
        /^[A-Z]{2}[0-9]{4}$/,  // LL0000 (formato antiguo)
        /^[A-Z]{3}[0-9]{3}$/,  // LLL000 (especiales)
        /^[A-Z]{2}[0-9]{2}[A-Z]{2}$/, // LL00LL (diplomáticos)
        /^[A-Z]{2}[0-9]{3}[A-Z]$/ // LL000L (motos)
    ];

    static forbiddenCombinations = [
        'SEX', 'GAY', 'ASS', 'FUK', 'SHT', 'DMN', 'HLL'
    ];

    static isValid(plateText) {
        if (!plateText || plateText.length < 5 || plateText.length > 7) {
            return false;
        }
        const matchesPattern = this.patterns.some(pattern => pattern.test(plateText));
        if (!matchesPattern) return false;
        const hasForbidden = this.forbiddenCombinations.some(forbidden => 
            plateText.includes(forbidden)
        );
        if (hasForbidden) return false;
        return this.validateSpecificRules(plateText);
    }

    static validateSpecificRules(plate) {
        if (/^[0-9]/.test(plate)) return false;
        if (/([A-Z])\1{3,}/.test(plate)) return false;
        if (/([0-9])\1{3,}/.test(plate)) return false;
        return true;
    }

    static calculateConfidence(detectedText, ocrConfidence) {
        let confidence = ocrConfidence;
        if (!this.isValid(detectedText)) {
            confidence *= 0.5;
        }
        if (/^[A-Z]{4}[0-9]{2}$|^[A-Z]{2}[0-9]{3}[A-Z]$/.test(detectedText)) {
            confidence *= 1.1;
        }
        const ambiguousChars = detectedText.match(/[0O1I]/g);
        if (ambiguousChars) {
            confidence *= Math.pow(0.9, ambiguousChars.length);
        }
        return Math.min(100, Math.max(0, confidence));
    }
}

/**
 * Gestor de performance y analytics
 */
class PerformanceTracker {
    static metrics = {
        cameraStartTime: 0,
        ocrProcessingTimes: [],
        detectionAccuracy: [],
        batteryImpact: []
    };

    static startCameraTimer() {
        this.metrics.cameraStartTime = performance.now();
    }

    static endCameraTimer() {
        const duration = performance.now() - this.metrics.cameraStartTime;
        console.log(`Cámara iniciada en ${duration.toFixed(2)}ms`);
        return duration;
    }

    static trackOCRPerformance(startTime, endTime, success) {
        const duration = endTime - startTime;
        this.metrics.ocrProcessingTimes.push(duration);
        this.metrics.detectionAccuracy.push(success ? 1 : 0);
        if (this.metrics.ocrProcessingTimes.length > 10) {
            this.metrics.ocrProcessingTimes.shift();
            this.metrics.detectionAccuracy.shift();
        }
    }

    static getAverageOCRTime() {
        const times = this.metrics.ocrProcessingTimes;
        return times.length > 0 ? 
            times.reduce((a, b) => a + b, 0) / times.length : 0;
    }

    static getAccuracyRate() {
        const accuracy = this.metrics.detectionAccuracy;
        return accuracy.length > 0 ? 
            accuracy.reduce((a, b) => a + b, 0) / accuracy.length * 100 : 0;
    }

    static async trackBatteryImpact() {
        try {
            if ('getBattery' in navigator) {
                const battery = await navigator.getBattery();
                this.metrics.batteryImpact.push({
                    level: battery.level,
                    charging: battery.charging,
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.log('Battery API no disponible');
        }
    }
}

/**
 * Gestor de configuración de usuario
 */
class UserSettings {
    static defaults = {
        autoScanInterval: 2000,
        ocrLanguage: 'spa',
        cameraResolution: 'hd',
        vibrationEnabled: true,
        soundEnabled: false,
        saveHistory: true,
        maxHistoryItems: 50
    };

    static load() {
        try {
            const stored = localStorage.getItem('plateDetectorSettings');
            return stored ? { ...this.defaults, ...JSON.parse(stored) } : this.defaults;
        } catch {
            return this.defaults;
        }
    }

    static save(settings) {
        try {
            localStorage.setItem('plateDetectorSettings', JSON.stringify(settings));
            return true;
        } catch {
            return false;
        }
    }

    static reset() {
        try {
            localStorage.removeItem('plateDetectorSettings');
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Gestor de historial de detecciones
 */
class DetectionHistory {
    static maxItems = 50;

    static add(plateText, confidence, timestamp = Date.now()) {
        try {
            const history = this.getAll();
            const newEntry = {
                id: Date.now().toString(),
                plate: plateText,
                confidence,
                timestamp,
                consulted: false
            };
            history.unshift(newEntry);
            if (history.length > this.maxItems) {
                history.splice(this.maxItems);
            }
            localStorage.setItem('plateDetectorHistory', JSON.stringify(history));
            return newEntry;
        } catch {
            return null;
        }
    }

    static getAll() {
        try {
            const stored = localStorage.getItem('plateDetectorHistory');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }

    static markAsConsulted(id) {
        try {
            const history = this.getAll();
            const entry = history.find(item => item.id === id);
            if (entry) {
                entry.consulted = true;
                localStorage.setItem('plateDetectorHistory', JSON.stringify(history));
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    static clear() {
        try {
            localStorage.removeItem('plateDetectorHistory');
            return true;
        } catch {
            return false;
        }
    }

    static export() {
        const history = this.getAll();
        const dataStr = JSON.stringify(history, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `historial-patentes-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
    }
}

/**
 * Utilidades de cámara avanzadas
 */
class CameraUtils {
    static async getOptimalConstraints() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            const backCamera = videoDevices.find(device => 
                device.label.toLowerCase().includes('back') ||
                device.label.toLowerCase().includes('rear') ||
                device.label.toLowerCase().includes('environment')
            );

            return {
                video: {
                    deviceId: backCamera ? { exact: backCamera.deviceId } : undefined,
                    facingMode: backCamera ? undefined : 'environment',
                    width: { ideal: 1920, min: 1280 },
                    height: { ideal: 1080, min: 720 },
                    aspectRatio: { ideal: 16/9 },
                    frameRate: { ideal: 30, min: 15 }
                }
            };
        } catch (error) {
            ErrorLogger.error('Error al obtener dispositivos de cámara', error);
            return {
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };
        }
    }
    
    static async switchCamera(currentStream) {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            if (videoDevices.length < 2) {
                throw new Error('Solo hay una cámara disponible');
            }
            const currentTrack = currentStream.getVideoTracks()[0];
            const currentDeviceId = currentTrack.getSettings().deviceId;
            const currentIndex = videoDevices.findIndex(device => device.deviceId === currentDeviceId);
            const nextIndex = (currentIndex + 1) % videoDevices.length;
            const nextDevice = videoDevices[nextIndex];
            currentStream.getTracks().forEach(track => track.stop());
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: { exact: nextDevice.deviceId },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            return newStream;
        } catch (error) {
            ErrorLogger.error('Error al cambiar cámara', error);
            throw new Error(`Error al cambiar cámara: ${error.message}`);
        }
    }

    static captureHighQualityFrame(video, targetWidth = 1920) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
        const aspectRatio = video.videoWidth / video.videoHeight;
        canvas.width = targetWidth;
        canvas.height = targetWidth / aspectRatio;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas;
    }
}

/**
 * Utilidades de vibración y feedback háptico
 */
class HapticFeedback {
    static isSupported() {
        return 'vibrate' in navigator;
    }

    static success() {
        if (this.isSupported()) {
            navigator.vibrate([100, 50, 100]);
        }
    }

    static error() {
        if (this.isSupported()) {
            navigator.vibrate([200, 100, 200, 100, 200]);
        }
    }

    static capture() {
        if (this.isSupported()) {
            navigator.vibrate(50);
        }
    }

    static scanning() {
        if (this.isSupported()) {
            navigator.vibrate([100, 50, 100, 50, 100]);
        }
    }
}

/**
 * Utilidades de sonido
 */
class SoundFeedback {
    static sounds = {
        capture: null,
        success: null,
        error: null
    };

    static init() {
        if ('AudioContext' in window || 'webkitAudioContext' in window) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            this.createSounds();
        }
    }

    static createSounds() {
        this.sounds.capture = () => this.playTone(1000, 50);
        this.sounds.success = () => this.playTone(800, 200, 'sine');
        this.sounds.error = () => this.playTone(300, 500, 'square');
    }

    static playTone(frequency, duration, type = 'sine') {
        if (!this.audioContext) return;
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gainNode.gain.value = 0.1;
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + duration / 1000);
    }

    static capture() {
        this.play('capture');
    }

    static success() {
        this.play('success');
    }

    static error() {
        this.play('error');
    }

    static play(soundName) {
        const settings = UserSettings.load();
        if (settings.soundEnabled && this.sounds[soundName]) {
            this.sounds[soundName]();
        }
    }
}

/**
 * Utilidades de conectividad y sincronización
 */
class ConnectivityManager {
    static isOnline() {
        return navigator.onLine;
    }
    
    static addConnectivityListeners(onOnline, onOffline) {
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }
    
    static async testConnection(url = 'https://www.google.com', timeout = 5000) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            const response = await fetch(url, {
                method: 'HEAD',
                mode: 'no-cors',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return true;
        } catch {
            return false;
        }
    }
        
    static getConnectionInfo() {
        if ('connection' in navigator) {
            const conn = navigator.connection;
            return {
                effectiveType: conn.effectiveType,
                downlink: conn.downlink,
                rtt: conn.rtt,
                saveData: conn.saveData
            };
        }
        return null;
    }
}

/**
 * Utilidades de localización y idioma
 */
class LocalizationManager {
    static strings = {
        es: {
            title: '🚗 Detector de Patentes',
            instructions: 'Apunta la cámara hacia la placa del vehículo',
            cameraStart: 'Iniciar Cámara',
            cameraStop: 'Detener Cámara',
            capture: 'Capturar',
            autoScan: 'Escaneo Automático',
            stopScan: 'Detener Escaneo',
            consulting: 'Consultar en AutoSeguro',
            plateDetected: 'Placa Detectada',
            confidence: 'Confianza',
            scanning: 'Escaneando...',
            processing: 'Procesando...',
            success: '¡Placa detectada correctamente!',
            error: 'No se detectó una placa válida',
            cameraError: 'Error al acceder a la cámara',
            positionPlate: 'Posiciona la placa aquí',
            noConnection: 'Sin conexión',
            offline: 'Modo offline'
        },
        en: {
            title: '🚗 License Plate Detector',
            instructions: 'Point the camera at the vehicle’s license plate',
            cameraStart: 'Start Camera',
            cameraStop: 'Stop Camera',
            capture: 'Capture',
            autoScan: 'Auto Scan',
            stopScan: 'Stop Scan',
            consulting: 'Check AutoSeguro',
            plateDetected: 'Plate Detected',
            confidence: 'Confidence',
            scanning: 'Scanning...',
            processing: 'Processing...',
            success: 'Plate detected successfully!',
            error: 'No valid plate detected',
            cameraError: 'Camera access error',
            positionPlate: 'Position plate here',
            noConnection: 'No connection',
            offline: 'Offline mode'
        }
    };

    static currentLanguage = 'es';

    static setLanguage(lang) {
        if (this.strings[lang]) {
            this.currentLanguage = lang;
            this.updateUI();
            localStorage.setItem('userLanguage', lang);
        }
    }

    static getString(key) {
        return this.strings[this.currentLanguage][key] || key;
    }

    static updateUI() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (el.placeholder) {
                el.placeholder = this.getString(key);
            } else {
                el.textContent = this.getString(key);
            }
        });
    }

    static detectLanguage() {
        const savedLang = localStorage.getItem('userLanguage');
        if (savedLang) return savedLang;
        const browserLang = navigator.language.split('-')[0];
        if (this.strings[browserLang]) return browserLang;
        return 'es';
    }
}

/**
 * Gestor de errores y logging
 */
class ErrorLogger {
    static logs = [];
    static maxLogs = 100;

    static log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        this.logs.unshift(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }
        console[level](message, data);
        try {
            localStorage.setItem('plateDetectorLogs', JSON.stringify(this.logs.slice(0, 20)));
        } catch {
            // Ignorar errores de storage
        }
    }

    static error(message, error = null) {
        this.log('error', message, error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
        } : null);
    }

    static warn(message, data = null) {
        this.log('warn', message, data);
    }

    static info(message, data = null) {
        this.log('info', message, data);
    }

    static getLogs() {
        return [...this.logs];
    }

    static clearLogs() {
        this.logs = [];
        try {
            localStorage.removeItem('plateDetectorLogs');
        } catch {
            // Ignorar errores
        }
    }

    static exportLogs() {
        const logsStr = JSON.stringify(this.logs, null, 2);
        const blob = new Blob([logsStr], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `plate-detector-logs-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
    }
}

// Inicializar utilidades cuando se carga el DOM
document.addEventListener('DOMContentLoaded', () => {
    SoundFeedback.init();
    const detectedLang = LocalizationManager.detectLanguage();
    LocalizationManager.setLanguage(detectedLang);
    window.addEventListener('error', (event) => {
        ErrorLogger.error('Global error', event.error);
    });
    window.addEventListener('unhandledrejection', (event) => {
        ErrorLogger.error('Unhandled promise rejection', event.reason);
    });
});

// Exportar todas las clases para uso global
if (typeof window !== 'undefined') {
    window.IconGenerator = IconGenerator;
    window.OCREnhancer = OCREnhancer;
    window.ChileanPlateValidator = ChileanPlateValidator;
    window.PerformanceTracker = PerformanceTracker;
    window.UserSettings = UserSettings;
    window.DetectionHistory = DetectionHistory;
    window.CameraUtils = CameraUtils;
    window.HapticFeedback = HapticFeedback;
    window.SoundFeedback = SoundFeedback;
    window.ConnectivityManager = ConnectivityManager;
    window.LocalizationManager = LocalizationManager;
    window.ErrorLogger = ErrorLogger;
}