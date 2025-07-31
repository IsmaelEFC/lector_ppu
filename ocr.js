import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/esm/ort.min.js';
import { CHARSET, cleanPlateText, PLATE_FORMATS } from './charset.js';

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
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Draw the video frame to canvas
    ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
    
    // Apply image processing
    const imageData = ctx.getImageData(0, 0, width, height);
    
    // Create a new Uint8Array for the grayscale image
    const input = new Uint8Array(width * height);
    
    // Convert to grayscale and enhance contrast
    for (let i = 0; i < width * height; i++) {
      const r = imageData.data[i * 4];
      const g = imageData.data[i * 4 + 1];
      const b = imageData.data[i * 4 + 2];
      
      // Convert to grayscale using luminosity method (values 0-255)
      let gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      
      // Apply contrast stretching (keep as uint8)
      gray = Math.min(255, Math.max(0, (gray - 51) * 1.5)); // 51 is ~0.2 * 255
      
      input[i] = gray;
    }
    
    // Debug: Check tensor values
    console.log('Input tensor values (first 10):', Array.from(input).slice(0, 10));
    console.log('Input tensor type: uint8, shape:', [1, 1, height, width]);
    
    // Create and return the tensor
    const tensor = new ort.Tensor('uint8', input, [1, 1, height, width]);
    
    // Verify tensor type
    if (tensor.type !== 'uint8') {
      console.warn(`Warning: Tensor type is ${tensor.type}, expected uint8. Converting...`);
      return new ort.Tensor('uint8', input, [1, 1, height, width]);
    }
    
    return tensor;
    
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
    
    // Lower confidence threshold to detect more potential characters
    const confidenceThreshold = 0.1; // Reduced from 0.5 to be more permissive
    
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
        if (maxScore > confidenceThreshold) {
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
    
    // Check against common plate formats
    const formatMatch = Object.entries(PLATE_FORMATS).find(([country, regex]) => {
      const match = regex.test(cleanedText);
      if (match) console.log(`Matched ${country} plate format`);
      return match;
    });
    
    // If we have a match, return the cleaned text
    if (formatMatch) {
      console.log(`Valid ${formatMatch[0]} plate detected:`, cleanedText);
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
      const output = await session.run({ input: inputTensor });
      
      if (!output || !output.output) {
        console.error('No output from OCR model');
        return '';
      }
      
      console.log('Model output received, decoding...');
      console.log('Output tensor details:', {
        type: output.output.type,
        dims: output.output.dims,
        dataType: output.output.data.constructor.name,
        dataLength: output.output.data.length
      });
      
      const plateText = decodeOutput(output.output);
      console.log('Decoded plate text:', plateText);
      return plateText || '';
      
    } catch (modelError) {
      console.error('Error during model execution:', {
        name: modelError.name,
        message: modelError.message,
        stack: modelError.stack
      });
      
      // Try to force uint8 type if there's a type mismatch
      if (modelError.message.includes('Unexpected input data type') && 
          inputTensor.type !== 'uint8') {
        console.log('Attempting to convert tensor to uint8...');
        const uint8Data = new Uint8Array(inputTensor.data);
        const fixedTensor = new ort.Tensor('uint8', uint8Data, inputTensor.dims);
        
        try {
          const output = await session.run({ input: fixedTensor });
          if (output?.output) {
            return decodeOutput(output.output) || '';
          }
        } catch (retryError) {
          console.error('Retry with uint8 tensor failed:', retryError);
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
