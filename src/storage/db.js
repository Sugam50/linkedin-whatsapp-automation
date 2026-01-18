import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseManager {
  constructor(dbPath = './data/database.db') {
    // Ensure data directory exists
    const dbDir = path.dirname(dbPath);
    fs.ensureDirSync(dbDir);

    this.databaseUrl = process.env.DATABASE_URL || null;
    this.isPostgres = !!this.databaseUrl;

    if (this.isPostgres) {
      const { Pool } = require('pg');
      this.pool = new Pool({ connectionString: this.databaseUrl, max: 10 });
      this.ready = this.initializePostgresTables();
    } else {
      const Database = require('better-sqlite3');
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      this.initializeSqliteTables();
      this.ready = Promise.resolve();
    }
  }

  /* -------------------- Initialization -------------------- */
  async initializePostgresTables() {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS posts (
          id SERIAL PRIMARY KEY,
          content TEXT NOT NULL,
          image_path TEXT,
          image_url TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          topic TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS posted_history (
          id SERIAL PRIMARY KEY,
          post_id INTEGER,
          content TEXT NOT NULL,
          image_url TEXT,
          linkedin_post_id TEXT,
          posted_at TIMESTAMPTZ DEFAULT NOW(),
          FOREIGN KEY (post_id) REFERENCES posts(id)
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS config (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS oauth_tokens (
          provider TEXT PRIMARY KEY,
          access_token TEXT NOT NULL,
          refresh_token TEXT,
          expires_at TIMESTAMPTZ,
          token_type TEXT DEFAULT 'Bearer',
          scope TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    } finally {
      client.release();
    }
  }

  initializeSqliteTables() {
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

    console.log('SQLite tables initialized successfully');
  }

  /* -------------------- Utility -------------------- */
  async ensureReady() {
    if (this.ready) await this.ready;
  }

  /* -------------------- Post operations -------------------- */
  async createPost(content, imagePath = null, imageUrl = null, topic = null) {
    if (this.isPostgres) {
      await this.ensureReady();
      const res = await this.pool.query(
        `INSERT INTO posts (content, image_path, image_url, topic, status)
         VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
        [content, imagePath, imageUrl, topic]
      );
      return res.rows[0].id;
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO posts (content, image_path, image_url, topic, status)
        VALUES (?, ?, ?, ?, 'pending')
      `);
      const result = stmt.run(content, imagePath, imageUrl, topic);
      return result.lastInsertRowid;
    }
  }

  async getPost(postId) {
    if (this.isPostgres) {
      await this.ensureReady();
      const res = await this.pool.query('SELECT * FROM posts WHERE id = $1', [postId]);
      return res.rows[0] || null;
    } else {
      const stmt = this.db.prepare('SELECT * FROM posts WHERE id = ?');
      return stmt.get(postId);
    }
  }

  async getPendingPosts() {
    if (this.isPostgres) {
      await this.ensureReady();
      const res = await this.pool.query('SELECT * FROM posts WHERE status = $1 ORDER BY created_at DESC', ['pending']);
      return res.rows;
    } else {
      const stmt = this.db.prepare('SELECT * FROM posts WHERE status = ? ORDER BY created_at DESC');
      return stmt.all('pending');
    }
  }

  async updatePostStatus(postId, status) {
    if (this.isPostgres) {
      await this.ensureReady();
      return await this.pool.query('UPDATE posts SET status = $1, updated_at = NOW() WHERE id = $2', [status, postId]);
    } else {
      const stmt = this.db.prepare(`
        UPDATE posts 
        SET status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      return stmt.run(status, postId);
    }
  }

  async deletePost(postId) {
    if (this.isPostgres) {
      await this.ensureReady();
      return await this.pool.query('DELETE FROM posts WHERE id = $1', [postId]);
    } else {
      const stmt = this.db.prepare('DELETE FROM posts WHERE id = ?');
      return stmt.run(postId);
    }
  }

  /* -------------------- Posted history -------------------- */
  async addToPostedHistory(postId, content, imageUrl, linkedinPostId) {
    if (this.isPostgres) {
      await this.ensureReady();
      return await this.pool.query(
        `INSERT INTO posted_history (post_id, content, image_url, linkedin_post_id)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [postId, content, imageUrl, linkedinPostId]
      );
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO posted_history (post_id, content, image_url, linkedin_post_id)
        VALUES (?, ?, ?, ?)
      `);
      return stmt.run(postId, content, imageUrl, linkedinPostId);
    }
  }

  async getPostedHistory(limit = 10) {
    if (this.isPostgres) {
      await this.ensureReady();
      const res = await this.pool.query('SELECT * FROM posted_history ORDER BY posted_at DESC LIMIT $1', [limit]);
      return res.rows;
    } else {
      const stmt = this.db.prepare(`
        SELECT * FROM posted_history 
        ORDER BY posted_at DESC 
        LIMIT ?
      `);
      return stmt.all(limit);
    }
  }

  /* -------------------- Config operations -------------------- */
  async setConfig(key, value) {
    if (this.isPostgres) {
      await this.ensureReady();
      return await this.pool.query(`
        INSERT INTO config (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `, [key, value]);
    } else {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO config (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `);
      return stmt.run(key, value);
    }
  }

  async getConfig(key) {
    if (this.isPostgres) {
      await this.ensureReady();
      const res = await this.pool.query('SELECT value FROM config WHERE key = $1', [key]);
      return res.rows[0] ? res.rows[0].value : null;
    } else {
      const stmt = this.db.prepare('SELECT value FROM config WHERE key = ?');
      const result = stmt.get(key);
      return result ? result.value : null;
    }
  }

  /* -------------------- OAuth token operations -------------------- */
  async saveOAuthToken(provider, tokenData) {
    const expiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null;
    if (this.isPostgres) {
      await this.ensureReady();
      return await this.pool.query(`
        INSERT INTO oauth_tokens (provider, access_token, refresh_token, expires_at, token_type, scope, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (provider) DO UPDATE SET
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          expires_at = EXCLUDED.expires_at,
          token_type = EXCLUDED.token_type,
          scope = EXCLUDED.scope,
          updated_at = NOW()
      `, [provider, tokenData.access_token, tokenData.refresh_token, expiresAt, tokenData.token_type || 'Bearer', tokenData.scope]);
    } else {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO oauth_tokens
        (provider, access_token, refresh_token, expires_at, token_type, scope, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      return stmt.run(provider, tokenData.access_token, tokenData.refresh_token, expiresAt, tokenData.token_type || 'Bearer', tokenData.scope);
    }
  }

  async getOAuthToken(provider) {
    if (this.isPostgres) {
      await this.ensureReady();
      const res = await this.pool.query('SELECT * FROM oauth_tokens WHERE provider = $1', [provider]);
      return res.rows[0] || null;
    } else {
      const stmt = this.db.prepare('SELECT * FROM oauth_tokens WHERE provider = ?');
      return stmt.get(provider);
    }
  }

  async updateAccessToken(provider, accessToken, expiresIn) {
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
    if (this.isPostgres) {
      await this.ensureReady();
      return await this.pool.query('UPDATE oauth_tokens SET access_token = $1, expires_at = $2, updated_at = NOW() WHERE provider = $3', [accessToken, expiresAt, provider]);
    } else {
      const stmt = this.db.prepare(`
        UPDATE oauth_tokens
        SET access_token = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE provider = ?
      `);
      return stmt.run(accessToken, expiresAt, provider);
    }
  }

  async isTokenExpired(provider) {
    const token = await this.getOAuthToken(provider);
    if (!token || !token.expires_at) return true;
    const expiryTime = new Date(token.expires_at).getTime() - (5 * 60 * 1000);
    return Date.now() >= expiryTime;
  }

  async deleteOAuthToken(provider) {
    if (this.isPostgres) {
      await this.ensureReady();
      return await this.pool.query('DELETE FROM oauth_tokens WHERE provider = $1', [provider]);
    } else {
      const stmt = this.db.prepare('DELETE FROM oauth_tokens WHERE provider = ?');
      return stmt.run(provider);
    }
  }

  /* -------------------- Cleanup -------------------- */
  async cleanupOldPosts(daysOld = 30) {
    if (this.isPostgres) {
      await this.ensureReady();
      return await this.pool.query(`DELETE FROM posts WHERE status != 'pending' AND created_at < NOW() - INTERVAL '${daysOld} days'`);
    } else {
      const stmt = this.db.prepare(`
        DELETE FROM posts 
        WHERE status != 'pending' 
        AND created_at < datetime('now', '-' || ? || ' days')
      `);
      return stmt.run(daysOld);
    }
  }

  async close() {
    if (this.isPostgres && this.pool) {
      await this.pool.end();
    } else if (this.db) {
      this.db.close();
    }
  }
}

export default DatabaseManager;
