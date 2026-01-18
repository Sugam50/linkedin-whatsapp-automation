# API Setup Guide - Step by Step Instructions

This guide provides detailed step-by-step instructions for obtaining all required API keys and credentials for the LinkedIn WhatsApp Automation system.

## 1. Google Gemini API Key

### Step 1: Access Google AI Studio
1. Open your web browser and go to: **https://aistudio.google.com**
2. Sign in with your Google account (the one with Gemini Pro subscription)

### Step 2: Create API Key
1. Click on **"Get API Key"** button (usually in the top right or sidebar)
2. If prompted, select **"Create API key in new project"** or use existing project
3. Your API key will be displayed - **COPY IT IMMEDIATELY** (you won't see it again)
4. Format: Usually starts with `AIza...`

### Step 3: Store the Key
- Paste it in your `.env` file as: `GEMINI_API_KEY=your_key_here`
- **Important**: Keep this key secret and never commit it to Git

### Verification
- Your API key should look like: `AIzaSy...` (about 39 characters)
- Test it by running: The app will verify on startup

---

## 2. LinkedIn API Credentials

### Step 1: Create LinkedIn Developer Account
1. Go to: **https://www.linkedin.com/developers/apps**
2. Sign in with your LinkedIn account
3. Click **"Create app"** button

### Step 2: Fill Application Details
1. **App name**: Enter a name (e.g., "My LinkedIn Automation")
2. **LinkedIn Page**: Select your LinkedIn page or company page
3. **Privacy Policy URL**: 
   - You can use: `https://example.com/privacy` (for testing)
   - Or create a simple GitHub Pages page with privacy policy
4. **App logo**: Upload a logo (optional, but recommended)
5. Check the terms and conditions
6. Click **"Create app"**

### Step 3: Get OAuth 2.0 Credentials
1. After creating the app, you'll be on the **"Auth"** tab
2. Find **"Application credentials"** section
3. Copy:
   - **Client ID**: Usually starts with `86...`
   - **Client Secret**: Click "Show" to reveal it

### Step 4: Request API Access Permissions
1. Go to the **"Products"** tab in your app
2. Click **"Request access"** for:
   - **Share on LinkedIn** (required for posting)
   - This gives you the `w_member_social` permission

### Step 5: Add Redirect URL
1. Go to **"Auth"** tab
2. Under **"Redirect URLs"**, click **"Add redirect URL"**
3. Add: `http://localhost:3000/auth/linkedin/callback`
4. Click **"Update"**

### Step 6: Store Credentials
Add to your `.env` file:
```
LINKEDIN_CLIENT_ID=your_client_id_here
LINKEDIN_CLIENT_SECRET=your_client_secret_here
LINKEDIN_REDIRECT_URI=http://localhost:3000/auth/linkedin/callback
```

### Step 7: Generate Access Token (First Time)
1. LinkedIn requires OAuth 2.0 authentication
2. You'll need to authorize the app (one-time process)
3. The app will handle the OAuth flow when you first run it
4. Or use LinkedIn's OAuth 2.0 Playground: https://www.linkedin.com/developers/tools/oauth/playground

### Verification
- Client ID format: Usually `86...` (about 14 characters)
- Client Secret: Usually alphanumeric (about 16 characters)

---

## 3. Telegram Bot Setup (replaces WhatsApp)

This project now uses Telegram for user interaction. The Telegram bot receives commands (e.g. `/generate`, `/approve`) and forwards them into the same approval/posting flow used previously.

### Step 1: Create a Telegram Bot and obtain the token
1. Open Telegram and message `@BotFather`.
2. Send the command `/newbot` and follow the prompts to choose a name and username.
3. When finished, BotFather will return a bot token. Copy it (format: `123456:ABC-DEF...`).
4. Save the token into your `.env` file as:

```
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
```

### Step 2: Decide polling vs webhook
- Development (recommended): Polling is easiest — the code uses Telegraf with polling by default. No public URL required.
- Production: Use webhooks (deploy to a server with HTTPS) and configure your hosting to forward Telegram updates to your app.

If you use polling during development you only need `TELEGRAM_BOT_TOKEN` set and `npm start`.

If you use webhooks:
1. Deploy the app to a public HTTPS URL or expose it via ngrok:
   ```bash
   npx ngrok http 3000
   ```
2. Configure Telegram to send updates to your webhook:
   ```bash
   curl -F "url=https://your-public-url.com/telegram-webhook" "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook"
   ```

### Step 3: Test the bot
1. Start the application:
   ```bash
   npm start
   ```
2. Open Telegram and send `/help` to your bot to confirm it responds.
3. Test `/generate test` to generate a LinkedIn post preview.

### Notes
- The bot forwards only messages beginning with `/` to the application logic.
- The bot stores the originating chat id and replies back to that chat.

---

## 4. Image Generation (Nano Banana / Gemini 2.5 Flash Image)

### Current Status
- **Nano Banana** (Gemini 2.5 Flash Image) image generation API may not be directly available yet
- The code structure is ready, but may need updates when API becomes available

### Alternative Options (if needed)

#### Option A: Use Free Image Generation API (Pixazo)
1. Go to: **https://www.pixazo.ai/**
2. Sign up for free account
3. Get API key from dashboard
4. Update `src/ai/imageGenerator.js` to use Pixazo API
5. Add to `.env`: `PIXAZO_API_KEY=your_key`

#### Option B: Use Unsplash API (Free stock images)
1. Go to: **https://unsplash.com/developers**
2. Create app
3. Get Access Key
4. Use for relevant stock images based on keywords

#### Option C: Wait for Gemini Image Generation
- Check Google AI Studio for updates
- When available, update `src/ai/imageGenerator.js`

---

## Quick Setup Checklist

- [ ] Gemini API Key obtained from https://aistudio.google.com
- [ ] LinkedIn app created at https://www.linkedin.com/developers/apps
- [ ] LinkedIn Client ID and Secret copied
- [ ] LinkedIn API permissions requested (w_member_social)
- [ ] Redirect URL added to LinkedIn app
- [ ] All credentials added to `.env` file
- [ ] `.env` file added to `.gitignore`
- [ ] Telegram bot token added to `.env` (`TELEGRAM_BOT_TOKEN`)

---

## Environment Variables Template

Create a `.env` file in the project root with:

```env
# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here

# LinkedIn API
LINKEDIN_CLIENT_ID=your_linkedin_client_id_here
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret_here
LINKEDIN_REDIRECT_URI=http://localhost:3000/auth/linkedin/callback
LINKEDIN_ACCESS_TOKEN=will_be_generated_after_oauth

# Database (auto-created)
DB_PATH=./data/database.db

# Images directory
IMAGES_DIR=./images

# App config
NODE_ENV=development
PORT=3000
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
```

---

## Troubleshooting

### Gemini API Issues
- **Error: API key invalid**: Check that you copied the full key
- **Error: Quota exceeded**: Check your Gemini Pro subscription status
- **Solution**: Visit https://aistudio.google.com to verify subscription

### LinkedIn API Issues
- **Error: Invalid client credentials**: Double-check Client ID and Secret
- **Error: Redirect URI mismatch**: Ensure redirect URI in `.env` matches LinkedIn app settings exactly
- **Error: Permission denied**: Make sure you requested "Share on LinkedIn" product access

### Telegram Issues
- **Bot not responding**: Ensure `TELEGRAM_BOT_TOKEN` is set and `npm start` was run.
- **Using polling but bot doesn't start**: Check console for Telegraf startup logs and that the network allows outbound connections.
- **Webhook failures**: Ensure your webhook URL is HTTPS and reachable by Telegram; check Telegram `setWebhook` response for errors.

---

## Security Reminders

1. **Never commit `.env` file** to Git (already in `.gitignore`)
2. **Never share API keys** publicly
3. **Rotate keys** if accidentally exposed
4. **Use environment variables** in production (not `.env` file)
5. **Keep your `TELEGRAM_BOT_TOKEN` secret and rotate it if exposed**

---

## Next Steps

After setting up all API keys:
1. Copy `.env.example` to `.env` (if not already done)
2. Fill in all values in `.env` file
3. Run `npm install` to install dependencies
4. Run `npm start` to start the application
5. Test with `/help` and `/generate test` commands via Telegram
