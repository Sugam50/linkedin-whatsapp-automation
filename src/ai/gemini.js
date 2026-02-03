import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiService {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Allow overriding the model via env var; default to a supported text model
    const modelName = process.env.GENERATIVE_MODEL || 'gemini-2.5-flash';
    this.model = this.genAI.getGenerativeModel({ model: modelName });
  }

  /**
   * Generate LinkedIn post content based on a topic
   * @param {string} topic - The topic for the post
   * @returns {Promise<{content: string, imagePrompt: string}>}
   */
  async generateLinkedInPost(topic) {
    const prompt = `Write a SHORT LinkedIn post about: "${topic}"

You are an engineer speaking from lived production experience.
This post will be auto-published. It must sound human, not explanatory.

ABSOLUTE RULES (do not violate):
- 60–110 words total
- First line must be a blunt statement (no setup, no context)
- Write in short paragraphs (1–2 lines max)
- Describe ONE concrete failure or anomaly
- Include at least ONE specific technical detail (number, value, limit, timeout)
- Do NOT explain systems, monitoring theory, or best practices
- Do NOT narrate investigation steps
- Do NOT use phrases like:
  "we learned", "this shows", "important lesson", "in order to", "focused on",
  "high-level", "metrics vs logs", "root cause", "postmortem"
- If a sentence uses abstract words like "failing", "issue", "problem",
  rewrite it using a concrete symptom instead.


STYLE ENFORCEMENT:
- Declarative sentences only
- Minimal adjectives
- No corporate language
- No teaching tone
- No emojis
- Assume the reader is technical

FORMATTING RULES:
- Insert a blank line after every 1–2 sentences
- Prefer single-sentence paragraphs
- Use white space intentionally to create pauses
- If a sentence explains something, rewrite it to show absence instead

ENDING:
- End with ONE sharp line or question (max 1 sentence)
- Max 5 hashtags, placed at the very end

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
