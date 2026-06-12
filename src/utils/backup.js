// File: src/utils/backup.js
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing'; 

import { getDB } from './database';
import { CryptoEngine } from './cryptoEngine';
import { 
    getMasterPin, 
    getCustomTypes, 
    getGalleryPhotos, 
    getGalleryCollections, 
    saveGalleryPhotos, 
    saveGalleryCollections 
} from './storage';

// 🚀 SECRET UNIVERSAL APP PIN (Koi purana password nahi chahiye)
const SECRET_UNIVERSAL_PIN = "SafeLocker_Universal_Bypass_08_System";

export const exportBackup = async (label = "Manual Backup", isAuto = false, onProgress) => {
    try {
       onProgress(10);
       const db = getDB();
       
       const currentPin = await getMasterPin();
       const currentVaultKey = await CryptoEngine.getVaultKey(currentPin);
       
       // 1. Get SQLite Data
       const entries = db.getAllSync('SELECT * FROM entries');
       const folders = db.getAllSync('SELECT * FROM folders');
       const files = db.getAllSync('SELECT * FROM files');
       
       // 2. Get ScanScreen (Gallery) Data 🚀 FIX YAHAN HAI
       const galleryPhotos = await getGalleryPhotos();
       const galleryCollections = await getGalleryCollections();
       
       onProgress(30);
       
       // 3. Pack SQLite Files to Base64
       const dbFilesWithData = [];
       for (let i = 0; i < files.length; i++) {
           const f = files[i];
           try {
              const b64 = await FileSystem.readAsStringAsync(f.uri, { encoding: 'base64' });
              const clearName = CryptoEngine.decryptData(f.name_enc, currentVaultKey) || f.name_enc;
              
              dbFilesWithData.push({ ...f, _base64Data: b64, originalName: clearName });
           } catch(e) { console.log("File read error: ", f.uri); }
       }
       
       onProgress(50);

       // 4. Pack ScanScreen Gallery Photos to Base64 🚀 FIX
       const galleryPhotosWithData = [];
       for (let i = 0; i < galleryPhotos.length; i++) {
           const gp = galleryPhotos[i];
           try {
               const b64 = await FileSystem.readAsStringAsync(gp.uri, { encoding: 'base64' });
               galleryPhotosWithData.push({ ...gp, _base64Data: b64 });
           } catch(e) { console.log("Gallery photo read error: ", gp.uri); }
       }

       onProgress(70);
       
       // Lock with Universal Key
       const universalMasterKey = CryptoEngine.deriveKeyFromPin(SECRET_UNIVERSAL_PIN);
       const universalEncryptedVaultKey = CryptoEngine.encryptData(currentVaultKey, universalMasterKey);
       
       const payload = {
           version: 'v12_ultimate_fix',
           universalVaultKeyBundle: universalEncryptedVaultKey,
           entries,
           folders,
           dbFiles: dbFilesWithData,
           galleryCollections,          // 🚀 Gallery Folders Added
           galleryPhotos: galleryPhotosWithData, // 🚀 Gallery Photos Added
           customTypes: await getCustomTypes()
       };
       
       const jsonString = JSON.stringify(payload);
       const backupUri = FileSystem.documentDirectory + `SafeLocker_Backup_${Date.now()}.bak`;
       await FileSystem.writeAsStringAsync(backupUri, jsonString, { encoding: 'utf8' });
       
       onProgress(100);
       if (!isAuto && await Sharing.isAvailableAsync()) {
           await Sharing.shareAsync(backupUri);
       }
       return { success: true };
    } catch(e) { return { success: false, message: e.message }; }
};

export const pickAndAnalyzeBackup = async () => {
    try {
        const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
        if (result.canceled) return { success: false, cancelled: true };
        const file = result.assets[0];
        return { success: true, data: { uri: file.uri, name: file.name } };
    } catch(e) { return { success: false, message: e.message }; }
};

export const processImportDecryption = async (fileObj, password, onProgress) => {
    try {
        onProgress(10);
        const jsonString = await FileSystem.readAsStringAsync(fileObj.uri, { encoding: 'utf8' });
        const payload = JSON.parse(jsonString);
        
        const currentPin = await getMasterPin(); 
        const currentVaultKey = await CryptoEngine.getVaultKey(currentPin);
        
        let oldVaultKey = currentVaultKey;
        
        // Auto-Unlock Backup
        if (payload.universalVaultKeyBundle) {
            const universalMasterKey = CryptoEngine.deriveKeyFromPin(SECRET_UNIVERSAL_PIN);
            const dec = CryptoEngine.decryptData(payload.universalVaultKeyBundle, universalMasterKey);
            if (dec) oldVaultKey = dec; else throw new Error("Backup File Corrupted");
        } else if (payload.vaultKeyBundle) {
             const tempOldMaster = CryptoEngine.deriveKeyFromPin(password || currentPin);
             const dec = CryptoEngine.decryptData(payload.vaultKeyBundle, tempOldMaster);
             if(dec) oldVaultKey = dec;
        }
        
        onProgress(40);
        const db = getDB();
        db.withTransactionSync(() => {
            db.runSync('DELETE FROM entries');
            db.runSync('DELETE FROM folders');
            db.runSync('DELETE FROM files');
            
            // Vault Entries Recovery
            if (payload.entries) {
                for (let e of payload.entries) {
                    const title = CryptoEngine.decryptData(e.title_enc, oldVaultKey) || 'Recovered Entry';
                    const notes = CryptoEngine.decryptData(e.notes_enc, oldVaultKey) || '';
                    const user = CryptoEngine.decryptData(e.username_enc, oldVaultKey) || '';
                    const pass = CryptoEngine.decryptData(e.password_enc, oldVaultKey) || '';
                    const url = CryptoEngine.decryptData(e.url_enc, oldVaultKey) || '';
                    
                    db.runSync(`INSERT INTO entries (id, type, title_enc, username_enc, password_enc, notes_enc, url_enc, is_decoy, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [e.id, e.type, CryptoEngine.encryptData(title, currentVaultKey), CryptoEngine.encryptData(user, currentVaultKey), CryptoEngine.encryptData(pass, currentVaultKey), CryptoEngine.encryptData(notes, currentVaultKey), CryptoEngine.encryptData(url, currentVaultKey), e.is_decoy || 0, e.created_at]);
                }
            }
            
            // Folders Recovery
            if (payload.folders) {
                for (let f of payload.folders) {
                    if (f.id && !f.id.includes('MACOSX')) {
                        const name = CryptoEngine.decryptData(f.name_enc, oldVaultKey) || 'Recovered Folder';
                        db.runSync(`INSERT INTO folders (id, name_enc, color, is_locked, is_favorite, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
                        [f.id, CryptoEngine.encryptData(name, currentVaultKey), f.color, f.is_locked || 0, f.is_favorite || 0, f.created_at]);
                    }
                }
            }
        });
        
        onProgress(60);
        
        // FilesScreen & Documents Recovery
        if (payload.dbFiles) {
            const FILES_DIR = FileSystem.documentDirectory + 'SafeLocker_Files/';
            FileSystem.makeDirectoryAsync(FILES_DIR, { intermediates: true }).catch(e=>{});
            
            for (let f of payload.dbFiles) {
                const finalName = f.originalName || `Recovered_File_${Date.now()}`;
                const newEncName = CryptoEngine.encryptData(finalName, currentVaultKey);
                const newUri = FILES_DIR + f.id + '.' + f.extension; 
                
                if (f._base64Data) await FileSystem.writeAsStringAsync(newUri, f._base64Data, { encoding: 'base64' });
                
                db.runSync(`INSERT INTO files (id, name_enc, uri, size, extension, mime_type, folder_id, is_favorite, is_locked, is_hidden, is_trashed, trashed_at, last_opened_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [f.id, newEncName, newUri, f.size, f.extension, f.mime_type, f.folder_id, f.is_favorite || 0, f.is_locked || 0, f.is_hidden || 0, f.is_trashed || 0, f.trashed_at, f.last_opened_at, f.created_at, f.updated_at]);
            }
        }

        onProgress(80);

        // 🚀 SCAN SCREEN GALLERY RECOVERY FIX
        if (payload.galleryCollections) {
            await saveGalleryCollections(payload.galleryCollections);
        }

        if (payload.galleryPhotos) {
            const recoveredGalleryPhotos = [];
            for (let gp of payload.galleryPhotos) {
                // Device badalne se DocumentDirectory ka path change ho jata hai, isliye naya path banana zaroori hai
                let ext = 'jpg';
                if (gp.uri && gp.uri.includes('.')) { ext = gp.uri.split('.').pop(); }
                const newUri = FileSystem.documentDirectory + `safelocker_recovered_${Date.now()}_${Math.floor(Math.random()*1000)}.${ext}`;
                
                if (gp._base64Data) {
                    await FileSystem.writeAsStringAsync(newUri, gp._base64Data, { encoding: 'base64' });
                }

                recoveredGalleryPhotos.push({
                    id: gp.id,
                    uri: newUri, 
                    collectionId: gp.collectionId,
                    isFavorite: gp.isFavorite,
                    locked: gp.locked,
                    addedAt: gp.addedAt
                });
            }
            await saveGalleryPhotos(recoveredGalleryPhotos);
        }
        
        onProgress(100);
        return { success: true };
    } catch(e) {
        return { success: false, message: "System Error. Failed to decrypt backup." };
    }
}
