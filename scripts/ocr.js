async function extractPPU(canvas) {
    const { createWorker } = Tesseract;
    const worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data } = await worker.recognize(canvas);
    const text = data.text.trim().replace(/\s/g, '');
    document.getElementById('ppu-result').textContent = text || 'No detectado';
  
    // Ocultar loader
    document.getElementById('loader').classList.add('hidden');
  }
  