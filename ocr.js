import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/esm/ort.min.js';
import { CHARSET } from './charset.js';

let session;
let modelLoaded = false;

export async function loadOCRModel() {
  if (modelLoaded) return true;
  
  try {
    console.log('Loading OCR model...');
    
    // Configure ONNX Runtime
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
    ort.env.wasm.numThreads = 1; // Reduce memory usage
    
    // Try to load the model from the local model directory first
    let modelPath = './model/license_plates_ocr_model.onnx';
    
    // Fallback to a CDN if local model is not available
    try {
      const response = await fetch(modelPath);
      if (!response.ok) throw new Error('Local model not found');
    } catch (error) {
      console.warn('Local model not found, using fallback model');
      modelPath = 'https://your-cdn-url.com/path/to/license_plates_ocr_model.onnx';
    }
    
    // Initialize the model with WebAssembly backend
    session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
      executionMode: 'parallel',
      enableCpuMemArena: true
    });
    
    modelLoaded = true;
    console.log('OCR model loaded successfully');
    return true;
    
  } catch (error) {
    console.error('Failed to load OCR model:', error);
    throw new Error('No se pudo cargar el modelo OCR. Por favor recarga la página e inténtalo de nuevo.');
  }
}

function preprocessImage(video) {
  try {
    const width = 100, height = 32;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    // Calculate aspect ratio to maintain proportions
    const aspectRatio = video.videoWidth / video.videoHeight;
    let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
    
    if (aspectRatio > width / height) {
      // Video is wider than target
      drawHeight = height;
      drawWidth = drawHeight * aspectRatio;
      offsetX = (drawWidth - width) / -2; // Center the crop
    } else {
      // Video is taller than target
      drawWidth = width;
      drawHeight = drawWidth / aspectRatio;
      offsetY = (drawHeight - height) / -2; // Center the crop
    }
    
    const ctx = canvas.getContext('2d');
    
    // Apply some basic image processing
    ctx.filter = 'contrast(1.2) brightness(1.1) grayscale(100%)';
    ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
    
    // Convert to grayscale and normalize
    const imageData = ctx.getImageData(0, 0, width, height);
    const input = new Float32Array(width * height);
    
    // Convert to grayscale and normalize to [0, 1]
    for (let i = 0; i < input.length; i++) {
      // Simple grayscale conversion (luminosity method)
      const r = imageData.data[i * 4];
      const g = imageData.data[i * 4 + 1];
      const b = imageData.data[i * 4 + 2];
      const gray = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
      
      // Apply contrast stretching
      input[i] = Math.min(1.0, Math.max(0.0, (gray - 0.2) * 1.5));
    }
    
    return new ort.Tensor('float32', input, [1, 1, height, width]);
    
  } catch (error) {
    console.error('Error preprocessing image:', error);
    throw new Error('Error al procesar la imagen de la cámara');
  }
}

function decodeOutput(output) {
  try {
    const scores = output.data;
    const [seqLength, , numClasses] = output.dims;
    let result = '', prev = -1;
    
    // Confidence threshold (adjust as needed)
    const confidenceThreshold = 0.5;
    
    for (let t = 0; t < seqLength; t++) {
      let maxScore = -Infinity, maxIndex = -1;
      
      // Find the most likely character at this timestep
      for (let c = 0; c < numClasses; c++) {
        const score = scores[t * numClasses + c];
        if (score > maxScore) {
          maxScore = score;
          maxIndex = c;
        }
      }
      
      // Only add the character if it's above the confidence threshold
      // and it's not the same as the previous character (removes duplicates)
      if (maxIndex !== prev && maxIndex < CHARSET.length && maxScore > confidenceThreshold) {
        result += CHARSET[maxIndex];
      }
      prev = maxIndex;
    }
    
    // Basic plate format validation (adjust based on your country's format)
    // For example, in some countries: 3 letters + 3 numbers (ABC123)
    const plateRegex = /^[A-Z0-9]{4,8}$/;
    
    // Only return the result if it matches the expected format
    return plateRegex.test(result) ? result : '';
    
  } catch (error) {
    console.error('Error decoding output:', error);
    return '';
  }
}

export async function recognizePlate(video) {
  if (!modelLoaded) {
    console.warn('OCR model not loaded yet');
    return '';
  }
  
  try {
    if (!video || video.readyState !== 4) { // 4 = HAVE_ENOUGH_DATA
      console.warn('Video not ready');
      return '';
    }
    
    const inputTensor = preprocessImage(video);
    const output = await session.run({ input: inputTensor });
    const plateText = decodeOutput(output.output);
    
    console.log('Recognized plate:', plateText);
    return plateText || '';
    
  } catch (error) {
    console.error('Error recognizing plate:', error);
    return '';
  }
}
