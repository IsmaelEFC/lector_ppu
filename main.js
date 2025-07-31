import { loadOCRModel, recognizePlate } from './ocr.js';

// Define and export the LicensePlateReader class
export default class LicensePlateReader {
  constructor() {
    this.video = null;
    this.result = null;
    this.startButton = null;
    this.cameraContainer = null;
    this.loading = null;
    this.recognitionInterval = null;
    this.stream = null;
    this.isCameraOn = false;
    this.isToggling = false; // Track if camera is currently toggling
    
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
    
    try {
      // Get DOM elements
      console.log('Searching for DOM elements...');
      this.video = document.getElementById('video');
      this.result = document.getElementById('result');
      this.startButton = document.getElementById('startButton');
      this.cameraContainer = document.getElementById('cameraContainer');
      this.loading = document.querySelector('.loading');
      
      // Log initialization
      console.log('DOM elements found:', {
        video: this.video ? 'Found' : 'Not found',
        result: this.result ? 'Found' : 'Not found',
        startButton: this.startButton ? 'Found' : 'Not found',
        cameraContainer: this.cameraContainer ? 'Found' : 'Not found',
        loading: this.loading ? 'Found' : 'Not found'
      });
      
      // Log the entire document structure for debugging
      console.log('Document structure:', document.documentElement.outerHTML);
      
      if (!this.video) {
        console.error('Video element not found in the DOM');
        this.updateResult('Error: No se pudo encontrar el elemento de video', 'red');
        return;
      }
      
      // Set up event listeners
      if (this.startButton) {
        console.log('Setting up start button event listener');
        this.startButton.addEventListener('click', this.toggleCamera);
      } else {
        console.error('Start button not found');
      }
      
    } catch (error) {
      console.error('Error during initialization:', error);
      this.updateResult('Error al inicializar la aplicación', 'red');
    }
    
    // Event listeners are now set up in the constructor
    // The start button click handler is set up in the initialize method
    
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
    // Prevent multiple simultaneous operations
    if (this.isToggling) return;
    this.isToggling = true;
    
    try {
      if (this.isCameraOn) {
        console.log('Stopping camera...');
        await this.stopCamera();
      } else {
        console.log('Starting camera...');
        await this.startCamera();
      }
    } catch (error) {
      console.error('Error toggling camera:', error);
      let errorMessage = 'Error al ' + (this.isCameraOn ? 'detener' : 'iniciar') + ' la cámara';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permiso de cámara denegado. Por favor, permite el acceso a la cámara.';
        this.showCameraHelp();
      } else if (error.message.includes('video')) {
        errorMessage = 'Error: No se pudo acceder al elemento de video.';
      }
      
      this.updateResult(errorMessage, 'red');
      
      // Reset button state on error
      if (this.startButton) {
        this.startButton.textContent = this.isCameraOn ? 'Detener Cámara' : 'Iniciar Cámara';
      }
    } finally {
      this.isToggling = false;
    }
  }
  
  async startCamera() {
    console.log('Starting camera initialization...');
    
    // Show camera status indicator
    const cameraStatus = document.getElementById('cameraStatus');
    if (cameraStatus) {
      cameraStatus.style.display = 'block';
    }
    
    try {
      // Ensure we have all required elements
      if (!this.video) {
        this.video = document.getElementById('video');
        if (!this.video) {
          throw new Error('Video element not found in the DOM');
        }
      }
      // Ensure all required DOM elements are available
      this.video = document.getElementById('video');
      this.result = document.getElementById('result');
      this.startButton = document.getElementById('startButton');
      this.cameraContainer = document.getElementById('cameraContainer');
      this.loading = document.querySelector('.loading');
      
      // Verify all required elements exist
      const missingElements = [];
      if (!this.video) missingElements.push('video');
      if (!this.result) missingElements.push('result');
      if (!this.startButton) missingElements.push('startButton');
      if (!this.cameraContainer) missingElements.push('cameraContainer');
      if (!this.loading) missingElements.push('loading');
      
      if (missingElements.length > 0) {
        const errorMsg = `Error: No se encontraron los siguientes elementos: ${missingElements.join(', ')}`;
        console.error(errorMsg);
        this.updateResult(errorMsg, 'red');
        throw new Error(errorMsg);
      }
      
      // Show loading state
      this.showLoading('Solicitando acceso a la cámara...');
      console.log('All required elements found');
      
      // Ensure camera container is visible
      this.cameraContainer.style.display = 'block';
      console.log('Camera container displayed');
      
      // Reset any existing stream
      if (this.stream) {
        console.log('Stopping existing stream...');
        this.stream.getTracks().forEach(track => {
          console.log(`Stopping track: ${track.kind}`);
          track.stop();
        });
        this.stream = null;
      }
      
      // Set video source to null before requesting new stream
      this.video.srcObject = null;
      
      // Log available media devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log('Available media devices:', devices);
      
      // Request camera access with error handling
      const constraints = {
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      
      console.log('Requesting media with constraints:', constraints);
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (!this.stream) {
        throw new Error('No se pudo obtener acceso a la cámara');
      }
      
      console.log('Media stream obtained:', this.stream);
      
      // Set up video element
      console.log('Setting video source to stream');
      this.video.srcObject = this.stream;
      
      // Add event listeners for debugging
      this.video.onloadedmetadata = () => {
        console.log('Video metadata loaded');
        console.log('Video dimensions:', this.video.videoWidth, 'x', this.video.videoHeight);
      };
      
      this.video.onplay = () => {
        console.log('Video started playing');
      };
      
      this.video.onerror = (error) => {
        console.error('Video error:', error);
      };
      
      // Wait for video to be ready
      console.log('Waiting for video to be ready...');
      await new Promise((resolve, reject) => {
        const onLoaded = () => {
          console.log('Video metadata loaded in promise');
          this.video.play()
            .then(() => {
              console.log('Video play started successfully');
              resolve();
            })
            .catch(err => {
              console.error('Error playing video:', err);
              reject(new Error('No se pudo reproducir el video de la cámara: ' + err.message));
            });
        };
        
        if (this.video.readyState >= 1) { // HAVE_CURRENT_DATA
          console.log('Video already has data, playing directly');
          onLoaded();
        } else {
          console.log('Adding loadedmetadata event listener');
          this.video.addEventListener('loadedmetadata', onLoaded, { once: true });
        }
        
        // Set a timeout in case the video never loads
        setTimeout(() => {
          console.error('Video loading timeout');
          reject(new Error('Tiempo de espera agotado al cargar el video'));
        }, 10000); // Increased timeout to 10 seconds
      });
      
      console.log('Video is playing');
      
      // Start recognition
      if (this.recognitionInterval) {
        clearInterval(this.recognitionInterval);
      }
      
      this.recognitionInterval = setInterval(() => this.recognizePlate(), 2000);
      this.isCameraOn = true;
      
      // Update UI
      if (this.startButton) {
        this.startButton.textContent = 'Detener Cámara';
      }
      
      this.updateResult('Cámara activa. Escaneando...', 'black');
      
    } catch (error) {
      console.error('Error in startCamera:', error);
      
      // Clean up on error
      if (this.stream) {
        this.stream.getTracks().forEach(track => {
          console.log(`Stopping track: ${track.kind}`);
          track.stop();
        });
        this.stream = null;
      }
      
      // Hide camera status on error
      if (cameraStatus) {
        cameraStatus.style.display = 'none';
      }
      
      if (this.video) {
        this.video.srcObject = null;
      }
      
      // Handle specific error cases
      let errorMessage = 'Error al iniciar la cámara';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permiso de cámara denegado. Por favor, permite el acceso a la cámara.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No se encontró ninguna cámara en el dispositivo.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'No se pudo acceder a la cámara. Puede que ya esté en uso por otra aplicación.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      this.updateResult(errorMessage, 'red');
      
      // Show help for permission issues
      if (error.name === 'NotAllowedError') {
        this.showCameraHelp();
      }
      
      // Reset button state
      if (this.startButton) {
        this.startButton.textContent = 'Iniciar Cámara';
      }
      
      this.isCameraOn = false;
      throw error; // Re-throw to be caught by toggleCamera
    } finally {
      if (this.loading) {
        this.loading.style.display = 'none';
      }
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
    if (!this.video || this.video.readyState < 2) {
      console.log('Video not ready for recognition, readyState:', this.video ? this.video.readyState : 'no video');
      return;
    }
    
    try {
      console.log('Attempting to recognize license plate...');
      const plate = await recognizePlate(this.video);
      
      if (plate && plate.trim() !== '') {
        console.log('License plate recognized:', plate);
        this.updateResult(`Patente: ${plate}`, 'green');
      } else {
        console.log('No license plate detected or recognized');
        this.updateResult('Escaneando...', 'black');
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

// The class is already exported above
