// File: src/utils/storage.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { getDB } from './database';
import { CryptoEngine } from './cryptoEngine';

const KEYS = {
  MASTER_PIN: 'MASTER_PIN', SETTINGS: 'SETTINGS',
  RECOVERY_EMAIL: 'RECOVERY_EMAIL', EMAIL_VERIFIED: 'EMAIL_VERIFIED', 
  RECOVERY_CODE: 'RECOVERY_CODE', SESSION_MODE: 'SESSION_MODE',
  CUSTOM_TYPES: 'CUSTOM_VAULT_TYPES', FAKE_PIN: 'FAKE_PIN', 
  DEVICE_ID: 'DEVICE_ID', SECURITY_STATE: 'SECURITY_STATE',
  ACTIVITY_LOGS: 'ACTIVITY_LOGS', LOCK_PROFILE: 'LOCK_PROFILE',
  CLOUD_ACCOUNT: 'CLOUD_ACCOUNT', CLOUD_CONFIG: 'CLOUD_CONFIG',
  COLOR_HISTORY: 'COLOR_HISTORY', DAILY_OPENS: 'DAILY_OPENS', DAILY_DATE: 'DAILY_DATE'
};

let activeVaultKey = null;

// 🚀 ULTRA SMART MEMORY CACHE (App speed badhane ke liye)
let memoryVaultCache = { normal: null, decoy: null }; 

export const setActiveVaultKey = (key) => { activeVaultKey = key; };
export const clearActiveVaultKey = () => { 
  activeVaultKey = null; 
  memoryVaultCache = { normal: null, decoy: null }; // Clear cache for security
};
export const getActiveVaultKey = () => activeVaultKey;

// AUTO-RECOVERY SYSTEM
export const ensureVaultKey = async () => {
  if (activeVaultKey) return activeVaultKey;
  try {
    const pin = await getMasterPin();
    if (pin && CryptoEngine && typeof CryptoEngine.getVaultKey === 'function') {
       const key = await CryptoEngine.getVaultKey(pin);
       if (key) { activeVaultKey = key; return key; }
    }
  } catch (e) { console.log("Auto-key recovery failed:", e); }
  return null;
};

export const generateSmartRecoveryCode = () => {
  const d1 = Math.floor(Math.random() * 10); const d2 = Math.floor(Math.random() * 10);
  const patterns = [`${d1}${d1}${d2}${d2}`, `${d1}${d2}${d2}${d1}`, `${d1}${d2}${d1}${d2}`];
  return patterns[Math.floor(Math.random() * patterns.length)];
};

export const getVaultData = async () => { 
  try { 
    const mode = await getSessionMode(); 
    const isDecoy = mode === 'LIMITED';
    const cacheKey = isDecoy ? 'decoy' : 'normal';

    // 🚀 CACHE RETURN: Agar data already loaded hai, toh turant return kardo (Zero Lag)
    if (memoryVaultCache[cacheKey]) return memoryVaultCache[cacheKey];

    const isDecoyInt = isDecoy ? 1 : 0; 
    const key = await ensureVaultKey();
    if (!key || !CryptoEngine) return null; 

    const db = getDB();
    let rows = [];
    let hasValidDbData = false;

    if (db) {
        try { rows = db.getAllSync(`SELECT * FROM entries WHERE is_decoy = ?`, [isDecoyInt]); } 
        catch(e) { try { rows = db.getAllSync(`SELECT * FROM entries`); } catch (err) { return null; } }
    }

    let decryptedData = [];

    if (rows && rows.length > 0) {
        for (let row of rows) {
          const decryptedString = CryptoEngine.decryptData(row.notes_enc, key);
          if (decryptedString) {
            hasValidDbData = true;
            try { decryptedData.push(JSON.parse(decryptedString)); } 
            catch(e) {
              decryptedData.push({
                id: row.id, type: row.type, title: CryptoEngine.decryptData(row.title_enc, key) || 'Corrupted',
                username: CryptoEngine.decryptData(row.username_enc, key) || '', password: CryptoEngine.decryptData(row.password_enc, key) || '',
                notes: decryptedString, url: CryptoEngine.decryptData(row.url_enc, key) || '', date: row.created_at
              });
            }
          }
        }
    }
    
    // Fallback for Legacy Data
    if (!hasValidDbData) {
        const legacyKey = isDecoy ? 'DECOY_VAULT_DATA' : 'VAULT_DATA';
        const legacyDataRaw = await AsyncStorage.getItem(legacyKey);
        if (legacyDataRaw) {
            const parsedLegacy = JSON.parse(legacyDataRaw);
            for (let item of parsedLegacy) {
                try {
                   const dec = CryptoEngine.decryptData(item.data, key);
                   if (dec) decryptedData.push(JSON.parse(dec));
                } catch(e) {}
            }
            if (decryptedData.length > 0) await saveVaultData(decryptedData); 
        }
    }

    // Save to Cache before returning
    memoryVaultCache[cacheKey] = decryptedData;
    return decryptedData; 
  } catch (error) { return null; } 
};

export const saveVaultData = async (dataArray) => { 
  try { 
    const mode = await getSessionMode(); 
    const isDecoy = mode === 'LIMITED';
    const isDecoyInt = isDecoy ? 1 : 0; 
    
    const key = await ensureVaultKey();
    if (!key || !CryptoEngine) return false; 

    // 🚀 INVALIDATE CACHE: Data update hora hai, toh purana cache hata do
    memoryVaultCache[isDecoy ? 'decoy' : 'normal'] = null;

    const db = getDB();
    if (db) {
        db.withTransactionSync(() => {
          // 🚀 SQL INJECTION FIX: Cleaned IDs to prevent database crash
          const keepIds = dataArray.map(item => `'${item.id.replace(/'/g, "''")}'`).join(',');
          
          try {
              if (keepIds.length > 0) db.runSync(`DELETE FROM entries WHERE is_decoy = ${isDecoyInt} AND id NOT IN (${keepIds})`);
              else db.runSync(`DELETE FROM entries WHERE is_decoy = ${isDecoyInt}`);
          } catch (e) {
              if (keepIds.length > 0) db.runSync(`DELETE FROM entries WHERE id NOT IN (${keepIds})`);
              else db.runSync(`DELETE FROM entries`);
          }

          for (let item of dataArray) {
            const fullPayloadString = JSON.stringify(item);
            const encryptedPayload = CryptoEngine.encryptData(fullPayloadString, key);
            const title_enc = CryptoEngine.encryptData(item.title || 'Untitled', key);

            try {
                db.runSync(`INSERT OR REPLACE INTO entries (id, type, title_enc, username_enc, password_enc, notes_enc, url_enc, is_decoy, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                  [item.id, item.type || 'Custom', title_enc, '', '', encryptedPayload, '', isDecoyInt, item.date || new Date().toISOString()]
                );
            } catch(e) {
                db.runSync(`INSERT OR REPLACE INTO entries (id, type, title_enc, username_enc, password_enc, notes_enc, url_enc, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
                  [item.id, item.type || 'Custom', title_enc, '', '', encryptedPayload, '', item.date || new Date().toISOString()]
                );
            }
          }
        });
    }
    
    const legacyKey = isDecoy ? 'DECOY_VAULT_DATA' : 'VAULT_DATA';
    const legacyFormat = dataArray.map(item => ({
        id: item.id, data: CryptoEngine.encryptData(JSON.stringify(item), key), date: item.date || new Date().toISOString()
    }));
    await AsyncStorage.setItem(legacyKey, JSON.stringify(legacyFormat));

    // Update Cache directly for instant reload
    memoryVaultCache[isDecoy ? 'decoy' : 'normal'] = dataArray;
    return true; 
  } catch (error) { return false; } 
};

// --- PREFERENCES & SETTINGS ---
export const getMasterPin = async () => await AsyncStorage.getItem(KEYS.MASTER_PIN);
export const saveMasterPin = async (pin) => await AsyncStorage.setItem(KEYS.MASTER_PIN, pin);
export const getSettings = async () => { try { const data = await AsyncStorage.getItem(KEYS.SETTINGS); let parsed = data ? JSON.parse(data) : {}; if (!parsed.autoLockTimer) parsed.autoLockTimer = '2 min'; if (parsed.lockOnExit === undefined) parsed.lockOnExit = false; return parsed; } catch (error) { return { autoLockTimer: '2 min', lockOnExit: false }; } };
export const updateSetting = async (key, value) => { try { const settings = await getSettings(); settings[key] = value; await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings)); return true; } catch (error) { return false; } };
export const getRecoveryEmail = async () => { let email = await AsyncStorage.getItem('SAFEGALLERY_RECOVERY_EMAIL'); if (!email) email = await AsyncStorage.getItem(KEYS.RECOVERY_EMAIL); return email; };
export const getEmailVerified = async () => { let verified = await AsyncStorage.getItem('SAFEGALLERY_EMAIL_VERIFIED'); if (!verified) verified = await AsyncStorage.getItem(KEYS.EMAIL_VERIFIED); return verified === 'true'; };
export const getRecoveryCode = async () => await AsyncStorage.getItem(KEYS.RECOVERY_CODE);
export const saveRecoveryCode = async (code) => await AsyncStorage.setItem(KEYS.RECOVERY_CODE, code);
export const getFakePin = async () => await AsyncStorage.getItem(KEYS.FAKE_PIN);
export const saveFakePin = async (pin) => await AsyncStorage.setItem(KEYS.FAKE_PIN, pin);
export const getSessionMode = async () => await AsyncStorage.getItem(KEYS.SESSION_MODE);
export const setSessionMode = async (mode) => { if (mode) await AsyncStorage.setItem(KEYS.SESSION_MODE, mode); else await AsyncStorage.removeItem(KEYS.SESSION_MODE); };
export const getCustomTypes = async () => { try { const data = await AsyncStorage.getItem(KEYS.CUSTOM_TYPES); return data ? JSON.parse(data) : []; } catch (error) { return []; } };
export const saveCustomTypes = async (typesArray) => { try { await AsyncStorage.setItem(KEYS.CUSTOM_TYPES, JSON.stringify(typesArray)); return true; } catch (error) { return false; } };
export const getGalleryPhotos = async () => { try { const data = await AsyncStorage.getItem('SAFEGALLERY_PHOTOS'); return data ? JSON.parse(data) : []; } catch(e){ return []; }};
export const saveGalleryPhotos = async (data) => { await AsyncStorage.setItem('SAFEGALLERY_PHOTOS', JSON.stringify(data)); };
export const getGalleryCollections = async () => { try { const data = await AsyncStorage.getItem('SAFEGALLERY_COLLECTIONS'); return data ? JSON.parse(data) : []; } catch(e){ return []; }};
export const saveGalleryCollections = async (data) => { await AsyncStorage.setItem('SAFEGALLERY_COLLECTIONS', JSON.stringify(data)); };
export const getSecurityState = async () => { try { const data = await AsyncStorage.getItem(KEYS.SECURITY_STATE); return data ? JSON.parse(data) : { attemptCount: 0, blockUntil: 0 }; } catch (error) { return { attemptCount: 0, blockUntil: 0 }; } };
export const updateSecurityState = async (attemptCount, blockUntil = 0) => { try { await AsyncStorage.setItem(KEYS.SECURITY_STATE, JSON.stringify({ attemptCount, blockUntil })); return true; } catch (error) { return false; } };
export const clearSecurityState = async () => { try { await AsyncStorage.removeItem(KEYS.SECURITY_STATE); return true; } catch (error) { return false; } };

export const logActivity = async (moduleName, actionTitle, detailsText = "System event recorded.", severityLvl = "NORMAL") => {
  try {
    const newEvent = { id: Date.now().toString() + Math.random().toString(36).substring(2, 7), module: moduleName || 'System', action: actionTitle || 'Action', details: detailsText, severity: severityLvl, timestamp: new Date().toISOString(), device: Platform.OS };
    const existingLogsStr = await AsyncStorage.getItem(KEYS.ACTIVITY_LOGS); let logs = existingLogsStr ? JSON.parse(existingLogsStr) : []; logs.unshift(newEvent); if (logs.length > 300) logs = logs.slice(0, 300); await AsyncStorage.setItem(KEYS.ACTIVITY_LOGS, JSON.stringify(logs)); return true;
  } catch (error) { return false; }
};

export const getLockProfile = async () => { try { const profile = await AsyncStorage.getItem(KEYS.LOCK_PROFILE); return profile || 'BIO_OR_PIN'; } catch (error) { return 'BIO_OR_PIN'; } };
export const saveLockProfile = async (profileMode) => { try { await AsyncStorage.setItem(KEYS.LOCK_PROFILE, profileMode); return true; } catch (error) { return false; } };
export const getColorHistory = async () => { try { const data = await AsyncStorage.getItem(KEYS.COLOR_HISTORY); return data ? JSON.parse(data) : []; } catch (e) { return []; } };
export const saveColorHistory = async (colorHex) => { try { let history = await getColorHistory(); history = [colorHex, ...history.filter(c => c !== colorHex)].slice(0, 5); await AsyncStorage.setItem(KEYS.COLOR_HISTORY, JSON.stringify(history)); return history; } catch (e) { return []; } };

export const clearAllData = async () => { 
  try { 
    await AsyncStorage.clear(); 
    clearActiveVaultKey(); // 🚀 Clean cache from memory too
    const newDeviceId = `DEV_${Date.now()}_${Platform.OS}`; await AsyncStorage.setItem(KEYS.DEVICE_ID, newDeviceId); 
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify({ autoLockTimer: '2 min', lockOnExit: false, darkMode: false, accentColor: 'Purple' })); 
    await AsyncStorage.setItem(KEYS.LOCK_PROFILE, 'BIO_OR_PIN'); 
    try { const db = getDB(); if (db) { db.runSync('DELETE FROM entries'); db.runSync('DELETE FROM files'); db.runSync('DELETE FROM folders'); } } catch (dbErr) {}
    return true; 
  } catch (error) { return false; } 
};
export const getCurrentDeviceId = async () => { let id = await AsyncStorage.getItem(KEYS.DEVICE_ID); if (!id) { id = `DEV_${Date.now()}_${Platform.OS}`; await AsyncStorage.setItem(KEYS.DEVICE_ID, id); } return id; };
