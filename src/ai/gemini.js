import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiService {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  /**
   * Generate LinkedIn post content based on a topic
   * @param {string} topic - The topic for the post
   * @returns {Promise<{content: string, imagePrompt: string}>}
   */
  async generateLinkedInPost(topic) {
    const prompt = `Create a professional LinkedIn post about: "${topic}"

Requirements:
1. Write an engaging, professional LinkedIn post (200-300 words)
2. Use a conversational yet professional tone
3. Include a hook in the first line to grab attention
4. Add value with insights, tips, or personal reflection
5. End with a question or call-to-action
6. Use appropriate LinkedIn formatting (line breaks, bullet points if needed)
7. Do NOT include hashtags (we'll add them separately)

After the post, provide a brief image description (1-2 sentences) that would be relevant for this post. Format your response as:
POST:
[your post content here]

IMAGE_PROMPT:
[description of what image would complement this post]`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse the response
      const postMatch = text.match(/POST:\s*([\s\S]*?)(?=IMAGE_PROMPT:|$)/i);
      const imagePromptMatch = text.match(/IMAGE_PROMPT:\s*([\s\S]*?)$/i);

      const content = postMatch ? postMatch[1].trim() : text.trim();
      const imagePrompt = imagePromptMatch ? imagePromptMatch[1].trim() : 
        `Professional, modern image related to: ${topic}`;

      return {
        content,
        imagePrompt
      };
    } catch (error) {
      console.error('Error generating LinkedIn post:', error);
      throw new Error(`Failed to generate post: ${error.message}`);
    }
  }

  /**
   * Generate an image prompt based on post content
   * @param {string} postContent - The LinkedIn post content
   * @param {string} topic - The original topic
   * @returns {Promise<string>}
   */
  async generateImagePrompt(postContent, topic) {
    const prompt = `Based on this LinkedIn post content and topic, create a detailed image generation prompt:

Topic: ${topic}
Post Content: ${postContent.substring(0, 500)}

Create a detailed, specific image description (2-3 sentences) that would be visually appealing and relevant for this LinkedIn post. The description should be suitable for AI image generation. Focus on:
- Professional, modern aesthetic
- Relevant visual elements
- Appropriate style for LinkedIn (business, tech, professional)
- Clear, specific details about composition and mood`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Error generating image prompt:', error);
      // Fallback to simple prompt
      return `Professional, modern business image related to: ${topic}`;
    }
  }
}

export default GeminiService;
