// File: src/utils/fileStorage.js
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { getDB } from './database';
import { getActiveVaultKey } from './storage'; 
import { CryptoEngine } from './cryptoEngine';

const VAULT_DIR = FileSystem.documentDirectory + 'SafeLocker_Files/';

const safeEncrypt = (text, key) => {
  try { if (!text) return 'Unknown'; return CryptoEngine.encryptData(String(text), key); } 
  catch(e) { return String(text); } 
};

const safeDecrypt = (cipher, key) => {
  try { 
    if (!cipher) return 'Unknown';
    if (!cipher.startsWith('{') && !cipher.includes('U2Fz')) return cipher; 
    const dec = CryptoEngine.decryptData(cipher, key);
    return dec || 'Unknown';
  } catch(e) { return 'Unknown'; }
};

export const initFileStorage = async () => {
  const dirInfo = await FileSystem.getInfoAsync(VAULT_DIR);
  if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(VAULT_DIR, { intermediates: true });
};

export const getFolders = async () => {
   const db = getDB(); const key = getActiveVaultKey(); if (!db || !key) return [];
   const rows = db.getAllSync(`SELECT * FROM folders`);
   return rows.filter(r => r.id && !r.id.includes('__MACOSX') && !r.name_enc.includes('MACOSX') && !r.id.includes('.safelocker')).map(r => ({
       id: r.id, name: safeDecrypt(r.name_enc, key), color: r.color, is_locked: r.is_locked, is_favorite: r.is_favorite
   }));
};

export const getFiles = async (folderName = 'All', searchQuery = '', folderId = null) => {
   const db = getDB(); const key = getActiveVaultKey(); if (!db || !key) return [];
   let query = `SELECT * FROM files WHERE is_trashed = 0`;
   let params = [];
   if (folderName === 'Favorites') { query += ` AND is_favorite = 1`; } 
   else if (folderName === 'Trash') { query = `SELECT * FROM files WHERE is_trashed = 1`; } 
   else if (folderId) { query += ` AND folder_id = ?`; params.push(folderId); }
   
   const rows = db.getAllSync(query, params);
   let files = rows.map(r => ({
       ...r, name: safeDecrypt(r.name_enc, key)
   }));

   if (searchQuery) {
       const lowerQ = searchQuery.toLowerCase();
       files = files.filter(f => f.name.toLowerCase().includes(lowerQ));
   }
   return files;
};

export const createFolder = async (name, color = '#6C5CE7') => {
   const db = getDB(); const key = getActiveVaultKey(); if (!db || !key) return false;
   const id = 'fold_' + Date.now();
   const name_enc = safeEncrypt(name, key);
   db.runSync(`INSERT INTO folders (id, name_enc, color, created_at) VALUES (?, ?, ?, ?)`, [id, name_enc, color, new Date().toISOString()]);
   return true;
};

export const importFiles = async (folderId = null) => {
  try {
    const key = getActiveVaultKey(); const db = getDB(); if (!key || !db) return { success: false };
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: true });
    if (result.canceled) return { success: false, cancelled: true };
    
    await initFileStorage();
    db.withTransactionSync(() => {
        for (let file of result.assets) {
            const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'file';
            const id = 'file_' + Date.now() + Math.floor(Math.random()*1000);
            const newUri = VAULT_DIR + id + '.' + ext;
            FileSystem.copyAsync({ from: file.uri, to: newUri });
            // Original file.name encrypt ho raha hai yahan par
            db.runSync(`INSERT INTO files (id, name_enc, uri, size, extension, mime_type, folder_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, safeEncrypt(file.name, key), newUri, file.size, ext, file.mimeType || '*/*', folderId, new Date().toISOString()]);
        }
    });
    return { success: true };
  } catch(e) { return { success: false }; }
};

export const performBulkAction = async (action, fileIds, targetFolderId = null) => {
    const db = getDB(); if (!db || !fileIds || fileIds.length === 0) return;
    const ids = fileIds.map(id => `'${id}'`).join(',');
    
    if (action === 'favorite') db.runSync(`UPDATE files SET is_favorite = 1 WHERE id IN (${ids})`);
    if (action === 'unfavorite') db.runSync(`UPDATE files SET is_favorite = 0 WHERE id IN (${ids})`);
    if (action === 'trash') db.runSync(`UPDATE files SET is_trashed = 1, is_favorite = 0, trashed_at = ? WHERE id IN (${ids})`, [new Date().toISOString()]);
    if (action === 'restore') db.runSync(`UPDATE files SET is_trashed = 0, trashed_at = NULL WHERE id IN (${ids})`);
    if (action === 'move') db.runSync(`UPDATE files SET folder_id = ? WHERE id IN (${ids})`, [targetFolderId]);
    if (action === 'delete_forever') {
        const rows = db.getAllSync(`SELECT uri FROM files WHERE id IN (${ids})`);
        for (let r of rows) { try { await FileSystem.deleteAsync(r.uri, {idempotent: true}); } catch(e){} }
        db.runSync(`DELETE FROM files WHERE id IN (${ids})`);
    }
};

export const renameFile = async (id, newName) => {
    const db = getDB(); const key = getActiveVaultKey(); if(!db || !key) return false;
    db.runSync(`UPDATE files SET name_enc = ? WHERE id = ?`, [safeEncrypt(newName, key), id]);
    return true;
};

export const renameFolder = async (id, newName) => {
    const db = getDB(); const key = getActiveVaultKey(); if(!db || !key) return false;
    db.runSync(`UPDATE folders SET name_enc = ? WHERE id = ?`, [safeEncrypt(newName, key), id]);
    return true;
};

export const deleteFolder = async (id) => {
    const db = getDB(); if(!db) return;
    db.runSync(`UPDATE files SET folder_id = NULL WHERE folder_id = ?`, [id]);
    db.runSync(`DELETE FROM folders WHERE id = ?`, [id]);
};
