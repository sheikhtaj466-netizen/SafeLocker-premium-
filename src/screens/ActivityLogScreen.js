// File: src/screens/ActivityLogScreen.js
import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { 
  View, Text, StyleSheet, SectionList, TouchableOpacity, ScrollView,
  Animated, TextInput, Modal, Pressable, Platform, ActivityIndicator 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native'; 
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext } from '../ThemeContext';
import { getMasterPin, getRecoveryEmail } from '../utils/storage';

const API_BASE_URL = 'http://127.0.0.1:3000';

export default function ActivityLogScreen({ navigation }) {
  const { isDark, themeColors } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  
  const [rawLogs, setRawLogs] = useState([]);
  const [groupedLogs, setGroupedLogs] = useState([]);
  const [pinnedLogs, setPinnedLogs] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('Main Logs'); 
  const [activeModule, setActiveModule] = useState('All'); 
  const [searchQuery, setSearchQuery] = useState('');
  
  // Clear Logs Auth States
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearAuthMode, setClearAuthMode] = useState('BIO'); 
  const [pinInput, setPinInput] = useState('');
  const [isPinError, setIsPinError] = useState(false); 
  const [pinAttempts, setPinAttempts] = useState(0);
  const [pinLockout, setPinLockout] = useState(0);
  const [isWiping, setIsWiping] = useState(false);
  const [wipeProgress, setWipeProgress] = useState(0);

  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const listAnim = useRef(new Animated.Value(0)).current; 
  const toastAnim = useRef(new Animated.Value(-100)).current;
  const wipeAnim = useRef(new Animated.Value(1)).current;
  const pinShakeAnim = useRef(new Animated.Value(0)).current; 

  useFocusEffect(useCallback(() => { fetchLogs(); }, []));

  useEffect(() => {
    let interval;
    if (pinLockout > 0) { interval = setInterval(() => setPinLockout(prev => prev - 1), 1000); }
    return () => clearInterval(interval);
  }, [pinLockout]);

  useEffect(() => {
    processAndGroupLogs();
  }, [searchQuery, activeTab, activeModule, rawLogs]);

  // 🧠 SMART PRIORITY ENGINE (Now fully supports Files & Tools)
  const sanitizeLog = (rawLog) => {
    const act = String(rawLog.action || '').toUpperCase();
    const rawMod = String(rawLog.module || 'System').trim().toUpperCase();
    let mod = String(rawLog.module || 'System').trim();

    // 🚀 NEW: Intelligent Module Routing for Files, Tools & Security
    if (rawMod.includes('PASSKEY') || act.includes('PASSKEY') || act.includes('BIOMETRIC') || act.includes('FINGERPRINT')) {
      mod = 'Security'; 
    } else if (rawMod.includes('COPY') || act.includes('COPY') || act.includes('COPIED')) {
      mod = 'Security';
    } else if (rawMod.includes('LOGIN') || rawMod.includes('AUTH') || act.includes('PIN') || act.includes('UNLOCK')) {
      mod = 'Security'; 
    } else if (rawMod.includes('FILE') || rawMod.includes('DOCUMENT') || rawMod.includes('STORAGE')) {
      mod = 'Files'; // 🚀 FILES MODULE ADDED
    } else if (rawMod.includes('TOOL') || rawMod.includes('GENERATOR') || act.includes('GENERATED')) {
      mod = 'Tools'; // 🚀 TOOLS MODULE ADDED
    } else if (rawMod.includes('GALLERY') || rawMod.includes('SCAN') || act.includes('IMAGE')) {
      mod = 'Gallery';
    } else if (rawMod.includes('VAULT') || act.includes('ENTRY')) {
      mod = 'Vault';
    } else if (rawMod.includes('SETTING') || act.includes('STEALTH') || act.includes('DECOY')) {
      mod = 'Settings';
    } else {
      mod = mod.replace(/_/g, ' ');
      mod = mod.replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())));
    }

    if (mod.length > 12) mod = mod.substring(0, 10) + '..';

    let label = rawLog.action ? rawLog.action.replace(/_/g, ' ') : 'System Event';
    let details = rawLog.details || 'System generated background event.';
    let bg = '#F3F4F6', text = '#6B7280', icon = 'activity'; 
    let priority = rawLog.priority || 'INFO'; 

    // 🔥 FORCE EXCLUDE MINOR SETTINGS FROM CRITICAL/IMPORTANT
    if (act === 'THEME_CHANGED' || act === 'AUTO_LOCK_UPDATED' || act.includes('PRIVACY_TOGGLED') || act.includes('LOCK_ON_EXIT')) {
      priority = 'INFO'; bg = '#EEF2FF'; text = '#6366F1'; icon = 'settings';
    }
    // 🟥 CRITICAL THREATS & HIGH SECURITY
    else if (act.includes('PANIC') || act.includes('FAILED') || act.includes('TAMPER') || act.includes('DECOY') || act.includes('MAX_PIN') || act.includes('PIN_CHANGED') || act.includes('RECOVERY_CODE') || act.includes('RESET')) {
      priority = 'CRITICAL'; bg = '#FFF1F2'; text = '#9F1239'; icon = 'alert-octagon';
      if(act.includes('PANIC')) label = 'Panic Lock Triggered';
      if(act.includes('FAILED')) label = 'Failed Access Attempt';
      if(act.includes('PIN_CHANGED') || act.includes('RESET')) { icon = 'key'; bg = '#DBEAFE'; text = '#3B82F6'; }
      if(act.includes('RECOVERY_CODE')) { icon = 'shield'; bg = '#DBEAFE'; text = '#3B82F6'; }
    }
    // 🟪 PASSKEY & BIOMETRIC ACTIONS
    else if (act.includes('PASSKEY') || act.includes('BIOMETRIC') || act.includes('AUTH') || rawMod.includes('PASSKEY')) {
      if (act.includes('FAILED') || act.includes('ERROR') || act.includes('REJECT')) {
        priority = 'CRITICAL'; bg = '#FFF1F2'; text = '#EF4444'; icon = 'alert-circle'; label = 'Auth Failed';
      } else if (act.includes('DISABLE') || act.includes('REMOVE')) {
        priority = 'IMPORTANT'; bg = '#FEF2F2'; text = '#F97316'; icon = 'shield-off';
      } else {
        priority = 'IMPORTANT'; bg = '#F3E8FF'; text = '#8B5CF6'; icon = 'fingerprint';
      }
    }
    // 🟨 IMPORTANT ACTIONS
    else if (act.includes('WIPE') || act.includes('DELETE') || act.includes('REMOVED') || act.includes('EXPORT') || act.includes('EMAIL_RECOVERY')) {
      priority = 'IMPORTANT'; bg = '#FEF2F2'; text = '#EF4444'; icon = 'trash-2';
      if (act.includes('EXPORT')) { bg = '#FEF3C7'; text = '#F59E0B'; icon = 'upload-cloud'; label = 'Secure Export'; }
      if (act.includes('EMAIL')) { bg = '#D1FAE5'; text = '#10B981'; icon = 'shield'; }
    }
    // 🟦 WORKFLOW / CORE APP ACTIONS
    else if (act.includes('COPY') || act.includes('COPIED')) {
      priority = 'WORKFLOW'; label = 'Secure Copy'; details = 'Sensitive field copied securely.'; bg = '#F4EEFF'; text = '#8B5CF6'; icon = 'copy';
    } 
    else if (act.includes('IMPORT') || act.includes('MOVED') || act.includes('CREATED') || act.includes('SETUP') || act.includes('ENABLED') || act.includes('ADDED')) {
      priority = 'WORKFLOW'; bg = '#D1FAE5'; text = '#10B981'; icon = act.includes('IMPORT') ? 'download-cloud' : (act.includes('CREATED') ? 'plus-circle' : 'check-circle');
    }
    else if (act.includes('FAVORITE')) {
      priority = 'WORKFLOW'; label = 'Favorite Updated'; bg = '#FEF9C3'; text = '#D97706'; icon = 'star'; 
    }
    else if (act.includes('LOGIN') || act.includes('UNLOCK')) {
      priority = 'WORKFLOW'; label = 'Vault Unlocked'; bg = '#F3F4F6'; text = '#4B5563'; icon = 'unlock'; 
    }
    else {
      priority = 'INFO'; 
      bg = isDark ? '#1F2937' : '#F9FAFB'; 
      text = isDark ? '#9CA3AF' : '#4B5563'; 
      icon = 'radio';
      
      // 🚀 NEW: Smart Premium Fallback Icons for Files & Tools
      if (mod === 'Files') { icon = 'file'; bg = isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF'; text = isDark ? '#93C5FD' : '#2563EB'; }
      if (mod === 'Tools') { icon = 'tool'; bg = isDark ? 'rgba(13, 148, 136, 0.15)' : '#CCFBF1'; text = isDark ? '#5EEAD4' : '#0D9488'; }
      if (mod === 'Vault') { icon = 'shield'; bg = isDark ? 'rgba(79, 70, 229, 0.15)' : '#EEF2FF'; text = isDark ? '#A5B4FC' : '#4F46E5'; }
      if (mod === 'Gallery') { icon = 'image'; bg = isDark ? 'rgba(124, 58, 237, 0.15)' : '#F3E8FF'; text = isDark ? '#C4B5FD' : '#7C3AED'; }
    }

    label = label.replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())));
    return { ...rawLog, displayTitle: label, displayDetails: details, moduleDisplay: mod, theme: { bg, text, icon }, priority };
  };

  const fetchLogs = async () => {
    setIsLoading(true); listAnim.setValue(0); wipeAnim.setValue(1);
    try {
      const data = await AsyncStorage.getItem('ACTIVITY_LOGS');
      if (data) {
        const parsed = JSON.parse(data);
        const sorted = parsed.sort((a, b) => new Date(b.timestamp || Date.now()) - new Date(a.timestamp || Date.now()));
        const sanitizedData = sorted.map(log => sanitizeLog(log));
        setRawLogs(sanitizedData);
        
        const criticals = sanitizedData.filter(l => l.priority === 'CRITICAL').slice(0, 6);
        setPinnedLogs(criticals);
      } else { setRawLogs([]); setPinnedLogs([]); }
    } catch (error) { setRawLogs([]); } 
    finally {
      setIsLoading(false);
      Animated.spring(listAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }).start();
    }
  };

  const formatTimePremium = (ts) => {
    if (!ts) return 'Just now';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return 'Just now';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()} • ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  };

  const processAndGroupLogs = () => {
    let filtered = [...rawLogs];
    const noisyKeywords = ['VIEW', 'SWIPE', 'TAB', 'SORT', 'SEARCH', 'SCROLL', 'OPENED', 'NAVIGATE'];
    
    if (activeTab === 'Main Logs') {
      filtered = filtered.filter(l => {
        const act = String(l.action||'').toUpperCase();
        if (noisyKeywords.some(kw => act.includes(kw))) return false;
        if (act === 'THEME_CHANGED' || act === 'AUTO_LOCK_UPDATED' || act.includes('PRIVACY_TOGGLED') || act.includes('LOCK_ON_EXIT')) return false;
        return l.priority === 'CRITICAL' || l.priority === 'IMPORTANT' || l.priority === 'WORKFLOW';
      });
    } 
    else if (activeTab === 'Security') {
      filtered = filtered.filter(l => {
        const mod = l.moduleDisplay.toUpperCase();
        const act = String(l.action||'').toUpperCase();
        return mod === 'SECURITY' || mod === 'SETTINGS' || mod === 'AUTH' || 
               l.priority === 'CRITICAL' || act.includes('PIN') || act.includes('LOCK') || 
               act.includes('DECOY') || act.includes('COPY') || act.includes('WIPE') || 
               act.includes('PASSKEY') || act.includes('BIO') || act.includes('AUTH');
      });
    }

    if (activeModule !== 'All') {
      filtered = filtered.filter(l => l.moduleDisplay.toUpperCase() === activeModule.toUpperCase());
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(l => l.displayTitle.toLowerCase().includes(q) || l.displayDetails.toLowerCase().includes(q) || l.moduleDisplay.toLowerCase().includes(q));
    }

    const groups = { 'Today': [], 'Yesterday': [], 'Older': [] };
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    filtered.forEach(log => {
      const d = new Date(log.timestamp || Date.now());
      if (isNaN(d.getTime())) { groups.Today.push(log); return; }
      if (d.toDateString() === today.toDateString()) groups.Today.push(log);
      else if (d.toDateString() === yesterday.toDateString()) groups.Yesterday.push(log);
      else groups.Older.push(log);
    });

    const finalGroups = [
      { title: 'TODAY', data: groups.Today },
      { title: 'YESTERDAY', data: groups.Yesterday },
      { title: 'OLDER', data: groups.Older }
    ].filter(g => g.data.length > 0);

    setGroupedLogs(finalGroups);
  };

  const triggerPinShake = () => {
    Animated.sequence([
      Animated.timing(pinShakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(pinShakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(pinShakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(pinShakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(pinShakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start();
  };

  const initiateClearLogs = async () => {
    if (rawLogs.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        setClearAuthMode('BIO'); setShowClearModal(true);
        const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Verify identity to clear logs', fallbackLabel: 'Use PIN', disableDeviceFallback: true });
        if (auth.success) executeSecureWipe(); else setClearAuthMode('PIN');
      } else { setClearAuthMode('PIN'); setShowClearModal(true); }
    } catch (e) { setClearAuthMode('PIN'); setShowClearModal(true); }
  };

  const verifyPinForClear = async (enteredPin) => {
    if (enteredPin.length !== 4) return;
    const actualPin = await getMasterPin();
    if (enteredPin === actualPin) {
      setIsPinError(false); setPinAttempts(0); setPinInput('');
      executeSecureWipe();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setIsPinError(true); triggerPinShake();
      const newAttempts = pinAttempts + 1; setPinAttempts(newAttempts);
      if (newAttempts >= 3) { setPinLockout(30); setPinAttempts(0); setPinInput(''); setIsPinError(false); } 
      else { setTimeout(() => { setPinInput(''); setIsPinError(false); }, 600); }
    }
  };

  const executeSecureWipe = async () => {
    setIsWiping(true); setWipeProgress(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += 15;
      if (progress >= 100) { setWipeProgress(100); clearInterval(interval); } 
      else { setWipeProgress(progress); }
    }, 30);
    
    try {
      const email = await getRecoveryEmail();
      if (email) {
        const d = new Date();
        const mailBody = `Your SafeLocker activity history was securely cleared.\n\nDate: ${d.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})}\nTime: ${d.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', hour12:true})}\nDevice: ${Platform.OS === 'ios' ? 'iOS' : 'Android'}\nVerification: Authenticated\nStatus: Success\n\nIf this was not you, reset your master PIN immediately.`;
        fetch(`${API_BASE_URL}/send-alert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, subject: "SafeLocker Security Logs Cleared", message: mailBody }) }).catch(()=>{}); 
      }
    } catch(e) {}

    setTimeout(() => {
      Animated.timing(wipeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(async () => {
        await AsyncStorage.setItem('ACTIVITY_LOGS', JSON.stringify([])); 
        setRawLogs([]); setPinnedLogs([]); setIsWiping(false); setWipeProgress(0); setShowClearModal(false); showSuccessToast(); wipeAnim.setValue(1); 
      });
    }, 400);
  };

  const showSuccessToast = () => {
    setToastVisible(true);
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: insets.top + 60, tension: 50, friction: 8, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(toastAnim, { toValue: -100, duration: 300, useNativeDriver: true })
    ]).start(() => setToastVisible(false));
  };

  const renderLogCard = ({ item, index }) => {
    const cardBg = isDark ? themeColors.card : '#FFFFFF';
    const borderColor = isDark ? themeColors.separator : '#F3F3F3';

    return (
      <Animated.View style={{ opacity: wipeAnim, transform: [{ scale: wipeAnim }, { translateY: listAnim.interpolate({ inputRange: [0, 1], outputRange: [20 + (index * 5), 0] }) }] }}>
        <Pressable 
          style={({pressed}) => [styles.compactCard, { backgroundColor: cardBg, borderColor }, pressed && { transform: [{scale: 0.98}], shadowOpacity: 0.1 }]}
          onPress={() => { Haptics.selectionAsync(); setSelectedLog(item); setShowDetailsModal(true); }}
          onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setSelectedLog(item); setShowActionSheet(true); }}
        >
          <View style={[styles.iconCircle, { backgroundColor: item.theme.bg }]}>
            <Feather name={item.theme.icon} size={20} color={item.theme.text} />
          </View>
          <View style={styles.cardCenter}>
             <Text style={[styles.cardTitle, { color: isDark ? '#FFF' : '#111827' }]} numberOfLines={1}>{item.displayTitle}</Text>
             <Text style={[styles.cardSub, { color: themeColors.textLight }]} numberOfLines={2}>{item.displayDetails}</Text>
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.timeText}>{new Date(item.timestamp || Date.now()).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'})}</Text>
            <View style={[styles.metaPill, { backgroundColor: isDark ? '#374151' : '#F6F2FF' }]}>
               <Text style={[styles.metaPillText, { color: isDark ? '#D1D5DB' : '#8B5CF6' }]} numberOfLines={1}>{item.moduleDisplay}</Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? themeColors.background : '#FAFAFB' }]}>
      
      <View style={[styles.headerWrapper, { paddingTop: insets.top + 14, backgroundColor: isDark ? themeColors.background : '#FAFAFB' }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.headerBtn, { backgroundColor: isDark ? themeColors.inputBg : '#FFF' }]}>
            <Feather name="arrow-left" size={22} color={isDark ? '#FFF' : '#111827'} />
          </TouchableOpacity>
          <Text style={[styles.mainTitle, { color: isDark ? '#FFF' : '#111827' }]} numberOfLines={1}>Activity Log</Text>
          <TouchableOpacity onPress={initiateClearLogs} disabled={rawLogs.length === 0} style={[styles.headerBtn, { backgroundColor: isDark ? themeColors.inputBg : '#FFF', opacity: rawLogs.length === 0 ? 0.5 : 1 }]}>
             <Feather name="trash-2" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <View style={styles.segmentedControl}>
          {['Main Logs', 'All Logs', 'Security'].map(tab => (
            <TouchableOpacity key={tab} onPress={() => { Haptics.selectionAsync(); setActiveTab(tab); }} style={[styles.segmentTab, activeTab === tab ? {backgroundColor: isDark ? '#FFF' : '#111827'} : {backgroundColor: 'transparent', borderWidth: 1, borderColor: isDark ? themeColors.separator : '#E5E7EB'}]}>
              <Text style={{fontSize: 14, fontWeight: '700', color: activeTab === tab ? (isDark ? '#111827' : '#FFF') : themeColors.textLight}}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 🚀 NEW: Files and Tools added dynamically to chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moduleFilterScroll}>
          {['All', 'Vault', 'Gallery', 'Files', 'Tools', 'Settings', 'Security', 'System'].map(mod => (
            <TouchableOpacity key={mod} onPress={() => { Haptics.selectionAsync(); setActiveModule(mod); }} style={[styles.moduleFilterChip, activeModule === mod ? {backgroundColor: themeColors.primaryLight} : {backgroundColor: isDark ? themeColors.inputBg : '#FFF', borderWidth: 1, borderColor: isDark ? themeColors.separator : '#E5E7EB'}]}>
              <Text style={{fontSize: 13, fontWeight: '700', color: activeModule === mod ? themeColors.primary : themeColors.textLight}}>{mod}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.searchBoxWrapper}>
          <View style={[styles.searchBox, { backgroundColor: isDark ? themeColors.inputBg : '#FFF', borderColor: isDark ? themeColors.separator : '#E5E7EB' }]}>
            <Feather name="search" size={18} color={themeColors.textLight} style={{marginRight: 10}} />
            <TextInput style={[styles.searchInput, { color: isDark ? '#FFF' : '#111827' }]} placeholder="Search app activity..." placeholderTextColor={themeColors.textLight} value={searchQuery} onChangeText={setSearchQuery} />
            {searchQuery.length > 0 && ( <TouchableOpacity onPress={() => setSearchQuery('')}><Feather name="x-circle" size={18} color={themeColors.textLight} /></TouchableOpacity> )}
          </View>
        </View>
      </View>

      <Animated.View style={{ flex: 1, opacity: listAnim }}>
        <SectionList
          sections={groupedLogs}
          keyExtractor={(item, index) => (item.timestamp || '0') + index.toString()}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          renderSectionHeader={({ section: { title } }) => ( <Text style={[styles.sectionHeader, { color: themeColors.textLight }]}>{title}</Text> )}
          renderItem={renderLogCard}
            ListHeaderComponent={() => (
            pinnedLogs.length > 0 && activeTab === 'Main Logs' && searchQuery === '' ? (
              <View style={{ marginBottom: 10 }}>
                <Text style={[styles.sectionHeader, { color: '#EF4444', marginTop: 0 }]}>📌 PINNED ALERTS</Text>
                {pinnedLogs.map((log, idx) => (
                  <View key={`pinned-${log.timestamp || idx}`}>
                    {renderLogCard({ item: log, index: idx })}
                  </View>
                ))}
                <View style={{ height: 1, backgroundColor: isDark ? themeColors.separator : '#F1F1F1', marginVertical: 10 }} />
              </View>
            ) : null
          )}
          ListEmptyComponent={() => (
            !isLoading ? (
              <View style={styles.emptyState}>
                <Feather name="shield" size={60} color={themeColors.textLight} style={{opacity: 0.3, marginBottom: 20}} />
                <Text style={[styles.emptyTitle, { color: themeColors.textDark }]}>No events found</Text>
                <Text style={[styles.emptyDesc, { color: themeColors.textLight }]}>Your SafeLocker history is clean for this filter.</Text>
              </View>
            ) : null
          )}
        />
      </Animated.View>

      {toastVisible && (
        <Animated.View style={[styles.toastPill, { transform: [{ translateY: toastAnim }] }]}>
          <Feather name="shield" size={16} color="#10B981" style={{marginRight: 8}} />
          <Text style={styles.toastText}>Logs securely cleared</Text>
        </Animated.View>
      )}

      {/* CLEAR AUTH MODAL */}
      <Modal visible={showClearModal} transparent animationType="slide">
        <View style={styles.modalOverlayBottom}>
          <View style={[styles.compactBottomSheet, { backgroundColor: themeColors.card, paddingBottom: insets.bottom + 24 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: themeColors.separator }]} />
            
            {isWiping ? (
              <View style={{alignItems: 'center', marginVertical: 20}}>
                <Text style={{color: '#EF4444', fontSize: 36, fontWeight: '900', fontVariant: ['tabular-nums']}}>{wipeProgress}%</Text>
                <View style={{width: '80%', height: 8, backgroundColor: themeColors.inputBg, borderRadius: 4, marginTop: 16, overflow: 'hidden'}}>
                   <View style={{width: `${wipeProgress}%`, height: '100%', backgroundColor: '#EF4444'}} />
                </View>
                <Text style={{color: themeColors.textLight, marginTop: 14, fontWeight: '700'}}>Securely erasing data...</Text>
              </View>
            ) : (
              <>
                <View style={{alignItems: 'center', marginBottom: 16}}><Feather name="trash-2" size={32} color="#EF4444" /></View>
                <Text style={[styles.sheetMainTitle, { textAlign: 'center', color: themeColors.textDark, marginBottom: 8 }]}>Clear activity logs?</Text>
                <Text style={{textAlign: 'center', color: themeColors.textLight, fontSize: 14, lineHeight: 20, marginBottom: 24, paddingHorizontal: 20}}>This permanently removes all security history. Authentication required.</Text>

                {clearAuthMode === 'PIN' && (
                  <View style={{width: '100%', alignItems: 'center'}}>
                    {pinLockout > 0 ? (
                      <Text style={{color: '#EF4444', fontWeight: 'bold', fontSize: 16, marginBottom: 20}}>Try again in {pinLockout}s</Text>
                    ) : (
                      <Animated.View style={{ transform: [{ translateX: pinShakeAnim }] }}>
                        <TextInput 
                          style={[
                            styles.pinBox, 
                            { backgroundColor: themeColors.inputBg, color: themeColors.textDark },
                            isPinError ? { borderColor: '#EF4444', borderWidth: 2 } : { borderColor: themeColors.inputBorder }
                          ]} 
                          keyboardType="number-pad" maxLength={4} secureTextEntry autoFocus textAlign="center" placeholder="PIN" placeholderTextColor={themeColors.textLight}
                          value={pinInput} onChangeText={val => { setPinInput(val); setIsPinError(false); if(val.length === 4) verifyPinForClear(val); }} 
                        />
                      </Animated.View>
                    )}
                  </View>
                )}

                <TouchableOpacity style={[styles.actionMenuRowCancel, { backgroundColor: themeColors.inputBg, marginTop: 0 }]} onPress={() => { setShowClearModal(false); setPinInput(''); setIsPinError(false); setPinAttempts(0); }}>
                  <Text style={[styles.actionMenuTextCancel, { color: themeColors.textDark }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showDetailsModal} transparent animationType="slide">
        <View style={styles.modalOverlayBottom}>
          <View style={[styles.compactBottomSheet, { backgroundColor: themeColors.card, paddingBottom: insets.bottom + 20 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: themeColors.separator }]} />
            <View style={styles.sheetHeaderRow}>
              <View style={[styles.sheetIconCircle, { backgroundColor: selectedLog?.theme?.bg || '#EEE' }]}><Feather name={selectedLog?.theme?.icon || 'info'} size={24} color={selectedLog?.theme?.text || '#000'} /></View>
              <View style={{flex: 1, marginLeft: 16}}>
                <Text style={[styles.sheetMainTitle, { color: themeColors.textDark }]} numberOfLines={1}>{selectedLog?.displayTitle || 'Event'}</Text>
                <Text style={{color: themeColors.textLight, fontSize: 13, fontWeight: '600', marginTop: 2}}>{formatTimePremium(selectedLog?.timestamp)}</Text>
              </View>
              <TouchableOpacity style={[styles.closeBtnSmall, { backgroundColor: themeColors.inputBg }]} onPress={() => setShowDetailsModal(false)}><Feather name="x" size={20} color={themeColors.textDark} /></TouchableOpacity>
            </View>
            <View style={[styles.detailsBox, { backgroundColor: themeColors.inputBg }]}>
              {selectedLog?.moduleDisplay && (
                <Text style={{fontSize: 12, fontWeight: 'bold', color: themeColors.primary, marginBottom: 8}}>MODULE: {selectedLog.moduleDisplay.toUpperCase()}</Text>
              )}
              <Text style={[styles.detailsBoxText, { color: themeColors.textDark }]}>{selectedLog?.displayDetails || selectedLog?.details || 'System generated event.'}</Text>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showActionSheet} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.actionMenuCard, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.actionMenuTitle, { color: themeColors.textDark }]}>Log Options</Text>
            <TouchableOpacity style={[styles.actionMenuRow, { borderBottomColor: themeColors.separator }]} onPress={() => { setShowActionSheet(false); setTimeout(() => setShowDetailsModal(true), 300); }}>
              <Feather name="maximize-2" size={18} color={themeColors.textDark} />
              <Text style={[styles.actionMenuText, { color: themeColors.textDark }]}>View Full Details</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionMenuRow} onPress={async () => { 
              await Clipboard.setStringAsync(`[SafeLocker] ${selectedLog?.displayTitle || 'Event'}: ${selectedLog?.displayDetails || selectedLog?.details || 'None'}`); 
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); 
              setShowActionSheet(false); 
            }}>
              <Feather name="copy" size={18} color={themeColors.primary} />
              <Text style={[styles.actionMenuText, { color: themeColors.primary }]}>Copy Secure Text</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionMenuRowCancel, { backgroundColor: themeColors.inputBg }]} onPress={() => setShowActionSheet(false)}>
              <Text style={[styles.actionMenuTextCancel, { color: themeColors.textLight }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrapper: { zIndex: 10, paddingBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, height: 60, marginBottom: 4 },
  headerBtn: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  mainTitle: { fontSize: 24, fontWeight: '800', flex: 1, textAlign: 'center', letterSpacing: -0.5 },
  
  segmentedControl: { flexDirection: 'row', paddingHorizontal: 18, gap: 10, marginBottom: 12 },
  segmentTab: { flex: 1, height: 42, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  moduleFilterScroll: { paddingHorizontal: 18, gap: 8, paddingBottom: 12, height: 44 },
  moduleFilterChip: { height: 38, paddingHorizontal: 16, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  
  searchBoxWrapper: { paddingHorizontal: 18 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, height: 46, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '500' },

  listContent: { paddingHorizontal: 16 },
  sectionHeader: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginTop: 16, marginBottom: 8, marginLeft: 6 },
  
  compactCard: { flexDirection: 'row', alignItems: 'center', height: 88, padding: 16, borderRadius: 22, marginBottom: 10, borderWidth: 1, shadowColor: '#000', shadowOffset: {width:0, height:4}, shadowOpacity: 0.04, shadowRadius: 14, elevation: 1 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  cardCenter: { flex: 1, justifyContent: 'center', paddingRight: 10 },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  cardSub: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  
  cardRight: { width: 72, alignItems: 'flex-end', justifyContent: 'space-between', height: '100%', paddingVertical: 2 },
  timeText: { fontSize: 12, fontWeight: '600', color: '#9AA0A6' },
  metaPill: { height: 22, paddingHorizontal: 8, borderRadius: 10, justifyContent: 'center', alignItems: 'center', maxWidth: 85 },
  metaPillText: { fontSize: 11, fontWeight: '700' },

  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptyDesc: { fontSize: 15, textAlign: 'center', paddingHorizontal: 40 },

  toastPill: { position: 'absolute', alignSelf: 'center', backgroundColor: '#111827', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 10, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  pinBox: { width: 120, height: 60, borderRadius: 16, fontSize: 24, fontWeight: 'bold', letterSpacing: 8, marginBottom: 24, borderWidth: 1 },

  modalOverlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  compactBottomSheet: { width: '100%', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 16, minHeight: '34%' },
  sheetHandle: { width: 48, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 24 },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  sheetIconCircle: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  sheetMainTitle: { fontSize: 22, fontWeight: '800' },
  closeBtnSmall: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  detailsBox: { width: '100%', padding: 18, borderRadius: 20, minHeight: 80 },
  detailsBoxText: { fontSize: 15, lineHeight: 24, fontWeight: '500' },

  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  actionMenuCard: { width: '85%', borderRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  actionMenuTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  actionMenuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
  actionMenuText: { fontSize: 16, fontWeight: '700', marginLeft: 12 },
  actionMenuRowCancel: { width: '100%', height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 16, marginBottom: 10 },
  actionMenuTextCancel: { fontSize: 15, fontWeight: '700' }
});
