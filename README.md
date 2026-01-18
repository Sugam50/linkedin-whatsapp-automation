# LinkedIn Telegram Automation

An automated system that generates LinkedIn posts with images using Google generative models, sends them to a Telegram bot for review/approval, and posts approved content to LinkedIn.

## Features

- 🤖 **AI-Powered Post Generation**: Uses Google Gemini Pro to generate professional LinkedIn posts
- 🎨 **Image Generation**: Generates relevant images using Gemini/Nano Banana (or alternative services)
- 💬 **Telegram Integration**: Send and receive approvals via Telegram
- 🔗 **LinkedIn Posting**: Automatically post approved content to LinkedIn with images
- 💾 **Database Storage**: SQLite database for managing posts and history
- ✅ **Approval Workflow**: Review and approve posts before publishing

## Prerequisites

- Node.js 18+ installed
- Google generative API access (Gemini or supported model)
- LinkedIn Developer account
- Telegram bot token
- API keys / tokens (see setup instructions below)

## Quick Start

### 1. Clone or Download the Project

```bash
cd Project
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   copy .env.example .env
   ```
   (On Linux/Mac: `cp .env.example .env`)

2. Fill in your API keys in `.env` file (see **API Setup Guide** below)

### 4. Run the Application

```bash
npm start
```

5. **Start the Telegram bot**
   - Ensure `TELEGRAM_BOT_TOKEN` is set in your `.env`
   - Start the app:
     ```bash
     npm start
     ```
   - Open Telegram and message your bot (try `/help`)

### 5. Start Using

Send commands to the Telegram bot:

 - `/generate <topic>` - Generate a LinkedIn post
   - Example: `/generate AI in business`

 - `/list` - List all pending posts

 - `/approve <post_id>` - Approve and post to LinkedIn
   - Example: `/approve 1`

 - `/reject <post_id>` - Reject a pending post

 - `/status` - Check bot status

 - `/help` - Show available commands

Example session (sample)
------------------------
User -> Bot:
```
/generate AI in business
```
Bot -> User:
```
📝 Post Generated (ID: 1)

[Generated post preview...]

To approve: /approve 1
To reject: /reject 1
```
User -> Bot:
```
/approve 1
```
Bot -> User:
```
✅ Post successfully published to LinkedIn!
Post ID: 1
LinkedIn Post ID: abc123
```

## API Setup Guide

For detailed step-by-step instructions on obtaining all required API keys, see:

**[API_SETUP_GUIDE.md](API_SETUP_GUIDE.md)**

### Quick Summary:

1. **Gemini API Key**
   - Visit: https://aistudio.google.com
   - Create API key
   - Add to `.env`: `GEMINI_API_KEY=your_key`

2. **LinkedIn API Credentials**
   - Visit: https://www.linkedin.com/developers/apps
   - Create app and get Client ID & Secret
   - Request "Share on LinkedIn" permission
   - Add to `.env`: `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`

3. **Telegram**
   - Create a bot with BotFather and add `TELEGRAM_BOT_TOKEN` to `.env`
   - No QR code required; the bot uses polling by default for development

## Project Structure

```
Project/
├── src/
│   ├── index.js              # Main application entry
│   ├── telegram/
│   │   └── bot.js            # Telegram bot wrapper (Telegraf)
│   ├── ai/
│   │   ├── gemini.js         # Generative AI integration (model configurable)
│   │   └── imageGenerator.js # Image generation helper
│   ├── linkedin/
│   │   └── client.js         # LinkedIn API client
│   └── storage/
│       └── db.js             # Database operations
├── images/                   # Generated images (gitignored)
├── data/                     # Database files (gitignored)
├── .env                      # Environment variables (gitignored)
├── .env.example              # Environment variables template
├── API_SETUP_GUIDE.md        # Detailed API setup instructions
├── DEPLOYMENT_PLAN.md        # Deployment guide for free hosting
├── package.json              # Dependencies
└── README.md                 # This file
```

## Workflow

1. **Generate Post**: User sends `/generate <topic>` via Telegram to the bot
2. **AI Generation**: System generates post text and an image prompt using the configured generative model
3. **Preview**: Generated post and image (if available) are sent to the user's Telegram chat
4. **Review/Edit**: User can edit the preview text locally and resend an `/approve <post_id>` command when satisfied
5. **Approval**: User approves via `/approve <post_id>`; the system posts to LinkedIn
6. **Confirmation**: User receives confirmation via Telegram

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Generative AI (Google)
GEMINI_API_KEY=your_generative_api_key
# Optional: override default model (example: 'models/text-bison-001' or a supported Gemini model)
GENERATIVE_MODEL=models/text-bison-001

# LinkedIn API
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:3000/auth/linkedin/callback

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Database (auto-created)
DB_PATH=./data/database.db

# Images directory
IMAGES_DIR=./images

# App config
NODE_ENV=development
PORT=3000
```

## LinkedIn OAuth Setup

The first time you use LinkedIn posting, you need to complete OAuth authentication:

1. The app will provide an authorization URL via `/auth url`
2. Visit the URL and authorize the application
3. Copy the authorization code from the redirect URL
4. Use `/auth code <code>` in Telegram to complete the OAuth flow (tokens are stored in the local database)

For detailed instructions, see [API_SETUP_GUIDE.md](API_SETUP_GUIDE.md).

## Image Generation

Currently, the system is set up to use Gemini/Nano Banana for image generation. If image generation is not yet available through the Gemini API, you can:

1. **Wait for API availability**: Check Google AI Studio for updates
2. **Use alternative service**: Modify `src/ai/imageGenerator.js` to use:
   - Pixazo API (free tier available)
   - Cloudinary AI
   - Unsplash API (stock images)
   - Other free image generation services

## Deployment

For deploying to free hosting services (Fly.io, Railway, etc.), see:

**[DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md)**

## Troubleshooting

### Telegram Issues

- **Bot not responding**: Ensure `TELEGRAM_BOT_TOKEN` is set and `npm start` was run.
- **Using polling but bot doesn't start**: Check console for Telegraf startup logs and that the network allows outbound connections.
- **Webhook failures**: Ensure your webhook URL is HTTPS and reachable by Telegram; check Telegram `setWebhook` response for errors.

### Gemini API Issues

- **Invalid API key**: Verify key is copied correctly
- **Quota exceeded**: Check your Gemini Pro subscription status
- **Rate limits**: Wait a few seconds between requests

### LinkedIn API Issues

- **Invalid credentials**: Double-check Client ID and Secret
- **Permission denied**: Ensure "Share on LinkedIn" permission is requested
- **OAuth errors**: Verify redirect URI matches exactly

### Database Issues

- **Permission errors**: Ensure `data/` directory is writable
- **Database locked**: Close other instances of the app

## Security Notes

- ⚠️ Never commit `.env` file to Git (already in `.gitignore`)
- ⚠️ Keep API keys secure and private
 - ⚠️ Rotate API keys if accidentally exposed

## Limitations

- Image generation via certain generative APIs may not be available in every region or account; use alternatives if needed
- LinkedIn OAuth requires one-time setup
- Free tier API limits may apply

## Contributing

This is a personal automation project. Feel free to fork and modify for your own use.

## License

MIT License - feel free to use and modify

## Support

For setup help:
1. Check [API_SETUP_GUIDE.md](API_SETUP_GUIDE.md) for detailed instructions
2. Review error messages in console output
3. Verify all environment variables are set correctly

---

**Note**: This project now uses Telegram (official Bot API) for interactive commands. Keep `TELEGRAM_BOT_TOKEN` secret and follow Telegram's Bot API terms.
