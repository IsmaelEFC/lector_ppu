const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('capture');

// Activar cámara TRASERA
navigator.mediaDevices.getUserMedia({
  video: { facingMode: { exact: "environment" } }
}).then(stream => {
  video.srcObject = stream;
}).catch(error => {
  // Fallback si no se encuentra cámara trasera
  console.warn("No se pudo acceder a la cámara trasera:", error);
  navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
    video.srcObject = stream;
  });
});

// Capturar frame
captureBtn.addEventListener('click', () => {
  const context = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0);
  canvas.hidden = false;

  document.getElementById('loader').classList.remove('hidden');
  extractPPU(canvas);
});
