import * as ort from 'onnxruntime-web';
import { CHARSET } from './charset.js';

let session;

export async function loadOCRModel() {
  session = await ort.InferenceSession.create('./model/license_plate_ocr_model.onnx');
}

function preprocessImage(video) {
  const width = 100, height = 32;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const input = new Float32Array(width * height);

  for (let i = 0; i < input.length; i++) {
    input[i] = imageData.data[i * 4] / 255.0;
  }

  return new ort.Tensor('float32', input, [1, 1, height, width]);
}

function decodeOutput(output) {
  const scores = output.data;
  const [seqLength, , numClasses] = output.dims;
  let result = '', prev = -1;

  for (let t = 0; t < seqLength; t++) {
    let maxScore = -Infinity, maxIndex = -1;
    for (let c = 0; c < numClasses; c++) {
      const score = scores[t * numClasses + c];
      if (score > maxScore) {
        maxScore = score;
        maxIndex = c;
      }
    }
    if (maxIndex !== prev && maxIndex < CHARSET.length) {
      result += CHARSET[maxIndex];
    }
    prev = maxIndex;
  }

  return result;
}

export async function recognizePlate(video) {
  const inputTensor = preprocessImage(video);
  const output = await session.run({ input: inputTensor });
  return decodeOutput(output.output);
}
