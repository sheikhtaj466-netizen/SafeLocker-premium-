// File: src/screens/FilesScreen.js
import React, { useState, useCallback, useEffect, useRef, useContext } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  FlatList, Modal, ActivityIndicator, Animated, Pressable, ScrollView, Image, Platform 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

import { ThemeContext } from '../ThemeContext'; 
import { importFiles, getFiles, getFolders, createFolder, performBulkAction, renameFile, renameFolder, deleteFolder } from '../utils/fileStorage';
// 🚀 FIX: Activity Tracker Imported Here
import { getSessionMode, logActivity } from '../utils/storage'; 

const formatBytes = (bytes, decimals = 2) => {
  if (!+bytes) return '0 B';
  const k = 1024; const dm = decimals < 0 ? 0 : decimals; const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const getDaysLeft = (trashedAt) => {
  if (!trashedAt) return 30;
  const diff = Date.now() - new Date(trashedAt).getTime();
  const daysPassed = Math.floor(diff / (1000 * 60 * 60 * 24));
  return Math.max(0, 30 - daysPassed);
};

const getPreciseMimeType = (ext) => {
  switch (ext?.toLowerCase()) {
    case 'pdf': return 'application/pdf';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'txt': return 'text/plain';
    case 'zip': case 'rar': return 'application/zip';
    default: return '*/*';
  }
};

const getFileIconProps = (extension) => {
  const ext = extension?.toLowerCase();
  switch (ext) {
    case 'pdf': return { icon: 'file-text', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)' };
    case 'jpg': case 'jpeg': case 'png': case 'webp': return { icon: 'image', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.1)' };
    case 'zip': case 'rar': return { icon: 'package', color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)' };
    case 'doc': case 'docx': case 'txt': case 'xls': case 'csv': return { icon: 'file', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)' };
    default: return { icon: 'file', color: '#64748B', bg: 'rgba(100, 116, 139, 0.1)' };
  }
};

const FileCard = React.memo(({ file, isSelectionMode, isSelected, isTrashMode, themeColors, isDark, primaryColor, onToggle, onOpen, onMenu }) => {
  const styleData = getFileIconProps(file.extension);
  return (
    <Pressable 
      delayLongPress={200} onLongPress={() => onToggle(file.id)} onPress={() => isSelectionMode ? onToggle(file.id) : onOpen(file)}
      style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#EDF1F5' }, isSelected && { borderColor: primaryColor, backgroundColor: primaryColor + '10' }]}
    >
      {isSelectionMode && (
        <View style={[styles.selectionDot, { borderColor: isDark ? '#475569' : '#CBD5E1' }, isSelected && { borderColor: primaryColor, backgroundColor: primaryColor }]}>
          {isSelected && <Feather name="check" size={12} color="#FFF" />}
        </View>
      )}
      <View style={[styles.cardIconBox, { backgroundColor: isTrashMode ? '#FEE2E2' : styleData.bg }]}>
        <Feather name={isTrashMode ? 'trash' : styleData.icon} size={24} color={isTrashMode ? '#EF4444' : styleData.color} />
      </View>
      <View style={styles.cardContent}>
        
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingRight: 4}}>
           <Text style={[styles.cardTitle, { color: themeColors.textDark, marginBottom: 0, flexShrink: 1 }]} numberOfLines={1}>{file.name}</Text>
           {file.is_favorite === 1 && <Feather name="star" size={14} color="#F59E0B" style={{ marginLeft: 6 }} />}
        </View>

        <View style={styles.cardMetaRow}>
          {isTrashMode ? (
            <Text style={[styles.cardMeta, { color: '#EF4444', fontWeight: '700' }]}>{getDaysLeft(file.trashed_at)} days left</Text>
          ) : (
            <>
              <Text style={[styles.cardMeta, { color: themeColors.textLight }]}>{formatBytes(file.size)}</Text>
              <Text style={[styles.cardMeta, { color: themeColors.textLight }]}>{new Date(file.created_at).toLocaleDateString()}</Text>
            </>
          )}
        </View>
      </View>
      {!isSelectionMode && (
        <TouchableOpacity style={styles.moreBtn} onPress={() => onMenu(file)}>
          <Feather name="more-vertical" size={20} color={themeColors.textLight} />
        </TouchableOpacity>
      )}
    </Pressable>
  );
});

export default function FilesScreen({ navigation, setSwipeEnabled }) {
  const { isDark, themeColors } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const primaryColor = themeColors?.primary || '#6C5CE7';

  const [allFiles, setAllFiles] = useState([]); 
  const [displayFiles, setDisplayFiles] = useState([]); 
  const [folders, setFolders] = useState([]); 
  const [smartPills, setSmartPills] = useState([]); 

  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false); 
  const [processText, setProcessText] = useState('Processing...');
  
  const [isDecoyMode, setIsDecoyMode] = useState(false);

  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [activeItem, setActiveItem] = useState(null); 
  const [renameModal, setRenameModal] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [moveModal, setMoveModal] = useState(false);
  
  const [folderModal, setFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [folderActionSheet, setFolderActionSheet] = useState(false);
  const [activeFolderItem, setActiveFolderItem] = useState(null);
  const [folderRenameModal, setFolderRenameModal] = useState(false);
  const [folderRenameInput, setFolderRenameInput] = useState('');

  const [infoModal, setInfoModal] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [sortType, setSortType] = useState('newest');

  const [confirmModal, setConfirmModal] = useState({ visible: false, title: '', subtitle: '', actionType: '', items: [] });
  const [inAppViewer, setInAppViewer] = useState({ visible: false, type: null, content: null, file: null, loading: false });
  const [selectedItems, setSelectedItems] = useState([]);
  const isSelectionMode = selectedItems.length > 0;
  
  const fabAnim = useRef(new Animated.Value(0)).current;
  const [toastData, setToastData] = useState({ visible: false, message: '', icon: 'check-circle' });
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(100)).current;

  const [storageStats, setStorageStats] = useState({ imgBytes: 0, docBytes: 0, otherBytes: 0, totalBytes: 1 });

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useFocusEffect(useCallback(() => { 
    const init = async () => {
        const mode = await getSessionMode();
        setIsDecoyMode(mode === 'LIMITED');
        loadFileData(mode === 'LIMITED');
    };
    init();
  }, [activeCategory]));

  const loadFileData = async (isDecoyState) => {
    if (isDecoyState || global.isDecoyMode) {
        setFolders([{ id: 'f-demo-1', name: 'Work Documents' }]);
        setAllFiles([{ id: 'file-demo-1', name: 'Welcome.pdf', extension: 'pdf', size: 245000, created_at: new Date().toISOString(), is_favorite: 1 }]);
        return; 
    }

    const fetchedFolders = await getFolders();
    setFolders(fetchedFolders);

    const isTrash = activeCategory === 'Trash';
    const fetchedFiles = await getFiles(isTrash ? 'Trash' : 'All');
    setAllFiles(fetchedFiles);
  };

  useEffect(() => {
    let filtered = [...allFiles];

    let iB=0, dB=0, oB=0;
    allFiles.forEach(f => {
       const ext = f.extension?.toLowerCase();
       const size = f.size || 0;
       if (['jpg','jpeg','png','webp','gif'].includes(ext)) iB += size;
       else if (['pdf','doc','docx','txt','xls','csv'].includes(ext)) dB += size;
       else oB += size;
    });
    setStorageStats({ imgBytes: iB, docBytes: dB, otherBytes: oB, totalBytes: (iB+dB+oB) || 1 });

    if (activeCategory !== 'Trash') {
       const favs = allFiles.filter(f => f.is_favorite === 1).length;
       const pdfs = allFiles.filter(f => f.extension?.toLowerCase() === 'pdf').length;
       const docs = allFiles.filter(f => ['doc','docx','txt','xls','csv'].includes(f.extension?.toLowerCase())).length;
       const imgs = allFiles.filter(f => ['jpg','jpeg','png','webp','gif'].includes(f.extension?.toLowerCase())).length;
       const zips = allFiles.filter(f => ['zip','rar'].includes(f.extension?.toLowerCase())).length;
       
       const pills = [{ id: 'cat_all', name: 'All', count: allFiles.length }];
       if (favs > 0) pills.push({ id: 'cat_favs', name: 'Favorites', count: favs });
       if (pdfs > 0) pills.push({ id: 'cat_pdf', name: 'PDF', count: pdfs });
       if (docs > 0) pills.push({ id: 'cat_docs', name: 'Documents', count: docs });
       if (imgs > 0) pills.push({ id: 'cat_imgs', name: 'Images', count: imgs });
       if (zips > 0) pills.push({ id: 'cat_zips', name: 'Archives', count: zips });
       
       folders.forEach(f => {
          const fCount = allFiles.filter(file => file.folder_id === f.id).length;
          pills.push({ id: `fold_${f.id}`, name: f.name, count: fCount, isFolder: true, folderObj: f });
       });
       setSmartPills(pills);
    }

    if (debouncedSearch) {
       filtered = filtered.filter(f => f.name.toLowerCase().includes(debouncedSearch.toLowerCase()));
    }
    
    if (activeCategory === 'All' || activeCategory === 'Trash') {
       // Do nothing
    } else if (activeCategory === 'Favorites') {
       filtered = filtered.filter(f => f.is_favorite === 1);
    } else if (activeCategory === 'PDF') {
       filtered = filtered.filter(f => f.extension?.toLowerCase() === 'pdf');
    } else if (activeCategory === 'Documents') {
       filtered = filtered.filter(f => ['doc', 'docx', 'txt', 'xls', 'xlsx', 'csv'].includes(f.extension?.toLowerCase()));
    } else if (activeCategory === 'Images') {
       filtered = filtered.filter(f => ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(f.extension?.toLowerCase()));
    } else if (activeCategory === 'Archives') {
       filtered = filtered.filter(f => ['zip', 'rar', '7z', 'tar', 'gz'].includes(f.extension?.toLowerCase()));
    } else {
       const targetFolder = folders.find(f => f.name === activeCategory);
       if (targetFolder) filtered = filtered.filter(f => f.folder_id === targetFolder.id);
    }
    
    if(sortType === 'newest') filtered.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    if(sortType === 'oldest') filtered.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    if(sortType === 'largest') filtered.sort((a,b) => b.size - a.size);
    if(sortType === 'smallest') filtered.sort((a,b) => a.size - b.size);
    if(sortType === 'a-z') filtered.sort((a,b) => a.name.localeCompare(b.name));
    if(sortType === 'z-a') filtered.sort((a,b) => b.name.localeCompare(a.name));

    setDisplayFiles(filtered);
  }, [allFiles, activeCategory, debouncedSearch, sortType, folders]);

  const showToast = (msg, icon = 'check-circle') => {
    setToastData({ visible: true, message: msg, icon });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(toastTranslateY, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true })
    ]).start();
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(toastTranslateY, { toValue: 100, duration: 250, useNativeDriver: true })
      ]).start(() => setToastData(prev => ({ ...prev, visible: false })));
    }, 2500);
  };

  const toggleFabMenu = () => {
    if (isDecoyMode) return showToast("Cannot add files in Decoy Mode", "shield-off"); 
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (showFabMenu) Animated.timing(fabAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShowFabMenu(false));
    else { setShowFabMenu(true); Animated.timing(fabAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start(); }
  };

  const handleCreateFolder = async () => {
    if (isDecoyMode) return showToast("Disabled in Decoy Mode", "shield-off"); 
    if (!newFolderName.trim() || isCreatingFolder) return;
    
    setIsCreatingFolder(true);
    const success = await createFolder(newFolderName.trim(), 0);
    if (success) { 
        setFolderModal(false); 
        showToast(`Folder Created`); 
        setNewFolderName(''); 
        await logActivity('Files', 'FOLDER_CREATED', 'Created a new secure folder.', 'WORKFLOW'); // 🚀 Log Added
        await loadFileData(); 
    }
    setIsCreatingFolder(false);
  };

  const handleRenameFolder = async () => {
    if (isDecoyMode) return showToast("Disabled in Decoy Mode", "shield-off");
    if (!folderRenameInput.trim()) return;
    const newName = folderRenameInput.trim();
    const success = await renameFolder(activeFolderItem.id, newName);
    if (success) { 
        setFolderRenameModal(false); 
        showToast('Folder Renamed ✅'); 
        if (activeCategory === activeFolderItem.name) setActiveCategory(newName); 
        await logActivity('Files', 'FOLDER_RENAMED', `Folder renamed to "${newName}".`, 'WORKFLOW'); // 🚀 Log Added
        loadFileData(); 
    }
  };

  const handleImport = async () => {
    if (isDecoyMode) { toggleFabMenu(); return showToast("Disabled in Decoy Mode", "shield-off"); } 
    toggleFabMenu();
    setTimeout(async () => {
      setIsProcessing(true); setProcessText('Importing Securely...');
      const activeFolderObj = folders.find(f => f.name === activeCategory);
      const result = await importFiles(activeFolderObj?.id || null);
      setIsProcessing(false);
      if (result.success) { 
          showToast('File Imported ✅'); 
          await logActivity('Files', 'FILES_IMPORTED', 'Imported new files into secure storage.', 'WORKFLOW'); // 🚀 Log Added
          loadFileData(); 
      }
    }, 300);
  };

  const toggleSelection = useCallback((id) => { 
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
    setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); 
  }, []);
  
  const clearSelection = () => setSelectedItems([]);
  const handleSelectAll = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedItems(displayFiles.map(f => f.id)); };

  const openActionMenu = useCallback((item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveItem(item); setShowActionSheet(true);
  }, []);

  const handleEmptyTrash = () => {
    if (isDecoyMode) return showToast("Disabled in Decoy Mode", "shield-off"); 
    if(displayFiles.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setConfirmModal({
       visible: true, title: 'Empty Trash',
       subtitle: 'Are you sure you want to permanently delete ALL items in the Trash? This cannot be undone.',
       actionType: 'empty_trash', items: displayFiles.map(f => f.id)
    });
  };

  const executeConfirmAction = async () => {
    if (isDecoyMode) return showToast("Disabled in Decoy Mode", "shield-off");
    const { actionType, items } = confirmModal;
    setConfirmModal({ visible: false, title: '', subtitle: '', actionType: '', items: [] });
    
    if (actionType === 'delete_forever' || actionType === 'empty_trash') {
        setIsProcessing(true); setProcessText('Deleting securely...');
        setTimeout(async () => {
           await performBulkAction('delete_forever', items);
           setIsProcessing(false); showToast(actionType === 'empty_trash' ? "Trash Emptied 🗑️" : "Deleted Permanently 🗑️");
           await logActivity('Files', actionType === 'empty_trash' ? 'TRASH_EMPTIED' : 'FILES_DELETED', 'Permanently deleted files.', 'IMPORTANT'); // 🚀 Log Added
           loadFileData(); clearSelection();
        }, 500);
    } else if (actionType === 'delete_folder') {
        setIsProcessing(true); setProcessText('Deleting Folder...');
        setTimeout(async () => {
           await deleteFolder(items[0]); setIsProcessing(false);
           if (activeCategory === activeFolderItem?.name) setActiveCategory('All');
           showToast("Folder Deleted 🗑️"); 
           await logActivity('Files', 'FOLDER_DELETED', 'Deleted a folder and moved its files to All.', 'IMPORTANT'); // 🚀 Log Added
           loadFileData();
        }, 500);
    }
  };

  const handleAction = async (actionType, explicitItem = null, isMulti = false) => {
    if (isDecoyMode && !['open', 'info'].includes(actionType)) {
        setShowActionSheet(false);
        return showToast("Disabled in Decoy Mode", "shield-off");
    }

    setShowActionSheet(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const currentItem = explicitItem || activeItem;
    const targetItems = isMulti ? selectedItems : [currentItem?.id];

    if (actionType === 'open') {
      const fileToOpen = isMulti ? allFiles.find(f => f.id === selectedItems[0]) : currentItem;
      if (!fileToOpen) return;

      await logActivity('Files', 'FILE_OPENED', 'Opened a secure file for viewing.', 'INFO'); // 🚀 Log Added

      const ext = fileToOpen.extension?.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
        setInAppViewer({ visible: true, file: fileToOpen, type: 'image', content: null, loading: false });
      } 
      else if (['txt', 'md', 'csv', 'json'].includes(ext)) {
        setInAppViewer({ visible: true, file: fileToOpen, type: 'text', content: '', loading: true });
        try {
          const text = await FileSystem.readAsStringAsync(fileToOpen.uri, { encoding: FileSystem.EncodingType.UTF8 });
          setInAppViewer({ visible: true, file: fileToOpen, type: 'text', content: text, loading: false });
        } catch (e) {
          setInAppViewer({ visible: false, type: null, content: null, loading: false });
          showToast("Error reading text file", "alert-triangle");
        }
      } 
      else { executeExternalOpen(fileToOpen); }
    } 
    else if (actionType === 'share') {
      setIsProcessing(true); setProcessText('Preparing Share...');
      setTimeout(async () => {
          try {
              const itemToShare = allFiles.find(f => f.id === targetItems[0]); 
              const tempUri = FileSystem.cacheDirectory + itemToShare.name;
              await FileSystem.copyAsync({ from: itemToShare.uri, to: tempUri });
              setIsProcessing(false);
              
              if (await Sharing.isAvailableAsync()) {
                  await logActivity('Files', 'FILE_SHARED', 'Shared a secure file externally.', 'IMPORTANT'); // 🚀 Log Added
                  await Sharing.shareAsync(tempUri, { dialogTitle: 'Share File', mimeType: getPreciseMimeType(itemToShare.extension) || '*/*' });
              }
              setTimeout(async() => { await FileSystem.deleteAsync(tempUri, { idempotent: true }); }, 2000);
          } catch(e) { setIsProcessing(false); showToast("Share Error", "alert-triangle"); }
      }, 300);
      if(isMulti) clearSelection();
    } 
    else if (actionType === 'favorite') {
      await performBulkAction(isMulti ? 'favorite' : (currentItem.is_favorite ? 'unfavorite' : 'favorite'), targetItems);
      showToast(isMulti ? `${targetItems.length} Added to Favorites` : 'Favorite Updated'); 
      await logActivity('Files', 'FAVORITE_TOGGLED', isMulti ? `Toggled favorites for ${targetItems.length} files.` : 'Toggled favorite for a file.', 'WORKFLOW'); // 🚀 Log Added
      loadFileData(); if(isMulti) clearSelection();
    } 
    else if (actionType === 'trash') {
      await performBulkAction('trash', targetItems); showToast('Moved To Trash'); 
      await logActivity('Files', 'MOVED_TO_TRASH', `Moved ${targetItems.length} items to the trash.`, 'WORKFLOW'); // 🚀 Log Added
      loadFileData(); if(isMulti) clearSelection();
    } 
    else if (actionType === 'restore') {
      await performBulkAction('restore', targetItems); showToast('Files Restored ✅'); 
      await logActivity('Files', 'FILES_RESTORED', `Restored ${targetItems.length} items from the trash.`, 'WORKFLOW'); // 🚀 Log Added
      loadFileData(); if(isMulti) clearSelection();
    }
    else if (actionType === 'delete_forever') {
      setConfirmModal({ visible: true, title: isMulti ? 'Delete Multiple Files' : 'Delete Forever', subtitle: 'Are you sure? This action cannot be undone.', actionType: 'delete_forever', items: targetItems });
    }
    else if (actionType === 'rename') {
      setTimeout(() => { const nameWithoutExt = currentItem.name.substring(0, currentItem.name.lastIndexOf('.')) || currentItem.name; setRenameInput(nameWithoutExt); setRenameModal(true); }, 300);
    } 
    else if (actionType === 'move') { setTimeout(() => setMoveModal(true), 300); }
    else if (actionType === 'info') { setTimeout(() => setInfoModal(true), 300); }
  };

  const saveRename = async () => {
    if(!renameInput.trim()) return;
    const newName = `${renameInput.trim()}.${activeItem.extension}`;
    await renameFile(activeItem.id, newName);
    setRenameModal(false); showToast('File Renamed'); 
    await logActivity('Files', 'FILE_RENAMED', `Renamed file to "${newName}".`, 'WORKFLOW'); // 🚀 Log Added
    loadFileData();
  };

  const confirmMove = async (folderId) => {
    const targetItems = isSelectionMode ? selectedItems : [activeItem?.id];
    await performBulkAction('move', targetItems, folderId);
    setMoveModal(false); showToast(`Moved files ✅`); clearSelection(); 
    await logActivity('Files', 'FILES_MOVED', `Moved ${targetItems.length} files to a folder.`, 'WORKFLOW'); // 🚀 Log Added
    loadFileData();
  };

  const executeExternalOpen = async (fileObj) => {
    try {
      setIsProcessing(true); setProcessText('Opening...');
      const targetFile = fileObj || inAppViewer.file;
      const tempUri = FileSystem.cacheDirectory + targetFile.name; 
      await FileSystem.copyAsync({ from: targetFile.uri, to: tempUri });

      await logActivity('Files', 'FILE_OPENED_EXTERNALLY', 'Opened file in an external app.', 'INFO'); // 🚀 Log Added

      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(tempUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: contentUri, flags: 1, type: getPreciseMimeType(targetFile.extension) });
      } else { if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(tempUri); }
      setIsProcessing(false);
    } catch(e) { setIsProcessing(false); showToast("Viewer app not found on device", "alert-triangle"); }
  };

  const renderItem = useCallback(({ item }) => (
    <FileCard 
      file={item} isSelectionMode={isSelectionMode} isSelected={selectedItems.includes(item.id)} 
      isTrashMode={activeCategory === 'Trash'} themeColors={themeColors} isDark={isDark} primaryColor={primaryColor}
      onToggle={toggleSelection} onOpen={(file) => activeCategory === 'Trash' ? openActionMenu(file) : handleAction('open', file, false)} 
      onMenu={openActionMenu}
    />
  ), [selectedItems, isSelectionMode, activeCategory, isDark, themeColors, primaryColor, toggleSelection, openActionMenu]);

  const buildActionMenu = () => {
    if (!activeItem) return [];
    if (activeCategory === 'Trash') {
       return [
         { id: 'restore', icon: 'refresh-ccw', text: 'Restore', color: '#10B981' }, 
         { id: 'info', icon: 'info', text: 'Info', color: themeColors.textDark },
         { id: 'delete_forever', icon: 'trash', text: 'Delete Forever', color: '#EF4444' }
       ];
    }
    return [
      { id: 'open', icon: 'external-link', text: 'Open', color: themeColors.textDark },
      { id: 'rename', icon: 'edit-2', text: 'Rename', color: themeColors.textDark },
      { id: 'share', icon: 'share-2', text: 'Share', color: themeColors.textDark },
      { id: 'favorite', icon: 'star', text: activeItem.is_favorite === 1 ? 'Unfavorite' : 'Favorite', color: activeItem.is_favorite === 1 ? '#F59E0B' : themeColors.textDark },
      { id: 'move', icon: 'folder', text: 'Move', color: themeColors.textDark },
      { id: 'info', icon: 'info', text: 'Info', color: themeColors.textDark },
      { id: 'trash', icon: 'trash-2', text: 'Trash', color: '#EF4444' }
    ];
  };

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#0F172A' : '#F8F9FB' }]}>
      <View style={{ flex: 1, paddingTop: insets.top + 16 }}> 
        
        {isSelectionMode ? (
          activeCategory === 'Trash' ? (
            <View style={[styles.headerShell, { backgroundColor: '#FEE2E2', borderRadius: 100, marginHorizontal: 16 }]}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <TouchableOpacity onPress={clearSelection} style={{marginRight: 16}}><Feather name="x" size={24} color="#EF4444" /></TouchableOpacity>
                <Text style={{fontSize: 18, fontWeight: '700', color: '#EF4444'}}>{selectedItems.length} Selected</Text>
              </View>
              <View style={{flexDirection: 'row', gap: 16}}>
                <TouchableOpacity onPress={handleSelectAll}><Feather name="check-square" size={22} color="#EF4444" /></TouchableOpacity>
                <TouchableOpacity onPress={() => handleAction('restore', null, true)}><Feather name="refresh-ccw" size={22} color="#10B981" /></TouchableOpacity>
                <TouchableOpacity onPress={() => handleAction('delete_forever', null, true)}><Feather name="trash" size={22} color="#EF4444" /></TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[styles.headerShell, { backgroundColor: primaryColor + '15', borderRadius: 100, marginHorizontal: 16 }]}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <TouchableOpacity onPress={clearSelection} style={{marginRight: 16}}><Feather name="x" size={24} color={themeColors.textDark} /></TouchableOpacity>
                <Text style={{fontSize: 18, fontWeight: '700', color: themeColors.textDark}}>{selectedItems.length} Selected</Text>
              </View>
              <View style={{flexDirection: 'row', gap: 16}}>
                <TouchableOpacity onPress={handleSelectAll}><Feather name="check-square" size={22} color={themeColors.textDark} /></TouchableOpacity>
                <TouchableOpacity onPress={() => handleAction('share', null, true)}><Feather name="share-2" size={22} color={themeColors.textDark} /></TouchableOpacity>
                <TouchableOpacity onPress={() => handleAction('move', null, true)}><Feather name="folder" size={22} color={themeColors.textDark} /></TouchableOpacity>
                <TouchableOpacity onPress={() => handleAction('trash', null, true)}><Feather name="trash-2" size={22} color="#EF4444" /></TouchableOpacity>
              </View>
            </View>
          )
        ) : (
          <View style={styles.headerShell}>
            <View>
              <Text style={[styles.headerTitle, { color: themeColors.textDark }]}>{activeCategory === 'Trash' ? 'Trash Bin' : 'Files'}</Text>
              {activeCategory !== 'Trash' && <Text style={{color: themeColors.textLight, fontWeight: '600', marginTop: 2}}>{displayFiles.length} Items</Text>}
            </View>
            <View style={{flexDirection: 'row', gap: 12}}>
              {activeCategory !== 'Trash' && (
                <>
                  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: themeColors.inputBg }]} onPress={() => setShowStatsModal(true)}>
                    <Feather name="pie-chart" size={20} color={themeColors.textDark} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: themeColors.inputBg }]} onPress={() => setShowSortSheet(true)}>
                    <Feather name="sliders" size={20} color={themeColors.textDark} />
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity onPress={() => { setActiveCategory(activeCategory === 'Trash' ? 'All' : 'Trash'); setDebouncedSearch(''); setSearchQuery(''); }} style={[styles.iconBtn, { backgroundColor: activeCategory === 'Trash' ? themeColors.inputBg : '#FEE2E2' }]}>
                 <Feather name={activeCategory === 'Trash' ? 'arrow-left' : 'trash-2'} size={20} color={activeCategory === 'Trash' ? themeColors.textDark : '#EF4444'} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeCategory === 'Trash' && displayFiles.length > 0 && !isSelectionMode && (
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12}}>
            <Text style={{color: '#94A3B8', fontSize: 13, fontWeight: '600'}}>Items delete permanently after 30 days</Text>
            <TouchableOpacity onPress={handleEmptyTrash} style={{backgroundColor: '#FEE2E2', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100}}>
               <Text style={{color: '#EF4444', fontWeight: '800', fontSize: 13}}>Empty Trash</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeCategory !== 'Trash' && (
          <View style={styles.searchContainer}>
            <View style={[styles.searchBox, { backgroundColor: themeColors.inputBg, borderColor: isDark ? '#334155' : '#EEF1F5' }]}>
              <Feather name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput style={[styles.searchInput, { color: themeColors.textDark }]} placeholder="Search files, folders..." placeholderTextColor="#94A3B8" value={searchQuery} onChangeText={setSearchQuery} />
            </View>
          </View>
        )}

        {activeCategory !== 'Trash' && (
          <View 
            style={styles.chipScrollContainer}
            onTouchStart={() => { if(setSwipeEnabled) setSwipeEnabled(false); }}
            onTouchEnd={() => { if(setSwipeEnabled) setSwipeEnabled(true); }}
            onTouchCancel={() => { if(setSwipeEnabled) setSwipeEnabled(true); }}
          >
            <ScrollView 
              horizontal={true} 
              showsHorizontalScrollIndicator={false} 
              keyboardShouldPersistTaps="handled" 
              nestedScrollEnabled={true}
              decelerationRate="fast"
              contentContainerStyle={{ flexDirection: 'row', paddingHorizontal: 16, gap: 10, paddingBottom: 5 }}
            >
              {smartPills.map((item) => {
                const isActive = activeCategory === item.name;
                return (
                  <Pressable 
                    key={item.id} 
                    onPress={() => { Haptics.selectionAsync(); setActiveCategory(item.name); }} 
                    onLongPress={() => {
                       if (item.isFolder) {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                          setActiveFolderItem(item.folderObj);
                          setFolderActionSheet(true);
                       }
                    }}
                    style={[styles.chip, { borderColor: isDark ? '#334155' : '#E9EDF3', backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }, isActive && { backgroundColor: primaryColor, borderColor: primaryColor }]}
                  >
                    {item.isFolder ? <Feather name="folder" size={14} color={isActive ? '#FFF' : primaryColor} style={{marginRight: 6}} /> : null}
                    <Text style={[styles.chipText, { color: isDark ? '#94A3B8' : '#64748B' }, isActive && { color: '#FFFFFF' }]}>
                      {item.name} {item.count > 0 && <Text style={{fontSize: 11, opacity: 0.8}}> ({item.count})</Text>}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
        )}

        <FlatList 
          data={displayFiles} keyExtractor={(item) => item.id} initialNumToRender={8} windowSize={5} maxToRenderPerBatch={10} removeClippedSubviews={Platform.OS === 'android'}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 6 }} renderItem={renderItem}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Feather name={activeCategory === 'Trash' ? 'trash' : 'folder'} size={48} color={isDark ? '#334155' : '#CBD5E1'} style={{ marginBottom: 16 }} />
              <Text style={{ color: themeColors.textDark, fontSize: 18, fontWeight: '700' }}>{activeCategory === 'Trash' ? 'Trash is Empty' : 'No Files Here'}</Text>
            </View>
          )}
        />

        {!isSelectionMode && activeCategory !== 'Trash' && (
          <>
            {showFabMenu && (
              <View style={[StyleSheet.absoluteFill, { zIndex: 50 }]}>
                 <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                 <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={toggleFabMenu} />
                 <Animated.View style={[styles.fabMenuOptions, { opacity: fabAnim, transform: [{ translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] }]} pointerEvents="box-none">
                    <TouchableOpacity style={styles.fabOptionRow} onPress={handleImport}>
                       <Text style={[styles.fabOptionText, {color: themeColors.textDark, backgroundColor: themeColors.card}]}>Import Files</Text>
                       <View style={[styles.fabOptionIcon, { backgroundColor: primaryColor }]}><Feather name="file-plus" size={20} color="#FFF" /></View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.fabOptionRow} onPress={() => { toggleFabMenu(); setTimeout(() => setFolderModal(true), 300); }}>
                       <Text style={[styles.fabOptionText, {color: themeColors.textDark, backgroundColor: themeColors.card}]}>Create Folder</Text>
                       <View style={[styles.fabOptionIcon, { backgroundColor: '#F59E0B' }]}><Feather name="folder-plus" size={20} color="#FFF" /></View>
                    </TouchableOpacity>
                 </Animated.View>
              </View>
            )}
            <View style={styles.fabContainer}>
              <TouchableOpacity onPress={toggleFabMenu} activeOpacity={0.8}>
                <Animated.View style={[styles.fab, { backgroundColor: primaryColor, transform: [{ rotate: fabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }]}>
                  <Feather name="plus" size={28} color="#FFFFFF" />
                </Animated.View>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* ACTION SHEET */}
      <Modal visible={showActionSheet} transparent animationType="slide" onRequestClose={() => setShowActionSheet(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowActionSheet(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.bottomSheet, { backgroundColor: themeColors.card, paddingBottom: insets.bottom + 20 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: themeColors.separator }]} />
            
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderColor: themeColors.separator}}>
               <View style={[styles.cardIconBox, { backgroundColor: getFileIconProps(activeItem?.extension).bg, marginRight: 16 }]}>
                 <Feather name={getFileIconProps(activeItem?.extension).icon} size={24} color={getFileIconProps(activeItem?.extension).color} />
               </View>
               <View style={{flex: 1}}>
                 <Text style={{fontSize: 16, fontWeight: '700', color: themeColors.textDark}} numberOfLines={1}>{activeItem?.name}</Text>
                 <Text style={{fontSize: 12, color: themeColors.textLight, marginTop: 4}}>{formatBytes(activeItem?.size)} • {activeItem?.extension?.toUpperCase()}</Text>
               </View>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 16, paddingHorizontal: 10 }}>
              {buildActionMenu().map((item, idx) => (
                <TouchableOpacity key={idx} style={{ width: '20%', alignItems: 'center', marginBottom: 20 }} onPress={() => handleAction(item.id)}>
                  <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: themeColors.inputBg, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}><Feather name={item.icon} size={22} color={item.color} /></View>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: themeColors.textDark, textAlign: 'center' }}>{item.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* FOLDER ACTIONS */}
      <Modal visible={folderActionSheet} transparent animationType="slide" onRequestClose={() => setFolderActionSheet(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFolderActionSheet(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.bottomSheet, { backgroundColor: themeColors.card, paddingBottom: insets.bottom + 30 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: themeColors.separator }]} />
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 20}}>
               <Feather name="folder" size={24} color={primaryColor} style={{marginRight: 12}} />
               <Text style={{fontSize: 18, fontWeight: '800', color: themeColors.textDark}}>{activeFolderItem?.name}</Text>
            </View>
            <TouchableOpacity style={styles.sortOptionRow} onPress={() => {
                if(isDecoyMode) return showToast("Disabled in Decoy Mode", "shield-off"); 
                setFolderRenameInput(activeFolderItem.name); setFolderActionSheet(false); setTimeout(() => setFolderRenameModal(true), 300);
            }}>
              <Text style={{fontSize: 16, fontWeight: '600', color: themeColors.textDark}}>Rename Folder</Text>
              <Feather name="edit-2" size={20} color={themeColors.textDark} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.sortOptionRow} onPress={() => {
                if(isDecoyMode) return showToast("Disabled in Decoy Mode", "shield-off"); 
                setFolderActionSheet(false); setTimeout(() => { setConfirmModal({ visible: true, title: 'Delete Folder', subtitle: `Are you sure you want to delete "${activeFolderItem?.name}"? All files inside will safely move to the main 'All' section.`, actionType: 'delete_folder', items: [activeFolderItem?.id] }); }, 300);
            }}>
              <Text style={{fontSize: 16, fontWeight: '600', color: '#EF4444'}}>Delete Folder</Text>
              <Feather name="trash-2" size={20} color="#EF4444" />
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* CREATE FOLDER MODAL */}
      <Modal hardwareAccelerated={true} statusBarTranslucent={true} visible={folderModal} transparent animationType="fade" onRequestClose={() => setFolderModal(false)}>
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={25} tint={isDark ? "dark" : "light"} style={styles.modalOverlayCenter}>
            <View style={[styles.customAlertBox, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', width: '85%' }]}>
              <View style={[styles.alertIconBox, { backgroundColor: `${primaryColor}20` }]}><Feather name="folder-plus" size={32} color={primaryColor} /></View>
              <Text style={[styles.alertTitle, { color: isDark ? '#F8FAFC' : '#0F172A', marginBottom: 20 }]}>Create Folder</Text>
              <TextInput style={[styles.modalInput, { width: '100%', backgroundColor: isDark ? '#0F172A' : '#F8F9FB', color: isDark ? '#F8FAFC' : '#0F172A', borderColor: isDark ? '#334155' : '#EEF1F5', borderRadius: 100, textAlign: 'left', letterSpacing: 0, paddingHorizontal: 20 }]} placeholder="Enter folder name" placeholderTextColor={isDark ? '#94A3B8' : '#94A3B8'} value={newFolderName} onChangeText={setNewFolderName} autoFocus />
              <View style={{flexDirection: 'row', gap: 12, width: '100%'}}>
                <TouchableOpacity style={[styles.alertBtn, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]} onPress={() => { setFolderModal(false); setNewFolderName(''); }}><Text style={[styles.alertBtnText, { color: isDark ? '#F8FAFC' : '#475569' }]}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.alertBtn, { backgroundColor: primaryColor, opacity: isCreatingFolder ? 0.5 : 1 }]} onPress={handleCreateFolder}><Text style={[styles.alertBtnText, { color: '#FFFFFF' }]}>{isCreatingFolder ? 'Wait...' : 'Create'}</Text></TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </View>
      </Modal>

      {/* RENAME FOLDER MODAL */}
      <Modal hardwareAccelerated={true} statusBarTranslucent={true} visible={folderRenameModal} transparent animationType="fade" onRequestClose={() => setFolderRenameModal(false)}>
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={25} tint="dark" style={styles.modalOverlayCenter}>
            <View style={[styles.customAlertBox, { backgroundColor: themeColors.card, width: '85%' }]}>
              <Text style={[styles.alertTitle, { color: themeColors.textDark }]}>Rename Folder</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: themeColors.inputBg, color: themeColors.textDark, borderColor: themeColors.separator, marginTop: 12, borderRadius: 100, textAlign: 'left', letterSpacing: 0, paddingHorizontal: 20 }]} value={folderRenameInput} onChangeText={setFolderRenameInput} autoFocus />
              <View style={{flexDirection: 'row', gap: 12, width: '100%'}}>
                <TouchableOpacity style={[styles.alertBtn, {backgroundColor: themeColors.inputBg}]} onPress={() => setFolderRenameModal(false)}><Text style={{color: themeColors.textDark, fontWeight: '700'}}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.alertBtn, {backgroundColor: primaryColor}]} onPress={handleRenameFolder}><Text style={{color: '#FFF', fontWeight: '700'}}>Save</Text></TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </View>
      </Modal>

      {/* RENAME FILE MODAL */}
      <Modal visible={renameModal} transparent animationType="fade" onRequestClose={() => setRenameModal(false)}>
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={25} tint="dark" style={styles.modalOverlayCenter}>
            <View style={[styles.customAlertBox, { backgroundColor: themeColors.card, width: '85%' }]}>
              <Text style={[styles.alertTitle, { color: themeColors.textDark }]}>Rename File</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: themeColors.inputBg, color: themeColors.textDark, borderColor: themeColors.separator, marginTop: 12, borderRadius: 100, textAlign: 'left', letterSpacing: 0, paddingHorizontal: 20 }]} value={renameInput} onChangeText={setRenameInput} autoFocus />
              <View style={{flexDirection: 'row', gap: 12, width: '100%'}}>
                <TouchableOpacity style={[styles.alertBtn, {backgroundColor: themeColors.inputBg}]} onPress={() => setRenameModal(false)}><Text style={{color: themeColors.textDark, fontWeight: '700'}}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.alertBtn, {backgroundColor: primaryColor}]} onPress={saveRename}><Text style={{color: '#FFF', fontWeight: '700'}}>Save</Text></TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </View>
      </Modal>

      <Modal visible={confirmModal.visible} transparent animationType="fade" onRequestClose={() => setConfirmModal({...confirmModal, visible: false})}>
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={25} tint="dark" style={styles.modalOverlayCenter}>
            <View style={[styles.customAlertBox, { backgroundColor: themeColors.card, width: '85%' }]}>
              <View style={[styles.alertIconBox, { backgroundColor: '#FEE2E2' }]}><Feather name="trash-2" size={32} color="#EF4444" /></View>
              <Text style={[styles.alertTitle, { color: themeColors.textDark, textAlign: 'center', marginBottom: 8 }]}>{confirmModal.title}</Text>
              <Text style={{color: themeColors.textLight, textAlign: 'center', fontSize: 14, marginBottom: 24, paddingHorizontal: 10, lineHeight: 20}}>{confirmModal.subtitle}</Text>
              <View style={{flexDirection: 'row', gap: 12}}>
                <TouchableOpacity style={[styles.alertBtn, {backgroundColor: themeColors.inputBg}]} onPress={() => setConfirmModal({...confirmModal, visible: false})}><Text style={{color: themeColors.textDark, fontWeight: '700'}}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.alertBtn, {backgroundColor: '#EF4444'}]} onPress={executeConfirmAction}><Text style={{color: '#FFF', fontWeight: '700'}}>{confirmModal.actionType === 'empty_trash' ? 'Empty Trash' : 'Delete'}</Text></TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </View>
      </Modal>

      <Modal visible={moveModal} transparent animationType="fade" onRequestClose={() => setMoveModal(false)}>
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={25} tint="dark" style={styles.modalOverlayCenter}>
            <View style={[styles.customAlertBox, { backgroundColor: themeColors.card, width: '90%', maxHeight: '80%' }]}>
              <Text style={[styles.alertTitle, { color: themeColors.textDark, marginBottom: 16 }]}>Move to Folder</Text>
              <ScrollView style={{width: '100%'}}>
                <TouchableOpacity onPress={() => confirmMove(null)} style={{flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: themeColors.inputBg, borderRadius: 100, marginBottom: 10}}>
                  <Feather name="grid" size={20} color={themeColors.textLight} style={{marginRight: 12}} />
                  <Text style={{fontSize: 16, fontWeight: '600', color: themeColors.textDark}}>Remove from folder</Text>
                </TouchableOpacity>
                {folders.map(f => (
                  <TouchableOpacity key={f.id} onPress={() => confirmMove(f.id)} style={{flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: themeColors.inputBg, borderRadius: 100, marginBottom: 10}}>
                    <Feather name="folder" size={20} color={primaryColor} style={{marginRight: 12}} />
                    <Text style={{fontSize: 16, fontWeight: '600', color: themeColors.textDark}}>{f.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={[styles.alertBtn, {backgroundColor: themeColors.inputBg, width: '100%', marginTop: 12}]} onPress={() => setMoveModal(false)}><Text style={{color: themeColors.textDark, fontWeight: '700'}}>Cancel</Text></TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>

      <Modal visible={infoModal} transparent animationType="fade" onRequestClose={() => setInfoModal(false)}>
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={25} tint="dark" style={styles.modalOverlayCenter}>
            <View style={[styles.customAlertBox, { backgroundColor: themeColors.card, width: '90%' }]}>
              <Text style={[styles.alertTitle, { color: themeColors.textDark, marginBottom: 16 }]}>File Information</Text>
              <View style={{gap: 16, width: '100%'}}>
                <View><Text style={{fontSize: 12, color: themeColors.textLight}}>File Name</Text><Text style={{fontSize: 15, fontWeight: '600', color: themeColors.textDark}}>{activeItem?.name}</Text></View>
                <View><Text style={{fontSize: 12, color: themeColors.textLight}}>Extension</Text><Text style={{fontSize: 15, fontWeight: '600', color: themeColors.textDark}}>{activeItem?.extension?.toUpperCase()}</Text></View>
                <View><Text style={{fontSize: 12, color: themeColors.textLight}}>Size</Text><Text style={{fontSize: 15, fontWeight: '600', color: themeColors.textDark}}>{formatBytes(activeItem?.size)}</Text></View>
                <View><Text style={{fontSize: 12, color: themeColors.textLight}}>Created</Text><Text style={{fontSize: 15, fontWeight: '600', color: themeColors.textDark}}>{new Date(activeItem?.created_at).toLocaleString()}</Text></View>
              </View>
              <TouchableOpacity style={[styles.alertBtn, {backgroundColor: primaryColor, width: '100%', marginTop: 24}]} onPress={() => setInfoModal(false)}><Text style={{color: '#FFF', fontWeight: '700'}}>Close</Text></TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>

      <Modal visible={inAppViewer.visible} transparent animationType="slide" onRequestClose={() => setInAppViewer({visible: false, type: null, content: null, file: null, loading: false})}>
         <View style={{flex: 1, backgroundColor: isDark ? '#000' : '#FFF'}}>
           <View style={{flex: 1, paddingTop: insets.top}}>
             <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: isDark ? '#333' : '#EEE'}}>
               <TouchableOpacity onPress={() => setInAppViewer({visible: false, type: null, content: null, file: null, loading: false})}><Feather name="x" size={28} color={isDark ? '#FFF' : '#111'} /></TouchableOpacity>
               <Text style={{color: isDark ? '#FFF' : '#111', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 16}} numberOfLines={1}>{inAppViewer.file?.name}</Text>
               <TouchableOpacity onPress={() => executeExternalOpen(inAppViewer.file)}><Feather name="external-link" size={24} color={primaryColor} /></TouchableOpacity>
             </View>
             {inAppViewer.loading ? ( <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}><ActivityIndicator size="large" color={primaryColor} /></View> ) : inAppViewer.type === 'image' ? ( <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}><Image source={{ uri: inAppViewer.file?.uri }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} /></View> ) : inAppViewer.type === 'text' ? ( <ScrollView style={{flex: 1, padding: 20}}><Text style={{color: isDark ? '#CCC' : '#333', fontSize: 16, lineHeight: 24}}>{inAppViewer.content}</Text></ScrollView> ) : null}
           </View>
         </View>
      </Modal>

      {/* PREMIUM STORAGE ANALYTICS MODAL */}
      <Modal visible={showStatsModal} transparent animationType="slide" onRequestClose={() => setShowStatsModal(false)}>
         <TouchableOpacity style={styles.modalOverlayBottom} activeOpacity={1} onPress={() => setShowStatsModal(false)}>
           <TouchableOpacity activeOpacity={1} style={[styles.bottomSheet, { backgroundColor: themeColors.card, paddingBottom: insets.bottom + 40 }]}>
             <View style={[styles.sheetHandle, { backgroundColor: themeColors.separator, marginBottom: 30 }]} />
             
             {/* Center Premium Header */}
             <View style={{alignItems: 'center', marginBottom: 36}}>
                <View style={{width: 72, height: 72, borderRadius: 36, backgroundColor: primaryColor + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 16}}>
                   <Feather name="hard-drive" size={32} color={primaryColor} />
                </View>
                <Text style={{fontSize: 34, fontWeight: '900', color: themeColors.textDark, letterSpacing: -1}}>{formatBytes(storageStats.totalBytes)}</Text>
                <Text style={{fontSize: 14, fontWeight: '600', color: themeColors.textLight, marginTop: 4}}>Total Secured Storage</Text>
             </View>

             {/* Minimalist Segmented Bar */}
             <View style={{height: 12, borderRadius: 100, flexDirection: 'row', overflow: 'hidden', marginBottom: 32, backgroundColor: themeColors.inputBg}}>
                <View style={{width: `${(storageStats.imgBytes / storageStats.totalBytes) * 100}%`, backgroundColor: '#8B5CF6'}} />
                <View style={{width: `${(storageStats.docBytes / storageStats.totalBytes) * 100}%`, backgroundColor: '#3B82F6'}} />
                <View style={{width: `${(storageStats.otherBytes / storageStats.totalBytes) * 100}%`, backgroundColor: '#10B981'}} />
             </View>

             {/* Detailed Breakdown Cards */}
             <View style={{gap: 12}}>
                {[
                  { title: 'Images', value: formatBytes(storageStats.imgBytes), icon: 'image', color: '#8B5CF6' },
                  { title: 'Documents', value: formatBytes(storageStats.docBytes), icon: 'file-text', color: '#3B82F6' },
                  { title: 'Other Archives', value: formatBytes(storageStats.otherBytes), icon: 'package', color: '#10B981' }
                ].map((item, idx) => (
                  <View key={idx} style={[styles.statBox, { backgroundColor: themeColors.inputBg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18 }]}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <View style={[styles.statIcon, { backgroundColor: item.color + '15' }]}><Feather name={item.icon} size={16} color={item.color} /></View>
                      <Text style={[styles.statTitle, { color: themeColors.textDark, fontSize: 15 }]}>{item.title}</Text>
                    </View>
                    <Text style={[styles.statValue, { color: themeColors.textDark, fontSize: 15, marginTop: 0 }]}>{item.value}</Text>
                  </View>
                ))}
             </View>
           </TouchableOpacity>
         </TouchableOpacity>
      </Modal>

      <Modal visible={showSortSheet} transparent animationType="slide" onRequestClose={() => setShowSortSheet(false)}>
         <TouchableOpacity style={styles.modalOverlayBottom} activeOpacity={1} onPress={() => setShowSortSheet(false)}>
           <TouchableOpacity activeOpacity={1} style={[styles.bottomSheet, { backgroundColor: themeColors.card, paddingBottom: insets.bottom + 20 }]}>
             <View style={[styles.sheetHandle, { backgroundColor: themeColors.separator }]} />
             <Text style={[styles.sheetTitle, { color: themeColors.textDark, marginBottom: 16 }]}>Sort By</Text>
             {['newest', 'oldest', 'a-z', 'z-a', 'largest', 'smallest'].map((opt) => (
               <TouchableOpacity key={opt} style={styles.sortOptionRow} onPress={() => { setSortType(opt); setShowSortSheet(false); }}>
                 <Text style={[styles.sortOptionText, { color: themeColors.textDark, textTransform: 'capitalize' }]}>{opt.replace('-', ' to ')}</Text>
                 {sortType === opt && <Feather name="check" size={20} color={primaryColor} />}
               </TouchableOpacity>
             ))}
           </TouchableOpacity>
         </TouchableOpacity>
       </Modal>

      <Modal visible={isProcessing} transparent animationType="fade">
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }]}>
           <ActivityIndicator size="large" color={primaryColor} style={{ marginBottom: 20, transform: [{scale: 1.5}] }} />
           <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>{processText}</Text>
        </View>
      </Modal>
      
      {toastData.visible && (
        <Animated.View style={[styles.premiumToast, { opacity: toastOpacity, transform: [{ translateY: toastTranslateY }] }]} pointerEvents="none">
           <Feather name={toastData.icon} size={18} color="#10B981" style={{marginRight: 8}} />
           <Text style={{color: '#FFF', fontWeight: '600', fontSize: 14}}>{toastData.message}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerShell: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 50, paddingHorizontal: 16, marginBottom: 8 },
  headerTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  searchContainer: { paddingHorizontal: 16, marginBottom: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', height: 46, borderRadius: 100, borderWidth: 1, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '500', height: '100%' },
  
  chipScrollContainer: { height: 42, marginBottom: 10 },
  chip: { height: 36, borderRadius: 100, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, marginRight: 8, flexDirection: 'row' },
  chipText: { fontSize: 13, fontWeight: '600' },
  
  statBox: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
  statIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  statTitle: { fontWeight: '700' },
  statValue: { fontWeight: '800' },

  card: { flexDirection: 'row', alignItems: 'center', height: 76, borderRadius: 100, paddingHorizontal: 12, borderWidth: 1, marginBottom: 10, shadowOpacity: 0.03, elevation: 1 },
  selectionDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  cardIconBox: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  cardContent: { flex: 1, justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center' },
  cardMeta: { fontSize: 12, fontWeight: '600', marginRight: 10 },
  moreBtn: { padding: 10 },
  
  fabContainer: { position: 'absolute', bottom: 95, right: 24, zIndex: 100 },
  fab: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 6 },
  fabMenuOptions: { position: 'absolute', bottom: 160, right: 24, alignItems: 'flex-end', gap: 14, zIndex: 101 },
  fabOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fabOptionText: { fontSize: 14, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, overflow: 'hidden' },
  fabOptionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', elevation: 4 },

  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheet: { borderTopLeftRadius: 36, borderTopRightRadius: 36, paddingHorizontal: 24, paddingTop: 14 },
  sheetHandle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '800' },

  modalOverlayCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  customAlertBox: { width: '100%', borderRadius: 36, padding: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 12, alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  alertIconBox: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  alertTitle: { fontSize: 22, fontWeight: '800', marginBottom: 10 },
  modalInput: { height: 60, borderRadius: 100, fontSize: 24, fontWeight: 'bold', letterSpacing: 10, marginBottom: 24, borderWidth: 1, width: '100%', textAlign: 'center', paddingHorizontal: 24 },
  alertBtnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  alertBtn: { flex: 1, height: 54, borderRadius: 100, justifyContent: 'center', alignItems: 'center' },
  alertBtnText: { fontSize: 16, fontWeight: '700' },
  
  modalOverlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sortOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  sortOptionText: { fontSize: 16, fontWeight: '600' },

  premiumToast: { 
    position: 'absolute', bottom: 120, alignSelf: 'center', zIndex: 9999999,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 14, 
    borderRadius: 999, backgroundColor: '#0F172A', 
    shadowColor: '#000', shadowOffset: {width:0,height:8}, shadowOpacity: 0.35, shadowRadius: 16, elevation: 12, 
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' 
  }
});
