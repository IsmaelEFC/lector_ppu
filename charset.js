// Conjunto de caracteres para reconocimiento
export const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ- ';

// Caracteres válidos en placas
export const VALID_PLATE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// Formatos de placas por país
export const PLATE_FORMATS = {
  'CL': /^[A-Z]{2}[0-9]{2}[A-Z0-9]{2}$/,  // Chile: AA 12 34
  'AR': /^[A-Z]{3}[0-9]{3}$/,             // Argentina: ABC 123
  'US': /^[A-Z0-9]{1,8}$/,                // Estados Unidos
  'EU': /^[A-Z0-9-]{1,12}$/,              // Europa
  'MX': /^[A-Z]{3}-?[0-9]{3}-?[0-9]{2}$/, // México
  'BR': /^[A-Z]{3}-?[0-9][A-Z0-9][0-9]{2}$/ // Brasil
};

// Limpiar texto de placa
export function cleanPlateText(text) {
  if (!text) return '';
  
  // Convertir a mayúsculas y filtrar caracteres
  let cleaned = text.toUpperCase()
    .split('')
    .filter(char => VALID_PLATE_CHARS.includes(char))
    .join('');

  // Formatear según patrones comunes
  if (/^[A-Z]{2}\d{4}$/.test(cleaned)) {
    return `${cleaned.substring(0, 2)} ${cleaned.substring(2)}`;
  } else if (/^[A-Z]{3}\d{3}$/.test(cleaned)) {
    return `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
  }

  return cleaned;
}

// Validar formato de placa
export function validatePlateFormat(plate, countryCode = 'CL') {
  if (!plate) return false;
  const format = PLATE_FORMATS[countryCode] || PLATE_FORMATS['CL'];
  return format.test(plate.replace(/\s/g, ''));
}