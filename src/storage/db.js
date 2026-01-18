import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseManager {
  constructor(dbPath = './data/database.db') {
    // Ensure data directory exists
    const dbDir = path.dirname(dbPath);
    fs.ensureDirSync(dbDir);

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL'); // Better performance
    this.initializeTables();
  }

  initializeTables() {
    // Posts table: stores generated posts waiting for approval
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        image_path TEXT,
        image_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        topic TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Posted history table: stores successfully posted content
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS posted_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER,
        content TEXT NOT NULL,
        image_url TEXT,
        linkedin_post_id TEXT,
        posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id)
      )
    `);

    // Configuration table for storing app settings
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // OAuth tokens table for storing LinkedIn access and refresh tokens
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        provider TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at DATETIME,
        token_type TEXT DEFAULT 'Bearer',
        scope TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database tables initialized successfully');
  }

  // Post operations
  createPost(content, imagePath = null, imageUrl = null, topic = null) {
    const stmt = this.db.prepare(`
      INSERT INTO posts (content, image_path, image_url, topic, status)
      VALUES (?, ?, ?, ?, 'pending')
    `);
    const result = stmt.run(content, imagePath, imageUrl, topic);
    return result.lastInsertRowid;
  }

  getPost(postId) {
    const stmt = this.db.prepare('SELECT * FROM posts WHERE id = ?');
    return stmt.get(postId);
  }

  getPendingPosts() {
    const stmt = this.db.prepare('SELECT * FROM posts WHERE status = ? ORDER BY created_at DESC');
    return stmt.all('pending');
  }

  updatePostStatus(postId, status) {
    const stmt = this.db.prepare(`
      UPDATE posts 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    return stmt.run(status, postId);
  }

  deletePost(postId) {
    const stmt = this.db.prepare('DELETE FROM posts WHERE id = ?');
    return stmt.run(postId);
  }

  // Posted history operations
  addToPostedHistory(postId, content, imageUrl, linkedinPostId) {
    const stmt = this.db.prepare(`
      INSERT INTO posted_history (post_id, content, image_url, linkedin_post_id)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(postId, content, imageUrl, linkedinPostId);
  }

  getPostedHistory(limit = 10) {
    const stmt = this.db.prepare(`
      SELECT * FROM posted_history 
      ORDER BY posted_at DESC 
      LIMIT ?
    `);
    return stmt.all(limit);
  }

  // Configuration operations
  setConfig(key, value) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO config (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);
    return stmt.run(key, value);
  }

  getConfig(key) {
    const stmt = this.db.prepare('SELECT value FROM config WHERE key = ?');
    const result = stmt.get(key);
    return result ? result.value : null;
  }

  // OAuth token operations
  saveOAuthToken(provider, tokenData) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO oauth_tokens
      (provider, access_token, refresh_token, expires_at, token_type, scope, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    return stmt.run(
      provider,
      tokenData.access_token,
      tokenData.refresh_token,
      expiresAt,
      tokenData.token_type || 'Bearer',
      tokenData.scope
    );
  }

  getOAuthToken(provider) {
    const stmt = this.db.prepare('SELECT * FROM oauth_tokens WHERE provider = ?');
    return stmt.get(provider);
  }

  updateAccessToken(provider, accessToken, expiresIn) {
    const stmt = this.db.prepare(`
      UPDATE oauth_tokens
      SET access_token = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE provider = ?
    `);

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    return stmt.run(accessToken, expiresAt, provider);
  }

  isTokenExpired(provider) {
    const token = this.getOAuthToken(provider);
    if (!token || !token.expires_at) return true;

    // Add 5-minute buffer before expiry
    const expiryTime = new Date(token.expires_at).getTime() - (5 * 60 * 1000);
    return Date.now() >= expiryTime;
  }

  deleteOAuthToken(provider) {
    const stmt = this.db.prepare('DELETE FROM oauth_tokens WHERE provider = ?');
    return stmt.run(provider);
  }

  // Cleanup operations
  cleanupOldPosts(daysOld = 30) {
    const stmt = this.db.prepare(`
      DELETE FROM posts 
      WHERE status != 'pending' 
      AND created_at < datetime('now', '-' || ? || ' days')
    `);
    return stmt.run(daysOld);
  }

  close() {
    this.db.close();
  }
}

export default DatabaseManager;
