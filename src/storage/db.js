import { Pool } from 'pg';

/**
 * Postgres-only DatabaseManager.
 * Requires DATABASE_URL in environment (Supabase Postgres).
 */
class DatabaseManager {
  constructor() {
    this.databaseUrl = process.env.DATABASE_URL;
    if (!this.databaseUrl) {
      throw new Error('DATABASE_URL is required in environment for Postgres mode');
    }
    this.pool = new Pool({ connectionString: this.databaseUrl, max: 10 });
    this.ready = this.initializePostgresTables();
  }

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

  async ensureReady() {
    if (this.ready) await this.ready;
  }

  async createPost(content, imagePath = null, imageUrl = null, topic = null) {
    await this.ensureReady();
    const res = await this.pool.query(
      `INSERT INTO posts (content, image_path, image_url, topic, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
      [content, imagePath, imageUrl, topic]
    );
    return res.rows[0].id;
  }

  async getPost(postId) {
    await this.ensureReady();
    const res = await this.pool.query('SELECT * FROM posts WHERE id = $1', [postId]);
    return res.rows[0] || null;
  }

  async getPendingPosts() {
    await this.ensureReady();
    const res = await this.pool.query('SELECT * FROM posts WHERE status = $1 ORDER BY created_at DESC', ['pending']);
    return res.rows;
  }

  async updatePostStatus(postId, status) {
    await this.ensureReady();
    return await this.pool.query('UPDATE posts SET status = $1, updated_at = NOW() WHERE id = $2', [status, postId]);
  }

  async deletePost(postId) {
    await this.ensureReady();
    return await this.pool.query('DELETE FROM posts WHERE id = $1', [postId]);
  }

  async addToPostedHistory(postId, content, imageUrl, linkedinPostId) {
    await this.ensureReady();
    return await this.pool.query(
      `INSERT INTO posted_history (post_id, content, image_url, linkedin_post_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [postId, content, imageUrl, linkedinPostId]
    );
  }

  async getPostedHistory(limit = 10) {
    await this.ensureReady();
    const res = await this.pool.query('SELECT * FROM posted_history ORDER BY posted_at DESC LIMIT $1', [limit]);
    return res.rows;
  }

  async setConfig(key, value) {
    await this.ensureReady();
    return await this.pool.query(`
      INSERT INTO config (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `, [key, value]);
  }

  async getConfig(key) {
    await this.ensureReady();
    const res = await this.pool.query('SELECT value FROM config WHERE key = $1', [key]);
    return res.rows[0] ? res.rows[0].value : null;
  }

  async saveOAuthToken(provider, tokenData) {
    const expiresIn = new Date();
    expiresIn.setMonth(expiresIn.getMonth() + 2);
    const expiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : new Date(expiresIn).toISOString();
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
  }

  async getOAuthToken(provider) {
    await this.ensureReady();
    const res = await this.pool.query('SELECT * FROM oauth_tokens WHERE provider = $1', [provider]);
    return res.rows[0] || null;
  }

  async updateAccessToken(provider, accessToken, expiresIn) {
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
    await this.ensureReady();
    return await this.pool.query('UPDATE oauth_tokens SET access_token = $1, expires_at = $2, updated_at = NOW() WHERE provider = $3', [accessToken, expiresAt, provider]);
  }

  async isTokenExpired(provider) {
    const token = await this.getOAuthToken(provider);
    if (!token || !token.expires_at) return true;
    const expiryTime = new Date(token.expires_at).getTime() - (5 * 60 * 1000);
    return Date.now() >= expiryTime;
  }

  async deleteOAuthToken(provider) {
    await this.ensureReady();
    return await this.pool.query('DELETE FROM oauth_tokens WHERE provider = $1', [provider]);
  }

  async cleanupOldPosts(daysOld = 30) {
    await this.ensureReady();
    return await this.pool.query(`DELETE FROM posts WHERE status != 'pending' AND created_at < NOW() - INTERVAL '${daysOld} days'`);
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

export default DatabaseManager;
