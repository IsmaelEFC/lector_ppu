import { loadOCRModel, recognizePlate } from './ocr.js';

const video = document.createElement('video');
video.setAttribute('autoplay', '');
video.setAttribute('playsinline', '');
video.style.display = 'none';
document.body.appendChild(video);

const result = document.createElement('p');
result.id = 'result';
document.body.appendChild(result);

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' }
  });
  video.srcObject = stream;
}

async function init() {
  await loadOCRModel();
  await startCamera();

  setInterval(async () => {
    const plate = await recognizePlate(video);
    if (plate.length >= 6) {
      window.location.href = `https://tuapp.com/placa/${plate}`;
    }
    result.textContent = 'Detectado: ' + plate;
  }, 3000);
}

init();
