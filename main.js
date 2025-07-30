import { loadOCRModel, recognizePlate } from './ocr.js';

document.addEventListener('DOMContentLoaded', () => {
  const video = document.getElementById('video');
  const result = document.getElementById('result');
  const startButton = document.getElementById('startButton');
  const cameraContainer = document.getElementById('cameraContainer');
  let recognitionInterval;

  // Show camera help instructions
  function showCameraHelp() {
    const helpText = document.createElement('div');
    helpText.innerHTML = `
      <h3>Cómo habilitar la cámara:</h3>
      <ol>
        <li>Haz clic en el ícono de candado o información en la barra de direcciones</li>
        <li>Busca la opción "Configuración de sitios" o "Permisos de la cámara"</li>
        <li>Cambia el permiso a "Permitir"</li>
        <li>Recarga la página</li>
      </ol>
      <p>Si el problema persiste, verifica que no haya otras aplicaciones usando la cámara.</p>
      <button onclick="this.parentElement.remove()" style="margin-top: 10px;">Cerrar</button>
    `;
    helpText.style.marginTop = '20px';
    helpText.style.padding = '15px';
    helpText.style.border = '1px solid #ddd';
    helpText.style.borderRadius = '8px';
    helpText.style.backgroundColor = '#f9f9f9';
    
    // Remove any existing help text
    const existingHelp = document.querySelector('.camera-help-text');
    if (existingHelp) existingHelp.remove();
    
    helpText.className = 'camera-help-text';
    document.getElementById('result').appendChild(helpText);
  }

  async function startCamera() {
    // Show loading state
    const loading = document.querySelector('.loading');
    const result = document.getElementById('result');
    const video = document.getElementById('camera');
    const cameraContainer = document.getElementById('cameraContainer');
    const startButton = document.getElementById('startButton');
    
    loading.style.display = 'block';
    result.textContent = 'Solicitando acceso a la cámara...';
    result.style.color = 'black';
    
    // Request camera access
    const constraints = {
      video: { 
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };
    
    try {
      // Try to get media with error handling for different browsers
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.error('Camera access error:', err);
        
        // Create a more helpful error message with instructions
        let errorMessage = 'No se pudo acceder a la cámara. ';
        let showHelpButton = false;
        
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Permiso de cámara denegado. ';
          showHelpButton = true;
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMessage += 'No se encontró ninguna cámara en el dispositivo.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          errorMessage += 'No se pudo acceder a la cámara. Puede que ya esté en uso por otra aplicación.';
        } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
          // Try with less constraints
          delete constraints.video.width;
          delete constraints.video.height;
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            // If we get here, the fallback worked
            loading.style.display = 'none';
            
            // Set up video stream
            video.srcObject = stream;
            cameraContainer.style.display = 'block';
            startButton.textContent = 'Detener Cámara';
            
            // Wait for video to be ready
            await new Promise((resolve) => {
              video.onloadedmetadata = () => {
                video.play();
                resolve();
              };
            });
            
            // Start recognition after a short delay
            if (recognitionInterval) clearInterval(recognitionInterval);
            recognitionInterval = setInterval(recognizePlate, 2000);
            
            return stream;
          } catch (nestedErr) {
            errorMessage += 'No se pudo acceder a la cámara con las configuraciones disponibles.';
          }
        } else {
          errorMessage += 'Error desconocido al acceder a la cámara.';
        }
        
        throw { message: errorMessage, showHelpButton };
      }
      
      // If we get here, we have a valid stream
      loading.style.display = 'none';
      video.srcObject = stream;
      cameraContainer.style.display = 'block';
      startButton.textContent = 'Detener Cámara';
      
      // Wait for video to be ready
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });
      
      // Start recognition after a short delay
      if (recognitionInterval) clearInterval(recognitionInterval);
      recognitionInterval = setInterval(recognizePlate, 2000);
      
      return stream;
      
    } catch (error) {
      console.error('Camera initialization error:', error);
      
      // Hide loading state
      loading.style.display = 'none';
      
      // Show error message
      result.innerHTML = error.message || 'Error desconocido al acceder a la cámara.';
      result.style.color = 'var(--error)';
      
      // Add help button if needed
      if (error.showHelpButton) {
        const helpButton = document.createElement('button');
        helpButton.textContent = '¿Cómo habilitar la cámara?';
        helpButton.style.marginTop = '10px';
        helpButton.style.padding = '8px 16px';
        helpButton.style.fontSize = '0.9rem';
        helpButton.style.backgroundColor = 'transparent';
        helpButton.style.color = 'var(--primary)';
        helpButton.style.border = '1px solid var(--primary)';
        helpButton.onclick = showCameraHelp;
        
        // Clear previous help button if any
        const oldHelpButton = document.querySelector('.camera-help-button');
        if (oldHelpButton) oldHelpButton.remove();
        
        helpButton.className = 'camera-help-button';
        result.appendChild(document.createElement('br'));
        result.appendChild(helpButton);
      }
      
      // Reset button state
      startButton.textContent = 'Reintentar';
      startButton.disabled = false;
      
      throw error;
    }
  }

  async function stopCamera() {
    if (video.srcObject) {
      const tracks = video.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      video.srcObject = null;
    }
    if (recognitionInterval) {
      clearInterval(recognitionInterval);
      recognitionInterval = null;
    }
  }

  async function recognizePlate() {
    try {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const plate = await recognizePlate(video);
        result.textContent = `Placa detectada: ${plate || 'No reconocida'}`;
        
        if (plate && plate.length >= 4) { // Reduced minimum length for better testing
          result.style.color = 'green';
          // Uncomment and update this when you have the correct URL
          // window.location.href = `https://tuapp.com/placa/${plate}`;
        } else {
          result.style.color = 'black';
        }
      }
    } catch (error) {
      console.error('Error recognizing plate:', error);
      result.textContent = 'Error al procesar la imagen';
      result.style.color = 'red';
    }
  }

  // Initialize the app
  async function init() {
    try {
      // Show loading state
      const loading = document.querySelector('.loading');
      loading.style.display = 'block';
      result.textContent = 'Cargando modelo OCR...';
      result.style.color = 'black';
      
      // Load the OCR model
      await loadOCRModel();
      
      // Hide loading state
      loading.style.display = 'none';
      result.textContent = 'Listo para escanear';
      
      // Set up camera toggle
      startButton.addEventListener('click', toggleCamera);
      
    } catch (error) {
      console.error('Error initializing app:', error);
      const loading = document.querySelector('.loading');
      loading.style.display = 'none';
      
      result.textContent = 'Error al cargar la aplicación: ' + (error.message || 'Error desconocido');
      result.style.color = 'var(--error)';
      
      // Allow retry
      startButton.textContent = 'Reintentar';
      startButton.onclick = init;
      startButton.disabled = false;
    }
  }
  
  // Toggle camera on/off
  async function toggleCamera() {
    const loading = document.querySelector('.loading');
    try {
      if (video.srcObject) {
        // Stop the camera
        await stopCamera();
        startButton.textContent = 'Iniciar Cámara';
        result.textContent = 'Cámara detenida';
        result.style.color = 'black';
      } else {
        // Start the camera
        startButton.disabled = true;
        result.textContent = 'Iniciando cámara...';
        result.style.color = 'black';
        
        await startCamera();
        result.textContent = 'Apunte la cámara a una patente';
        result.style.color = 'black';
      }
    } catch (error) {
      console.error('Error toggling camera:', error);
      result.textContent = 'Error: ' + (error.message || 'No se pudo acceder a la cámara');
      result.style.color = 'var(--error)';
      startButton.textContent = 'Reintentar';
    } finally {
      loading.style.display = 'none';
      startButton.disabled = false;
    }
  }

  // Start the app
  init();
});
