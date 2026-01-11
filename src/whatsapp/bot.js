import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

class WhatsAppBot {
  constructor(onMessageCallback) {
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth'
      }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    this.onMessageCallback = onMessageCallback;
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // QR code generation
    this.client.on('qr', (qr) => {
      console.log('\n=== WhatsApp QR Code ===');
      console.log('Scan this QR code with your WhatsApp mobile app:');
      console.log('1. Open WhatsApp on your phone');
      console.log('2. Go to Settings > Linked Devices');
      console.log('3. Tap "Link a Device"');
      console.log('4. Scan the QR code below:\n');
      qrcode.generate(qr, { small: true });
      console.log('\n================================\n');
    });

    // Ready event
    this.client.on('ready', () => {
      console.log('✅ WhatsApp client is ready!');
      console.log('You can now send commands to this WhatsApp number.\n');
      console.log('Available commands:');
      console.log('  /generate <topic> - Generate a LinkedIn post');
      console.log('  /approve <post_id> - Approve a pending post');
      console.log('  /reject <post_id> - Reject a pending post');
      console.log('  /list - List all pending posts');
      console.log('  /status - Check bot status\n');
    });

    // Authentication failure
    this.client.on('auth_failure', (msg) => {
      console.error('❌ WhatsApp authentication failed:', msg);
    });

    // Disconnected
    this.client.on('disconnected', (reason) => {
      console.log('⚠️ WhatsApp client disconnected:', reason);
    });

    // Message received
    this.client.on('message', async (message) => {
      // Ignore group messages and messages from status broadcasts
      if (message.from === 'status@broadcast' || message.isGroupMsg) {
        return;
      }

      const messageBody = message.body.trim();
      const sender = message.from;

      // Only process commands (messages starting with /)
      if (messageBody.startsWith('/')) {
        if (this.onMessageCallback) {
          await this.onMessageCallback(messageBody, sender, message);
        }
      }
    });
  }

  /**
   * Initialize and start the WhatsApp client
   */
  async initialize() {
    try {
      await this.client.initialize();
    } catch (error) {
      console.error('Error initializing WhatsApp client:', error);
      throw error;
    }
  }

  /**
   * Send a text message
   * @param {string} to - Recipient number (format: countrycode+number@c.us)
   * @param {string} message - Message text
   */
  async sendMessage(to, message) {
    try {
      await this.client.sendMessage(to, message);
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Send a message with image
   * @param {string} to - Recipient number
   * @param {string} message - Message text
   * @param {string} imagePath - Path to image file
   */
  async sendMessageWithImage(to, message, imagePath) {
    try {
      const media = MessageMedia.fromFilePath(imagePath);
      await this.client.sendMessage(to, media, { caption: message });
    } catch (error) {
      console.error('Error sending message with image:', error);
      // Fallback to text-only if image fails
      await this.sendMessage(to, message + '\n\n[Image preview failed, but image will be included in LinkedIn post]');
    }
  }

  /**
   * Get client info
   * @returns {Promise<object>} Client info including number
   */
  async getClientInfo() {
    try {
      return await this.client.info;
    } catch (error) {
      console.error('Error getting client info:', error);
      return null;
    }
  }

  /**
   * Check if client is ready
   * @returns {boolean}
   */
  isReady() {
    return this.client.info !== undefined;
  }

  /**
   * Stop the WhatsApp client
   */
  async destroy() {
    try {
      await this.client.destroy();
    } catch (error) {
      console.error('Error destroying WhatsApp client:', error);
    }
  }
}

export default WhatsAppBot;
