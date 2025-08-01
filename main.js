import { loadOCRModel, recognizePlate, setOCRConfig } from './ocr.js';
import { validatePlateFormat } from './charset.js';

class LicensePlateReader {
  constructor() {
    this.video = null;
    this.result = null;
    this.startButton = null;
    this.cameraContainer = null;
    this.loading = null;
    this.recognitionInterval = null;
    this.stream = null;
    this.isCameraOn = false;
    this.isToggling = false;
    this.plateHistory = [];
    this.recognitionTimeout = 2000; // Default 2 seconds
    this.confidenceThreshold = 0.7; // Default confidence threshold
    this.countryCode = 'CL'; // Default country code

    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.toggleCamera = this.toggleCamera.bind(this);
    this.startCamera = this.startCamera.bind(this);
    this.stopCamera = this.stopCamera.bind(this);
    this.recognizePlate = this.recognizePlate.bind(this);
    this.showCameraHelp = this.showCameraHelp.bind(this);
    this.showSettings = this.showSettings.bind(this);
    this.saveSettings = this.saveSettings.bind(this);
    this.showHistory = this.showHistory.bind(this);
    this.updateConfig = this.updateConfig.bind(this);

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', this.initialize);
    } else {
      setTimeout(this.initialize, 0);
    }
  }

  initialize() {
    console.log('Initializing License Plate Reader...');

    // Get DOM elements
    this.video = document.getElementById('video');
    this.result = document.getElementById('result');
    this.startButton = document.getElementById('startButton');
    this.cameraContainer = document.getElementById('cameraContainer');
    this.loading = document.querySelector('.loading');

    // Create additional UI elements
    this.createUIElements();

    // Load settings from localStorage
    this.loadSettings();

    // Set up event listeners
    this.startButton.addEventListener('click', this.toggleCamera);

    // Initialize OCR model
    this.initOCR();
  }

  createUIElements() {
    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.justifyContent = 'center';
    buttonsContainer.style.gap = '10px';
    buttonsContainer.style.margin = '10px 0';

    // Create settings button
    this.settingsButton = document.createElement('button');
    this.settingsButton.textContent = 'Configuración';
    this.settingsButton.style.backgroundColor = '#4CAF50';
    this.settingsButton.addEventListener('click', this.showSettings);

    // Create history button
    this.historyButton = document.createElement('button');
    this.historyButton.textContent = 'Historial';
    this.historyButton.style.backgroundColor = '#FF9800';
    this.historyButton.addEventListener('click', this.showHistory);

    // Add buttons to container
    buttonsContainer.appendChild(this.settingsButton);
    buttonsContainer.appendChild(this.historyButton);

    // Insert buttons after the start button
    this.startButton.parentNode.insertBefore(buttonsContainer, this.startButton.nextSibling);

    // Create history container (hidden by default)
    this.historyContainer = document.createElement('div');
    this.historyContainer.id = 'historyContainer';
    this.historyContainer.style.display = 'none';
    this.historyContainer.style.marginTop = '20px';
    this.historyContainer.style.padding = '15px';
    this.historyContainer.style.border = '1px solid #ddd';
    this.historyContainer.style.borderRadius = '8px';
    this.historyContainer.style.backgroundColor = '#f9f9f9';

    this.historyTitle = document.createElement('h3');
    this.historyTitle.textContent = 'Historial de Placas';
    this.historyTitle.style.marginTop = '0';
    this.historyTitle.style.textAlign = 'center';

    this.historyList = document.createElement('ul');
    this.historyList.style.listStyleType = 'none';
    this.historyList.style.padding = '0';

    this.historyContainer.appendChild(this.historyTitle);
    this.historyContainer.appendChild(this.historyList);

    // Add history container to the main container
    document.querySelector('.container').appendChild(this.historyContainer);
  }

  loadSettings() {
    const settings = JSON.parse(localStorage.getItem('plateReaderSettings')) || {};
    this.recognitionTimeout = settings.timeout || 2000;
    this.confidenceThreshold = settings.confidence || 0.7;
    this.countryCode = settings.country || 'CL';
    this.updateConfig();
  }

  saveSettings() {
    const settings = {
      timeout: this.recognitionTimeout,
      confidence: this.confidenceThreshold,
      country: this.countryCode
    };
    localStorage.setItem('plateReaderSettings', JSON.stringify(settings));
    this.updateConfig();
  }

  updateConfig() {
    setOCRConfig({
      recognitionInterval: this.recognitionTimeout,
      confidenceThreshold: this.confidenceThreshold,
      countryCode: this.countryCode
    });
  }

  async initOCR() {
    try {
      console.log('Loading OCR model...');
      this.showLoading('Cargando modelo OCR...');
      await loadOCRModel();
      console.log('OCR model loaded successfully');
      this.updateResult('Listo para escanear', 'black');
    } catch (error) {
      console.error('Error initializing OCR:', error);
      this.updateResult('Error al cargar el modelo OCR', 'red');
    } finally {
      this.hideLoading();
    }
  }

  async toggleCamera() {
    if (this.isToggling) return;
    this.isToggling = true;

    try {
      if (this.isCameraOn) {
        await this.stopCamera();
      } else {
        await this.startCamera();
      }
    } catch (error) {
      console.error('Error toggling camera:', error);
      this.handleCameraError(error);
    } finally {
      this.isToggling = false;
    }
  }

  async startCamera() {
    // Evitar múltiples inicios simultáneos
    if (this.isToggling) return;
    this.isToggling = true;

    try {
      this.showLoading('Iniciando cámara...');
      
      // Detener cámara si ya está encendida
      if (this.isCameraOn) {
        await this.stopCamera();
        return;
      }

      // Obtener stream de la cámara con manejo de errores mejorado
      try {
        const constraints = {
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };
        
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        // Intentar con restricciones menos estrictas si falla
        console.warn('No se pudo obtener la cámara con restricciones estrictas, intentando con restricciones más flexibles...');
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      // Configurar elemento de video
      this.video = document.createElement('video');
      this.video.playsInline = true;
      this.video.muted = true;
      this.video.srcObject = this.stream;
      
      // Esperar a que el video esté listo con timeout
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Tiempo de espera agotado al cargar el video'));
        }, 5000);

        this.video.onloadedmetadata = () => {
          clearTimeout(timeout);
          this.video.play().then(resolve).catch(reject);
        };

        this.video.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Error al reproducir el video'));
        };
      });

      // Limpiar contenedor y agregar video
      this.cameraContainer.innerHTML = '';
      this.cameraContainer.appendChild(this.video);

      // Inicializar OCR si no está inicializado
      if (!window.ocrInitialized) {
        try {
          await this.initOCR();
          window.ocrInitialized = true;
        } catch (error) {
          console.error('Error al inicializar OCR:', error);
          throw new Error('No se pudo inicializar el sistema de reconocimiento');
        }
      }

      // Iniciar bucle de reconocimiento
      this.isCameraOn = true;
      this.startButton.textContent = 'Detener Cámara';
      this.updateResult('Escaneando...', 'black');
      
      // Usar requestAnimationFrame con referencia para poder cancelarlo
      const processFrame = async () => {
        if (!this.isCameraOn) return;
        
        try {
          await this.recognizePlate();
        } catch (error) {
          console.error('Error en el reconocimiento:', error);
        }
        
        if (this.isCameraOn) {
          this.animationFrameId = requestAnimationFrame(processFrame);
        }
      };
      
      this.animationFrameId = requestAnimationFrame(processFrame);
    } catch (error) {
      console.error('Error en startCamera:', error);
      this.handleCameraError(error);
    } finally {
      this.isToggling = false;
      this.hideLoading();
    }
  }

  async stopCamera() {
    console.log('Stopping camera...');
    
    // Evitar múltiples detenciones simultáneas
    if (this.isToggling) return;
    this.isToggling = true;

    try {
      // Detener el bucle de reconocimiento
      this.isCameraOn = false;
      
      // Cancelar el frame animation
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      // Limpiar intervalos
      if (this.recognitionInterval) {
        clearInterval(this.recognitionInterval);
        this.recognitionInterval = null;
      }

      // Detener los tracks de la cámara
      if (this.stream) {
        this.stream.getTracks().forEach(track => {
          track.stop();
          this.stream.removeTrack(track);
        });
        this.stream = null;
      }

      // Limpiar el elemento de video
      if (this.video) {
        this.video.pause();
        this.video.srcObject = null;
        if (this.video.parentNode === this.cameraContainer) {
          this.cameraContainer.removeChild(this.video);
        }
        this.video = null;
      }

      // Actualizar la interfaz de usuario
      if (this.startButton) {
        this.startButton.textContent = 'Iniciar Cámara';
      }
      
      this.updateResult('Cámara detenida', 'black');
      
    } catch (error) {
      console.error('Error al detener la cámara:', error);
      this.updateResult('Error al detener la cámara', 'red');
    } finally {
      this.isToggling = false;
      this.hideLoading();
    }
  }

  async recognizePlate() {
    if (!this.video || this.video.readyState < 2) {
      console.log('Video not ready for recognition, readyState:', this.video ? this.video.readyState : 'no video');
      return;
    }

    try {
      const plate = await recognizePlate(this.video);
      if (plate && plate.trim() !== '') {
        console.log('Recognized plate:', plate);
        
        // Add to history if not already present
        if (!this.plateHistory.includes(plate)) {
          this.plateHistory.unshift(plate);
          if (this.plateHistory.length > 10) {
            this.plateHistory.pop();
          }
          this.updateHistoryDisplay();
        }
        
        const isValid = validatePlateFormat(plate, this.countryCode);
        const color = isValid ? 'green' : 'orange';
        this.updateResult(`Placa detectada: ${plate}`, color);
      } else {
        this.updateResult('Escaneando...', 'black');
      }
    } catch (error) {
      console.error('Error recognizing plate:', error);
      this.updateResult('Error al reconocer la placa', 'red');
    }
  }

  updateHistoryDisplay() {
    this.historyList.innerHTML = '';
    this.plateHistory.forEach(plate => {
      const li = document.createElement('li');
      li.textContent = plate;
      li.style.padding = '8px';
      li.style.borderBottom = '1px solid #eee';
      li.style.textAlign = 'center';
      li.style.cursor = 'pointer';
      
      li.addEventListener('click', () => {
        this.updateResult(`Placa seleccionada: ${plate}`, 'blue');
      });
      
      this.historyList.appendChild(li);
    });
  }

  showHistory() {
    if (this.historyContainer.style.display === 'none') {
      this.historyContainer.style.display = 'block';
      this.historyButton.textContent = 'Ocultar Historial';
      this.updateHistoryDisplay();
    } else {
      this.historyContainer.style.display = 'none';
      this.historyButton.textContent = 'Historial';
    }
  }

  showSettings() {
    const settingsHtml = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;">
        <div style="background: white; padding: 20px; border-radius: 8px; max-width: 500px; width: 90%;">
          <h3 style="margin-top: 0; text-align: center;">Configuración</h3>
          
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px;">Intervalo de reconocimiento (ms):</label>
            <input type="number" id="timeoutSetting" value="${this.recognitionTimeout}" min="500" max="5000" step="100" style="width: 100%; padding: 8px; box-sizing: border-box;">
          </div>
          
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px;">Umbral de confianza (0-1):</label>
            <input type="number" id="confidenceSetting" value="${this.confidenceThreshold}" min="0.1" max="1" step="0.1" style="width: 100%; padding: 8px; box-sizing: border-box;">
          </div>
          
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px;">Formato de placa:</label>
            <select id="countrySetting" style="width: 100%; padding: 8px; box-sizing: border-box;">
              <option value="CL" ${this.countryCode === 'CL' ? 'selected' : ''}>Chile (AA 12 34)</option>
              <option value="AR" ${this.countryCode === 'AR' ? 'selected' : ''}>Argentina (ABC 123)</option>
              <option value="US" ${this.countryCode === 'US' ? 'selected' : ''}>Estados Unidos</option>
              <option value="EU" ${this.countryCode === 'EU' ? 'selected' : ''}>Europa</option>
              <option value="MX" ${this.countryCode === 'MX' ? 'selected' : ''}>México</option>
              <option value="BR" ${this.countryCode === 'BR' ? 'selected' : ''}>Brasil</option>
            </select>
          </div>
          
          <div style="display: flex; justify-content: space-between; margin-top: 20px;">
            <button id="saveSettings" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Guardar</button>
            <button id="cancelSettings" style="padding: 10px 20px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancelar</button>
          </div>
        </div>
      </div>
    `;
    
    const settingsOverlay = document.createElement('div');
    settingsOverlay.innerHTML = settingsHtml;
    document.body.appendChild(settingsOverlay);
    
    const saveBtn = document.getElementById('saveSettings');
    const cancelBtn = document.getElementById('cancelSettings');
    
    saveBtn.addEventListener('click', () => {
      this.recognitionTimeout = parseInt(document.getElementById('timeoutSetting').value) || 2000;
      this.confidenceThreshold = parseFloat(document.getElementById('confidenceSetting').value) || 0.7;
      this.countryCode = document.getElementById('countrySetting').value || 'CL';
      this.saveSettings();
      document.body.removeChild(settingsOverlay);
    });
    
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(settingsOverlay);
    });
  }

  // Helper methods
  showLoading(message) {
    if (this.loading) {
      this.loading.style.display = 'block';
      if (this.loading.querySelector('p')) {
        this.loading.querySelector('p').textContent = message;
      }
    }
    if (this.result) {
      this.result.textContent = message;
      this.result.style.color = 'black';
    }
  }

  hideLoading() {
    if (this.loading) this.loading.style.display = 'none';
  }

  updateResult(message, color = 'black') {
    if (!this.result) return;
    this.result.textContent = message;
    this.result.style.color = color;
  }

  handleCameraError(error) {
    let message = 'Error al acceder a la cámara';
    let showHelp = false;

    if (error.name === 'NotAllowedError') {
      message = 'Permiso de cámara denegado. Por favor, permite el acceso a la cámara.';
      showHelp = true;
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      message = 'No se encontró ninguna cámara en el dispositivo.';
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      message = 'No se pudo acceder a la cámara. Puede que ya esté en uso por otra aplicación.';
    } else {
      message = `Error: ${error.message || 'Error desconocido al acceder a la cámara'}`;
    }

    this.updateResult(message, 'red');
    if (showHelp) this.showCameraHelp();
    this.startButton.textContent = 'Reintentar';
  }

  showCameraHelp() {
    if (!this.result) return;

    const helpText = document.createElement('div');
    helpText.style.marginTop = '20px';
    helpText.style.padding = '15px';
    helpText.style.border = '1px solid #ddd';
    helpText.style.borderRadius = '8px';
    helpText.style.backgroundColor = '#f9f9f9';

    helpText.innerHTML = `
      <h3>Cómo habilitar la cámara:</h3>
      <ol>
        <li>Haz clic en el ícono de candado o información en la barra de direcciones</li>
        <li>Busca la opción "Configuración de sitios" o "Permisos de la cámara"</li>
        <li>Cambia el permiso a "Permitir"</li>
        <li>Recarga la página</li>
      </ol>
      <button style="margin-top: 10px; padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;">Cerrar</button>
    `;

    helpText.querySelector('button').onclick = () => helpText.remove();
    const existingHelp = this.result.querySelector('.camera-help-text');
    if (existingHelp) existingHelp.remove();

    helpText.className = 'camera-help-text';
    this.result.appendChild(helpText);
  }
}

// Initialize the app
export { LicensePlateReader as default };