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
  'EU': /^[A-Z0-9- ]{1,12}$/              // Generic European format
};

// Function to clean and validate a recognized plate
export function cleanPlateText(text) {
  if (!text) return '';
  
  // Convert to uppercase and remove invalid characters
  let cleaned = text.toUpperCase()
    .split('')
    .filter(char => VALID_PLATE_CHARS.includes(char))
    .join('');
  
  // Remove any remaining spaces or special characters
  return cleaned.replace(/[^A-Z0-9]/g, '');
}
