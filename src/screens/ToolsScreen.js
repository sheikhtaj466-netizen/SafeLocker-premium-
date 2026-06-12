// File: src/screens/ToolsScreen.js
import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  FlatList, Modal, ActivityIndicator, ScrollView, Switch, Pressable, Platform, Animated
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 🚀 REAL CONVERSION ENGINES
import * as Print from 'expo-print';
import * as XLSX from 'xlsx';

import { ThemeContext } from '../ThemeContext';
import { logActivity } from '../utils/storage'; 

const formatBytes = (bytes, decimals = 2) => {
  if (!+bytes) return '0 B';
  const k = 1024; const dm = decimals < 0 ? 0 : decimals; const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const TOOLS_DIR = FileSystem.documentDirectory + 'SafeLocker_Tools/';

export default function ToolsScreen({ setSwipeEnabled }) {
  const { isDark, themeColors } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const primaryColor = themeColors?.primary || '#6C5CE7';

  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeTool, setActiveTool] = useState(null);
  const [settings, setSettings] = useState({ autoSave: true, keepHistory: true });

  const [pickedFile, setPickedFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionSuccess, setConversionSuccess] = useState(false);
  const [customName, setCustomName] = useState('');
  const [convertedFileUri, setConvertedFileUri] = useState(null);

  const [confirmModal, setConfirmModal] = useState({ visible: false, title: '', subtitle: '', onConfirm: null });

  const initialTools = [
    { id: 'img_pdf', title: 'Image ➔ PDF', icon: 'image', desc: 'Convert PNG/JPG to PDF document', type: 'image' },
    { id: 'pdf_img', title: 'PDF ➔ Images', icon: 'file-text', desc: 'Extract high-quality images from PDF', type: 'pdf', comingSoon: true },
    { id: 'imgs_pdf', title: 'Multi Images ➔ PDF', icon: 'layers', desc: 'Merge multiple pictures into one A4 PDF', type: 'image_multi' },
    { id: 'txt_pdf', title: 'TXT ➔ PDF', icon: 'align-left', desc: 'Convert plain text files with styled layouts', type: 'txt' },
    { id: 'html_pdf', title: 'HTML ➔ PDF', icon: 'globe', desc: 'Render web files into responsive sheets', type: 'html' },
    { id: 'csv_xlsx', title: 'CSV ➔ XLSX', icon: 'grid', desc: 'Convert spreadsheet data streams smoothly', type: 'csv' }
  ];

  const [toastData, setToastData] = useState({ visible: false, message: '', icon: 'check-circle' });
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => { 
    initToolsSystem();
    loadHubData(); 
  }, []);

  const initToolsSystem = async () => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(TOOLS_DIR);
      if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(TOOLS_DIR, { intermediates: true });
    } catch (e) { console.log(e); }
  };

  const loadHubData = async () => {
     try {
       const favs = await AsyncStorage.getItem('TOOLS_FAVORITES');
       if (favs) setFavorites(JSON.parse(favs));
       const hist = await AsyncStorage.getItem('TOOLS_HISTORY');
       if (hist) setHistory(JSON.parse(hist));
     } catch (e) { console.log(e); }
  };

  // 🚀 Premium Animated Toast (Drops from top to avoid overlapping)
  const showToast = (msg, icon = 'check-circle') => {
    setToastData({ visible: true, message: msg, icon });
    Haptics.notificationAsync(icon === 'x-circle' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success);
    
    Animated.parallel([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(toastTranslateY, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true })
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(toastTranslateY, { toValue: -20, duration: 250, useNativeDriver: true })
      ]).start(() => setToastData({ visible: false, message: '', icon: 'check-circle' }));
    }, 2500);
  };

  const renderPremiumToast = () => {
    if (!toastData.visible) return null;
    const isError = toastData.icon === 'x-circle';
    return (
      <Animated.View style={[styles.premiumToast, { top: insets.top + 16, opacity: toastOpacity, transform: [{ translateY: toastTranslateY }] }]} pointerEvents="none">
         <Feather name={toastData.icon} size={18} color={isError ? "#EF4444" : "#10B981"} style={{marginRight: 8}} />
         <Text style={{color: '#FFF', fontWeight: '600', fontSize: 14}}>{toastData.message}</Text>
      </Animated.View>
    );
  };

  const toggleFavorite = async (toolId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let updated = [...favorites];
    if (updated.includes(toolId)) updated = updated.filter(id => id !== toolId);
    else updated.push(toolId);
    setFavorites(updated);
    await AsyncStorage.setItem('TOOLS_FAVORITES', JSON.stringify(updated));
    await logActivity('Tools', 'TOOL_FAVORITED', 'Toggled favorite status for a utility tool.', 'INFO');
  };

  const handlePickFile = async (tool) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    let mimeType = '*/*';
    if (tool.id === 'img_pdf') mimeType = 'image/*';
    if (tool.id === 'txt_pdf') mimeType = 'text/plain';
    if (tool.id === 'html_pdf') mimeType = 'text/html';
    if (tool.id === 'csv_xlsx') mimeType = 'text/comma-separated-values';

    try {
      const result = await DocumentPicker.getDocumentAsync({ type: mimeType, multiple: tool.id === 'imgs_pdf' });
      if (!result.canceled && result.assets) {
         setPickedFile(tool.id === 'imgs_pdf' ? result.assets : result.assets[0]);
         setCustomName(`Converted_${Date.now().toString().slice(-4)}`);
         await logActivity('Tools', 'FILE_SELECTED', 'Selected a file for format conversion.', 'INFO');
      }
    } catch (e) { console.log(e); }
  };

  const triggerConversion = async () => {
    if (!pickedFile) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setIsConverting(true);
    setProgress(10); 

    try {
      let outputUri = '';
      let finalName = customName ? customName : `Converted_${Date.now()}`;

      if (activeTool.id === 'img_pdf') {
        setProgress(30);
        const b64 = await FileSystem.readAsStringAsync(pickedFile.uri, { encoding: FileSystem.EncodingType.Base64 });
        const mime = pickedFile.name.toLowerCase().endsWith('png') ? 'image/png' : 'image/jpeg';
        const html = `<div style="display:flex; justify-content:center; align-items:center; height:95vh;"><img src="data:${mime};base64,${b64}" style="max-width:100%; max-height:100%; object-fit:contain;" /></div>`;
        setProgress(60);
        const { uri } = await Print.printToFileAsync({ html });
        outputUri = uri;
        if (!finalName.endsWith('.pdf')) finalName += '.pdf';
      }
      
      else if (activeTool.id === 'imgs_pdf') {
        setProgress(20);
        let html = '';
        for (let i = 0; i < pickedFile.length; i++) {
          const img = pickedFile[i];
          const b64 = await FileSystem.readAsStringAsync(img.uri, { encoding: FileSystem.EncodingType.Base64 });
          const mime = img.name.toLowerCase().endsWith('png') ? 'image/png' : 'image/jpeg';
          html += `<div style="display:flex; justify-content:center; align-items:center; height:95vh; page-break-after: ${i === pickedFile.length - 1 ? 'auto' : 'always'};"><img src="data:${mime};base64,${b64}" style="max-width:100%; max-height:100%; object-fit:contain;" /></div>`;
          setProgress(20 + Math.floor((i / pickedFile.length) * 40)); 
        }
        const { uri } = await Print.printToFileAsync({ html });
        outputUri = uri;
        if (!finalName.endsWith('.pdf')) finalName += '.pdf';
      }
      
      else if (activeTool.id === 'txt_pdf') {
        setProgress(40);
        const text = await FileSystem.readAsStringAsync(pickedFile.uri, { encoding: FileSystem.EncodingType.UTF8 });
        const html = `<div style="padding: 20px; font-family: 'Helvetica Neue', sans-serif; font-size: 16px; white-space: pre-wrap; line-height: 1.6;">${text}</div>`;
        setProgress(70);
        const { uri } = await Print.printToFileAsync({ html });
        outputUri = uri;
        if (!finalName.endsWith('.pdf')) finalName += '.pdf';
      }
      
      else if (activeTool.id === 'html_pdf') {
        setProgress(40);
        const htmlContent = await FileSystem.readAsStringAsync(pickedFile.uri, { encoding: FileSystem.EncodingType.UTF8 });
        setProgress(70);
        const { uri } = await Print.printToFileAsync({ html: htmlContent });
        outputUri = uri;
        if (!finalName.endsWith('.pdf')) finalName += '.pdf';
      }
      
      else if (activeTool.id === 'csv_xlsx') {
        setProgress(40);
        const csvText = await FileSystem.readAsStringAsync(pickedFile.uri, { encoding: FileSystem.EncodingType.UTF8 });
        setProgress(60);
        const wb = XLSX.read(csvText, { type: 'string' });
        const base64Xlsx = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        
        if (!finalName.endsWith('.xlsx')) finalName += '.xlsx';
        outputUri = FileSystem.cacheDirectory + finalName; 
        await FileSystem.writeAsStringAsync(outputUri, base64Xlsx, { encoding: FileSystem.EncodingType.Base64 });
      }

      setProgress(90);

      const persistentUri = TOOLS_DIR + finalName;
      await FileSystem.copyAsync({ from: outputUri, to: persistentUri });
      
      setConvertedFileUri(persistentUri);
      setProgress(100);
      
      setTimeout(() => finalizeConversion(finalName, persistentUri), 500);

    } catch (error) {
      setIsConverting(false); setProgress(0);
      showToast("Failed to process file format.", "x-circle");
    }
  };

  const finalizeConversion = async (fileName, uri) => {
     setIsConverting(false);
     setConversionSuccess(true);
     Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
     
     if (settings.keepHistory) {
         const newLog = {
           id: Date.now().toString(),
           title: activeTool.title,
           name: fileName,
           date: new Date().toLocaleDateString(),
           uri: uri
         };
         const updatedHistory = [newLog, ...history].slice(0, 30);
         setHistory(updatedHistory);
         await AsyncStorage.setItem('TOOLS_HISTORY', JSON.stringify(updatedHistory));
     }
     await logActivity('Tools', 'FILE_CONVERTED', `Successfully converted file format to ${fileName.split('.').pop().toUpperCase()}.`, 'WORKFLOW');
  };

  const executeShare = async (uriToShare) => {
     try {
       Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
       let target = (typeof uriToShare === 'string') ? uriToShare : convertedFileUri;
       if (!target) { showToast("File not found!", "x-circle"); return; }

       const fileInfo = await FileSystem.getInfoAsync(target);
       if (!fileInfo.exists) { showToast("File has been moved or deleted.", "x-circle"); return; }

       if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(target, { dialogTitle: 'Share Converted File' });
          await logActivity('Tools', 'CONVERSION_SHARED', 'Shared a converted file externally.', 'IMPORTANT');
       }
     } catch (e) { showToast("Unable to share this file.", "x-circle"); }
  };

  const closeConversionFlow = () => {
     setPickedFile(null);
     setIsConverting(false);
     setConversionSuccess(false);
     setProgress(0);
     setConvertedFileUri(null);
     setActiveTool(null);
  };

  const deleteHistoryItem = (id, uri) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfirmModal({
      visible: true,
      title: 'Delete File',
      subtitle: 'Remove this file from your conversion history? This action cannot be undone.',
      onConfirm: async () => {
         const updated = history.filter(h => h.id !== id);
         setHistory(updated);
         await AsyncStorage.setItem('TOOLS_HISTORY', JSON.stringify(updated));
         try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch(e) {}
         setConfirmModal({...confirmModal, visible: false});
         showToast("Item deleted securely");
         await logActivity('Tools', 'HISTORY_ITEM_DELETED', 'Deleted a generated file from tool history.', 'WORKFLOW');
      }
    });
  };

  const clearAllHistory = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfirmModal({
      visible: true,
      title: 'Clear All History',
      subtitle: 'Are you sure? This will permanently delete all generated files from the Tools folder.',
      onConfirm: async () => {
         setHistory([]);
         await AsyncStorage.removeItem('TOOLS_HISTORY');
         try { 
           await FileSystem.deleteAsync(TOOLS_DIR, { idempotent: true }); 
           await FileSystem.makeDirectoryAsync(TOOLS_DIR, { intermediates: true }); 
         } catch(e) {}
         setConfirmModal({...confirmModal, visible: false});
         showToast("All history cleared");
         await logActivity('Tools', 'HISTORY_CLEARED', 'Permanently cleared all generated tool history.', 'IMPORTANT');
      }
    });
  };

  const filteredTools = initialTools.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const favToolsList = initialTools.filter(t => favorites.includes(t.id));

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8F9FB' }]}>
      {renderPremiumToast()}
      <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingTop: insets.top + 16 }} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <Text style={[styles.title, { color: themeColors.textDark }]}>Tools Hub</Text>
          <Text style={[styles.subtitle, { color: themeColors.textLight }]}>Real Core Utilities Installed</Text>
        </View>

        <View style={styles.searchContainer}>
          <View style={[styles.searchBox, { backgroundColor: themeColors.inputBg, borderColor: isDark ? '#334155' : '#EEF1F5' }]}>
            <Feather name="search" size={18} color="#94A3B8" style={{ marginRight: 10 }} />
            <TextInput 
              style={[styles.searchInput, { color: themeColors.textDark }]} 
              placeholder="Search Tools..." 
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {favToolsList.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.textDark }]}>Favorite Tools ⭐</Text>
            <View style={styles.grid}>
              {favToolsList.map(tool => (
                <TouchableOpacity 
                  key={tool.id} 
                  activeOpacity={tool.comingSoon ? 1 : 0.7}
                  style={[styles.glassCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: primaryColor + '40', opacity: tool.comingSoon ? 0.65 : 1 }]}
                  onPress={() => tool.comingSoon ? showToast('Coming Soon! Stay tuned 🚀', 'info') : setActiveTool(tool)}
                  onLongPress={() => tool.comingSoon ? null : toggleFavorite(tool.id)}
                >
                  {tool.comingSoon && (
                     <View style={{position: 'absolute', top: 12, right: 12, backgroundColor: '#8B5CF620', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6}}>
                        <Text style={{fontSize: 9, color: '#8B5CF6', fontWeight: '800'}}>SOON</Text>
                     </View>
                  )}
                  <View style={[styles.iconBox, { backgroundColor: primaryColor + '15' }]}>
                    <Feather name={tool.icon} size={22} color={primaryColor} />
                  </View>
                  <Text style={[styles.cardTitle, { color: themeColors.textDark }]} numberOfLines={1}>{tool.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.textDark }]}>All Utilities</Text>
          <View style={styles.grid}>
            {filteredTools.map(tool => (
              <TouchableOpacity 
                key={tool.id} 
                activeOpacity={tool.comingSoon ? 1 : 0.7}
                style={[styles.glassCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#EDF1F5', opacity: tool.comingSoon ? 0.65 : 1 }]}
                onPress={() => tool.comingSoon ? showToast('Coming Soon! Stay tuned 🚀', 'info') : setActiveTool(tool)}
                onLongPress={() => tool.comingSoon ? null : toggleFavorite(tool.id)}
              >
                {tool.comingSoon && (
                   <View style={{position: 'absolute', top: 12, right: 12, backgroundColor: '#8B5CF620', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6}}>
                      <Text style={{fontSize: 9, color: '#8B5CF6', fontWeight: '800'}}>SOON</Text>
                   </View>
                )}
                <View style={[styles.iconBox, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
                  <Feather name={tool.icon} size={22} color={favorites.includes(tool.id) ? '#F59E0B' : primaryColor} />
                </View>
                <Text style={[styles.cardTitle, { color: themeColors.textDark }]}>{tool.title}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>{tool.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {history.length > 0 && (
          <View style={styles.section}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
              <Text style={[styles.sectionTitle, { color: themeColors.textDark, marginBottom: 0 }]}>Recent Conversions</Text>
              <TouchableOpacity onPress={clearAllHistory} style={{paddingHorizontal: 8, paddingVertical: 4}}>
                 <Text style={{color: '#EF4444', fontWeight: '700', fontSize: 13}}>Clear All</Text>
              </TouchableOpacity>
            </View>

            {history.map(item => (
              <View key={item.id} style={[styles.historyRow, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#EDF1F5' }]}>
                <View style={[styles.iconBox, {width: 36, height: 36, marginBottom: 0, marginRight: 12, backgroundColor: primaryColor+'15'}]}>
                   <Feather name="file" size={16} color={primaryColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.historyName, { color: themeColors.textDark }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={{ fontSize: 11, color: '#94A3B8' }}>{item.title} • {item.date}</Text>
                </View>
                
                {/* 🚀 Minimalist History Options: Only Share & Delete */}
                <View style={{flexDirection: 'row', gap: 14, alignItems: 'center', marginLeft: 10}}>
                   <TouchableOpacity onPress={() => executeShare(item.uri)} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                     <Feather name="share-2" size={18} color={themeColors.textDark} />
                   </TouchableOpacity>
                   <TouchableOpacity onPress={() => deleteHistoryItem(item.id, item.uri)} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                     <Feather name="trash-2" size={18} color="#EF4444" />
                   </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.textDark }]}>Tool Settings</Text>
          <View style={[styles.settingRow, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
             <Text style={{ color: themeColors.textDark, fontWeight: '600' }}>Keep Conversion History</Text>
             <Switch 
               value={settings.keepHistory} 
               onValueChange={async (val) => {
                 setSettings({...settings, keepHistory: val});
                 await logActivity('Tools', 'SETTINGS_CHANGED', `Keep Conversion History set to ${val}.`, 'INFO');
               }} 
               trackColor={{ true: primaryColor }} 
             />
          </View>
        </View>

      </ScrollView>

      {/* UNIVERSAL CORE CONVERT MODAL */}
      <Modal visible={activeTool !== null} transparent animationType="slide" onRequestClose={closeConversionFlow}>
        <View style={styles.modalOverlay}>
          <View style={[styles.bottomSheet, { backgroundColor: themeColors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: themeColors.separator }]} />
            
            <Text style={[styles.sheetTitle, { color: themeColors.textDark }]}>{activeTool?.title}</Text>
            <Text style={{ color: '#94A3B8', fontSize: 13, marginBottom: 20 }}>{activeTool?.desc}</Text>

            {!pickedFile ? (
              <TouchableOpacity style={[styles.pickerBtn, { borderColor: primaryColor }]} onPress={() => handlePickFile(activeTool)}>
                <Feather name="upload-cloud" size={32} color={primaryColor} />
                <Text style={{ color: primaryColor, fontWeight: '700', marginTop: 8 }}>Select Target File</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: '100%' }}>
                <View style={[styles.fileMetadataCard, { backgroundColor: themeColors.inputBg }]}>
                  <Feather name="file" size={24} color={primaryColor} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                     <Text style={{ color: themeColors.textDark, fontWeight: '700' }} numberOfLines={1}>
                       {Array.isArray(pickedFile) ? `${pickedFile.length} Items Selected` : pickedFile.name}
                     </Text>
                     <Text style={{ color: '#94A3B8', fontSize: 12 }}>
                       {Array.isArray(pickedFile) ? 'Batch Queue' : formatBytes(pickedFile.size)}
                     </Text>
                  </View>
                </View>

                <Text style={{ color: themeColors.textDark, fontWeight: '700', marginBottom: 8, marginTop: 16 }}>Rename Output</Text>
                <TextInput 
                  style={[styles.inputBox, { backgroundColor: themeColors.inputBg, color: themeColors.textDark, borderColor: themeColors.separator }]}
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder="Output file designation name"
                />

                {isConverting && (
                  <View style={{ alignItems: 'center', marginTop: 24 }}>
                     <ActivityIndicator size="small" color={primaryColor} />
                     <Text style={{ color: themeColors.textDark, fontWeight: '800', marginTop: 8, fontSize: 16 }}>
                        Working... {progress}%
                     </Text>
                  </View>
                )}

                {conversionSuccess && (
                  <View style={{ alignItems: 'center', marginTop: 20, backgroundColor: '#10B98115', padding: 16, borderRadius: 16 }}>
                    <Feather name="check-circle" size={40} color="#10B981" />
                    <Text style={{ color: '#10B981', fontWeight: '800', marginTop: 6, fontSize: 16 }}>Conversion Complete!</Text>
                    
                    {/* 🚀 Minimalist Share Button Restored */}
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10B981', marginTop: 16, width: '100%' }]} onPress={() => executeShare(convertedFileUri)}>
                       <Text style={{ color: '#FFF', fontWeight: '700', textAlign: 'center' }}>Share File</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {!isConverting && !conversionSuccess && (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
                    <TouchableOpacity style={[styles.alertBtn, { backgroundColor: themeColors.inputBg }]} onPress={closeConversionFlow}>
                      <Text style={{ color: themeColors.textDark, fontWeight: '700', textAlign: 'center' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.alertBtn, { backgroundColor: primaryColor }]} onPress={triggerConversion}>
                      <Text style={{ color: '#FFF', fontWeight: '700', textAlign: 'center' }}>Convert REAL</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {(conversionSuccess) && (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: themeColors.inputBg, marginTop: 12 }]} onPress={closeConversionFlow}>
                     <Text style={{ color: themeColors.textDark, fontWeight: '700', textAlign: 'center' }}>Close Hub</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
          {/* TOAST RENDERED INSIDE MODAL */}
          {renderPremiumToast()}
        </View>
      </Modal>

      {/* PREMIUM CONFIRM DELETE MODAL */}
      <Modal visible={confirmModal.visible} transparent animationType="fade" onRequestClose={() => setConfirmModal({...confirmModal, visible: false})}>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.alertBox, { backgroundColor: themeColors.card, width: '85%' }]}>
            <View style={{alignItems: 'center', marginBottom: 16}}>
               <View style={{width: 56, height: 56, borderRadius: 28, backgroundColor: '#EF444415', justifyContent: 'center', alignItems: 'center'}}>
                 <Feather name="trash-2" size={24} color="#EF4444" />
               </View>
            </View>
            <Text style={[styles.alertTitle, { color: themeColors.textDark, textAlign: 'center', marginBottom: 8 }]}>{confirmModal.title}</Text>
            <Text style={{color: themeColors.textLight, textAlign: 'center', fontSize: 14, marginBottom: 24, paddingHorizontal: 10, lineHeight: 20}}>
               {confirmModal.subtitle}
            </Text>
            <View style={{flexDirection: 'row', gap: 12}}>
              <TouchableOpacity style={[styles.alertBtn, {backgroundColor: themeColors.inputBg}]} onPress={() => setConfirmModal({...confirmModal, visible: false})}>
                 <Text style={{color: themeColors.textDark, fontWeight: '700'}}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.alertBtn, {backgroundColor: '#EF4444'}]} onPress={confirmModal.onConfirm}>
                 <Text style={{color: '#FFF', fontWeight: '700'}}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
          {/* TOAST RENDERED INSIDE MODAL */}
          {renderPremiumToast()}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  searchContainer: { paddingHorizontal: 16, marginBottom: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', height: 46, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '500', height: '100%' },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12, letterSpacing: -0.2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  glassCard: { width: '48%', padding: 16, borderRadius: 20, borderWidth: 1, elevation: 1, marginBottom: 4 },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  cardDesc: { fontSize: 11, color: '#94A3B8', lineHeight: 14 },
  historyRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
  historyName: { fontSize: 14, fontWeight: '700' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alertBox: { padding: 24, borderRadius: 28 },
  alertTitle: { fontSize: 20, fontWeight: '800' },
  bottomSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 40 },
  sheetHandle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  pickerBtn: { width: '100%', height: 140, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  fileMetadataCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginTop: 10 },
  inputBox: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 15, fontWeight: '600' },
  alertBtn: { flex: 1, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  actionBtn: { height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  
  // 🚀 Premium Dropdown Dynamic Island Toast
  premiumToast: { 
    position: 'absolute', alignSelf: 'center', 
    backgroundColor: '#1E293B', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, borderRadius: 100, 
    shadowColor: '#000', shadowOffset: {width:0, height:10}, shadowOpacity: 0.25, shadowRadius: 16, elevation: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', zIndex: 999999
  }
});
