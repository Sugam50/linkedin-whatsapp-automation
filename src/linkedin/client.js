import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

class LinkedInClient {
  constructor(clientId, clientSecret, redirectUri, db = null) {
    if (!clientId || !clientSecret) {
      throw new Error('LinkedIn Client ID and Secret are required');
    }
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri || 'http://localhost:3000/auth/linkedin/callback';
    this.baseURL = 'https://api.linkedin.com/v2';
    this.authURL = 'https://www.linkedin.com/oauth/v2';
    this.accessToken = null;
    this.db = db;
    this.provider = 'linkedin';

    // Load tokens from database if available
    if (this.db) {
      this.loadTokensFromDatabase();
    }
  }

  /**
   * Load tokens from database
   */
  loadTokensFromDatabase() {
    if (!this.db) return;

    const tokenData = this.db.getOAuthToken(this.provider);
    if (tokenData) {
      this.accessToken = tokenData.access_token;
      this.refreshToken = tokenData.refresh_token;
      console.log('✅ Loaded LinkedIn tokens from database');
    }
  }

  /**
   * Save tokens to database
   * @param {object} tokenData - Token data from OAuth response
   */
  saveTokensToDatabase(tokenData) {
    if (!this.db) return;

    this.db.saveOAuthToken(this.provider, tokenData);
    this.accessToken = tokenData.access_token;
    this.refreshToken = tokenData.refresh_token;
    console.log('✅ LinkedIn tokens saved to database');
  }

  /**
   * Check if access token is expired or about to expire
   * @returns {boolean} True if token needs refresh
   */
  async isAccessTokenExpired() {
    if (!this.db) return !this.accessToken;

    return this.db.isTokenExpired(this.provider);
  }

  /**
   * Refresh access token using refresh token
   * @returns {Promise<string>} New access token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available. Please re-authorize the application.');
    }

    try {
      console.log('🔄 Refreshing LinkedIn access token...');

      const response = await axios.post(
        `${this.authURL}/accessToken`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const tokenData = response.data;
      this.saveTokensToDatabase(tokenData);

      console.log('✅ LinkedIn access token refreshed successfully');
      return this.accessToken;
    } catch (error) {
      console.error('❌ Failed to refresh LinkedIn access token:', error.response?.data || error.message);
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Ensure valid access token (refresh if needed)
   * @returns {Promise<string>} Valid access token
   */
  async ensureValidToken() {
    if (this.isAccessTokenExpired()) {
      await this.refreshAccessToken();
    }
    return this.accessToken;
  }

  /**
   * Set access token (obtained from OAuth flow)
   * @param {string} token - Access token
   */
  setAccessToken(token) {
    this.accessToken = token;
  }

  /**
   * Get OAuth authorization URL
   * @param {string[]} scopes - OAuth scopes (default: w_member_social)
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl(scopes = ['openid', 'profile', 'w_member_social']) {
    const state = Math.random().toString(36).substring(7);
  
    const url = new URL(`${this.authURL}/authorization`);
  
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('scope', scopes.join(' '));
  
    return url.toString();
  }
  

  /**
   * Complete OAuth flow with authorization code
   * @param {string} code - Authorization code from OAuth callback
   * @returns {Promise<object>} Token information
   */
  async completeOAuthFlow(code) {
    const tokenData = await this.getAccessToken(code);
    return {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
      scope: tokenData.scope
    };
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from OAuth callback
   * @returns {Promise<string>} Access token
   */
  async getAccessToken(code) {
    try {
      const response = await axios.post(
        `${this.authURL}/accessToken`,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri,
          client_id: this.clientId,
          client_secret: this.clientSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const tokenData = response.data;
      this.saveTokensToDatabase(tokenData);

      return this.accessToken;
    } catch (error) {
      console.error('Error getting access token:', error.response?.data || error.message);
      throw new Error(`Failed to get access token: ${error.message}`);
    }
  }

  /**
   * Get current user's profile ID (URN)
   * @returns {Promise<string>} User URN
   */
  async getCurrentUserProfile() {
    const token = await this.ensureValidToken();

    try {
      const response = await axios.get(
        `${this.baseURL}/userinfo`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const memberId = response.data.sub;

      return `urn:li:person:${memberId}`;
    } catch (error) {
      console.error('Error getting user profile:', error.response?.data || error.message);
      throw new Error(`Failed to get user profile: ${error.message}`);
    }
  }

  /**
   * Upload image to LinkedIn
   * @param {string} imagePath - Path to image file
   * @returns {Promise<string>} Upload URL (upload URL for image)
   */
  async uploadImage(imagePath) {
    const token = await this.ensureValidToken();

    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    try {
      // Step 1: Get user profile URN
      const userUrn = await this.getCurrentUserProfile();

      // Step 2: Initialize image upload
      const initializeResponse = await axios.post(
        `${this.baseURL}/assets?action=registerUpload`,
        {
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: userUrn,
            serviceRelationships: [{
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent'
            }]
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const uploadUrl = initializeResponse.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
      const asset = initializeResponse.data.value.asset;

      // Step 3: Upload image file
      const imageData = fs.readFileSync(imagePath);

      await axios.put(uploadUrl, imageData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'image/jpeg'
        }
      });

      return asset; // Returns asset URN
    } catch (error) {
      console.error('Error uploading image:', error.response?.data || error.message);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  /**
   * Create a LinkedIn post with text and image
   * @param {string} content - Post text content
   * @param {string} imagePath - Optional path to image file
   * @returns {Promise<object>} Post response with post ID
   */
  async createPost(content, imagePath = null) {
    const token = await this.ensureValidToken();

    try {
      const userUrn = await this.getCurrentUserProfile();

      let postData = {
        author: userUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: content
            },
            shareMediaCategory: imagePath ? 'IMAGE' : 'NONE'
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
      };

      // Add image if provided
      if (imagePath) {
        const imageAsset = await this.uploadImage(imagePath);
        postData.specificContent['com.linkedin.ugc.ShareContent'].media = [
          {
            status: 'READY',
            media: imageAsset,
            title: {
              text: 'LinkedIn Post Image'
            }
          }
        ];
      }

      const response = await axios.post(
        `${this.baseURL}/ugcPosts`,
        postData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0'
          }
        }
      );

      // Extract post ID from response headers
      const postId = response.headers['x-linkedin-id'] || response.data.id;
      
      return {
        success: true,
        postId: postId,
        message: 'Post created successfully'
      };
    } catch (error) {
      console.error('Error creating LinkedIn post:', error.response?.data || error.message);
      throw new Error(`Failed to create LinkedIn post: ${error.message}`);
    }
  }

  /**
   * Test connection by getting user profile
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection() {
    try {
      await this.ensureValidToken();
      await this.getCurrentUserProfile();
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default LinkedInClient;
