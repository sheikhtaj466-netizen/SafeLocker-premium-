// File: src/utils/cryptoEngine.js
import CryptoJS from 'crypto-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  VAULT_KEY_PIN: 'SAFE_LOCKER_VAULT_KEY_PIN_FINAL_V2',
  VAULT_KEY_RECOVERY: 'SAFE_LOCKER_VAULT_KEY_RECOVERY_FINAL_V2',
  RECOVERY_TOKEN: 'SAFE_LOCKER_RECOVERY_TOKEN_FINAL_V2'
}; 
const SALT = 'Safelocker_Super_Salt_9988_Taj'; 

// 🚀 100% PURE JS SAFE GENERATOR (NO NATIVE BUGS OR CRASHES)
const generateSafeIV = () => {
    let result = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 16; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return CryptoJS.enc.Utf8.parse(result);
};

const generateSafeKey = () => {
    let result = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
};

export const CryptoEngine = {
  
  deriveKeyFromPin: (pin) => {
    return CryptoJS.PBKDF2(pin, SALT, { keySize: 256 / 32, iterations: 500 }).toString();
  },

  encryptData: (plainText, keyPassphrase) => {
    if (!plainText || !keyPassphrase) return null;
    try {
        const iv = generateSafeIV(); // 🔥 Explicit IV so AES NEVER crashes
        const encrypted = CryptoJS.AES.encrypt(String(plainText), keyPassphrase, { iv: iv });
        return JSON.stringify({
          cipher: encrypted.toString(),
          iv: CryptoJS.enc.Base64.stringify(iv),
          mac: CryptoJS.HmacSHA256(encrypted.toString(), keyPassphrase).toString()
        });
    } catch(e) { 
        throw new Error("Encrypt Logic Failed: " + e.message); 
    }
  },

  decryptData: (cipherBundleString, keyPassphrase) => {
    if (!cipherBundleString || !keyPassphrase) return null;
    try {
      if (!cipherBundleString.startsWith('{')) {
         const bytes = CryptoJS.AES.decrypt(cipherBundleString, keyPassphrase);
         return bytes.toString(CryptoJS.enc.Utf8);
      }
      const bundle = JSON.parse(cipherBundleString);
      const parsedIv = CryptoJS.enc.Base64.parse(bundle.iv);
      const bytes = CryptoJS.AES.decrypt(bundle.cipher, keyPassphrase, { iv: parsedIv });
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      return null;
    }
  },

  setupVaultKey: async (userPin) => {
    try {
      const vaultKey = generateSafeKey();

      const masterKeyPin = CryptoEngine.deriveKeyFromPin(userPin);
      const encryptedWithPin = CryptoEngine.encryptData(vaultKey, masterKeyPin);
      
      const recoveryToken = generateSafeKey();
      const encryptedWithRecovery = CryptoEngine.encryptData(vaultKey, recoveryToken);

      if (!encryptedWithPin || !encryptedWithRecovery) {
          throw new Error("Encryption generated null output.");
      }
      
      await AsyncStorage.setItem(KEYS.VAULT_KEY_PIN, encryptedWithPin);
      await AsyncStorage.setItem(KEYS.VAULT_KEY_RECOVERY, encryptedWithRecovery);
      await AsyncStorage.setItem(KEYS.RECOVERY_TOKEN, recoveryToken);

      return true;
    } catch (error) { 
      throw new Error("SetupVaultKey failed: " + error.message); 
    }
  },

  getVaultKey: async (userPin) => {
    try {
      const encryptedWithPin = await AsyncStorage.getItem(KEYS.VAULT_KEY_PIN);
      if (!encryptedWithPin) return null;
      
      const masterKeyPin = CryptoEngine.deriveKeyFromPin(userPin);
      return CryptoEngine.decryptData(encryptedWithPin, masterKeyPin);
    } catch (error) { return null; }
  },

  recoverVaultKey: async () => {
    try {
      const recoveryToken = await AsyncStorage.getItem(KEYS.RECOVERY_TOKEN);
      const encryptedWithRecovery = await AsyncStorage.getItem(KEYS.VAULT_KEY_RECOVERY);
      
      if (!recoveryToken || !encryptedWithRecovery) return null;
      
      return CryptoEngine.decryptData(encryptedWithRecovery, recoveryToken);
    } catch (error) { return null; }
  },

  resetPinWithRecovery: async (vaultKey, newPin) => {
    try {
      const newMasterKeyPin = CryptoEngine.deriveKeyFromPin(newPin);
      const newEncryptedWithPin = CryptoEngine.encryptData(vaultKey, newMasterKeyPin);
      
      await AsyncStorage.setItem(KEYS.VAULT_KEY_PIN, newEncryptedWithPin);
      return true;
    } catch (error) { return false; }
  },

  getVaultKeyBundle: async () => {
     return await AsyncStorage.getItem(KEYS.VAULT_KEY_PIN);
  }
};
