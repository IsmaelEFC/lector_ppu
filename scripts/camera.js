const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('capture');

// Activar cámara
navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
  video.srcObject = stream;
});

// Capturar frame
captureBtn.addEventListener('click', () => {
  const context = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0);
  canvas.hidden = false;

  // Mostrar loader y ejecutar OCR
  document.getElementById('loader').classList.remove('hidden');
  extractPPU(canvas);
});
