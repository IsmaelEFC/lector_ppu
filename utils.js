// utils.js - Utilidades avanzadas para la PWA Detector de Patentes Chile

/**
 * Generador de iconos dinámicos para PWA
 */
class IconGenerator {
    static generateIcon(size = 192, color = '#2563eb') {
        const svg = `
            <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="grad${size}" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#667eea;stop-opacity:1" />
                    </linearGradient>
                    <filter id="shadow${size}">
                        <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.3"/>
                    </filter>
                </defs>
                <rect width="${size}" height="${size}" rx="${size * 0.1}" fill="url(#grad${size})" filter="url(#shadow${size})"/>
                <rect x="${size*0.15}" y="${size*0.25}" width="${size*0.7}" height="${size*0.18}" 
                      rx="${size*0.02}" fill="white" opacity="0.95"/>
                <text x="${size/2}" y="${size*0.36}" text-anchor="middle" 
                      fill="#333" font-size="${size*0.06}" font-weight="bold" font-family="Arial, sans-serif">CHILE</text>
                <circle cx="${size*0.25}" cy="${size*0.65}" r="${size*0.04}" fill="white" opacity="0.9"/>
                <circle cx="${size*0.75}" cy="${size*0.65}" r="${size*0.04}" fill="white" opacity="0.9"/>
                <rect x="${size*0.2}" y="${size*0.6}" width="${size*0.6}" height="${size*0.1}" 
                      rx="${size*0.01}" fill="white" opacity="0.7"/>
                <text x="${size/2}" y="${size*0.85}" text-anchor="middle" 
                      fill="white" font-size="${size*0.04}" font-weight="bold" opacity="0.8">OCR</text>
            </svg>
        `;
        return `data:image/svg+xml;base64,${btoa(svg)}`;
    }

    static async generateIconFile(size = 192) {
        return new Promise((resolve, reject) => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = size;
                canvas.height = size;

                // Enable antialiasing
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                // Background with gradient
                const gradient = ctx.createLinearGradient(0, 0, size, size);
                gradient.addColorStop(0, '#2563eb');
                gradient.addColorStop(1, '#667eea');
                ctx.fillStyle = gradient;
                
                // Rounded rectangle
                ctx.beginPath();
                ctx.roundRect(0, 0, size, size, size * 0.1);
                ctx.fill();

                // License plate background
                ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                ctx.beginPath();
                ctx.roundRect(size*0.15, size*0.25, size*0.7, size*0.18, size*0.02);
                ctx.fill();

                // CHILE text
                ctx.fillStyle = '#333';
                ctx.font = `bold ${size*0.06}px Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('CHILE', size/2, size*0.34);

                // Wheels
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.beginPath();
                ctx.arc(size*0.25, size*0.65, size*0.04, 0, 2 * Math.PI);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(size*0.75, size*0.65, size*0.04, 0, 2 * Math.PI);
                ctx.fill();

                // Car body
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.beginPath();
                ctx.roundRect(size*0.2, size*0.6, size*0.6, size*0.1, size*0.01);
                ctx.fill();

                // OCR text
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.font = `bold ${size*0.04}px Arial, sans-serif`;
                ctx.fillText('OCR', size/2, size*0.85);

                // Convert to data URL
                canvas.toBlob((blob) => {
                    if (blob) {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    } else {
                        reject(new Error('Failed to create blob'));
                    }
                }, 'image/png', 0.9);

            } catch (error) {
                reject(error);
            }
        });
    }
}

/**
 * Mejorador de OCR con preprocessamiento de imagen
 */
class OCREnhancer {
    static preprocessImage(canvas, ctx, video) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // 1. Convertir a escala de grises con mejor algoritmo
        this.convertToGrayscale(data);

        // 2. Aplicar filtro de contraste adaptativo
        this.applyAdaptiveContrast(data, canvas.width, canvas.height);

        // 3. Aplicar detección de bordes (Sobel mejorado)
        this.applySobelEdgeDetection(data, canvas.width, canvas.height);

        // 4. Aplicar threshold adaptativo
        this.applyAdaptiveThreshold(data, canvas.width, canvas.height);

        // 5. Noise reduction con median filter
        this.reduceNoise(data, canvas.width, canvas.height);

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    static convertToGrayscale(data) {
        for (let i = 0; i < data.length; i += 4) {
            // Use luminance formula for better grayscale conversion
            const gray = Math.round(
                data[i] * 0.299 +     // Red
                data[i + 1] * 0.587 + // Green  
                data[i + 2] * 0.114   // Blue
            );
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
        }
    }

    static applyAdaptiveContrast(data, width, height) {
        const blockSize = 32;
        const C = 10;
        
        for (let y = 0; y < height; y += blockSize) {
            for (let x = 0; x < width; x += blockSize) {
                const blockData = this.getBlock(data, x, y, blockSize, width, height);
                const mean = this.getMean(blockData);
                const std = this.getStandardDeviation(blockData, mean);
                
                if (std > C) {
                    this.enhanceBlock(data, x, y, blockSize, width, height, mean, std);
                }
            }
        }
    }

    static getBlock(data, startX, startY, blockSize, width, height) {
        const block = [];
        const endX = Math.min(startX + blockSize, width);
        const endY = Math.min(startY + blockSize, height);
        
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const idx = (y * width + x) * 4;
                block.push(data[idx]);
            }
        }
        return block;
    }

    static getMean(values) {
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    static getStandardDeviation(values, mean) {
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }

    static enhanceBlock(data, startX, startY, blockSize, width, height, mean, std) {
        const endX = Math.min(startX + blockSize, width);
        const endY = Math.min(startY + blockSize, height);
        const factor = 1.5;
        
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const idx = (y * width + x) * 4;
                const newValue = Math.round(mean + factor * (data[idx] - mean));
                const clampedValue = Math.max(0, Math.min(255, newValue));
                data[idx] = clampedValue;
                data[idx + 1] = clampedValue;
                data[idx + 2] = clampedValue;
            }
        }
    }

    static applySobelEdgeDetection(data, width, height) {
        const output = new Uint8ClampedArray(data.length);
        const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let sumX = 0, sumY = 0;
                
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4;
                        const pixel = data[idx];
                        const kIndex = (ky + 1) * 3 + (kx + 1);
                        sumX += pixel * kernelX[kIndex];
                        sumY += pixel * kernelY[kIndex];
                    }
                }
                
                const idx = (y * width + x) * 4;
                const magnitude = Math.sqrt(sumX * sumX + sumY * sumY);
                const value = Math.min(255, Math.max(0, magnitude));
                
                output[idx] = value;
                output[idx + 1] = value;
                output[idx + 2] = value;
                output[idx + 3] = data[idx + 3];
            }
        }
        
        // Copy border pixels
        for (let i = 0; i < data.length; i += 4) {
            const x = (i / 4) % width;
            const y = Math.floor((i / 4) / width);
            
            if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
                output[i] = data[i];
                output[i + 1] = data[i + 1];
                output[i + 2] = data[i + 2];
                output[i + 3] = data[i + 3];
            }
        }
        
        data.set(output);
    }

    static applyAdaptiveThreshold(data, width, height) {
        const blockSize = 16;
        const C = 15;
        
        for (let y = 0; y < height; y += blockSize) {
            for (let x = 0; x < width; x += blockSize) {
                const blockData = this.getBlock(data, x, y, blockSize, width, height);
                const threshold = this.getMean(blockData) - C;
                
                const endX = Math.min(x + blockSize, width);
                const endY = Math.min(y + blockSize, height);
                
                for (let by = y; by < endY; by++) {
                    for (let bx = x; bx < endX; bx++) {
                        const idx = (by * width + bx) * 4;
                        const value = data[idx] > threshold ? 255 : 0;
                        data[idx] = value;
                        data[idx + 1] = value;
                        data[idx + 2] = value;
                    }
                }
            }
        }
    }

    static reduceNoise(data, width, height) {
        const newData = new Uint8ClampedArray(data);
        const kernelSize = 3;
        const offset = Math.floor(kernelSize / 2);
        
        for (let y = offset; y < height - offset; y++) {
            for (let x = offset; x < width - offset; x++) {
                const neighbors = [];
                
                for (let dy = -offset; dy <= offset; dy++) {
                    for (let dx = -offset; dx <= offset; dx++) {
                        const nIdx = ((y + dy) * width + (x + dx)) * 4;
                        neighbors.push(data[nIdx]);
                    }
                }
                
                neighbors.sort((a, b) => a - b);
                const median = neighbors[Math.floor(neighbors.length / 2)];
                
                const idx = (y * width + x) * 4;
                newData[idx] = median;
                newData[idx + 1] = median;
                newData[idx + 2] = median;
            }
        }
        
        data.set(newData);
    }

    static enhanceForPlates(imageData) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        
        ctx.putImageData(imageData, 0, 0);
        
        // Apply filters for better text recognition
        ctx.filter = 'contrast(150%) brightness(110%) saturate(0%)';
        ctx.drawImage(canvas, 0, 0);
        
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
}

/**
 * Validador avanzado de placas chilenas
 */
class ChileanPlateValidator {
    static patterns = [
        { regex: /^[A-Z]{4}[0-9]{2}$/, type: 'new', weight: 1.0 },      // LLLL00 (nuevo formato)
        { regex: /^[A-Z]{2}[0-9]{4}$/, type: 'old', weight: 0.9 },      // LL0000 (formato antiguo)
        { regex: /^[A-Z]{3}[0-9]{3}$/, type: 'special', weight: 0.8 },  // LLL000 (especiales)
        { regex: /^[A-Z]{2}[0-9]{2}[A-Z]{2}$/, type: 'diplomatic', weight: 0.7 }, // LL00LL (diplomáticos)
        { regex: /^[A-Z]{2}[0-9]{3}[A-Z]$/, type: 'motorcycle', weight: 0.8 }     // LL000L (motos)
    ];

    static forbiddenCombinations = [
        'SEX', 'GAY', 'ASS', 'FUK', 'SHT', 'DMN', 'HLL', 'DIE', 'KIL'
    ];

    static commonMistakes = {
        '0': ['O', 'Q', 'D'],
        'O': ['0', 'Q', 'D'],
        '1': ['I', 'L', 'T'],
        'I': ['1', 'L', 'T'],
        '5': ['S'],
        'S': ['5'],
        '8': ['B'],
        'B': ['8'],
        '2': ['Z'],
        'Z': ['2'],
        '6': ['G'],
        'G': ['6']
    };

    static isValid(plateText) {
        if (!plateText || plateText.length < 5 || plateText.length > 7) {
            return false;
        }

        // Check against patterns
        const matchesPattern = this.patterns.some(pattern => pattern.regex.test(plateText));
        if (!matchesPattern) return false;

        // Check forbidden combinations
        const hasForbidden = this.forbiddenCombinations.some(forbidden => 
            plateText.includes(forbidden)
        );
        if (hasForbidden) return false;

        // Apply specific validation rules
        return this.validateSpecificRules(plateText);
    }

    static validateSpecificRules(plate) {
        // No puede empezar con número
        if (/^[0-9]/.test(plate)) return false;
        
        // No más de 3 caracteres repetidos consecutivos
        if (/([A-Z])\1{3,}/i.test(plate)) return false;
        
        // Validar formato según patrones de placas chilenas
        const platePatterns = [
            /^[A-Z]{4}\d{2}$/,       // Formato nuevo: LLLLNN
            /^[A-Z]{2}\d{4}$/,       // Formato antiguo: LLNNNN
            /^[A-Z]{3}\d{3}$/,       // Formato especial: LLLNNN
            /^[A-Z]{2}\d{2}[A-Z]{2}$/, // Formato diplomático: LLNNLL
            /^[A-Z]{2}\d{3}[A-Z]$/   // Formato motos: LLNNNL
        ];
        
        // Verificar si la placa coincide con algún patrón válido
        if (!platePatterns.some(pattern => pattern.test(plate))) {
            return false;
        }
        
        // Validar combinaciones prohibidas
        const forbiddenCombinations = ['SEX', 'GAY', 'ASS', 'FUK', 'SHT', 'DMN', 'HLL', 'KKK', 'XXX', 'SSS'];
        const upperPlate = plate.toUpperCase();
        if (forbiddenCombinations.some(combo => upperPlate.includes(combo))) {
            return false;
        }
        
        // Validar dígito verificador para formato nuevo (si aplica)
        if (/^[A-Z]{4}\d{2}$/.test(plate)) {
            return this.validateCheckDigit(plate);
        }
        
        return true;
    }
    
    /**
     * Valida el dígito verificador de una patente chilena en formato LLLLNN
     * @param {string} plate - La patente a validar (ej: "ABCD12")
     * @returns {boolean} true si la patente tiene un dígito verificador válido
     */
    static validateCheckDigit(plate) {
        // Verificar que la patente tenga el formato correcto
        if (!/^[A-Z]{4}\d{2}$/.test(plate)) {
            return false;
        }

        const letterValues = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const weights = [3, 2, 4, 1, 5, 9, 8, 6, 7, 0];
        
        // Convertir cada carácter a su valor numérico (0-35)
        const values = Array.from(plate).map(char => {
            const value = letterValues.indexOf(char);
            return value === -1 ? 0 : value; // Si no se encuentra, usar 0 como valor por defecto
        });
        
        // Aplicar ponderación y calcular suma
        let sum = 0;
        for (let i = 0; i < values.length - 1; i++) {
            sum += values[i] * weights[i % weights.length];
        }
        
        // Calcular dígito verificador (11 - (suma % 11))
        const calculatedCheckDigit = (11 - (sum % 11)) % 10;
        const actualCheckDigit = parseInt(plate[5], 10);
        
        return calculatedCheckDigit === actualCheckDigit;
    }
}