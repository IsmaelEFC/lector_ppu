// ONNX Runtime Web is loaded via script tag in HTML
import { CHARSET, cleanPlateText, PLATE_FORMATS, validatePlateFormat } from './charset.js';

// Global configuration
let session = null;
let modelLoaded = false;
let config = {
  recognitionInterval: 2000,
  confidenceThreshold: 0.7,
  countryCode: 'CL'
};

// Function to update configuration
export function setOCRConfig(newConfig) {
  config = { ...config, ...newConfig };
  console.log('OCR config updated:', config);
  return true;
}

// Check if ONNX Runtime is available
function isONNXRuntimeAvailable() {
  return typeof ort !== 'undefined' && typeof ort.InferenceSession !== 'undefined';
}

// Load OCR model
export async function loadOCRModel() {
  if (modelLoaded && session !== null) return true;
  
  console.log('Loading OCR model...');
  
  if (!isONNXRuntimeAvailable()) {
    const errorMsg = 'ONNX Runtime is not available. Please check if the script is properly loaded.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  
  // List of possible model locations
  const modelLocations = [
    './model/license_plates_ocr_model.onnx',
    './license_plates_ocr_model.onnx',
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.0/test/data/squeezenet.onnx' // Fallback test model
  ];

  let lastError = null;
  
  // Try loading from each location until successful
  for (const modelPath of modelLocations) {
    try {
      console.log(`Trying to load model from: ${modelPath}`);
      
      // For local files, check if they exist first
      if (!modelPath.startsWith('http')) {
        try {
          const response = await fetch(modelPath, { method: 'HEAD' });
          if (!response.ok) {
            console.warn(`Model not found at: ${modelPath}`);
            continue;
          }
        } catch (error) {
          console.warn(`Error checking model at ${modelPath}:`, error.message);
          continue;
        }
      }

      // Load the model with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        session = await ort.InferenceSession.create(modelPath, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
          executionMode: 'parallel',
          enableCpuMemArena: true,
          enableMemPattern: true,
          enableProfiling: false,
          logSeverityLevel: 1,
          logVerbosityLevel: 1
        });
        
        clearTimeout(timeoutId);

        console.log('Model loaded successfully from:', modelPath);
        console.log('Model input names:', session.inputNames);
        console.log('Model output names:', session.outputNames);
        
        modelLoaded = true;
        return true;
        
      } catch (error) {
        clearTimeout(timeoutId);
        throw error; // Re-throw to be caught by the outer catch
      }
    } catch (error) {
      lastError = error;
      console.warn(`Failed to load model from ${modelPath}:`, error.message);
      // Continue with next location
    }
  }
  
  // If we get here, all locations failed
  const errorMsg = 'Failed to load any OCR model. Please ensure the model is available.';
  console.error(errorMsg);
  throw new Error(errorMsg, { cause: lastError });
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