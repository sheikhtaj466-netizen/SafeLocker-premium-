// File: src/screens/ToolsScreen.js
import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  FlatList, Modal, ActivityIndicator, ScrollView, Switch, Pressable, Platform, Animated, Keyboard, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 🚀 REAL PROCESSING ENGINES
import * as Print from 'expo-print';
import * as XLSX from 'xlsx';
import * as ImageManipulator from 'expo-image-manipulator';

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
  const [activeCategory, setActiveCategory] = useState('All'); 
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeTool, setActiveTool] = useState(null);
  const [settings, setSettings] = useState({ autoSave: true, keepHistory: true });

  const [pickedFile, setPickedFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processSuccess, setProcessSuccess] = useState(false);
  const [customName, setCustomName] = useState('');
  const [outputFileUri, setOutputFileUri] = useState(null);
  
  // 🔥 ULTRA-SMART TARGET COMPRESSION STATES
  const [targetKB, setTargetKB] = useState('');
  const [minPossibleKB, setMinPossibleKB] = useState(0);
  const [finalCompressedSize, setFinalCompressedSize] = useState(0);
  const [extremeWarningModal, setExtremeWarningModal] = useState(false);

  const [confirmModal, setConfirmModal] = useState({ visible: false, title: '', subtitle: '', onConfirm: null });

  // TOOLS LIST
  const initialTools = [
    { id: 'img_pdf', title: 'Image ➔ PDF', icon: 'image', desc: 'Convert PNG/JPG to PDF document', category: 'Convert' },
    { id: 'pdf_img', title: 'PDF ➔ Images', icon: 'file-text', desc: 'Extract high-quality images from PDF', category: 'Convert', comingSoon: true },
    { id: 'imgs_pdf', title: 'Multi Images ➔ PDF', icon: 'layers', desc: 'Merge multiple pictures into one A4 PDF', category: 'Convert' },
    { id: 'txt_pdf', title: 'TXT ➔ PDF', icon: 'align-left', desc: 'Convert plain text files with styled layouts', category: 'Convert' },
    { id: 'html_pdf', title: 'HTML ➔ PDF', icon: 'globe', desc: 'Render web files into responsive sheets', category: 'Convert' },
    { id: 'csv_xlsx', title: 'CSV ➔ XLSX', icon: 'grid', desc: 'Convert spreadsheet data streams smoothly', category: 'Convert' },
    
    { id: 'compress_img', title: 'Image Compressor', icon: 'minimize', desc: 'Reduce JPEG/PNG to exact target KB', category: 'Compress' },
    { id: 'minify_code', title: 'Code/Text Minifier', icon: 'code', desc: 'Minify JS, CSS, HTML, and TXT files', category: 'Compress' },
    { id: 'compress_pdf', title: 'PDF Compressor', icon: 'file-minus', desc: 'Shrink PDF documents', category: 'Compress', comingSoon: true },
    { id: 'compress_doc', title: 'Document Compressor', icon: 'briefcase', desc: 'Compress DOCX, XLSX, PPTX', category: 'Compress', comingSoon: true },
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
    if (tool.id === 'img_pdf' || tool.id === 'compress_img') mimeType = 'image/*';
    if (tool.id === 'txt_pdf') mimeType = 'text/plain';
    if (tool.id === 'html_pdf' || tool.id === 'minify_code') mimeType = ['text/html', 'text/css', 'text/javascript', 'text/plain'];
    if (tool.id === 'csv_xlsx') mimeType = 'text/comma-separated-values';

    try {
      const result = await DocumentPicker.getDocumentAsync({ type: mimeType, multiple: tool.id === 'imgs_pdf' });
      if (!result.canceled && result.assets) {
         const selectedFile = tool.id === 'imgs_pdf' ? result.assets : result.assets[0];
         setPickedFile(selectedFile);
         setCustomName(`${tool.category === 'Compress' ? 'Compressed' : 'Converted'}_${Date.now().toString().slice(-4)}`);
         setTargetKB(''); 
         setFinalCompressedSize(0);
         
         // 🚀 SMART ESTIMATOR: Calculate absolute minimum possible KB without complete destruction
         if (tool.id === 'compress_img' && !Array.isArray(selectedFile)) {
             // Roughly 4% of original size is the extreme mathematical limit for standard JPEGs before dimensions hit 1x1
             const estimatedMinKB = Math.max(12, Math.floor((selectedFile.size / 1024) * 0.04));
             setMinPossibleKB(estimatedMinKB);
         }
         
         await logActivity('Tools', 'FILE_SELECTED', `Selected a file for ${tool.category.toLowerCase()}.`, 'INFO');
      }
    } catch (e) { console.log(e); }
  };

  // 🔥 Helper to get image dimensions natively
  const getImageDimensions = (uri) => new Promise((resolve) => {
      Image.getSize(uri, (width, height) => resolve({ width, height }), () => resolve({ width: 1200, height: 1200 }));
  });

  const triggerProcessing = async () => {
    if (!pickedFile) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Keyboard.dismiss();

    // 🚨 EXTREME COMPRESSION CHECK
    if (activeTool.id === 'compress_img' && targetKB) {
        const inputKB = parseInt(targetKB);
        if (inputKB < minPossibleKB) {
            setExtremeWarningModal(true);
            return; // Stop processing, show warning
        }
    }

    setIsProcessing(true);
    setProgress(10); 

    try {
      let outputUri = '';
      let finalName = customName ? customName : `Output_${Date.now()}`;

      // 🛠️ CONVERTERS LOGIC
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

      // 🛠️ ULTRA-SMART EXACT-SIZE COMPRESSOR ENGINE
      else if (activeTool.id === 'compress_img') {
        setProgress(20);
        
        const targetBytes = targetKB ? parseInt(targetKB) * 1024 : pickedFile.size;
        let bestUri = pickedFile.uri;
        let bestSize = pickedFile.size;
        
        if (targetKB && pickedFile.size > targetBytes) {
            const { width: origW } = await getImageDimensions(pickedFile.uri);
            let currentW = origW;
            let minQ = 0.0;
            let maxQ = 1.0;
            
            // 🔥 Deep Compression Algorithm (Tests 6 times for extreme accuracy)
            for (let i = 0; i < 6; i++) {
                setProgress(20 + (i * 10)); 
                let midQ = (minQ + maxQ) / 2;
                
                // Agar target bohot chota hai aur quality kam karne se kaam nahi ban raha, toh dimensions bhi chote karo
                let actions = [];
                if (currentW < origW) {
                    actions.push({ resize: { width: Math.floor(currentW) } });
                }
                
                const manipResult = await ImageManipulator.manipulateAsync(
                    pickedFile.uri, actions,
                    { compress: midQ, format: ImageManipulator.SaveFormat.JPEG }
                );
                
                const fileInfo = await FileSystem.getInfoAsync(manipResult.uri);
                
                if (fileInfo.size <= targetBytes) {
                    bestUri = manipResult.uri;
                    bestSize = fileInfo.size;
                    minQ = midQ; // Got it! Now try increasing quality slightly to get closer to limit
                } else {
                    maxQ = midQ; // Still too big, reduce quality
                    if (midQ <= 0.2) {
                        // Quality is already dead low, we MUST shrink dimensions to hit the target KB
                        currentW = currentW * 0.75; // Reduce resolution by 25%
                        maxQ = 0.8; // Reset quality testing range for new smaller dimension
                        minQ = 0.0;
                    }
                }
            }
            outputUri = bestUri;
            setFinalCompressedSize(bestSize);
        } else {
            // Auto Balanced Compression
            const manipResult = await ImageManipulator.manipulateAsync(
                pickedFile.uri, [],
                { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
            );
            const fileInfo = await FileSystem.getInfoAsync(manipResult.uri);
            outputUri = manipResult.uri;
            setFinalCompressedSize(fileInfo.size);
        }

        if (!finalName.endsWith('.jpg')) finalName += '.jpg';
        setProgress(80);
      }
      else if (activeTool.id === 'minify_code') {
        setProgress(30);
        let content = await FileSystem.readAsStringAsync(pickedFile.uri, { encoding: FileSystem.EncodingType.UTF8 });
        setProgress(50);
        
        // JS/CSS/HTML Minification: Removes block comments, line comments, and extra whitespaces
        content = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').replace(/\s+/g, ' ').trim();
        setProgress(70);
        
        const originalExt = pickedFile.name.split('.').pop();
        if (!finalName.endsWith(`.${originalExt}`)) finalName += `.${originalExt}`;
        
        outputUri = FileSystem.cacheDirectory + finalName;
        await FileSystem.writeAsStringAsync(outputUri, content, { encoding: FileSystem.EncodingType.UTF8 });
        
        const fileInfo = await FileSystem.getInfoAsync(outputUri);
        setFinalCompressedSize(fileInfo.size);
      }

      setProgress(90);

      const persistentUri = TOOLS_DIR + finalName;
      await FileSystem.copyAsync({ from: outputUri, to: persistentUri });
      
      setOutputFileUri(persistentUri);
      setProgress(100);
      
      setTimeout(() => finalizeProcessing(finalName, persistentUri), 500);

    } catch (error) {
      setIsProcessing(false); setProgress(0);
      showToast("Failed to process file.", "x-circle");
    }
  };

  const finalizeProcessing = async (fileName, uri) => {
     setIsProcessing(false);
     setProcessSuccess(true);
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
     await logActivity('Tools', 'FILE_PROCESSED', `Successfully completed operation: ${activeTool.title}.`, 'WORKFLOW');
  };

  const executeShare = async (uriToShare) => {
     try {
       Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
       let target = (typeof uriToShare === 'string') ? uriToShare : outputFileUri;
       if (!target) { showToast("File not found!", "x-circle"); return; }

       const fileInfo = await FileSystem.getInfoAsync(target);
       if (!fileInfo.exists) { showToast("File has been moved or deleted.", "x-circle"); return; }

       if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(target, { dialogTitle: 'Share File' });
          await logActivity('Tools', 'FILE_SHARED', 'Shared a processed file externally.', 'IMPORTANT');
       }
     } catch (e) { showToast("Unable to share this file.", "x-circle"); }
  };

  // 🔥 NEW: RE-COMPRESS FUNCTIONALITY
  const handleRecompress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProcessSuccess(false);
    setProgress(0);
    setTargetKB('');
    setFinalCompressedSize(0);
  };

  const closeProcessingFlow = () => {
     setPickedFile(null);
     setIsProcessing(false);
     setProcessSuccess(false);
     setProgress(0);
     setOutputFileUri(null);
     setActiveTool(null);
     setTargetKB('');
     setFinalCompressedSize(0);
  };

  const deleteHistoryItem = (id, uri) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfirmModal({
      visible: true,
      title: 'Delete File',
      subtitle: 'Remove this file from your history? This action cannot be undone.',
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

  let displayTools = initialTools;
  if (activeCategory !== 'All') {
    displayTools = displayTools.filter(t => t.category === activeCategory);
  }
  const filteredTools = displayTools.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
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

        <View style={styles.tabsContainer}>
          {['All', 'Convert', 'Compress'].map(cat => (
             <TouchableOpacity 
               key={cat} 
               onPress={() => { Haptics.selectionAsync(); setActiveCategory(cat); }}
               style={[styles.tabBtn, activeCategory === cat && { backgroundColor: primaryColor }]}
             >
               <Text style={[styles.tabText, { color: activeCategory === cat ? '#FFF' : themeColors.textLight }]}>{cat}</Text>
             </TouchableOpacity>
          ))}
        </View>

        {favToolsList.length > 0 && activeCategory === 'All' && !searchQuery && (
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
          <Text style={[styles.sectionTitle, { color: themeColors.textDark }]}>
            {activeCategory === 'All' ? 'All Utilities' : `${activeCategory} Tools`}
          </Text>
          <View style={styles.grid}>
            {filteredTools.map(tool => (
              <TouchableOpacity 
                key={tool.id} 
                activeOpacity={tool.comingSoon ? 1 : 0.7}
                style={[styles.glassCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#EDF1F5', opacity: tool.comingSoon ? 0.65 : 1 }]}
                onPress={() => tool.comingSoon ? showToast('Available in next update 🚀', 'info') : setActiveTool(tool)}
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

        {history.length > 0 && activeCategory === 'All' && !searchQuery && (
          <View style={styles.section}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
              <Text style={[styles.sectionTitle, { color: themeColors.textDark, marginBottom: 0 }]}>Recent Activities</Text>
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
             <Text style={{ color: themeColors.textDark, fontWeight: '600' }}>Keep Process History</Text>
             <Switch 
               value={settings.keepHistory} 
               onValueChange={async (val) => {
                 setSettings({...settings, keepHistory: val});
                 await logActivity('Tools', 'SETTINGS_CHANGED', `Keep History set to ${val}.`, 'INFO');
               }} 
               trackColor={{ true: primaryColor }} 
             />
          </View>
        </View>

      </ScrollView>

      {/* UNIVERSAL CORE PROCESS MODAL */}
      <Modal visible={activeTool !== null} transparent animationType="slide" onRequestClose={closeProcessingFlow}>
        <View style={styles.modalOverlay}>
          <View style={[styles.bottomSheet, { backgroundColor: themeColors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: themeColors.separator }]} />
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
               <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: activeTool?.category === 'Compress' ? '#F59E0B20' : primaryColor + '20', marginRight: 10 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: activeTool?.category === 'Compress' ? '#F59E0B' : primaryColor, textTransform: 'uppercase' }}>{activeTool?.category}</Text>
               </View>
               <Text style={[styles.sheetTitle, { color: themeColors.textDark, marginBottom: 0 }]}>{activeTool?.title}</Text>
            </View>
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

                {/* 🔥 ULTRA-SMART EXACT KB TARGET COMPRESSION ENGINE */}
                {activeTool?.id === 'compress_img' && !isProcessing && !processSuccess && (
                   <View style={{ marginTop: 20 }}>
                     <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                       <Text style={{ color: themeColors.textDark, fontWeight: '700' }}>Target Size (Exact KB)</Text>
                       <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '800' }}>Min Est: ~{minPossibleKB} KB</Text>
                     </View>
                     <TextInput 
                        style={[styles.inputBox, { backgroundColor: themeColors.inputBg, color: themeColors.textDark, borderColor: themeColors.separator }]}
                        value={targetKB}
                        onChangeText={setTargetKB}
                        placeholder={`Optional (Current: ${Math.floor(pickedFile.size/1024)} KB)`}
                        keyboardType="numeric"
                     />
                     <Text style={{color: '#94A3B8', fontSize: 11, marginTop: 6, marginLeft: 2}}>Leave blank for auto balanced compression.</Text>
                   </View>
                )}
                
                {/* 📝 MINIFIER MESSAGE */}
                {activeTool?.id === 'minify_code' && !isProcessing && !processSuccess && (
                   <View style={{ marginTop: 16, backgroundColor: '#3B82F615', padding: 12, borderRadius: 12, flexDirection: 'row' }}>
                     <Feather name="info" size={16} color="#3B82F6" style={{marginTop: 2, marginRight: 8}}/>
                     <Text style={{ color: themeColors.textDark, fontSize: 12, flex: 1, lineHeight: 18 }}>
                       Code minification removes spaces and comments to make the file as small as structurally possible.
                     </Text>
                   </View>
                )}

                {(!processSuccess) && (
                  <>
                    <Text style={{ color: themeColors.textDark, fontWeight: '700', marginBottom: 8, marginTop: 20 }}>Rename Output</Text>
                    <TextInput 
                      style={[styles.inputBox, { backgroundColor: themeColors.inputBg, color: themeColors.textDark, borderColor: themeColors.separator }]}
                      value={customName}
                      onChangeText={setCustomName}
                      placeholder="Output file designation name"
                    />
                  </>
                )}

                {isProcessing && (
                  <View style={{ alignItems: 'center', marginTop: 24 }}>
                     <ActivityIndicator size="small" color={primaryColor} />
                     <Text style={{ color: themeColors.textDark, fontWeight: '800', marginTop: 8, fontSize: 16 }}>
                        {activeTool?.category === 'Compress' ? 'Optimizing size...' : 'Working...'} {progress}%
                     </Text>
                  </View>
                )}

                {/* 🔥 PREMIUM BEFORE/AFTER SUCCESS STATE */}
                {processSuccess && (
                  <View style={{ alignItems: 'center', marginTop: 20, backgroundColor: '#10B98115', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#10B98130' }}>
                    <Feather name="check-circle" size={44} color="#10B981" />
                    <Text style={{ color: '#10B981', fontWeight: '900', marginTop: 8, fontSize: 18 }}>Process Complete!</Text>
                    
                    {/* STATS */}
                    {activeTool?.category === 'Compress' && (
                        <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-around', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#10B98130' }}>
                           <View style={{ alignItems: 'center' }}>
                              <Text style={{ color: themeColors.textLight, fontSize: 12, fontWeight: '600' }}>Original</Text>
                              <Text style={{ color: themeColors.textDark, fontSize: 16, fontWeight: '800' }}>{formatBytes(pickedFile.size)}</Text>
                           </View>
                           <View style={{ justifyContent: 'center' }}><Feather name="arrow-right" size={20} color="#10B981" /></View>
                           <View style={{ alignItems: 'center' }}>
                              <Text style={{ color: themeColors.textLight, fontSize: 12, fontWeight: '600' }}>Compressed</Text>
                              <Text style={{ color: '#10B981', fontSize: 16, fontWeight: '900' }}>{formatBytes(finalCompressedSize)}</Text>
                           </View>
                        </View>
                    )}

                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10B981', marginTop: 20, width: '100%' }]} onPress={() => executeShare(outputFileUri)}>
                       <Text style={{ color: '#FFF', fontWeight: '800', textAlign: 'center', fontSize: 15 }}>Share File</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {!isProcessing && !processSuccess && (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
                    <TouchableOpacity style={[styles.alertBtn, { backgroundColor: themeColors.inputBg }]} onPress={closeProcessingFlow}>
                      <Text style={{ color: themeColors.textDark, fontWeight: '700', textAlign: 'center' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.alertBtn, { backgroundColor: primaryColor }]} onPress={triggerProcessing}>
                      <Text style={{ color: '#FFF', fontWeight: '700', textAlign: 'center' }}>
                        {activeTool?.category === 'Compress' ? 'Compress' : 'Convert'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {(processSuccess) && (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    {activeTool?.category === 'Compress' && (
                        <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: themeColors.inputBg }]} onPress={handleRecompress}>
                           <Feather name="refresh-ccw" size={16} color={themeColors.textDark} style={{ marginRight: 8 }} />
                           <Text style={{ color: themeColors.textDark, fontWeight: '700', textAlign: 'center' }}>Re-Compress</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: themeColors.inputBg }]} onPress={closeProcessingFlow}>
                       <Text style={{ color: themeColors.textDark, fontWeight: '700', textAlign: 'center' }}>Close Hub</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
          {renderPremiumToast()}
        </View>
      </Modal>

      {/* 🔥 EXTREME COMPRESSION WARNING MODAL */}
      <Modal 
        visible={extremeWarningModal} 
        transparent 
        animationType="fade"
        onRequestClose={() => setExtremeWarningModal(false)} // 👈 Back button se bhi close hoga
      >
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.alertBox, { backgroundColor: themeColors.card, width: '85%' }]}>
            <View style={{alignItems: 'center', marginBottom: 16}}>
               <View style={{width: 56, height: 56, borderRadius: 28, backgroundColor: '#EF444415', justifyContent: 'center', alignItems: 'center'}}>
                 <Feather name="alert-triangle" size={28} color="#EF4444" />
               </View>
            </View>
            <Text style={[styles.alertTitle, { color: themeColors.textDark, textAlign: 'center', marginBottom: 8 }]}>Extreme Limit Hit</Text>
            <Text style={{color: themeColors.textLight, textAlign: 'center', fontSize: 14, marginBottom: 24, paddingHorizontal: 10, lineHeight: 20}}>
               Compressing this image below <Text style={{fontWeight:'800', color: primaryColor}}>{minPossibleKB} KB</Text> will completely destroy the visual quality and readability. Please enter a higher target.
            </Text>
            
            {/* 🚀 FIXED BUTTON: Ab gayab nahi hoga aur ekdum premium dikhega */}
            <TouchableOpacity 
              style={{ backgroundColor: primaryColor, width: '100%', height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }} 
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setExtremeWarningModal(false); }}
            >
                 <Text style={{color: '#FFF', fontWeight: '800', fontSize: 16}}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 20, gap: 10 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, backgroundColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '700' },

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

  premiumToast: { 
    position: 'absolute', alignSelf: 'center', 
    backgroundColor: '#1E293B', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, borderRadius: 100, 
    shadowColor: '#000', shadowOffset: {width:0, height:10}, shadowOpacity: 0.25, shadowRadius: 16, elevation: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', zIndex: 999999
  }
});
