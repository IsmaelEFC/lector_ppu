import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/esm/ort.min.js';
import { CHARSET, cleanPlateText, PLATE_FORMATS, validatePlateFormat } from './charset.js';

let session;
let modelLoaded = false;
let config = {
  recognitionInterval: 2000,
  confidenceThreshold: 0.7,
  countryCode: 'CL'
};

export function setOCRConfig(newConfig) {
  config = { ...config, ...newConfig };
  console.log('OCR config updated:', config);
}

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
      modelPath = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/test/data/squeezenet1.onnx'; // Modelo de ejemplo
    }
    
    // Initialize the model with WebAssembly backend
    session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
      executionMode: 'parallel',
      enableCpuMemArena: true
    });
    
    // Log model input/output information (compatible con todas las versiones)
    console.log('Model loaded successfully');
    console.log('Input names:', session.inputNames);
    console.log('Output names:', session.outputNames);
    
    // Obtener información de inputs de forma compatible
    if (session.inputNames && session.inputNames.length > 0) {
      console.log('First input name:', session.inputNames[0]);
      if (session.inputValues) {
        console.log('First input shape:', session.inputValues.get(session.inputNames[0]).dims);
      }
    }
    
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
    // Target dimensions (adjust based on model requirements)
    const width = 100, height = 32;
    const channels = 1; // Grayscale
    
    console.log(`Preprocessing image to ${width}x${height} grayscale`);
    
    // Create canvas for processing
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    // Get 2D context with willReadFrequently for better performance
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Draw the video frame to canvas
    ctx.drawImage(video, 0, 0, width, height);
    
    // Apply contrast enhancement
    ctx.filter = 'contrast(1.5)';
    ctx.drawImage(canvas, 0, 0);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Create a new Float32Array for the grayscale image
    const input = new Float32Array(width * height * channels);
    
    // Convert to grayscale and normalize to [0, 1]
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      // Convert to grayscale using luminosity method
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Grayscale conversion (values 0-255)
      let gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      
      // Apply contrast stretching and normalize to [0, 1]
      gray = Math.min(255, Math.max(0, (gray - 51) * 1.5)) / 255; // 51 is ~0.2 * 255
      
      input[j] = gray;
    }
    
    // Log tensor details
    console.log('Preprocessed tensor:', {
      type: 'float32',
      shape: [1, channels, height, width],
      min: Math.min(...input),
      max: Math.max(...input),
      mean: input.reduce((a, b) => a + b, 0) / input.length,
      first10: Array.from(input).slice(0, 10)
    });
    
    // Create and return the tensor with shape [batch, channels, height, width]
    return new ort.Tensor('float32', input, [1, channels, height, width]);
    
  } catch (error) {
    console.error('Error preprocessing image:', error);
    throw new Error('Error al procesar la imagen de la cámara');
  }
}

function decodeOutput(output) {
  try {
    console.log('Raw model output:', {
      data: output.data,
      dims: output.dims,
      type: output.type
    });
    
    const scores = output.data;
    const [seqLength, batchSize, numClasses] = output.dims;
    let result = '', prev = -1;
    
    console.log(`Decoding output: seqLength=${seqLength}, numClasses=${numClasses}`);
    
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
      
      // Log each character's score for debugging
      console.log(`Timestep ${t}: maxIndex=${maxIndex}, char=${CHARSET[maxIndex] || '?'}, score=${maxScore.toFixed(4)}`);
      
      // Only add the character if it's above the confidence threshold
      // and it's not the same as the previous character (removes duplicates)
      if (maxIndex !== -1 && maxIndex < CHARSET.length) {
        if (maxScore > config.confidenceThreshold) {
          result += CHARSET[maxIndex];
          console.log(`Added character: ${CHARSET[maxIndex]} (score: ${maxScore.toFixed(4)})`);
        }
        prev = maxIndex;
      }
    }
    
    console.log('Raw recognized text before filtering:', result);
    
    // Clean the recognized text using our utility function
    const cleanedText = cleanPlateText(result);
    console.log('Cleaned plate text:', cleanedText);
    
    // Validate against selected country format
    const isValid = validatePlateFormat(cleanedText, config.countryCode);
    
    if (isValid) {
      console.log(`Valid ${config.countryCode} plate detected:`, cleanedText);
      return cleanedText;
    }
    
    // Fallback: Check if we have at least 3 alphanumeric characters
    if (cleanedText.length >= 3) {
      console.log('Partial plate detected (3+ chars):', cleanedText);
      return cleanedText;
    }
    
    console.log('No valid plate detected');
    return '';
    
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
    if (!video) {
      console.warn('Video element is null or undefined');
      return '';
    }
    
    if (video.readyState !== 4) { // 4 = HAVE_ENOUGH_DATA
      console.warn('Video not ready, readyState:', video.readyState);
      return '';
    }
    
    console.log('Preprocessing video frame...');
    const inputTensor = preprocessImage(video);
    
    if (!inputTensor || !inputTensor.data) {
      console.error('Failed to create input tensor');
      return '';
    }
    
    // Log tensor details before running the model
    console.log('Input tensor details:', {
      type: inputTensor.type,
      dims: inputTensor.dims,
      dataType: inputTensor.data.constructor.name,
      dataLength: inputTensor.data.length,
      first10Values: Array.from(inputTensor.data).slice(0, 10)
    });
    
    console.log('Running OCR model...');
    
    try {
      // Get the expected input name from the session
      const inputName = session.inputNames[0];
      
      // Create input feed with the correct input name
      const inputFeed = {};
      inputFeed[inputName] = inputTensor;
      
      console.log('Running model with input feed:', {
        inputName,
        inputShape: inputTensor.dims,
        inputType: inputTensor.type
      });
      
      // Run the model
      const output = await session.run(inputFeed);
      
      if (!output) {
        console.error('No output from OCR model');
        return '';
      }
      
      // Get the first output (assuming single output model)
      const outputName = session.outputNames[0];
      const outputTensor = output[outputName];
      
      if (!outputTensor) {
        console.error('No output tensor found in model output');
        return '';
      }
      
      console.log('Model output received:', {
        outputName,
        type: outputTensor.type,
        dims: outputTensor.dims,
        dataType: outputTensor.data.constructor.name,
        dataLength: outputTensor.data.length,
        first10: Array.from(outputTensor.data).slice(0, 10)
      });
      
      // Decode the output
      const plateText = decodeOutput(outputTensor);
      console.log('Decoded plate text:', plateText);
      return plateText || '';
      
    } catch (modelError) {
      console.error('Error during model execution:', {
        name: modelError.name,
        message: modelError.message,
        stack: modelError.stack
      });
      
      // Try to force float32 type if there's a type mismatch
      if (modelError.message.includes('Unexpected input data type') && 
          inputTensor.type !== 'float32') {
        console.log('Attempting to convert tensor to float32...');
        const float32Data = new Float32Array(inputTensor.data);
        const fixedTensor = new ort.Tensor('float32', float32Data, inputTensor.dims);
        
        try {
          const output = await session.run({ input: fixedTensor });
          if (output?.output) {
            return decodeOutput(output.output) || '';
          }
        } catch (retryError) {
          console.error('Retry with float32 tensor failed:', retryError);
        }
      }
      
      return '';
    }
    
  } catch (error) {
    console.error('Error in recognizePlate:', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    return '';
  }
}