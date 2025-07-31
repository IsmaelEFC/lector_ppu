import { loadOCRModel, recognizePlate } from './ocr.js';

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
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.toggleCamera = this.toggleCamera.bind(this);
    this.startCamera = this.startCamera.bind(this);
    this.stopCamera = this.stopCamera.bind(this);
    this.recognizePlate = this.recognizePlate.bind(this);
    this.showCameraHelp = this.showCameraHelp.bind(this);
    
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
    
    // Log initialization
    console.log('DOM elements:', {
      video: !!this.video,
      result: !!this.result,
      startButton: !!this.startButton,
      cameraContainer: !!this.cameraContainer,
      loading: !!this.loading
    });
    
    // Initialize event listeners
    if (this.startButton) {
      this.startButton.addEventListener('click', this.toggleCamera);
    }
    
    // Initialize OCR model
    this.initOCR();
  }
  
  async initOCR() {
    try {
      console.log('Loading OCR model...');
      if (this.loading) this.loading.style.display = 'block';
      if (this.result) this.result.textContent = 'Cargando modelo OCR...';
      
      await loadOCRModel();
      console.log('OCR model loaded successfully');
      
      if (this.result) this.result.textContent = 'Listo para escanear';
    } catch (error) {
      console.error('Error initializing OCR:', error);
      if (this.result) {
        this.result.textContent = 'Error al cargar el modelo OCR';
        this.result.style.color = 'red';
      }
    } finally {
      if (this.loading) this.loading.style.display = 'none';
    }
  }
  
  async toggleCamera() {
    try {
      if (this.isCameraOn) {
        await this.stopCamera();
      } else {
        await this.startCamera();
      }
    } catch (error) {
      console.error('Error toggling camera:', error);
      this.updateResult('Error al alternar la cámara', 'red');
    }
  }
  
  async startCamera() {
    if (!this.video) {
      this.video = document.getElementById('video');
      if (!this.video) {
        throw new Error('No se pudo encontrar el elemento de video');
      }
    }
    
    console.log('Starting camera...');
    this.showLoading('Solicitando acceso a la cámara...');
    
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      
      this.video.srcObject = this.stream;
      this.video.onloadedmetadata = () => {
        this.video.play().catch(error => {
          console.error('Error playing video:', error);
          throw new Error('No se pudo reproducir el video');
        });
      };
      
      if (this.cameraContainer) this.cameraContainer.style.display = 'block';
      if (this.startButton) this.startButton.textContent = 'Detener Cámara';
      
      this.recognitionInterval = setInterval(() => this.recognizePlate(), 2000);
      this.isCameraOn = true;
      
      this.updateResult('Cámara activa. Escaneando...', 'black');
      
    } catch (error) {
      console.error('Camera error:', error);
      this.handleCameraError(error);
      throw error;
    } finally {
      if (this.loading) this.loading.style.display = 'none';
    }
  }
  
  async stopCamera() {
    console.log('Stopping camera...');
    
    if (this.recognitionInterval) {
      clearInterval(this.recognitionInterval);
      this.recognitionInterval = null;
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.video) {
      this.video.srcObject = null;
    }
    
    if (this.startButton) this.startButton.textContent = 'Iniciar Cámara';
    this.updateResult('Cámara detenida', 'black');
    this.isCameraOn = false;
  }
  
  async recognizePlate() {
    if (!this.video || this.video.readyState < 2) return;
    
    try {
      const plate = await recognizePlate(this.video);
      if (plate) {
        console.log('Recognized plate:', plate);
        this.updateResult(`Placa detectada: ${plate}`, 'green');
      }
    } catch (error) {
      console.error('Error recognizing plate:', error);
      this.updateResult('Error al reconocer la placa', 'red');
    }
  }
  
  // Helper methods
  showLoading(message) {
    if (this.loading) this.loading.style.display = 'block';
    if (this.result) {
      this.result.textContent = message;
      this.result.style.color = 'black';
    }
  }
  
  updateResult(message, color = 'black') {
    if (!this.result) return;
    this.result.textContent = message;
    this.result.style.color = color;
  }
  
  handleCameraError(error) {
    console.error('Camera error:', error);
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
    
    if (this.startButton) this.startButton.textContent = 'Reintentar';
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
    
    // Add close button functionality
    const closeButton = helpText.querySelector('button');
    closeButton.onclick = () => helpText.remove();
    
    // Remove any existing help text
    const existingHelp = this.result.querySelector('.camera-help-text');
    if (existingHelp) existingHelp.remove();
    
    helpText.className = 'camera-help-text';
    this.result.appendChild(helpText);
  }
}

// Initialize the app
const app = new LicensePlateReader();
