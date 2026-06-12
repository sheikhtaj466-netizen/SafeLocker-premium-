// File: src/utils/cryptoEngine.js
import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';

const VAULT_KEY_NAME = 'SAFE_LOCKER_MASTER_VAULT_KEY_V4'; 
const SALT = 'Safelocker_Super_Salt_9988_Taj'; 

// 🚀 CRITICAL FIX: React Native Random Bytes Polyfill
if (!CryptoJS.lib.WordArray.random_polyfilled) {
  CryptoJS.lib.WordArray.random = function (nBytes) {
    const words = [];
    for (let i = 0; i < nBytes; i += 4) { words.push((Math.random() * 0x100000000) | 0); }
    return CryptoJS.lib.WordArray.create(words, nBytes);
  };
  CryptoJS.lib.WordArray.random_polyfilled = true;
}

export const CryptoEngine = {
  
  deriveKeyFromPin: (pin) => {
    return CryptoJS.PBKDF2(pin, SALT, { keySize: 256 / 32, iterations: 500 }).toString();
  },

  encryptData: (plainText, key) => {
    if (!plainText) return null;
    const iv = CryptoJS.lib.WordArray.random(128 / 8);
    const encrypted = CryptoJS.AES.encrypt(String(plainText), key, { iv: iv });
    return JSON.stringify({
      cipher: encrypted.toString(),
      iv: CryptoJS.enc.Base64.stringify(iv),
      mac: CryptoJS.HmacSHA256(encrypted.toString(), key).toString()
    });
  },

  decryptData: (cipherBundleString, key) => {
    if (!cipherBundleString) return null;
    try {
      if (!cipherBundleString.startsWith('{')) {
         const bytes = CryptoJS.AES.decrypt(cipherBundleString, key);
         return bytes.toString(CryptoJS.enc.Utf8);
      }
      const bundle = JSON.parse(cipherBundleString);
      const parsedIv = CryptoJS.enc.Base64.parse(bundle.iv);
      const bytes = CryptoJS.AES.decrypt(bundle.cipher, key, { iv: parsedIv });
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      return null;
    }
  },

  setupVaultKey: async (userPin) => {
    try {
      await SecureStore.deleteItemAsync(VAULT_KEY_NAME);
      const masterKey = CryptoEngine.deriveKeyFromPin(userPin);
      const vaultKey = CryptoJS.lib.WordArray.random(256 / 8).toString();
      const encryptedVaultKeyBundle = CryptoEngine.encryptData(vaultKey, masterKey);
      await SecureStore.setItemAsync(VAULT_KEY_NAME, encryptedVaultKeyBundle);
      return true;
    } catch (error) { throw error; }
  },

  getVaultKey: async (userPin) => {
    try {
      const encryptedVaultKeyBundle = await SecureStore.getItemAsync(VAULT_KEY_NAME);
      if (!encryptedVaultKeyBundle) return null;
      const masterKey = CryptoEngine.deriveKeyFromPin(userPin);
      return CryptoEngine.decryptData(encryptedVaultKeyBundle, masterKey);
    } catch (error) { return null; }
  },

  // 🚀 NAYA PREMIUM FIX: Export ke waqt Key Pack karne ke liye
  getVaultKeyBundle: async () => {
     return await SecureStore.getItemAsync(VAULT_KEY_NAME);
  }
};
