import { handleTelegramMessage } from '../src/index.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(200).send('OK');
    }

    // Optional secret validation (set when calling setWebhook)
    const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
    if (process.env.TELEGRAM_WEBHOOK_SECRET) {
      if (!secretHeader || secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
        return res.status(401).send('Unauthorized');
      }
    }

    const update = req.body || {};
    const message = update.message || update.edited_message || update.callback_query?.message;
    if (!message) {
      // Nothing to process
      return res.status(200).json({ ok: true });
    }

    const text = message.text || message.caption || '';
    const chatId = String(message.chat?.id || message.from?.id || '');

  // Optional owner restriction: only accept messages from OWNER_ID if set
  if (process.env.OWNER_ID && String(process.env.OWNER_ID) !== chatId) {
    console.warn('Ignoring message from non-owner chat:', chatId);
    return res.status(200).json({ ok: true });
  }

  await handleTelegramMessage(text, chatId, message);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).send('Internal Server Error');
  }
}

