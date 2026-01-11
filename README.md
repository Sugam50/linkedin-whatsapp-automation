# LinkedIn WhatsApp Automation

An automated system that generates LinkedIn posts with images using Google Gemini Pro API, sends them to WhatsApp for approval, and posts approved content to LinkedIn.

## Features

- 🤖 **AI-Powered Post Generation**: Uses Google Gemini Pro to generate professional LinkedIn posts
- 🎨 **Image Generation**: Generates relevant images using Gemini/Nano Banana (or alternative services)
- 💬 **WhatsApp Integration**: Send and receive approvals via WhatsApp
- 🔗 **LinkedIn Posting**: Automatically post approved content to LinkedIn with images
- 💾 **Database Storage**: SQLite database for managing posts and history
- ✅ **Approval Workflow**: Review and approve posts before publishing

## Prerequisites

- Node.js 18+ installed
- Google Gemini Pro subscription
- LinkedIn Developer account
- WhatsApp account (mobile number)
- API keys (see setup instructions below)

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

5. **Scan WhatsApp QR Code**: When prompted, scan the QR code with your WhatsApp mobile app:
   - Open WhatsApp on your phone
   - Go to Settings > Linked Devices
   - Tap "Link a Device"
   - Scan the QR code displayed in the terminal

### 5. Start Using

Send commands to the WhatsApp bot:

- `/generate <topic>` - Generate a LinkedIn post
  - Example: `/generate AI in business`
  
- `/list` - List all pending posts

- `/approve <post_id>` - Approve and post to LinkedIn
  - Example: `/approve 1`

- `/reject <post_id>` - Reject a pending post

- `/status` - Check bot status

- `/help` - Show available commands

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

3. **WhatsApp**
   - No API key needed!
   - Just scan QR code when app starts

## Project Structure

```
Project/
├── src/
│   ├── index.js              # Main application entry
│   ├── whatsapp/
│   │   └── bot.js            # WhatsApp bot handler
│   ├── ai/
│   │   ├── gemini.js         # Gemini Pro integration
│   │   └── imageGenerator.js # Image generation (Nano Banana)
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

1. **Generate Post**: User sends `/generate <topic>` via WhatsApp
2. **AI Generation**: System generates post text and image using Gemini Pro
3. **Preview**: Generated post and image sent to user on WhatsApp
4. **Approval**: User reviews and approves/rejects via `/approve` or `/reject`
5. **Posting**: If approved, content is posted to LinkedIn with image
6. **Confirmation**: User receives confirmation via WhatsApp

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key

# LinkedIn API
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:3000/auth/linkedin/callback
LINKEDIN_ACCESS_TOKEN=your_access_token

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

1. The app will provide an authorization URL
2. Visit the URL and authorize the application
3. Copy the authorization code from the redirect URL
4. Exchange it for an access token (or use LinkedIn's OAuth Playground)
5. Add the access token to `.env`: `LINKEDIN_ACCESS_TOKEN=your_token`

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

### WhatsApp Connection Issues

- **QR code not showing**: Ensure `qrcode-terminal` package is installed
- **Connection lost**: Delete `.wwebjs_auth/` directory and restart
- **Session expired**: Re-scan QR code

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
- ⚠️ Don't share WhatsApp session files (`.wwebjs_auth/`)
- ⚠️ Rotate API keys if accidentally exposed

## Limitations

- Image generation via Gemini API may not be available yet (structure ready for future updates)
- LinkedIn OAuth requires one-time setup
- WhatsApp session requires re-authentication if expired
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

**Note**: This project uses WhatsApp Web.js, which is an unofficial library. Use at your own risk and comply with WhatsApp's Terms of Service.
