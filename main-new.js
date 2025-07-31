import { loadOCRModel, recognizePlate } from './ocr.js';

class LicensePlateReader {
  constructor() {
    this.video = document.getElementById('video');
    this.result = document.getElementById('result');
    this.startButton = document.getElementById('startButton');
    this.cameraContainer = document.getElementById('cameraContainer');
    this.loading = document.querySelector('.loading');
    this.recognitionInterval = null;
    this.stream = null;
    this.isCameraOn = false;
    
    // Bind methods
    this.toggleCamera = this.toggleCamera.bind(this);
    this.startCamera = this.startCamera.bind(this);
    this.stopCamera = this.stopCamera.bind(this);
    this.initOCR = this.initOCR.bind(this);
    
    // Initialize
    this.initOCR();
    if (this.startButton) this.startButton.addEventListener('click', this.toggleCamera);
  }

  async initOCR() {
    try {
      this.showLoading('Cargando modelo OCR...');
      await loadOCRModel();
      this.updateResult('Listo para escanear', 'black');
    } catch (error) {
      console.error('Error initializing OCR:', error);
      this.updateResult('Error al cargar el modelo OCR', 'red');
    } finally {
      this.hideLoading();
    }
  }
  
  async toggleCamera() {
    this.isCameraOn ? await this.stopCamera() : await this.startCamera();
  }
  
  async startCamera() {
    try {
      this.showLoading('Solicitando acceso a la cámara...');
      
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      
      this.video.srcObject = this.stream;
      this.cameraContainer.style.display = 'block';
      this.startButton.textContent = 'Detener Cámara';
      
      await new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play().then(resolve).catch(e => {
            console.error('Error starting video:', e);
            throw new Error('No se pudo iniciar el video');
          });
        };
      });
      
      this.recognitionInterval = setInterval(() => this.recognizePlate(), 2000);
      this.isCameraOn = true;
      this.updateResult('Cámara activa. Escaneando...', 'black');
      
    } catch (error) {
      console.error('Camera error:', error);
      this.handleCameraError(error);
    } finally {
      this.hideLoading();
    }
  }
  
  async stopCamera() {
    if (this.recognitionInterval) clearInterval(this.recognitionInterval);
    if (this.stream) this.stream.getTracks().forEach(track => track.stop());
    if (this.video) this.video.srcObject = null;
    
    this.recognitionInterval = null;
    this.stream = null;
    this.isCameraOn = false;
    
    if (this.startButton) this.startButton.textContent = 'Iniciar Cámara';
    this.updateResult('Cámara detenida', 'black');
  }
  
  async recognizePlate() {
    if (this.video.readyState < 2) return;
    
    try {
      const plate = await recognizePlate(this.video);
      if (plate) this.updateResult(`Placa detectada: ${plate}`, 'green');
    } catch (error) {
      console.error('Recognition error:', error);
      this.updateResult('Error al reconocer la placa', 'red');
    }
  }
  
  // Helper methods
  showLoading(message) {
    if (this.loading) this.loading.style.display = 'block';
    if (this.result) this.result.textContent = message;
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
      message = 'Permiso de cámara denegado';
      showHelp = true;
    } else if (error.name === 'NotFoundError') {
      message = 'No se encontró ninguna cámara';
    }
    
    this.updateResult(message, 'red');
    if (showHelp) this.showCameraHelp();
  }
  
  showCameraHelp() {
    if (!this.result) return;
    
    const helpText = document.createElement('div');
    helpText.innerHTML = `
      <h3>Cómo habilitar la cámara:</h3>
      <ol>
        <li>Haz clic en el ícono de candado en la barra de direcciones</li>
        <li>Busca "Permisos de cámara"</li>
        <li>Cambia a "Permitir"</li>
        <li>Recarga la página</li>
      </ol>
      <button>Entendido</button>
    `;
    
    helpText.querySelector('button').onclick = () => helpText.remove();
    this.result.appendChild(helpText);
  }
}

// Initialize the app when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new LicensePlateReader());
} else {
  new LicensePlateReader();
}
