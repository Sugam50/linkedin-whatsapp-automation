#!/usr/bin/env node
/**
 * Migrate data from local SQLite (data/database.db) to Postgres (DATABASE_URL).
 *
 * Usage:
 *   node scripts/migrate_sqlite_to_postgres.js
 *
 * Ensure DATABASE_URL env var is set (pointing to your Supabase Postgres).
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const path = require('path');
const fs = require('fs');

const Database = require('better-sqlite3');
const { Pool } = require('pg');

const SQLITE_PATH = path.resolve(process.cwd(), process.env.DB_PATH || './data/database.db');
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL in environment. Aborting migration.');
  process.exit(1);
}

if (!fs.existsSync(SQLITE_PATH)) {
  console.error('SQLite DB not found at', SQLITE_PATH);
  process.exit(1);
}

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const pool = new Pool({ connectionString: DATABASE_URL });

async function run() {
  console.log('Starting migration from', SQLITE_PATH, 'to', DATABASE_URL);

  const client = await pool.connect();
  try {
    // Create tables if not exist (idempotent)
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
        posted_at TIMESTAMPTZ DEFAULT NOW()
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

    // Copy posts
    const posts = sqlite.prepare('SELECT * FROM posts').all();
    console.log('Found', posts.length, 'posts in SQLite');
    for (const p of posts) {
      // Insert preserving id if possible
      await client.query(
        `INSERT INTO posts (id, content, image_path, image_url, status, topic, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO NOTHING`,
        [p.id, p.content, p.image_path, p.image_url, p.status, p.topic, p.created_at, p.updated_at]
      );
    }

    // Copy posted_history
    const history = sqlite.prepare('SELECT * FROM posted_history').all();
    console.log('Found', history.length, 'posted_history rows');
    for (const h of history) {
      await client.query(
        `INSERT INTO posted_history (id, post_id, content, image_url, linkedin_post_id, posted_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO NOTHING`,
        [h.id, h.post_id, h.content, h.image_url, h.linkedin_post_id, h.posted_at]
      );
    }

    // Copy config
    const configs = sqlite.prepare('SELECT * FROM config').all();
    console.log('Found', configs.length, 'config rows');
    for (const c of configs) {
      await client.query(
        `INSERT INTO config (key, value, updated_at)
         VALUES ($1,$2,$3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
        [c.key, c.value, c.updated_at]
      );
    }

    // Copy oauth_tokens
    const tokens = sqlite.prepare('SELECT * FROM oauth_tokens').all();
    console.log('Found', tokens.length, 'oauth token rows');
    for (const t of tokens) {
      await client.query(
        `INSERT INTO oauth_tokens (provider, access_token, refresh_token, expires_at, token_type, scope, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (provider) DO UPDATE SET
           access_token = EXCLUDED.access_token,
           refresh_token = EXCLUDED.refresh_token,
           expires_at = EXCLUDED.expires_at,
           token_type = EXCLUDED.token_type,
           scope = EXCLUDED.scope,
           updated_at = EXCLUDED.updated_at`,
        [t.provider, t.access_token, t.refresh_token, t.expires_at, t.token_type, t.scope, t.created_at, t.updated_at]
      );
    }

    // Reset sequences for serial ids
    await client.query(`SELECT setval(pg_get_serial_sequence('posts','id'), COALESCE((SELECT MAX(id) FROM posts), 1), true)`);
    await client.query(`SELECT setval(pg_get_serial_sequence('posted_history','id'), COALESCE((SELECT MAX(id) FROM posted_history), 1), true)`);

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

run().catch(err => {
  console.error('Unhandled error during migration:', err);
  process.exit(1);
});

