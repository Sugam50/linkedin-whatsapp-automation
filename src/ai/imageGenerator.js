import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ImageGenerator {
  constructor(apiKey, imagesDir = './images') {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required for image generation');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.imagesDir = imagesDir;
    
    // Ensure images directory exists
    fs.ensureDirSync(this.imagesDir);
  }

  /**
   * Generate an image using Gemini API (Nano Banana / Gemini 2.5 Flash Image)
   * Note: As of current Gemini API, direct image generation may not be available
   * This implementation provides a structure for when it becomes available
   * @param {string} prompt - Image generation prompt
   * @param {string} filename - Optional filename for the image
   * @returns {Promise<{imagePath: string, imageUrl: string}>}
   */
  async generateImage(prompt, filename = null) {
    try {
      // Note: Gemini API image generation support may vary
      // For now, we'll use a placeholder approach
      // When Gemini 2.5 Flash Image API is available, update this method
      
      console.log('Generating image with prompt:', prompt.substring(0, 100));
      
      // Attempt to use Gemini for image generation
      // This is a placeholder - actual implementation depends on API availability
      const imageData = await this.generateImageViaGemini(prompt);
      
      // Save image to local storage
      const savedPath = await this.saveImage(imageData, filename || `img_${Date.now()}.png`);
      
      return {
        imagePath: savedPath,
        imageUrl: null // Will be set when uploaded to cloud storage
      };
    } catch (error) {
      console.error('Error generating image with Gemini:', error);
      // Fallback: Return placeholder or throw error
      throw new Error(`Image generation failed: ${error.message}`);
    }
  }

  /**
   * Generate image via Gemini API
   * This method should be updated when Gemini image generation API is available
   */
  async generateImageViaGemini(prompt) {
    // Placeholder implementation
    // TODO: Update when Gemini 2.5 Flash Image (Nano Banana) API is available
    // For now, this throws an error indicating manual implementation needed
    
    throw new Error(
      'Direct image generation via Gemini API is not yet implemented. ' +
      'Please use an alternative image generation service or wait for Gemini API image generation support. ' +
      'You can use services like Pixazo API, Cloudinary AI, or other free image generation APIs as fallback.'
    );
  }

  /**
   * Generate image using alternative free service (Pixazo or similar)
   * This can be used as a fallback if Gemini image generation is not available
   */
  async generateImageViaFallback(prompt) {
    // Example: Using a free image generation API
    // Uncomment and configure when needed
    /*
    try {
      const response = await axios.post('https://api.pixazo.ai/v1/generate', {
        prompt: prompt,
        model: 'stable-diffusion',
        // Add other parameters as needed
      }, {
        headers: {
          'Content-Type': 'application/json',
          // Add API key if required
        }
      });
      
      // Download image from response
      const imageUrl = response.data.image_url;
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      return Buffer.from(imageResponse.data);
    } catch (error) {
      console.error('Fallback image generation failed:', error);
      throw error;
    }
    */
    
    throw new Error('Fallback image generation not configured. Please set up an image generation service.');
  }

  /**
   * Save image buffer to file system
   * @param {Buffer} imageData - Image data buffer
   * @param {string} filename - Filename to save as
   * @returns {Promise<string>} - Path to saved image
   */
  async saveImage(imageData, filename) {
    const filePath = path.join(this.imagesDir, filename);
    await fs.writeFile(filePath, imageData);
    console.log('Image saved to:', filePath);
    return filePath;
  }

  /**
   * Delete image file
   * @param {string} imagePath - Path to image file
   */
  async deleteImage(imagePath) {
    try {
      if (imagePath && await fs.pathExists(imagePath)) {
        await fs.remove(imagePath);
        console.log('Image deleted:', imagePath);
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  }

  /**
   * Clean up old images (older than specified days)
   * @param {number} daysOld - Delete images older than this many days
   */
  async cleanupOldImages(daysOld = 7) {
    try {
      const files = await fs.readdir(this.imagesDir);
      const now = Date.now();
      const maxAge = daysOld * 24 * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.imagesDir, file);
        const stats = await fs.stat(filePath);
        if (now - stats.mtimeMs > maxAge) {
          await fs.remove(filePath);
          console.log('Deleted old image:', file);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old images:', error);
    }
  }
}

export default ImageGenerator;
