export default async function handler(req, res) {
  // Defer importing app code until request time so initialization errors can be caught
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

    // Dynamic import so we can catch initialization/runtime errors
    let mod;
    try {
      mod = await import('../src/index.js');
    } catch (impErr) {
      console.error('Failed to import app module:', impErr);
      // Return 200 to Telegram to avoid repeated retries; check logs
      return res.status(200).json({ ok: false, error: 'import_failed' });
    }

    const handleTelegramMessage = mod.handleTelegramMessage;
    if (typeof handleTelegramMessage !== 'function') {
      console.error('handleTelegramMessage not found in app module');
      return res.status(200).json({ ok: false, error: 'handler_missing' });
    }

    try {
      await handleTelegramMessage(text, chatId, message);
    } catch (procErr) {
      console.error('Error processing Telegram update:', procErr);
      // Return 200 to Telegram to avoid retry storms; record error in logs for debugging
      return res.status(200).json({ ok: false, error: 'processing_error' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook handler fatal error:', err);
    return res.status(500).send('Internal Server Error');
  }
}

