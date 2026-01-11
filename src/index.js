import dotenv from 'dotenv';
import DatabaseManager from './storage/db.js';
import GeminiService from './ai/gemini.js';
import ImageGenerator from './ai/imageGenerator.js';
import LinkedInClient from './linkedin/client.js';
import WhatsAppBot from './whatsapp/bot.js';
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
  linkedinAccessToken: process.env.LINKEDIN_ACCESS_TOKEN,
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
let whatsappBot;
let userPhoneNumber = null;

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
      config.linkedinRedirectUri
    );
    
    if (config.linkedinAccessToken) {
      linkedinClient.setAccessToken(config.linkedinAccessToken);
      console.log('✅ LinkedIn client initialized with access token');
    } else {
      console.log('⚠️ LinkedIn client initialized but no access token found');
      console.log('   You will need to complete OAuth flow to post to LinkedIn');
      console.log('   See API_SETUP_GUIDE.md for instructions\n');
    }
  } catch (error) {
    console.error('❌ LinkedIn client initialization failed:', error);
  }
} else {
  console.log('⚠️ LinkedIn credentials not found. LinkedIn posting will be disabled.');
  console.log('   See API_SETUP_GUIDE.md for setup instructions\n');
}

// Initialize WhatsApp bot
whatsappBot = new WhatsAppBot(handleWhatsAppMessage);

// Handle WhatsApp messages
async function handleWhatsAppMessage(messageBody, sender, message) {
  try {
    // Store sender number for responses
    if (!userPhoneNumber) {
      userPhoneNumber = sender;
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
      
      case '/help':
        await handleHelpCommand(sender);
        break;
      
      default:
        await whatsappBot.sendMessage(
          sender,
          '❓ Unknown command. Send /help to see available commands.'
        );
    }
  } catch (error) {
    console.error('Error handling WhatsApp message:', error);
    await whatsappBot.sendMessage(
      sender,
      '❌ An error occurred while processing your request. Please try again.'
    );
  }
}

// Handle /generate command
async function handleGenerateCommand(sender, topic) {
  if (!topic || topic.trim() === '') {
    await whatsappBot.sendMessage(
      sender,
      '❌ Please provide a topic. Usage: /generate <topic>\nExample: /generate AI in business'
    );
    return;
  }

  try {
    await whatsappBot.sendMessage(sender, '🔄 Generating LinkedIn post... Please wait...');

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
    const postId = db.createPost(content, imagePath, null, topic.trim());

    // Send preview to user
    let previewMessage = `📝 *Post Generated (ID: ${postId})*\n\n`;
    previewMessage += `${content}\n\n`;
    previewMessage += `Topic: ${topic}\n`;
    previewMessage += `Status: Pending Approval\n\n`;
    previewMessage += `To approve: /approve ${postId}\n`;
    previewMessage += `To reject: /reject ${postId}`;

    if (imagePath && fs.existsSync(imagePath)) {
      await whatsappBot.sendMessageWithImage(sender, previewMessage, imagePath);
    } else {
      await whatsappBot.sendMessage(sender, previewMessage);
    }
  } catch (error) {
    console.error('Error generating post:', error);
    await whatsappBot.sendMessage(
      sender,
      `❌ Failed to generate post: ${error.message}`
    );
  }
}

// Handle /approve command
async function handleApproveCommand(sender, postId) {
  if (!postId) {
    await whatsappBot.sendMessage(
      sender,
      '❌ Please provide a post ID. Usage: /approve <post_id>'
    );
    return;
  }

  try {
    const postIdNum = parseInt(postId);
    const post = db.getPost(postIdNum);

    if (!post) {
      await whatsappBot.sendMessage(sender, `❌ Post with ID ${postId} not found.`);
      return;
    }

    if (post.status !== 'pending') {
      await whatsappBot.sendMessage(
        sender,
        `⚠️ Post ${postId} is already ${post.status}. Use /list to see pending posts.`
      );
      return;
    }

    // Check if LinkedIn client is available
    if (!linkedinClient || !config.linkedinAccessToken) {
      await whatsappBot.sendMessage(
        sender,
        '❌ LinkedIn is not configured. Please set up LinkedIn API credentials first.\nSee API_SETUP_GUIDE.md for instructions.'
      );
      return;
    }

    await whatsappBot.sendMessage(sender, '🔄 Posting to LinkedIn... Please wait...');

    // Post to LinkedIn
    try {
      const result = await linkedinClient.createPost(post.content, post.image_path);
      
      // Update database
      db.updatePostStatus(postIdNum, 'approved');
      db.addToPostedHistory(postIdNum, post.content, post.image_url, result.postId);

      await whatsappBot.sendMessage(
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
      await whatsappBot.sendMessage(
        sender,
        `❌ Failed to post to LinkedIn: ${linkedinError.message}\n\nPost is still saved and can be retried.`
      );
    }
  } catch (error) {
    console.error('Error approving post:', error);
    await whatsappBot.sendMessage(
      sender,
      `❌ Error processing approval: ${error.message}`
    );
  }
}

// Handle /reject command
async function handleRejectCommand(sender, postId) {
  if (!postId) {
    await whatsappBot.sendMessage(
      sender,
      '❌ Please provide a post ID. Usage: /reject <post_id>'
    );
    return;
  }

  try {
    const postIdNum = parseInt(postId);
    const post = db.getPost(postIdNum);

    if (!post) {
      await whatsappBot.sendMessage(sender, `❌ Post with ID ${postId} not found.`);
      return;
    }

    db.updatePostStatus(postIdNum, 'rejected');

    // Clean up image file
    if (post.image_path && fs.existsSync(post.image_path)) {
      try {
        await fs.remove(post.image_path);
      } catch (cleanupError) {
        console.log('Image cleanup skipped:', cleanupError.message);
      }
    }

    await whatsappBot.sendMessage(
      sender,
      `✅ Post ${postId} has been rejected and removed.`
    );
  } catch (error) {
    console.error('Error rejecting post:', error);
    await whatsappBot.sendMessage(
      sender,
      `❌ Error processing rejection: ${error.message}`
    );
  }
}

// Handle /list command
async function handleListCommand(sender) {
  try {
    const pendingPosts = db.getPendingPosts();

    if (pendingPosts.length === 0) {
      await whatsappBot.sendMessage(sender, '📋 No pending posts.');
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

    await whatsappBot.sendMessage(sender, message);
  } catch (error) {
    console.error('Error listing posts:', error);
    await whatsappBot.sendMessage(sender, '❌ Error fetching posts list.');
  }
}

// Handle /status command
async function handleStatusCommand(sender) {
  try {
    const pendingCount = db.getPendingPosts().length;
    const linkedinStatus = linkedinClient && config.linkedinAccessToken ? '✅ Connected' : '❌ Not configured';
    const whatsappStatus = whatsappBot.isReady() ? '✅ Connected' : '⚠️ Connecting...';

    let message = `📊 *Bot Status*\n\n`;
    message += `WhatsApp: ${whatsappStatus}\n`;
    message += `LinkedIn: ${linkedinStatus}\n`;
    message += `Gemini: ✅ Connected\n`;
    message += `Pending Posts: ${pendingCount}\n`;

    await whatsappBot.sendMessage(sender, message);
  } catch (error) {
    console.error('Error getting status:', error);
    await whatsappBot.sendMessage(sender, '❌ Error fetching status.');
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
    `*/help* - Show this help message`;

  await whatsappBot.sendMessage(sender, helpMessage);
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  
  if (whatsappBot) {
    await whatsappBot.destroy();
  }
  
  if (db) {
    db.close();
  }
  
  console.log('✅ Shutdown complete');
  process.exit(0);
});

// Start the application
async function start() {
  try {
    console.log('🚀 Starting LinkedIn WhatsApp Automation...\n');
    
    // Initialize WhatsApp bot
    await whatsappBot.initialize();
    
    console.log('\n✅ Application started successfully!');
    console.log('📱 Waiting for WhatsApp connection...\n');
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

// Run the application
start();
