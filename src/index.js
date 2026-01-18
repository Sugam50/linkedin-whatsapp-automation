  import dotenv from 'dotenv';
  import DatabaseManager from './storage/db.js';
  import GeminiService from './ai/gemini.js';
  import ImageGenerator from './ai/imageGenerator.js';
  import LinkedInClient from './linkedin/client.js';
  import TelegramBot from './telegram/bot.js';
  import fs from 'fs-extra';
  import path from 'path';
  import { fileURLToPath } from 'url';

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Load environment variables
  dotenv.config();

  // Configuration
  const config = {
    geminiApiKey: process.env.GEMINI_API_KEY,
    linkedinClientId: process.env.LINKEDIN_CLIENT_ID,
    linkedinClientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    linkedinRedirectUri: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3000/auth/linkedin/callback',
    dbPath: process.env.DB_PATH || './data/database.db',
    imagesDir: process.env.IMAGES_DIR || './images'
  };

  // Validate required environment variables
  const requiredVars = ['GEMINI_API_KEY'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease check your .env file and see API_SETUP_GUIDE.md for setup instructions.\n');
    process.exit(1);
  }

  // Initialize services
  let db;
  let geminiService;
  let imageGenerator;
  let linkedinClient;
  let telegramBot;
  let userChatId = null;

  // Initialize database
  try {
    db = new DatabaseManager(config.dbPath);
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }

  // Initialize Gemini service
  try {
    console.log("Gemini API key", config.geminiApiKey)
    geminiService = new GeminiService(config.geminiApiKey);
    console.log('✅ Gemini service initialized');
  } catch (error) {
    console.error('❌ Gemini service initialization failed:', error);
    process.exit(1);
  }

  // Initialize image generator
  try {
    imageGenerator = new ImageGenerator(config.geminiApiKey, config.imagesDir);
    console.log('✅ Image generator initialized');
  } catch (error) {
    console.error('⚠️ Image generator initialization warning:', error.message);
    console.log('   Image generation may not be available. Continuing without images...\n');
  }

  // Initialize LinkedIn client
  if (config.linkedinClientId && config.linkedinClientSecret) {
    try {
      linkedinClient = new LinkedInClient(
        config.linkedinClientId,
        config.linkedinClientSecret,
        config.linkedinRedirectUri,
        db
      );

      // Check if tokens exist in database (async)
      (async () => {
        try {
          const tokenData = await db.getOAuthToken('linkedin');
          if (tokenData && !linkedinClient.isAccessTokenExpired()) {
            console.log('✅ LinkedIn client initialized with valid stored tokens');
          } else if (tokenData) {
            console.log('⚠️ LinkedIn client initialized with expired tokens - will refresh automatically when needed');
          } else {
            console.log('⚠️ LinkedIn client initialized but no tokens found');
            console.log('   You will need to complete OAuth flow to post to LinkedIn');
            console.log('   See API_SETUP_GUIDE.md for instructions\n');
          }
        } catch (err) {
          console.error('Error checking LinkedIn tokens:', err.message || err);
        }
      })();
    } catch (error) {
      console.error('❌ LinkedIn client initialization failed:', error);
    }
  } else {
    console.log('⚠️ LinkedIn credentials not found. LinkedIn posting will be disabled.');
    console.log('   See API_SETUP_GUIDE.md for setup instructions\n');
  }

  // Initialize Telegram bot
  telegramBot = new TelegramBot(handleTelegramMessage);

  // Handle Telegram messages (commands forwarded from Telegram)
  export async function handleTelegramMessage(messageBody, sender, message) {
    try {
      // Store sender id for responses
      if (!userChatId) {
        userChatId = sender;
      }

      const parts = messageBody.split(' ');
      const command = parts[0].toLowerCase();
      const args = parts.slice(1).join(' ');

      switch (command) {
        case '/generate':
          await handleGenerateCommand(sender, args);
          break;
        
        case '/approve':
          await handleApproveCommand(sender, parts[1]);
          break;
        
        case '/reject':
          await handleRejectCommand(sender, parts[1]);
          break;
        
        case '/list':
          await handleListCommand(sender);
          break;
        
        case '/status':
          await handleStatusCommand(sender);
          break;
        
        case '/auth':
          await handleAuthCommand(sender, args);
          break;

        case '/help':
          await handleHelpCommand(sender);
          break;

        default:
          await telegramBot.sendMessage(
            sender,
            '❓ Unknown command. Send /help to see available commands.'
          );
      }
    } catch (error) {
      console.error('Error handling Telegram message:', error.message);
      // Try to send error message, but don't fail if it also errors
      try {
        await telegramBot.sendMessage(
          sender,
          '❌ An error occurred while processing your request. Please try again.'
        );
      } catch (sendError) {
        console.error('Failed to send error message:', sendError.message);
      }
    }
  }

  // Handle /generate command
  async function handleGenerateCommand(sender, topic) {
    if (!topic || topic.trim() === '') {
      await telegramBot.sendMessage(
        sender,
        '❌ Please provide a topic. Usage: /generate <topic>\nExample: /generate AI in business'
      );
      return;
    }

    try {
      await telegramBot.sendMessage(sender, '🔄 Generating LinkedIn post... Please wait...');

      // Generate post content using Gemini
      const { content, imagePrompt } = await geminiService.generateLinkedInPost(topic.trim());

      // Generate image (if available)
      let imagePath = null;
      try {
        if (imageGenerator) {
          imagePath = await imageGenerator.generateImage(imagePrompt, `img_${Date.now()}.png`);
          imagePath = imagePath.imagePath;
        }
      } catch (imageError) {
        console.log('Image generation skipped:', imageError.message);
        // Continue without image
      }

      // Save to database
      const postId = await db.createPost(content, imagePath, null, topic.trim());

      // Send preview to user
      let previewMessage = `📝 *Post Generated (ID: ${postId})*\n\n`;
      previewMessage += `${content}\n\n`;
      previewMessage += `Topic: ${topic}\n`;
      previewMessage += `Status: Pending Approval\n\n`;
      previewMessage += `To approve: /approve ${postId}\n`;
      previewMessage += `To reject: /reject ${postId}`;

      if (imagePath && fs.existsSync(imagePath)) {
        await telegramBot.sendMessageWithImage(sender, previewMessage, imagePath);
      } else {
        await telegramBot.sendMessage(sender, previewMessage);
      }
    } catch (error) {
      console.error('Error generating post:', error);
      await telegramBot.sendMessage(
        sender,
        `❌ Failed to generate post: ${error.message}`
      );
    }
  }

  // Handle /approve command
  async function handleApproveCommand(sender, postId) {
    if (!postId) {
      await telegramBot.sendMessage(
        sender,
        '❌ Please provide a post ID. Usage: /approve <post_id>'
      );
      return;
    }

    try {
      const postIdNum = parseInt(postId);
      const post = await db.getPost(postIdNum);

      if (!post) {
        await telegramBot.sendMessage(sender, `❌ Post with ID ${postId} not found.`);
        return;
      }

      if (post.status !== 'pending') {
        await telegramBot.sendMessage(
          sender,
          `⚠️ Post ${postId} is already ${post.status}. Use /list to see pending posts.`
        );
        return;
      }

      // Check if LinkedIn client is available
      if (!linkedinClient) {
        await telegramBot.sendMessage(
          sender,
          '❌ LinkedIn is not configured. Please set up LinkedIn API credentials first.\nSee API_SETUP_GUIDE.md for instructions.'
        );
        return;
      }

      await telegramBot.sendMessage(sender, '🔄 Posting to LinkedIn... Please wait...');

      // Post to LinkedIn
      try {
        const result = await linkedinClient.createPost(post.content, post.image_path);
        
        // Update database
        await db.updatePostStatus(postIdNum, 'approved');
        await db.addToPostedHistory(postIdNum, post.content, post.image_url, result.postId);

        await telegramBot.sendMessage(
          sender,
          `✅ Post successfully published to LinkedIn!\n\nPost ID: ${postId}\nLinkedIn Post ID: ${result.postId}`
        );

        // Clean up image file after successful posting (optional)
        if (post.image_path && fs.existsSync(post.image_path)) {
          try {
            await fs.remove(post.image_path);
          } catch (cleanupError) {
            console.log('Image cleanup skipped:', cleanupError.message);
          }
        }
      } catch (linkedinError) {
        console.error('LinkedIn posting error:', linkedinError);
        await telegramBot.sendMessage(
          sender,
          `❌ Failed to post to LinkedIn: ${linkedinError.message}\n\nPost is still saved and can be retried.`
        );
      }
    } catch (error) {
      console.error('Error approving post:', error);
      await telegramBot.sendMessage(
        sender,
        `❌ Error processing approval: ${error.message}`
      );
    }
  }

  // Handle /reject command
  async function handleRejectCommand(sender, postId) {
    if (!postId) {
      await telegramBot.sendMessage(
        sender,
        '❌ Please provide a post ID. Usage: /reject <post_id>'
      );
      return;
    }

    try {
      const postIdNum = parseInt(postId);
      const post = await db.getPost(postIdNum);

      if (!post) {
        await telegramBot.sendMessage(sender, `❌ Post with ID ${postId} not found.`);
        return;
      }

      await db.updatePostStatus(postIdNum, 'rejected');

      // Clean up image file
      if (post.image_path && fs.existsSync(post.image_path)) {
        try {
          await fs.remove(post.image_path);
        } catch (cleanupError) {
          console.log('Image cleanup skipped:', cleanupError.message);
        }
      }

      await telegramBot.sendMessage(
        sender,
        `✅ Post ${postId} has been rejected and removed.`
      );
    } catch (error) {
      console.error('Error rejecting post:', error);
      await telegramBot.sendMessage(
        sender,
        `❌ Error processing rejection: ${error.message}`
      );
    }
  }

  // Handle /list command
  async function handleListCommand(sender) {
    try {
      const pendingPosts = await db.getPendingPosts();

    if (pendingPosts.length === 0) {
        await telegramBot.sendMessage(sender, '📋 No pending posts.');
        return;
      }

      let message = `📋 *Pending Posts (${pendingPosts.length})*\n\n`;
      pendingPosts.forEach(post => {
        const preview = post.content.substring(0, 100) + (post.content.length > 100 ? '...' : '');
        message += `*ID: ${post.id}*\n`;
        message += `${preview}\n`;
        message += `Topic: ${post.topic || 'N/A'}\n`;
        message += `Created: ${new Date(post.created_at).toLocaleString()}\n`;
        message += `/approve ${post.id} | /reject ${post.id}\n\n`;
      });

      await telegramBot.sendMessage(sender, message);
    } catch (error) {
      console.error('Error listing posts:', error);
      await telegramBot.sendMessage(sender, '❌ Error fetching posts list.');
    }
  }

  // Handle /status command
  async function handleStatusCommand(sender) {
    try {
      const pendingCount = (await db.getPendingPosts()).length;
      let linkedinStatus = '❌ Not configured';

      if (linkedinClient) {
        const tokenData = await db.getOAuthToken('linkedin');
        if (tokenData && !linkedinClient.isAccessTokenExpired()) {
          linkedinStatus = '✅ Connected';
        } else if (tokenData) {
          linkedinStatus = '⚠️ Tokens expired (will refresh automatically)';
        } else {
          linkedinStatus = '⚠️ OAuth required';
        }
      }

    const telegramStatus = telegramBot.isReady() ? '✅ Connected' : '⚠️ Connecting...';

      let message = `📊 *Bot Status*\n\n`;
    message += `Telegram: ${telegramStatus}\n`;
      message += `LinkedIn: ${linkedinStatus}\n`;
      message += `Gemini: ✅ Connected\n`;
      message += `Pending Posts: ${pendingCount}\n`;

    await telegramBot.sendMessage(sender, message);
    } catch (error) {
      console.error('Error getting status:', error);
      await telegramBot.sendMessage(sender, '❌ Error fetching status.');
    }
  }

  // Handle /auth command
  async function handleAuthCommand(sender, args) {
    if (!linkedinClient) {
      await telegramBot.sendMessage(
        sender,
        '❌ LinkedIn is not configured. Please set up LinkedIn API credentials first.\nSee API_SETUP_GUIDE.md for instructions.'
      );
      return;
    }

    const subCommand = args.split(' ')[0]?.toLowerCase();

    switch (subCommand) {
      case 'url':
        // Generate authorization URL
        try {
          const authUrl = linkedinClient.getAuthorizationUrl();

          await telegramBot.sendMessage(
            sender,
            `🔗 *LinkedIn Authorization URL*\n\n${authUrl}\n\nAfter authorization, you'll be redirected to your callback URL\\. Copy the authorization code from the URL and use:\n\n/auth code <authorization_code>`
          , 'NONE');
        } catch (error) {
          await telegramBot.sendMessage(
            sender,
            `❌ Failed to generate authorization URL: ${error.message}`
          );
        }
        break;

      case 'code':
        // Complete OAuth flow with authorization code
        const code = args.replace(/^code\s+/, '').trim();
        if (!code) {
          await telegramBot.sendMessage(
            sender,
            '❌ Please provide the authorization code. Usage: /auth code <authorization_code>'
          );
          return;
        }

        try {
          await telegramBot.sendMessage(sender, '🔄 Completing OAuth flow... Please wait...');

          const tokenInfo = await linkedinClient.completeOAuthFlow(code);

          await telegramBot.sendMessage(
            sender,
            `✅ LinkedIn OAuth completed successfully!\n\n` +
            `Access Token: ✅ Stored\n` +
            `Refresh Token: ✅ Stored\n` +
            `Expires In: ${Math.floor(tokenInfo.expires_in / (24 * 60 * 60))} days\n\n` +
            `Your tokens will be automatically refreshed when they expire.`
          );
        } catch (error) {
          await telegramBot.sendMessage(
            sender,
            `❌ Failed to complete OAuth flow: ${error.message}`
          );
        }
        break;

      default:
        await telegramBot.sendMessage(
          sender,
          `🔐 *LinkedIn OAuth Commands*\n\n` +
          `*/auth url* - Get authorization URL\n` +
          `*/auth code <code>* - Complete OAuth with authorization code`
        );
    }
  }

  // Handle /help command
  async function handleHelpCommand(sender) {
    const helpMessage = `📖 *Available Commands*\n\n` +
      `*/generate <topic>* - Generate a LinkedIn post\n` +
      `   Example: /generate AI in business\n\n` +
      `*/approve <post_id>* - Approve and post to LinkedIn\n` +
      `   Example: /approve 1\n\n` +
      `*/reject <post_id>* - Reject a pending post\n` +
      `   Example: /reject 1\n\n` +
      `*/list* - List all pending posts\n\n` +
      `*/status* - Check bot status\n\n` +
      `*/auth* - LinkedIn OAuth management\n` +
      `   /auth url - Get authorization URL\n` +
      `   /auth code <code> - Complete OAuth flow\n\n` +
      `*/help* - Show this help message`;

    await telegramBot.sendMessage(sender, helpMessage);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down gracefully...');
    
    if (telegramBot) {
      await telegramBot.destroy();
    }
    
    if (db) {
      await db.close();
    }
    
    console.log('✅ Shutdown complete');
    process.exit(0);
  });

  // Start the application
  async function start() {
    try {
      console.log('🚀 Starting LinkedIn Telegram Automation...\n');

      // Initialize Telegram bot
      await telegramBot.initialize();

      console.log('\n✅ Application started successfully!');
      console.log('📱 Waiting for Telegram connection...\n');
    } catch (error) {
      console.error('❌ Failed to start application:', error);
      process.exit(1);
    }
  }

  // Run the application (only when not running on Vercel serverless)
  if (!process.env.VERCEL) {
    start();
  }
