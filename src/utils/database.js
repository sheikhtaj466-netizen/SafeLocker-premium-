// File: src/utils/database.js
import * as SQLite from 'expo-sqlite';

let db = null;

export const initDB = () => {
  try {
    db = SQLite.openDatabaseSync('safelocker_vault.db');

    // =========================================
    // 1. ENTRIES TABLE 
    // ==========================================
    db.execSync(`
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        type TEXT,
        title_enc TEXT,
        username_enc TEXT,
        password_enc TEXT,
        notes_enc TEXT,
        url_enc TEXT,
        is_decoy INTEGER DEFAULT 0,
        created_at TEXT
      );
    `);

    // 🚀 AUTO-FIX MIGRATION: Agar purana database hai toh is_decoy column khud add hoga
    try {
      db.execSync(`ALTER TABLE entries ADD COLUMN is_decoy INTEGER DEFAULT 0;`);
    } catch (e) {
      // Column already exists, safe to ignore
    }

    // ==========================================
    // 2. FOLDERS TABLE
    // ==========================================
    db.execSync(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name_enc TEXT,
        color TEXT,
        is_locked INTEGER DEFAULT 0,
        is_favorite INTEGER DEFAULT 0,
        created_at TEXT
      );
    `);

    // ==========================================
    // 3. FILES TABLE
    // ==========================================
    db.execSync(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        name_enc TEXT,
        uri TEXT,
        size INTEGER,
        extension TEXT,
        mime_type TEXT,
        folder_id TEXT,
        is_favorite INTEGER DEFAULT 0,
        is_locked INTEGER DEFAULT 0,
        is_hidden INTEGER DEFAULT 0,
        is_trashed INTEGER DEFAULT 0,
        trashed_at TEXT,
        last_opened_at TEXT,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
      );
    `);

    // ==========================================
    // 4. SMART INDEXES
    // ==========================================
    db.execSync(`
      CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
      CREATE INDEX IF NOT EXISTS idx_files_favorite ON files(is_favorite);
      CREATE INDEX IF NOT EXISTS idx_files_trashed ON files(is_trashed);
      CREATE INDEX IF NOT EXISTS idx_files_hidden ON files(is_hidden);
      CREATE INDEX IF NOT EXISTS idx_files_recent ON files(last_opened_at DESC);
    `);
    
    console.log('✅ SQLite Database aur Safe Migration ekdum makkhan ready hain!');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    return false;
  }
};

export const getDB = () => db;
