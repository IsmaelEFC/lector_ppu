// ONNX Runtime Web is loaded via script tag in HTML
import { CHARSET, cleanPlateText, PLATE_FORMATS, validatePlateFormat } from './charset.js';

// Global configuration
let session;
let modelLoaded = false;
let config = {
  recognitionInterval: 2000,
  confidenceThreshold: 0.7,
  countryCode: 'CL'
};

// Function to update configuration
export function setOCRConfig(newConfig) {
  config = { ...config, ...newConfig };
  console.log('Configuración actualizada:', config);
}

// Load OCR model
export async function loadOCRModel() {
  if (modelLoaded) return true;
  
  // Check if ONNX Runtime is available
  if (typeof ort === 'undefined') {
    throw new Error('ONNX Runtime no está cargado. Por favor, recarga la página.');
  }

  console.log('Cargando modelo OCR...');
  
  try {
    // Configure ONNX Runtime
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.simd = true;

    // List of possible model locations
    const modelLocations = [
      './model/license_plates_ocr_model.onnx',
      './license_plates_ocr_model.onnx',
      'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.0/test/data/squeezenet.onnx' // Fallback test model
    ];

    let lastError;
    
    // Try loading from each location until successful
    for (const modelPath of modelLocations) {
      try {
        console.log(`Intentando cargar modelo desde: ${modelPath}`);
        
        // For local files, check if they exist first
        if (!modelPath.startsWith('http')) {
          try {
            const response = await fetch(modelPath, { method: 'HEAD' });
            if (!response.ok) {
              console.warn(`Modelo no encontrado en: ${modelPath}`);
              continue;
            }
          } catch (error) {
            console.warn(`Error al verificar el modelo en ${modelPath}:`, error.message);
            continue;
          }
        }

        // Load the model with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        try {
          session = await ort.InferenceSession.create(modelPath, {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all',
            executionMode: 'parallel',
            enableCpuMemArena: true,
            enableMemPattern: true,
            enableProfiling: false,
            logSeverityLevel: 1, // 0:Verbose, 1:Info, 2:Warning, 3:Error, 4:Fatal
            logVerbosityLevel: 1
          });
          
          clearTimeout(timeoutId);

          console.log('Modelo cargado exitosamente desde:', modelPath);
          console.log('Entradas del modelo:', session.inputNames);
          console.log('Salidas del modelo:', session.outputNames);
          
          modelLoaded = true;
          return true;
          
        } catch (error) {
          clearTimeout(timeoutId);
          throw error; // Re-throw to be caught by the outer catch
        }
      } catch (error) {
        lastError = error;
        console.warn(`Error al cargar el modelo desde ${modelPath}:`, error.message);
        // Continue with next location
      }
    }
    
    // If we get here, all locations failed
    const errorMsg = 'No se pudo cargar ningún modelo OCR. Asegúrese de que el modelo está disponible.';
    console.error(errorMsg);
    throw new Error(errorMsg, { cause: lastError });
    
  } catch (error) {
    console.error('Error fatal al cargar el modelo OCR:', error);
    throw new Error('Error al cargar el modelo OCR. Por favor recarga la página.');
  }
}

// Preprocesamiento de imagen
function preprocessImage(video) {
  try {
    const width = 100, height = 32;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // 1. Dibujar frame con ajustes
    ctx.drawImage(video, 0, 0, width, height);
    
    // 2. Aplicar filtros de mejora
    ctx.filter = 'contrast(1.5) brightness(1.2) grayscale(100%)';
    ctx.drawImage(canvas, 0, 0);

    // 3. Obtener datos de imagen
    const imageData = ctx.getImageData(0, 0, width, height);
    const input = new Float32Array(width * height);

    // 4. Normalización mejorada
    for (let i = 0, j = 0; i < imageData.data.length; i += 4, j++) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      
      // Conversión a escala de grises
      let gray = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      
      // Ajuste de contraste
      gray = Math.pow((gray - 0.5) * 1.5 + 0.5, 1.5);
      gray = Math.min(1, Math.max(0, gray));
      
      input[j] = gray;
    }

    return new ort.Tensor('float32', input, [1, 1, height, width]);

  } catch (error) {
    console.error('Error en preprocesamiento:', error);
    throw error;
  }
}

// Decodificación de resultados
function decodeOutput(output) {
  try {
    const scores = output.data;
    const [seqLength, _, numClasses] = output.dims;
    let result = '';
    let prevChar = '';
    let confidence = 0;
    let charCount = 0;

    // Procesar cada paso de tiempo
    for (let t = 0; t < seqLength; t++) {
      let maxScore = -Infinity;
      let maxIndex = -1;

      // Encontrar carácter más probable
      for (let c = 0; c < numClasses; c++) {
        const score = scores[t * numClasses + c];
        if (score > maxScore) {
          maxScore = score;
          maxIndex = c;
        }
      }

      // Filtrar por confianza y duplicados
      if (maxIndex !== -1 && maxScore > config.confidenceThreshold) {
        const currentChar = CHARSET[maxIndex];
        
        if (currentChar !== prevChar) {
          result += currentChar;
          confidence += maxScore;
          charCount++;
          prevChar = currentChar;
        }
      }
    }

    // Calcular confianza promedio
    const avgConfidence = charCount > 0 ? confidence / charCount : 0;
    
    // Filtrar resultados con baja confianza
    if (avgConfidence < config.confidenceThreshold * 0.8) {
      console.log('Resultado descartado por baja confianza');
      return '';
    }

    // Limpiar y formatear texto
    const cleanedText = cleanPlateText(result);
    
    // Validar formato según país
    if (validatePlateFormat(cleanedText, config.countryCode)) {
      console.log(`Placa válida detectada: ${cleanedText}`);
      return cleanedText;
    }

    // Permitir resultados parciales
    if (cleanedText.length >= 3) {
      console.log(`Detección parcial: ${cleanedText}`);
      return cleanedText;
    }

    return '';

  } catch (error) {
    console.error('Error decodificando salida:', error);
    return '';
  }
}

// Función principal de reconocimiento
export async function recognizePlate(video) {
  if (!modelLoaded) {
    console.warn('Modelo OCR no cargado');
    return '';
  }

  try {
    // Verificar estado del video
    if (!video || video.readyState < 2) {
      console.warn('Video no listo para reconocimiento');
      return '';
    }

    // 1. Preprocesamiento
    const inputTensor = preprocessImage(video);
    
    // 2. Verificar tensor de entrada
    if (!inputTensor?.data) {
      console.error('Tensor de entrada inválido');
      return '';
    }

    // 3. Ejecutar modelo con timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const output = await session.run(
        { [session.inputNames[0]]: inputTensor },
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      // 4. Procesar resultados
      const plateText = decodeOutput(output[session.outputNames[0]]);
      
      if (plateText) {
        console.log('Placa reconocida:', plateText);
        return plateText;
      }
      
      return '';
    } catch (modelError) {
      clearTimeout(timeoutId);
      console.error('Error en modelo:', modelError);
      return '';
    }
  } catch (error) {
    console.error('Error en reconocimiento:', error);
    return '';
  }
}