// Character set for license plate recognition
// Includes numbers, uppercase letters, and common special characters
export const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ- ';

// Character set for validation (what we expect to see in license plates)
export const VALID_PLATE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// Common license plate formats by country (for reference)
export const PLATE_FORMATS = {
  'CL': /^[A-Z]{2}[0-9]{2}[A-Z0-9]{2}$/,  // Chilean format: AA 12 34
  'AR': /^[A-Z]{3} ?[0-9]{3}$/,           // Argentine format: ABC 123
  'US': /^[A-Z0-9]{1,8}$/,                 // US format (varies by state)
  'EU': /^[A-Z0-9- ]{1,12}$/,              // Generic European format
  'MX': /^[A-Z]{3}-?[0-9]{3}-?[0-9]{2}$/,  // Mexican format
  'BR': /^[A-Z]{3}-?[0-9][A-Z0-9][0-9]{2}$/ // Brazilian format
};

// Enhanced plate cleaning function
export function cleanPlateText(text) {
  if (!text) return '';
  
  // Convert to uppercase and remove invalid characters
  let cleaned = text.toUpperCase()
    .split('')
    .filter(char => VALID_PLATE_CHARS.includes(char))
    .join('');
  
  // Remove any remaining spaces or special characters
  cleaned = cleaned.replace(/[^A-Z0-9]/g, '');
  
  // Additional formatting based on detected patterns
  if (/^[A-Z]{2}\d{4}$/.test(cleaned)) {
    // Format like AA1234
    return `${cleaned.substring(0, 2)} ${cleaned.substring(2)}`;
  } else if (/^[A-Z]{3}\d{3}$/.test(cleaned)) {
    // Format like ABC123
    return `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
  }
  
  return cleaned;
}

// Function to validate plate format
export function validatePlateFormat(plate, countryCode = 'CL') {
  if (!plate) return false;
  const format = PLATE_FORMATS[countryCode] || PLATE_FORMATS['CL'];
  return format.test(plate);
}