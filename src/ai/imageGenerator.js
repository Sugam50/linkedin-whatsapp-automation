class ImageGenerator {
  constructor() {
    // Image generation disabled. No local files will be used.
  }

  async generateImage(prompt, filename = null) {
    // Images disabled - return nulls so rest of the flow uses image_url if available.
    return { imagePath: null, imageUrl: null };
  }

  async deleteImage() {
    // no-op
  }

  async cleanupOldImages() {
    // no-op
  }
}

export default ImageGenerator;
