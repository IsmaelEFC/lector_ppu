// main.js - Aplicación principal del Detector de Patentes Chilenas

class PlateDetectorApp {
    constructor() {
        // Initialize properties
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.stream = null;
        this.scanning = false;
        this.scanInterval = null;
        this.worker = null;
        this.lastDetection = null;
        this.elements = {};
        this.eventListeners = [];
        this.activeTimers = new Set();
        
        // Initialize the app
        this.init().catch(error => {
            console.error('Failed to initialize PlateDetectorApp:', error);
            this.showError('Error al inicializar la aplicación');
        });
    }

    async init() {
        try {
            this.initElements();
            this.setupEventListeners();
            await this.initTesseract();
            this.loadSettings();
            ErrorLogger.info('Aplicación inicializada correctamente');
        } catch (error) {
            ErrorLogger.error('Error al inicializar la aplicación', error);
            this.showError('Error al inicializar la aplicación');
        }
    }

    initElements() {
        // Required elements
        this.video = this.getRequiredElement('video');
        this.canvas = this.getRequiredElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        if (!this.ctx) {
            throw new Error('No se pudo obtener el contexto 2D del canvas');
        }
        
        // UI Elements
        const elementIds = [
            'startCamera', 'capture', 'autoScan', 'switchCamera',
            'consult', 'history', 'settings', 'plateText',
            'confidenceValue', 'confidenceFill', 'loading', 'error',
            'overlay', 'historyPanel', 'historyList', 'clearHistory',
            'exportHistory', 'closeHistory'
        ];
        
        this.elements = elementIds.reduce((acc, id) => {
            const element = document.getElementById(id);
            if (!element) {
                console.warn(`Elemento no encontrado: ${id}`);
            }
            acc[id] = element;
            return acc;
        }, {});
    }
    
    getRequiredElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            throw new Error(`Elemento requerido no encontrado: ${id}`);
        }
        return element;
    }

    setupEventListeners() {
        // Camera controls
        this.elements.startCamera.addEventListener('click', () => this.toggleCamera());
        this.elements.capture.addEventListener('click', () => this.captureAndProcess());
        this.elements.autoScan.addEventListener('click', () => this.toggleAutoScan());
        this.elements.switchCamera.addEventListener('click', () => this.switchCamera());
        
        // Actions
        this.elements.consult.addEventListener('click', () => this.consultAutoSeguro());
        this.elements.history.addEventListener('click', () => this.toggleHistory());
        
        // History controls
        this.elements.clearHistory.addEventListener('click', () => this.clearHistory());
        this.elements.exportHistory.addEventListener('click', () => this.exportHistory());
        this.elements.closeHistory.addEventListener('click', () => this.toggleHistory());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.target.matches('input, textarea')) {
                e.preventDefault();
                if (this.stream) {
                    this.captureAndProcess();
                }
            }
        });

        // Video events
        this.video.addEventListener('loadedmetadata', () => {
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
        });
    }

    async initTesseract() {
        try {
            this.showLoading('Inicializando OCR...');
            
            // Initialize Tesseract worker
            this.worker = await Tesseract.createWorker({
                logger: m => {
                    if (m.status === 'recognizing text') {
                        this.showLoading(`OCR: ${(m.progress * 100).toFixed(0)}%`);
                    }
                }
            });

            await this.worker.loadLanguage('eng');
            await this.worker.initialize('eng');
            
            // Configure for license plate recognition
            await this.worker.setParameters({
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
                tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
            });

            this.hideLoading();
            ErrorLogger.info('Tesseract inicializado correctamente');
        } catch (error) {
            this.hideLoading();
            ErrorLogger.error('Error al inicializar Tesseract', error);
            throw new Error('No se pudo inicializar el motor OCR');
        }
    }

    loadSettings() {
        this.settings = UserSettings.load();
        LocalizationManager.setLanguage(this.settings.language || 'es');
    }

    async toggleCamera() {
        try {
            if (this.stream) {
                await this.stopCamera();
            } else {
                await this.startCamera();
            }
        } catch (error) {
            ErrorLogger.error('Error al cambiar estado de cámara', error);
            this.showError('Error al acceder a la cámara');
        }
    }

    async startCamera() {
        try {
            this.showLoading('Iniciando cámara...');
            PerformanceTracker.startCameraTimer();

            const constraints = await CameraUtils.getOptimalConstraints();
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            this.video.srcObject = this.stream;
            this.video.classList.add('active');
            this.canvas.classList.remove('active');

            // Update UI
            this.elements.startCamera.textContent = '⏹️ Detener Cámara';
            this.elements.startCamera.setAttribute('data-i18n', 'cameraStop');
            this.elements.capture.disabled = false;
            this.elements.autoScan.disabled = false;
            this.elements.switchCamera.disabled = false;

            const duration = PerformanceTracker.endCameraTimer();
            this.hideLoading();
            
            ErrorLogger.info(`Cámara iniciada en ${duration.toFixed(2)}ms`);
            this.showToast('Cámara iniciada correctamente');

        } catch (error) {
            this.hideLoading();
            ErrorLogger.error('Error al iniciar cámara', error);
            
            let errorMessage = 'Error al acceder a la cámara';
            if (error.name === 'NotPermissionError') {
                errorMessage = 'Permisos de cámara denegados';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'No se encontró cámara';
            }
            
            this.showError(errorMessage);
        }
    }

    async stopCamera() {
        try {
            if (this.scanning) {
                this.stopAutoScan();
            }

            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }

            this.video.srcObject = null;
            this.video.classList.remove('active');
            
            // Reset UI
            this.elements.startCamera.textContent = '📷 Iniciar Cámara';
            this.elements.startCamera.setAttribute('data-i18n', 'cameraStart');
            this.elements.capture.disabled = true;
            this.elements.autoScan.disabled = true;
            this.elements.switchCamera.disabled = true;
            
            this.elements.overlay.classList.remove('scanning');

            ErrorLogger.info('Cámara detenida');
            
        } catch (error) {
            ErrorLogger.error('Error al detener cámara', error);
        }
    }

    async switchCamera() {
        try {
            if (!this.stream) return;
            
            this.showLoading('Cambiando cámara...');
            const newStream = await CameraUtils.switchCamera(this.stream);
            
            this.stream = newStream;
            this.video.srcObject = newStream;
            
            this.hideLoading();
            this.showToast('Cámara cambiada');
            
        } catch (error) {
            this.hideLoading();
            ErrorLogger.error('Error al cambiar cámara', error);
            this.showError(error.message);
        }
    }

    toggleAutoScan() {
        if (this.scanning) {
            this.stopAutoScan();
        } else {
            this.startAutoScan();
        }
    }

    startAutoScan() {
        if (!this.stream || this.scanning) return;

        this.scanning = true;
        this.elements.autoScan.textContent = '⏹️ Detener Scan';
        this.elements.autoScan.setAttribute('data-i18n', 'stopScan');
        this.elements.overlay.classList.add('scanning');
        
        const interval = this.settings.autoScanInterval || 2000;
        this.scanInterval = setInterval(() => {
            this.captureAndProcess(true);
        }, interval);

        HapticFeedback.scanning();
        ErrorLogger.info('Escaneo automático iniciado');
    }

    stopAutoScan() {
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }

        this.scanning = false;
        this.elements.autoScan.textContent = '🔍 Auto Scan';
        this.elements.autoScan.setAttribute('data-i18n', 'autoScan');
        this.elements.overlay.classList.remove('scanning');
        
        ErrorLogger.info('Escaneo automático detenido');
    }

    async captureAndProcess(isAutoScan = false) {
        // Prevent multiple simultaneous processing
        if (this.isProcessing || !this.stream || !this.worker) {
            return;
        }

        this.isProcessing = true;
        const startTime = performance.now();
        
        try {
            if (!isAutoScan) {
                this.showLoading('Capturando imagen...');
                HapticFeedback.capture();
                SoundFeedback.capture();
            }

            // Throttle processing to prevent UI freezing
            if (isAutoScan && this.lastProcessTime) {
                const timeSinceLastProcess = Date.now() - this.lastProcessTime;
                if (timeSinceLastProcess < 500) { // 500ms minimum between auto-scans
                    this.isProcessing = false;
                    return;
                }
            }

            // Capture high quality frame with error handling
            let canvas;
            try {
                canvas = CameraUtils.captureHighQualityFrame(this.video);
                if (!canvas) {
                    throw new Error('No se pudo capturar el fotograma');
                }
            } catch (error) {
                ErrorLogger.error('Error al capturar fotograma', error);
                if (!isAutoScan) {
                    this.showError('Error al capturar la imagen');
                }
                this.isProcessing = false;
                return;
            }

            this.video.classList.remove('active');

            // Process with OCR
            const result = await this.processImage(canvas);
            const endTime = performance.now();

            if (result.plate && ChileanPlateValidator.isValid(result.plate)) {
                const confidence = ChileanPlateValidator.calculateConfidence(result.plate, result.confidence);
                
                this.displayResult(result.plate, confidence);
                this.lastDetection = { plate: result.plate, confidence };
                
                // Add to history
                DetectionHistory.add(result.plate, confidence);
                
                // Track performance
                PerformanceTracker.trackOCRPerformance(startTime, endTime, true);
                
                // Feedback
                HapticFeedback.success();
                SoundFeedback.success();
                
                if (!isAutoScan) {
                    this.showToast('¡Placa detectada correctamente!');
                }
                
                ErrorLogger.info(`Placa detectada: ${result.plate} (${confidence.toFixed(1)}%)`);
                
            } else {
                PerformanceTracker.trackOCRPerformance(startTime, endTime, false);
                
                if (!isAutoScan) {
                    HapticFeedback.error();
                    SoundFeedback.error();
                    this.showError('No se detectó una placa válida');
                }
            }

            if (!isAutoScan) {
                this.hideLoading();
                // Return to video after 3 seconds
                setTimeout(() => {
                    if (this.stream) {
                        this.canvas.classList.remove('active');
                        this.video.classList.add('active');
                    }
                }, 3000);
            }

        } catch (error) {
            this.hideLoading();
            ErrorLogger.error('Error al procesar imagen', error);
            
            if (!isAutoScan) {
                HapticFeedback.error();
                SoundFeedback.error();
                this.showError('Error al procesar la imagen');
            }
        }
    }

    async processImage(canvas) {
        try {
            // Preprocess image for better OCR
            const preprocessedCanvas = OCREnhancer.preprocessImage(
                canvas, 
                canvas.getContext('2d'), 
                this.video
            );

            // Extract image data
            const imageData = preprocessedCanvas.getContext('2d').getImageData(
                0, 0, preprocessedCanvas.width, preprocessedCanvas.height
            );
            
            // Enhance for plates
            const enhancedImageData = OCREnhancer.enhanceForPlates(imageData);

            // Perform OCR
            const { data: { text, confidence } } = await this.worker.recognize(enhancedImageData);
            
            // Clean and validate text
            const cleanText = this.cleanOCRText(text);
            
            return {
                plate: cleanText,
                confidence: confidence,
                originalText: text
            };

        } catch (error) {
            ErrorLogger.error('Error en procesamiento OCR', error);
            throw error;
        }
    }

    cleanOCRText(text) {
        if (!text) return '';
        
        // Remove whitespace and special characters
        let cleaned = text.replace(/[^A-Z0-9]/g, '').toUpperCase();
        
        // Fix common OCR mistakes
        const corrections = {
            '0': 'O', '1': 'I', '5': 'S', '8': 'B',
            'Q': 'O', 'Z': '2', 'G': '6'
        };
        
        // Apply corrections contextually
        cleaned = cleaned.split('').map((char, index) => {
            // Letters are more likely at the beginning
            if (index < 2 && corrections[char] && /[A-Z]/.test(corrections[char])) {
                return corrections[char];
            }
            // Numbers are more likely at the end
            if (index >= 2 && /[0-9]/.test(char)) {
                return char;
            }
            return char;
        }).join('');
        
        return cleaned;
    }

    displayResult(plate, confidence) {
        this.elements.plateText.textContent = plate || '-';
        this.elements.confidenceValue.textContent = confidence ? `${confidence.toFixed(1)}%` : '-%';
        
        // Update confidence bar
        if (confidence) {
            this.elements.confidenceFill.style.width = `${confidence}%`;
        } else {
            this.elements.confidenceFill.style.width = '0%';
        }
        
        // Enable consult button if plate is valid
        this.elements.consult.disabled = !plate || !ChileanPlateValidator.isValid(plate);
    }

    consultAutoSeguro() {
        if (!this.lastDetection || !this.lastDetection.plate) {
            this.showError('No hay placa para consultar');
            return;
        }

        try {
            const plate = this.lastDetection.plate;
            const url = `https://www.autoseguro.gob.cl/consulta.php?placa=${encodeURIComponent(plate)}`;
            
            // Mark as consulted in history
            const history = DetectionHistory.getAll();
            const recent = history.find(item => item.plate === plate);
            if (recent) {
                DetectionHistory.markAsConsulted(recent.id);
            }
            
            // Open in new tab/window
            window.open(url, '_blank', 'noopener,noreferrer');
            
            ErrorLogger.info(`Consultando placa ${plate} en AutoSeguro`);
            this.showToast('Abriendo consulta en AutoSeguro...');
            
        } catch (error) {
            ErrorLogger.error('Error al abrir consulta', error);
            this.showError('Error al abrir la consulta');
        }
    }

    toggleHistory() {
        const panel = this.elements.historyPanel;
        const isVisible = panel.classList.contains('show');
        
        if (isVisible) {
            panel.classList.remove('show');
        } else {
            this.loadHistory();
            panel.classList.add('show');
        }
    }

    loadHistory() {
        const history = DetectionHistory.getAll();
        const listElement = this.elements.historyList;
        
        if (history.length === 0) {
            listElement.innerHTML = '<p style="text-align: center; opacity: 0.7;">No hay detecciones en el historial</p>';
            return;
        }
        
        listElement.innerHTML = history.map(item => `
            <div class="history-item">
                <div>
                    <strong>${item.plate}</strong><br>
                    <small>${new Date(item.timestamp).toLocaleString()}</small><br>
                    <small>Confianza: ${item.confidence.toFixed(1)}%</small>
                    ${item.consulted ? '<small style="color: #00ff88;">✓ Consultado</small>' : ''}
                </div>
                <button onclick="app.consultPlateFromHistory('${item.plate}')" 
                        class="secondary-btn" style="padding: 8px 16px; font-size: 12px;">
                    🔍 Consultar
                </button>
            </div>
        `).join('');
    }

    consultPlateFromHistory(plate) {
        this.lastDetection = { plate };
        this.consultAutoSeguro();
    }

    clearHistory() {
        if (confirm('¿Estás seguro de que quieres limpiar el historial?')) {
            DetectionHistory.clear();
            this.loadHistory();
            this.showToast('Historial limpiado');
        }
    }

    exportHistory() {
        try {
            DetectionHistory.export();
            this.showToast('Historial exportado');
        } catch (error) {
            ErrorLogger.error('Error al exportar historial', error);
            this.showError('Error al exportar historial');
        }
    }

    showLoading(message = 'Procesando...') {
        this.elements.loading.classList.add('active');
        const textElement = this.elements.loading.querySelector('div:last-child');
        if (textElement) {
            textElement.textContent = message;
        }
    }

    hideLoading() {
        this.elements.loading.classList.remove('active');
    }

    showError(message) {
        this.elements.error.textContent = message;
        this.elements.error.classList.add('active');
        
        setTimeout(() => {
            this.elements.error.classList.remove('active');
        }, 5000);
    }

    showToast(message, duration = 3000) {
        if (typeof showToast === 'function') {
            showToast(message, duration);
        } else {
            console.log('Toast:', message);
        }
    }

    // Cleanup on page unload
    cleanup() {
        if (this.worker) {
            this.worker.terminate();
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
        }
    }
}

// Statistics and Performance Monitor
class AppStatistics {
    static startTime = Date.now();
    static sessionsStats = {
        detections: 0,
        consultations: 0,
        errors: 0,
        cameraUsage: 0
    };

    static updateStats(type, value = 1) {
        if (this.sessionsStats[type] !== undefined) {
            this.sessionsStats[type] += value;
        }
        this.saveStats();
    }

    static saveStats() {
        try {
            const totalStats = JSON.parse(localStorage.getItem('appStatistics') || '{}');
            Object.keys(this.sessionsStats).forEach(key => {
                totalStats[key] = (totalStats[key] || 0) + this.sessionsStats[key];
            });
            localStorage.setItem('appStatistics', JSON.stringify(totalStats));
        } catch (error) {
            ErrorLogger.warn('No se pudieron guardar las estadísticas', error);
        }
    }

    static getStats() {
        try {
            return JSON.parse(localStorage.getItem('appStatistics') || '{}');
        } catch {
            return {};
        }
    }
}

// Initialize application
let app;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Check if required APIs are available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera API not supported');
        }

        if (typeof Tesseract === 'undefined') {
            throw new Error('Tesseract.js not loaded');
        }

        // Initialize app
        app = new PlateDetectorApp();
        
        // Setup cleanup
        window.addEventListener('beforeunload', () => {
            app.cleanup();
            AppStatistics.updateStats('sessionDuration', Date.now() - AppStatistics.startTime);
        });

        // Handle visibility changes (battery optimization)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && app.scanning) {
                app.stopAutoScan();
                ErrorLogger.info('Auto-scan paused due to page visibility');
            }
        });

        // Handle orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                if (app.video && app.video.srcObject) {
                    // Recalculate canvas size
                    app.canvas.width = app.video.videoWidth;
                    app.canvas.height = app.video.videoHeight;
                }
            }, 500);
        });

        ErrorLogger.info('Aplicación inicializada correctamente');
        
    } catch (error) {
        ErrorLogger.error('Error crítico en la inicialización', error);
        
        // Show fallback error message
        document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; text-align: center; padding: 20px;">
                <div>
                    <h2>❌ Error de Inicialización</h2>
                    <p>La aplicación no se pudo inicializar correctamente.</p>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #00ff88; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        🔄 Recargar Página
                    </button>
                </div>
            </div>
        `;
    }
});

// Export for debugging
if (typeof window !== 'undefined') {
    window.PlateDetectorApp = PlateDetectorApp;
    window.AppStatistics = AppStatistics;
}