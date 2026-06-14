// File: src/screens/VaultScreen.js
import React, { useState, useCallback, useEffect, useRef, useMemo, useContext } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  Pressable, Animated, Easing, SectionList, 
  LayoutAnimation, UIManager, Platform, Keyboard, Modal, Share 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, Swipeable } from 'react-native-gesture-handler'; 
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication'; 
import { BlurView } from 'expo-blur'; 

import { ThemeContext } from '../ThemeContext'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getVaultData, saveVaultData, logActivity, getSessionMode } from '../utils/storage'; 

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const maskData = (text) => {
  if (!text) return '••••••••';
  if (text.includes('@')) {
    const [name, domain] = text.split('@');
    if (name.length <= 2) return `${name}***@${domain}`;
    return `${name.substring(0, 2)}••••@${domain}`;
  }
  if (text.length > 4) return `${text.substring(0, 2)}••••${text.slice(-2)}`;
  return '••••••••';
};

const VaultCard = React.memo(({ 
  item, isSelected, isSelectionMode, isDark, themeColors, primaryColor,
  onToggle, onOpen, onEdit, onCopy, onDelete, onSwipeOpen, swipeableRefs
}) => {
  
  const getCardStyle = (type) => {
    switch(type) {
      case 'Mail': return { icon: 'mail', bg: isDark ? '#31111D' : '#FDECEF', color: '#F43F5E' };
      case 'Wi-Fi': return { icon: 'wifi', bg: isDark ? '#083344' : '#E9FAFD', color: '#06B6D4' };
      case 'Notes': return { icon: 'file-text', bg: isDark ? '#2E1065' : '#F2EEFF', color: '#8B5CF6' };
      case 'Login': return { icon: 'log-in', bg: isDark ? '#1E3A8A' : '#EFF6FF', color: '#3B82F6' };
      case 'Card': return { icon: 'credit-card', bg: isDark ? '#451A03' : '#FFFBEB', color: '#F59E0B' };
      case 'Bank': return { icon: 'briefcase', bg: isDark ? '#134E4A' : '#CCFBF1', color: '#0D9488' };
      default: return { icon: 'shield', bg: isDark ? '#1E293B' : '#F1F5F9', color: '#64748B' }; 
    }
  };
  const styleData = getCardStyle(item.type);

  const renderRightActions = () => (
    <View style={styles.swipeActionsContainer}>
      <TouchableOpacity style={[styles.swipeAction, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]} onPress={onEdit}>
        <Feather name="edit-2" size={18} color={isDark ? '#D1D5DB' : '#4B5563'} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.swipeAction, { backgroundColor: isDark ? '#1E3A8A' : '#EFF6FF' }]} onPress={onCopy}>
        <Feather name="copy" size={18} color="#3B82F6" />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.swipeAction, { backgroundColor: isDark ? '#450A0A' : '#FEE2E2' }]} onPress={onDelete}>
        <Feather name="trash-2" size={18} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ marginBottom: 8 }}>
      <Swipeable 
        ref={ref => { if(swipeableRefs) swipeableRefs.current[item.id] = ref; }}
        onSwipeableWillOpen={() => onSwipeOpen(item.id)}
        renderRightActions={isSelectionMode ? undefined : renderRightActions} 
        friction={1.8} rightThreshold={45} overshootRight={false} containerStyle={{ overflow: 'visible' }} 
      >
        <Pressable 
          delayLongPress={280}
          onLongPress={() => onToggle(item.id, true)}
          onPress={() => { if (isSelectionMode) onToggle(item.id, false); else onOpen(); }}
          style={({ pressed }) => [
            styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#EDF1F5' },
            isSelected && { borderColor: primaryColor, backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}10` },
            pressed && { transform: [{ scale: 0.985 }] } 
          ]}
        >
          {isSelectionMode && (
            <View style={[styles.selectionDot, { borderColor: isDark ? '#475569' : '#CBD5E1' }, isSelected && { borderColor: primaryColor, backgroundColor: primaryColor }]}>
              {isSelected && <Feather name="check" size={12} color="#FFF" />}
            </View>
          )}
          <View style={[styles.cardIconBox, { backgroundColor: styleData.bg }]}>
            <Feather name={styleData.icon} size={20} color={styleData.color} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: isDark ? '#F8FAFC' : '#111827' }]} numberOfLines={1}>{item.title || 'Untitled'}</Text>
            <Text style={[styles.cardType, { color: isDark ? '#94A3B8' : '#94A3B8' }]}>{item.type ? item.type.toUpperCase() : 'UNKNOWN'}</Text>
            <Text style={[styles.cardPreview, { color: isDark ? '#64748B' : '#64748B' }]} numberOfLines={1}>
              {maskData(item.username || item.accNumber || item.email || item.ssid)}
            </Text>
          </View>
          {!isSelectionMode && <Feather name="chevron-right" size={16} color={isDark ? '#475569' : '#CBD5E1'} />}
        </Pressable>
      </Swipeable>
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isSelectionMode === nextProps.isSelectionMode &&
    prevProps.isDark === nextProps.isDark
  );
});

export default function VaultScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { themeColors, isDark } = useContext(ThemeContext); 
  const primaryColor = themeColors?.primary || '#12C7B2'; 

  const [entries, setEntries] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [sortType, setSortType] = useState('recent'); 
  
  const [isDecoyMode, setIsDecoyMode] = useState(false); 

  const [showSortSheet, setShowSortSheet] = useState(false);
  const [copySheetEntry, setCopySheetEntry] = useState(null); 
  const [showQuickAdd, setShowQuickAdd] = useState(false); 
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', actionText: '', actionStyle: 'primary', onConfirm: null });

  const openSwipeableId = useRef(null); 
  const swipeableRefs = useRef({});
  const dockAnim = useRef(new Animated.Value(20)).current;
  const dockOpacity = useRef(new Animated.Value(0)).current;

  const [toastData, setToastData] = useState({ visible: false, message: '', icon: 'info', color: primaryColor });
  const toastTranslateY = useRef(new Animated.Value(100)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const showToast = (message, icon = 'check-circle', color = primaryColor) => {
    setToastData({ visible: true, message, icon, color });
    Animated.parallel([
      Animated.spring(toastTranslateY, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true })
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastTranslateY, { toValue: 100, duration: 300, useNativeDriver: true }),
        Animated.timing(toastOpacity, { toValue: 0, duration: 250, useNativeDriver: true })
      ]).start(() => setToastData(prev => ({ ...prev, visible: false })));
    }, 2500);
  };

  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedSearch(searchInput); }, 250); 
    return () => clearTimeout(handler);
  }, [searchInput]);

  useFocusEffect(useCallback(() => {
    loadData(); return () => { clearSelection(); closeAllSwipes(); };
  }, []));

  const showCustomAlert = (title, message, actionText, actionStyle, onConfirm) => {
    setAlertConfig({ visible: true, title, message, actionText, actionStyle, onConfirm });
  };
  const hideCustomAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  const dynamicCategories = useMemo(() => {
    const types = entries.map(e => e.type).filter(Boolean);
    return ["All", ...Array.from(new Set(types))];
  }, [entries]);

  // 🚀 ULTRA SMART TIME EXTRACTOR
  const getSmartTime = (obj) => {
    const t = obj.updatedAt || obj.createdAt || obj.date || obj.timestamp;
    if (!t) return 0;
    const time = new Date(t).getTime();
    return isNaN(time) ? 0 : time;
  };

  const filteredSections = useMemo(() => {
    let result = [...entries];
    if (activeCategory !== 'All') result = result.filter(item => item.type === activeCategory);
    if (debouncedSearch.trim() !== '') {
      const lowerQuery = debouncedSearch.toLowerCase();
      result = result.filter(item => ((item.title || '').toLowerCase().includes(lowerQuery)));
    }
    const grouped = {};
    result.forEach(entry => {
      let sectionName = entry.type ? entry.type.toUpperCase() : 'CUSTOM ENTRIES';
      if (!grouped[sectionName]) grouped[sectionName] = [];
      grouped[sectionName].push(entry);
    });
    
    const sectionArray = Object.keys(grouped).map(key => {
      let sectionData = grouped[key];
      sectionData.sort((a, b) => {
        const titleA = (a.title || 'Untitled').trim().toLowerCase();
        const titleB = (b.title || 'Untitled').trim().toLowerCase();
        
        const timeA = getSmartTime(a);
        const timeB = getSmartTime(b);
        
        if (sortType === 'az') return titleA.localeCompare(titleB);
        if (sortType === 'za') return titleB.localeCompare(titleA);
        
        if (sortType === 'oldest') {
          // Time same ho toh alphabetically sort kardo
          if (timeA === timeB) return titleA.localeCompare(titleB);
          return timeA - timeB; 
        }
        
        // Default: Recent (Newest first)
        if (timeA === timeB) return titleA.localeCompare(titleB);
        return timeB - timeA; 
      });
      return { title: key, data: sectionData };
    });
    sectionArray.sort((a, b) => a.title.localeCompare(b.title)); 
    return sectionArray;
  }, [entries, activeCategory, debouncedSearch, sortType]);

  const handleSortChange = (newSort) => {
    Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSortType(newSort);
    setShowSortSheet(false);
  };

  useEffect(() => {
    if (selectedIds.length > 0) {
      Animated.parallel([
        Animated.spring(dockAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
        Animated.timing(dockOpacity, { toValue: 1, duration: 180, useNativeDriver: true })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(dockAnim, { toValue: 20, duration: 140, useNativeDriver: true }),
        Animated.timing(dockOpacity, { toValue: 0, duration: 140, useNativeDriver: true })
      ]).start();
    }
  }, [selectedIds.length]);

  const loadData = async () => { 
     const mode = await getSessionMode();
     const decoyStatus = mode === 'LIMITED' || global.isDecoyMode;
     setIsDecoyMode(decoyStatus);
     
     if (decoyStatus) {
       setEntries([
         { id: 'demo1', type: 'Login', title: 'Facebook (Demo)', username: 'demo_user_123', password: 'password123', createdAt: new Date().toISOString() },
         { id: 'demo2', type: 'Card', title: 'Visa Credit (Demo)', accNumber: '4111 2222 3333 4444', pin: '1234', createdAt: new Date().toISOString() },
         { id: 'demo3', type: 'Notes', title: 'Secret Recipe (Demo)', notes: 'This is a demo note for decoy mode.', createdAt: new Date().toISOString() }
       ]);
       return;
     }

     const data = await getVaultData() || []; 
     const validData = data.filter(e => e && e.id);
     setEntries(validData); 
  };

  const handleSearchChange = (text) => { setSearchInput(text); closeAllSwipes(); };
  
  const handleCategorySelect = (category) => {
    Haptics.selectionAsync(); setActiveCategory(category); closeAllSwipes(); clearSelection();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };
  
  const toggleSelection = useCallback((id, isLongPress) => {
    if (isLongPress) closeAllSwipes();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }, []);
  
  const clearSelection = () => setSelectedIds([]);
  
  const handleSelectAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const visibleIds = filteredSections.flatMap(section => section.data.map(item => item.id));
    if (selectedIds.length === visibleIds.length) setSelectedIds([]); 
    else setSelectedIds(visibleIds); 
  };

  const handleBulkClone = async () => {
    if (isDecoyMode) return showToast("Disabled in Decoy Mode", "shield-off", '#EF4444');
    
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const itemsToClone = entries.filter(e => selectedIds.includes(e.id));
    const clonedItems = itemsToClone.map(e => ({
      ...e, id: Math.random().toString(36).substr(2, 9), title: `${e.title || 'Untitled'} (Copy)`, createdAt: new Date().toISOString()
    }));
    const newVaultData = [...clonedItems, ...entries];
    setEntries(newVaultData); await saveVaultData(newVaultData);
    
    showToast(`${clonedItems.length} entries duplicated`, 'copy', primaryColor);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await logActivity('Vault', 'Items Duplicated', `${clonedItems.length} vault entries were cloned/copied.`, 'WORKFLOW');
    clearSelection();
  };

  const promptShare = (idsToShare) => {
    if (isDecoyMode) return showToast("Disabled in Decoy Mode", "shield-off", '#EF4444');
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    showCustomAlert(
      "Share Sensitive Data",
      `You are about to export full details for ${idsToShare.length} entry(s). Please confirm.`,
      "Proceed", "primary",
      () => { hideCustomAlert(); executePremiumShare(idsToShare); }
    );
  };

  const executePremiumShare = async (idsToShare) => {
    const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Authenticate to share sensitive vault data', fallbackLabel: 'Use PIN' });
    if (!auth.success) { 
      showToast('Authentication failed', 'alert-circle', '#EF4444'); 
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); 
      return; 
    }

    const itemsToShare = entries.filter(e => idsToShare.includes(e.id));
    let shareText = "🛡️ SAFELOCKER SECURE EXPORT\n=========================\n\n";
    itemsToShare.forEach(e => {
      shareText += `📌 ${(e.title || 'Untitled').toUpperCase()} (${e.type || 'Custom'})\n`;
      if (e.username || e.email) shareText += `👤 ID/Email: ${e.username || e.email}\n`;
      if (e.password) shareText += `🔑 Password: ${e.password}\n`;
      if (e.pin) shareText += `🔢 PIN: ${e.pin}\n`;
      if (e.accNumber) shareText += `🏦 Account: ${e.accNumber}\n`;
      if (e.cardNumber) shareText += `💳 Card: ${e.cardNumber}\n`;
      if (e.notes) shareText += `📝 Notes: ${e.notes}\n`;
      shareText += `-------------------------\n`;
    });
    shareText += `\nShared securely via SafeLocker 🔒`;

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Share.share({ message: shareText, title: "SafeLocker Export" });
      await logActivity('Vault', 'Secure Export', `Shared/Exported details of ${idsToShare.length} entries externally.`, 'IMPORTANT');
      clearSelection(); closeAllSwipes();
    } catch (error) { console.log("Share failed:", error); }
  };

  const promptDelete = (idsToDelete) => {
    if (isDecoyMode) return showToast("Disabled in Decoy Mode", "shield-off", '#EF4444');
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    showCustomAlert(
      "Permanently Delete?",
      `Are you sure you want to delete ${idsToDelete.length} selected entry(s)? This action cannot be undone.`,
      "Delete", "destructive",
      () => { hideCustomAlert(); executeDelete(idsToDelete); }
    );
  };

  const executeDelete = async (idsToDelete) => {
    const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Authenticate to delete vault data', fallbackLabel: 'Use PIN' });
    if (!auth.success) { 
      showToast('Authentication failed', 'alert-circle', '#EF4444'); 
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); 
      return; 
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Heavy);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); 
    const newEntries = entries.filter(e => !idsToDelete.includes(e.id));
    setEntries(newEntries); await saveVaultData(newEntries);
    
    showToast(`${idsToDelete.length} entries deleted`, 'trash-2', '#EF4444');
    await logActivity('Vault', 'Entries Deleted', `${idsToDelete.length} vault entries were permanently deleted.`, 'CRITICAL');
    
    clearSelection(); closeAllSwipes();
  };

  const closeAllSwipes = useCallback(() => {
    if (openSwipeableId.current && swipeableRefs.current[openSwipeableId.current]) { swipeableRefs.current[openSwipeableId.current].close(); }
    openSwipeableId.current = null;
  }, []);

  const handleSwipeOpen = useCallback((id) => {
    if (openSwipeableId.current && openSwipeableId.current !== id) {
      if (swipeableRefs.current[openSwipeableId.current]) swipeableRefs.current[openSwipeableId.current].close();
    }
    openSwipeableId.current = id; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const executeSecureCopy = async (text, isSensitive, label) => {
    if (isDecoyMode) return showToast("Disabled in Decoy Mode", "shield-off", '#EF4444');
    
    if (!text) return;
    if (isSensitive) {
      const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Authenticate to copy sensitive data', fallbackLabel: 'Use PIN' });
      if (!auth.success) { 
        showToast('Authentication failed', 'alert-circle', '#EF4444'); 
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); 
        await logActivity('Security', 'Copy Failed', `Failed biometric auth while trying to copy ${label}.`, 'CRITICAL');
        return; 
      }
    }
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopySheetEntry(null); 
    showToast(`${label} copied to clipboard`, 'check-circle', primaryColor);
    await logActivity('Security', 'Secure Copy', `User copied ${label} to clipboard.`, 'WORKFLOW');
  };

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#0F172A' : '#F8F9FB' }]}>
      
      {toastData.visible && (
        <Animated.View style={[styles.premiumToast, { transform: [{ translateY: toastTranslateY }], opacity: toastOpacity }]} pointerEvents="none">
           <Feather name={toastData.icon} size={18} color={toastData.color} style={{marginRight: 8}} />
           <Text style={styles.smartToastText}>{toastData.message}</Text>
        </Animated.View>
      )}

      <View style={{ paddingTop: insets.top }}>
        <View style={styles.headerShell}>
          {selectedIds.length > 0 ? (
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
              <TouchableOpacity onPress={clearSelection}><Feather name="x" size={24} color={isDark ? '#F8FAFC' : '#0F172A'} /></TouchableOpacity>
              <Text style={[styles.selectionTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{selectedIds.length} selected</Text>
            </View>
          ) : (
            <>
              <Text style={[styles.headerTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{isDecoyMode ? 'Demo Vault' : 'My Vault'}</Text>
              <View style={styles.headerActions}>
                <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowSortSheet(true); }} style={({ pressed }) => [styles.iconBtn, { backgroundColor: isDark ? '#1E293B' : 'rgba(15,23,42,0.04)' }, pressed && { transform: [{ scale: 0.96 }] }, sortType !== 'recent' && { backgroundColor: `${primaryColor}20` }]}>
                  <Feather name="sliders" size={18} color={sortType !== 'recent' ? primaryColor : (isDark ? '#F8FAFC' : '#0F172A')} />
                </Pressable>
                <Pressable onPress={async () => { await logActivity('Security', 'Manual Lock', 'User manually locked the app from Vault', 'INFO'); navigation.replace('Lock'); }} style={({ pressed }) => [styles.iconBtn, { backgroundColor: isDark ? '#1E293B' : 'rgba(15,23,42,0.04)' }, pressed && { transform: [{ scale: 0.96 }] }]}>
                  <Feather name="lock" size={18} color={isDark ? '#F8FAFC' : '#0F172A'} />
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={styles.searchContainer}>
          <View style={[styles.searchBox, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#EEF1F5' }, isSearchFocused && { borderColor: primaryColor, shadowColor: primaryColor }]}>
            <Feather name="search" size={18} color={isSearchFocused ? primaryColor : '#94A3B8'} style={{ marginRight: 8 }} />
            <TextInput style={[styles.searchInput, { color: isDark ? '#F8FAFC' : '#0F172A' }]} placeholder="Search entries...." placeholderTextColor="#94A3B8" value={searchInput} onChangeText={handleSearchChange} onFocus={() => { setIsSearchFocused(true); closeAllSwipes(); }} onBlur={() => setIsSearchFocused(false)} autoCorrect={false} />
          </View>
        </View>

        <View style={styles.chipScrollContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContent}>
            {dynamicCategories.map((item) => {
              const isActive = activeCategory === item;
              const count = item === 'All' ? entries.length : entries.filter(e => e.type === item).length;
              return (
                <Pressable key={item} onPress={() => handleCategorySelect(item)} style={[styles.chip, { borderColor: isDark ? '#334155' : '#E9EDF3', backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }, isActive && { backgroundColor: primaryColor, borderColor: primaryColor }]}>
                  <Text style={[styles.chipText, { color: isDark ? '#94A3B8' : '#64748B' }, isActive && { color: '#FFFFFF' }]}>{item}</Text>
                  {isActive && count > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{count}</Text></View>}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      <SectionList 
        sections={filteredSections} 
        keyExtractor={(item) => item.id} 
        contentContainerStyle={styles.listContainer} 
        showsVerticalScrollIndicator={false} 
        stickySectionHeadersEnabled={false}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        updateCellsBatchingPeriod={50}
        onScrollBeginDrag={() => { closeAllSwipes(); Keyboard.dismiss(); }} 
        renderSectionHeader={({ section: { title } }) => <Text style={styles.sectionLabel}>{title}</Text>}
        renderItem={({ item }) => (
          <VaultCard 
            item={item} 
            isSelected={selectedIds.includes(item.id)}
            isSelectionMode={selectedIds.length > 0}
            isDark={isDark}
            themeColors={themeColors}
            primaryColor={primaryColor}
            onToggle={toggleSelection}
            onOpen={() => {
              if (isDecoyMode) return showToast("Disabled in Decoy Mode", "shield-off", '#EF4444');
              navigation.navigate('EntryDetail', { entry: item });
            }}
            onEdit={() => { 
              if (isDecoyMode) return showToast("Disabled in Decoy Mode", "shield-off", '#EF4444');
              closeAllSwipes(); navigation.navigate('Form', { type: item.type, editEntry: item }); 
            }}
            onCopy={() => { 
              if (isDecoyMode) return showToast("Disabled in Decoy Mode", "shield-off", '#EF4444');
              closeAllSwipes(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setCopySheetEntry(item); 
            }}
            onDelete={() => promptDelete([item.id])}
            onSwipeOpen={handleSwipeOpen}
            swipeableRefs={swipeableRefs}
          />
        )} 
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <View style={{width: 80, height: 80, borderRadius: 40, backgroundColor: isDark ? '#1E293B' : '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 16}}>
              <Feather name="shield" size={36} color={primaryColor} />
            </View>
            <Text style={{ color: isDark ? '#F8FAFC' : '#0F172A', fontSize: 18, fontWeight: '800', marginBottom: 6 }}>
              {activeCategory !== 'All' ? `No ${activeCategory} entries` : 'Vault is clean'}
            </Text>
            <Text style={{ color: '#94A3B8', fontSize: 14, fontWeight: '500', textAlign: 'center', paddingHorizontal: 40 }}>
              Tap the + button below to add new secure entries to your vault.
            </Text>
          </View>
        )}
      />

      <Animated.View style={[styles.contextDock, { backgroundColor: isDark ? 'rgba(30,41,59,0.96)' : 'rgba(255,255,255,0.96)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.7)' , opacity: dockOpacity, transform: [{ translateY: dockAnim }] }]} pointerEvents={selectedIds.length > 0 ? 'auto' : 'none'}>
        <TouchableOpacity style={styles.dockAction} onPress={handleSelectAll}><Feather name="check-square" size={20} color={isDark ? '#F8FAFC' : '#0F172A'} /></TouchableOpacity>
        <TouchableOpacity style={styles.dockAction} onPress={handleBulkClone}><Feather name="copy" size={20} color={isDark ? '#F8FAFC' : '#0F172A'} /></TouchableOpacity>
        <TouchableOpacity style={styles.dockAction} onPress={() => promptShare(selectedIds)}><Feather name="share-2" size={20} color={isDark ? '#F8FAFC' : '#0F172A'} /></TouchableOpacity>
        <TouchableOpacity style={styles.dockAction} onPress={() => promptDelete(selectedIds)}><Feather name="trash-2" size={20} color="#EF4444" /></TouchableOpacity>
      </Animated.View>

      {selectedIds.length === 0 && !isDecoyMode && (
        <Pressable 
          onPress={() => { closeAllSwipes(); navigation.navigate('SelectType'); }} 
          onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setShowQuickAdd(true); }}
          style={styles.fabContainer}
        >
          <View style={[styles.fab, { backgroundColor: primaryColor, shadowColor: primaryColor }]}><Feather name="plus" size={26} color="#FFFFFF" /></View>
        </Pressable>
      )}

      {/* QUICK ADD MODAL */}
      <Modal visible={showQuickAdd} transparent animationType="fade" onRequestClose={() => setShowQuickAdd(false)}>
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowQuickAdd(false)}>
            <TouchableOpacity activeOpacity={1} style={[styles.bottomSheet, { paddingBottom: insets.bottom + 20, backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0', borderWidth: 1 }]}>
              <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]} />
              <Text style={[styles.sheetTitle, { color: isDark ? '#F8FAFC' : '#0F172A', marginBottom: 24 }]}>Quick Add</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                {[
                  { type: 'Login', icon: 'log-in', color: '#3B82F6', bg: isDark ? '#1E3A8A' : '#EFF6FF' },
                  { type: 'Card', icon: 'credit-card', color: '#F59E0B', bg: isDark ? '#451A03' : '#FFFBEB' },
                  { type: 'Bank', icon: 'briefcase', color: '#0D9488', bg: isDark ? '#134E4A' : '#CCFBF1' },
                  { type: 'Notes', icon: 'file-text', color: '#8B5CF6', bg: isDark ? '#2E1065' : '#F2EEFF' },
                ].map(item => (
                  <TouchableOpacity 
                    key={item.type} 
                    style={{ alignItems: 'center', width: '22%' }}
                    onPress={() => { setShowQuickAdd(false); navigation.navigate('Form', { type: item.type }); }}
                  >
                    <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: item.bg, justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                      <Feather name={item.icon} size={24} color={item.color} />
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#F8FAFC' : '#0F172A' }}>{item.type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* SMART COPY MODAL */}
      <Modal visible={!!copySheetEntry} transparent animationType="fade" onRequestClose={() => setCopySheetEntry(null)}>
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCopySheetEntry(null)}>
            <TouchableOpacity activeOpacity={1} style={[styles.bottomSheet, { paddingBottom: insets.bottom + 20, backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0', borderWidth: 1 }]}>
              <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]} />
              <Text style={[styles.sheetTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Smart Copy</Text>
              <Text style={[styles.sheetSubTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>{copySheetEntry?.title}</Text>
              
              <View style={styles.copyList}>
                {(copySheetEntry?.username || copySheetEntry?.email) && (
                  <TouchableOpacity style={[styles.copyRow, { backgroundColor: isDark ? '#0F172A' : '#F8F9FB', borderColor: isDark ? '#334155' : '#EEF1F5' }]} onPress={() => executeSecureCopy(copySheetEntry.username || copySheetEntry.email, false, 'ID/Username')}>
                    <View><Text style={styles.copyLabel}>ID / Username</Text><Text style={[styles.copyValue, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{copySheetEntry.username || copySheetEntry.email}</Text></View>
                    <Feather name="copy" size={20} color={primaryColor} />
                  </TouchableOpacity>
                )}
                {copySheetEntry?.password && (
                  <TouchableOpacity style={[styles.copyRow, { backgroundColor: isDark ? '#0F172A' : '#F8F9FB', borderColor: isDark ? '#334155' : '#EEF1F5' }]} onPress={() => executeSecureCopy(copySheetEntry.password, true, 'Password')}>
                    <View><Text style={styles.copyLabel}>Password</Text><Text style={[styles.copyValue, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>••••••••</Text></View>
                    <Feather name="lock" size={20} color="#F59E0B" />
                  </TouchableOpacity>
                )}
                {copySheetEntry?.pin && (
                  <TouchableOpacity style={[styles.copyRow, { backgroundColor: isDark ? '#0F172A' : '#F8F9FB', borderColor: isDark ? '#334155' : '#EEF1F5' }]} onPress={() => executeSecureCopy(copySheetEntry.pin, true, 'PIN')}>
                    <View><Text style={styles.copyLabel}>PIN</Text><Text style={[styles.copyValue, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>••••</Text></View>
                    <Feather name="lock" size={20} color="#F59E0B" />
                  </TouchableOpacity>
                )}
                {copySheetEntry?.notes && (
                  <TouchableOpacity style={[styles.copyRow, { backgroundColor: isDark ? '#0F172A' : '#F8F9FB', borderColor: isDark ? '#334155' : '#EEF1F5' }]} onPress={() => executeSecureCopy(copySheetEntry.notes, false, 'Notes')}>
                    <View><Text style={styles.copyLabel}>Notes</Text><Text style={[styles.copyValue, { color: isDark ? '#F8FAFC' : '#0F172A' }]} numberOfLines={1}>{copySheetEntry.notes}</Text></View>
                    <Feather name="copy" size={20} color={primaryColor} />
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* 🚀 PREMIUM SORT OPTIONS MODAL */}
      <Modal visible={showSortSheet} transparent animationType="fade" onRequestClose={() => setShowSortSheet(false)}>
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSortSheet(false)}>
            <TouchableOpacity activeOpacity={1} style={[styles.bottomSheet, { paddingBottom: insets.bottom + 20, backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0', borderWidth: 1 }]}>
              <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]} />
              <Text style={[styles.sheetTitle, { color: isDark ? '#F8FAFC' : '#0F172A', marginBottom: 20 }]}>Sort Vault Entries</Text>
              
              {[
                { id: 'recent', label: 'Recently Added', icon: 'clock', sub: 'Newest entries first' }, 
                { id: 'oldest', label: 'Oldest First', icon: 'calendar', sub: 'Earliest entries first' },
                { id: 'az', label: 'Name (A → Z)', icon: 'arrow-down', sub: 'Alphabetical order' }, 
                { id: 'za', label: 'Name (Z → A)', icon: 'arrow-up', sub: 'Reverse alphabetical' }
              ].map(option => {
                const isActive = sortType === option.id;
                return (
                  <TouchableOpacity key={option.id} style={[styles.sortOptionRow, { borderBottomColor: isDark ? '#334155' : '#EEF1F5', paddingVertical: 14 }]} onPress={() => handleSortChange(option.id)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                       <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: isActive ? primaryColor + '20' : (isDark ? '#0F172A' : '#F1F5F9'), justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                         <Feather name={option.icon} size={18} color={isActive ? primaryColor : (isDark ? '#94A3B8' : '#64748B')} />
                       </View>
                       <View>
                         <Text style={[styles.sortOptionText, { color: isDark ? '#F8FAFC' : '#1E293B', fontSize: 16 }, isActive && { color: primaryColor, fontWeight: '800' }]}>{option.label}</Text>
                         <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 4, fontWeight: '500' }}>{option.sub}</Text>
                       </View>
                    </View>
                    {isActive && <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: primaryColor, justifyContent: 'center', alignItems: 'center' }}><Feather name="check" size={14} color="#FFF" /></View>}
                  </TouchableOpacity>
                );
              })}
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* CUSTOM ALERT BOX */}
      <Modal visible={alertConfig.visible} transparent animationType="fade" onRequestClose={hideCustomAlert}>
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={25} tint={isDark ? "dark" : "light"} style={styles.alertOverlayBg}>
            <View style={[styles.customAlertBox, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
              <View style={[styles.alertIconBox, { backgroundColor: alertConfig.actionStyle === 'destructive' ? '#FEE2E2' : `${primaryColor}20` }]}>
                <Feather name={alertConfig.actionStyle === 'destructive' ? "alert-triangle" : "share"} size={28} color={alertConfig.actionStyle === 'destructive' ? "#EF4444" : primaryColor} />
              </View>
              <Text style={[styles.alertTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{alertConfig.title}</Text>
              <Text style={[styles.alertMessage, { color: isDark ? '#94A3B8' : '#64748B' }]}>{alertConfig.message}</Text>
              <View style={styles.alertBtnRow}>
                <TouchableOpacity style={[styles.alertBtn, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]} onPress={hideCustomAlert}>
                  <Text style={[styles.alertBtnText, { color: isDark ? '#F8FAFC' : '#475569' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.alertBtn, { backgroundColor: alertConfig.actionStyle === 'destructive' ? '#EF4444' : primaryColor }]} onPress={alertConfig.onConfirm}>
                  <Text style={[styles.alertBtnText, { color: '#FFFFFF' }]}>{alertConfig.actionText}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerShell: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 48, marginTop: 6, marginBottom: 10, paddingHorizontal: 16 },
  headerTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  selectionTitle: { fontSize: 16, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  searchContainer: { paddingHorizontal: 16, marginBottom: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 100, borderWidth: 1, paddingHorizontal: 14, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 14, elevation: 2 }, 
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500', height: '100%' },
  chipScrollContainer: { height: 36, marginBottom: 4 },
  chipContent: { paddingHorizontal: 16, gap: 8, paddingRight: 24, flexGrow: 1 },
  chip: { height: 36, minWidth: 72, maxWidth: 132, borderRadius: 100, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6, borderWidth: 1 }, 
  chipText: { fontSize: 13, fontWeight: '700' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  listContainer: { paddingHorizontal: 16, paddingBottom: 100 },
  sectionLabel: { marginTop: 14, marginBottom: 8, paddingLeft: 4, fontSize: 11, fontWeight: '800', letterSpacing: 3, color: '#94A3B8' },
  card: { flexDirection: 'row', alignItems: 'center', height: 84, borderRadius: 36, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, shadowColor: 'rgba(15,23,42,0.04)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 14, elevation: 2 }, 
  selectionDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  cardIconBox: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 }, 
  cardContent: { flex: 1, justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 1 },
  cardType: { fontSize: 11.5, fontWeight: '700', marginBottom: 1 },
  cardPreview: { fontSize: 12, marginTop: 1 },
  swipeActionsContainer: { flexDirection: 'row', width: 156, height: 84, alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4, gap: 4 },
  swipeAction: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  contextDock: { position: 'absolute', bottom: 86, left: 16, right: 16, height: 64, borderRadius: 100, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 28, elevation: 10 }, 
  dockAction: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  fabContainer: { position: 'absolute', bottom: 86, right: 18, zIndex: 100 },
  fab: { width: 62, height: 62, borderRadius: 31, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 8 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  
  modalOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  bottomSheet: { borderTopLeftRadius: 36, borderTopRightRadius: 36, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 40 }, 
  sheetHandle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  sheetSubTitle: { fontSize: 14, fontWeight: '600', marginBottom: 24 },
  copyList: { gap: 12 },
  copyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1 },
  copyLabel: { fontSize: 12, fontWeight: '700', color: '#94A3B8', marginBottom: 4 },
  copyValue: { fontSize: 15, fontWeight: '600' },
  sortOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1 },
  sortOptionText: { fontSize: 16, fontWeight: '600' },

  premiumToast: { 
    position: 'absolute', bottom: 120, alignSelf: 'center', zIndex: 9999999,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 14, 
    borderRadius: 999, backgroundColor: '#0F172A', 
    shadowColor: '#000', shadowOffset: {width:0,height:8}, shadowOpacity: 0.35, shadowRadius: 16, elevation: 12, 
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' 
  },
  smartToastText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginLeft: 8 },

  alertOverlayBg: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  customAlertBox: { width: '100%', borderRadius: 36, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 15 }, 
  alertIconBox: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  alertTitle: { fontSize: 22, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  alertMessage: { fontSize: 15, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  alertBtnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  alertBtn: { flex: 1, height: 54, borderRadius: 100, justifyContent: 'center', alignItems: 'center' }, 
  alertBtnText: { fontSize: 16, fontWeight: '700' }
});
