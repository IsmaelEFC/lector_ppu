document.getElementById('consultar').addEventListener('click', () => {
    const ppu = document.getElementById('ppu-result').textContent;
    if (ppu && ppu !== '----' && ppu !== 'No detectado') {
      window.open(`https://consultavehiculo.example.gov?placa=${ppu}`, '_blank');
    } else {
      alert('Primero debes capturar una patente válida.');
    }
  });
  