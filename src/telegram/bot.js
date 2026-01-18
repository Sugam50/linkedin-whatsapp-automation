import { Telegraf } from 'telegraf';
import fs from 'fs';

/**
 * TelegramBot wrapper to mirror the previous WhatsAppBot interface used by the app.
 * - Uses polling by default (simple to run locally)
 * - Exposes initialize(), sendMessage(), sendMessageWithImage(), isReady(), destroy()
 *
 * Environment variables:
 * - TELEGRAM_BOT_TOKEN
 */
class TelegramBot {
  constructor(onMessageCallback) {
    this.onMessageCallback = onMessageCallback;
    this.token = process.env.TELEGRAM_BOT_TOKEN || null;
    this.bot = this.token ? new Telegraf(this.token) : null;
    this.ready = false;
  }

  async initialize() {
    if (!this.bot) {
      console.warn('⚠️ Telegram bot token not provided. Set TELEGRAM_BOT_TOKEN in your .env');
      return;
    }
    // Do not start polling in production; webhook mode is used.
    // We still keep a Telegraf instance for sending messages via bot.telegram
    this.ready = true;
    console.log('✅ Telegram bot ready (webhook mode expected)');
  }

  async sendMessage(to, message, parse_mode = 'Markdown') {
    if (!this.bot) {
      console.error('❌ Cannot send Telegram message: bot not initialized');
      return;
    }

    try {
      await this.bot.telegram.sendMessage(String(to), message, { parse_mode: parse_mode });
    } catch (err) {
      console.error('Error sending Telegram message:', err.response?.error_description || err.message);
      throw err;
    }
  }

  async sendMessageWithImage(to, message, imagePath) {
    if (!this.bot) return this.sendMessage(to, message);
    if (!imagePath || !fs.existsSync(imagePath)) return this.sendMessage(to, message);

    try {
      await this.bot.telegram.sendPhoto(String(to), { source: fs.createReadStream(imagePath) }, { caption: message, parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Error sending Telegram image:', err.response?.error_description || err.message);
      // Fallback to text
      await this.sendMessage(to, `${message}\n\n[Image failed to send]`);
    }
  }

  isReady() {
    return this.ready && !!this.bot;
  }

  async destroy() {
    if (this.bot) {
      try {
        await this.bot.stop();
      } catch (err) {
        // ignore
      }
      this.ready = false;
      console.log('✅ Telegram bot stopped');
    }
  }
}

export default TelegramBot;

