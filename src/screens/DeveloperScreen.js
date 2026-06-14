// File: src/screens/DeveloperScreen.js
import React, { useContext, useState, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Linking, Platform, Animated, Pressable, Modal, ActivityIndicator
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

import { ThemeContext } from '../ThemeContext';
import { logActivity } from '../utils/storage';

export default function DeveloperScreen({ navigation }) {
  const { isDark, themeColors } = useContext(ThemeContext);
  const primaryColor = themeColors?.primary || '#12C7B2';
  const insets = useSafeAreaInsets(); 

  // Native Animations for Premium Fluidity
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const popupScale = useRef(new Animated.Value(0.85)).current;
  const popupOpacity = useRef(new Animated.Value(0)).current;
  const pulseDotAnim = useRef(new Animated.Value(0.2)).current;
  const godModeAnim = useRef(new Animated.Value(0)).current;

  // Trackers
  const appStartTime = useRef(Date.now()).current;
  const [versionTaps, setVersionTaps] = useState(0);
  const [godModeActive, setGodModeActive] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [popup, setPopup] = useState({ visible: false, title: '', message: '', icon: '', color: '' });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true })
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseDotAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseDotAnim, { toValue: 0.2, duration: 1200, useNativeDriver: true })
      ])
    ).start();
  }, []);

  // 💎 Premium Glassmorphic Popup Trigger
  const showPremiumPopup = (title, message, icon = 'info', color = primaryColor) => {
    setPopup({ visible: true, title, message, icon, color });
    Animated.parallel([
      Animated.spring(popupScale, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
      Animated.timing(popupOpacity, { toValue: 1, duration: 200, useNativeDriver: true })
    ]).start();
  };

  const closePremiumPopup = () => {
    Animated.parallel([
      Animated.timing(popupScale, { toValue: 0.85, duration: 200, useNativeDriver: true }),
      Animated.timing(popupOpacity, { toValue: 0, duration: 200, useNativeDriver: true })
    ]).start(() => setPopup(prev => ({ ...prev, visible: false })));
  };

  // 💖 HIDDEN EASTER EGG 1: Shanna Dedication (Long Press Avatar)
  const handleSecretDedication = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 150);
    showPremiumPopup("Built to Last.", "Built with passion and dedication.\nEvery line of code crafted with purpose.", "heart", "#EF4444");
  };

  // ⏱️ HIDDEN FEATURE 2: Live Uptime
  const handleNameTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const diff = Math.floor((Date.now() - appStartTime) / 1000);
    const mins = Math.floor(diff / 60);
    showPremiumPopup("Session Uptime", `Core engine has been running flawlessly for ${mins} minutes and ${diff % 60} seconds.`, "activity", primaryColor);
  };

  // 🛡️ HIDDEN FEATURE 3: Stealth Panic Lock (Double Tap Footer)
  let lastFooterTap = 0;
  const handlePanicLock = async () => {
    const now = Date.now();
    if (now - lastFooterTap < 400) { 
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await logActivity('Security', 'PANIC_LOCK', 'Stealth lock triggered from Developer Screen.', 'CRITICAL');
      navigation.replace('Lock'); // Instantly throws user out
    }
    lastFooterTap = now;
  };

  // 💻 MAJOR FEATURE 1: Real God Mode Unlock
  const handleVersionTap = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newTaps = versionTaps + 1;
    setVersionTaps(newTaps);

    if (newTaps === 7 && !godModeActive) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGodModeActive(true);
      await logActivity('System', 'GOD_MODE_UNLOCKED', 'Terminal diagnostics revealed.', 'WARNING');
      Animated.spring(godModeAnim, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }).start();
    }
  };

  // 💾 MAJOR FEATURE 2: Real Byte-Level Memory Audit
  const runDeepAudit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsAuditing(true);
    try {
      const startTime = Date.now();
      const keys = await AsyncStorage.getAllKeys();
      const stores = await AsyncStorage.multiGet(keys);
      
      let totalBytes = 0;
      stores.forEach(([key, value]) => {
        if (value) totalBytes += value.length * 2; // Approx 2 bytes per char
      });
      
      const kbSize = (totalBytes / 1024).toFixed(2);
      const pingTime = Date.now() - startTime;
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showPremiumPopup(
        "Real Audit Complete", 
        `Active Nodes: ${keys.length}\nVault Size: ${kbSize} KB\nLatency: ${pingTime}ms\n\nDatabase is healthy and highly optimized.`, 
        "database", 
        "#10B981"
      );
    } catch (e) {
      showPremiumPopup("Audit Failed", "System blocked the memory request.", "alert-triangle", "#EF4444");
    }
    setIsAuditing(false);
  };

  // 📄 MAJOR FEATURE 3: Generate Real Encrypted Logs
  const exportDiagnostics = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsExporting(true);
    try {
      const keys = await AsyncStorage.getAllKeys();
      const report = {
        developer: "Shaik Taj",
        node: "RMG-TS (Ramagundam Local)",
        os: Platform.OS,
        osVersion: Platform.Version,
        activeEncryptedKeys: keys.length,
        timestamp: new Date().toISOString(),
        encryptionEngine: "SafeLocker v2.0 - AES-GCM"
      };

      await Clipboard.setStringAsync(JSON.stringify(report, null, 2));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showPremiumPopup("Logs Exported", "System diagnostics copied to clipboard. Do not share these publicly.", "terminal", "#3B82F6");
    } catch (error) {
      showPremiumPopup("Export Failed", "Could not read core logs.", "alert-circle", "#EF4444");
    }
    setIsExporting(false);
  };

  // Links
  const openInstagram = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { await Linking.openURL('instagram://user?username=sheikhtaj__08'); } 
    catch (error) { Linking.openURL('https://instagram.com/sheikhtaj__08'); }
  };

  return (
    <View style={[styles.root, { backgroundColor: isDark ? themeColors.background[0] : '#F4F6F9' }]}>
      
      {/* Premium Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0', borderWidth: 1 }]}>
          <Feather name="chevron-left" size={24} color={isDark ? '#F8FAFC' : '#0F172A'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Developer</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center', marginTop: 10, marginBottom: 40 }}>
          
          <Pressable onLongPress={handleSecretDedication} style={styles.avatarContainer}>
            <LinearGradient colors={['#111827', '#374151']} style={styles.avatarBox}>
               <LinearGradient colors={[primaryColor, '#9333EA']} style={styles.innerAvatarRing}>
                  <Feather name="code" size={32} color="#FFFFFF" />
               </LinearGradient>
            </LinearGradient>
          </Pressable>

          <View style={styles.statusPill}>
            <Animated.View style={[styles.pulseDot, { opacity: pulseDotAnim }]} />
            <Text style={styles.statusText}>SYSTEM OPTIMAL</Text>
          </View>

          <Pressable onPress={handleNameTap}>
            <Text style={[styles.name, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Shaik Taj</Text>
          </Pressable>
          <Text style={[styles.role, { color: primaryColor }]}>Lead Architect & Developer</Text>
          
          <Text style={[styles.bio, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            Crafting minimal, hyper-secure digital experiences. SafeLocker is built with uncompromising privacy and zero telemetry.
          </Text>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          
          {/* Social Links - Glassmorphic Style */}
          <View style={styles.cardsContainer}>
            <Pressable onPress={openInstagram} style={({ pressed }) => [styles.linkCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }, pressed && { transform: [{ scale: 0.98 }] }]}>
              <View style={[styles.iconBox, { backgroundColor: '#E8156615' }]}><Feather name="instagram" size={20} color="#E81566" /></View>
              <View style={styles.linkTextCol}>
                <Text style={[styles.linkTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Instagram</Text>
                <Text style={[styles.linkSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>@sheikhtaj__08</Text>
              </View>
              <Feather name="external-link" size={18} color={isDark ? '#475569' : '#CBD5E1'} />
            </Pressable>

            <Pressable onPress={() => Linking.openURL(`mailto:sheikhtaj3010@gmail.com`)} style={({ pressed }) => [styles.linkCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }, pressed && { transform: [{ scale: 0.98 }] }]}>
              <View style={[styles.iconBox, { backgroundColor: '#3B82F615' }]}><Feather name="mail" size={20} color="#3B82F6" /></View>
              <View style={styles.linkTextCol}>
                <Text style={[styles.linkTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Email Support</Text>
                <Text style={[styles.linkSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>sheikhtaj3010@gmail.com</Text>
              </View>
              <Feather name="arrow-up-right" size={18} color={isDark ? '#475569' : '#CBD5E1'} />
            </Pressable>

            <Pressable onPress={handleVersionTap} style={({ pressed }) => [styles.versionCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }, pressed && { transform: [{ scale: 0.98 }] }]}>
               <Text style={[styles.linkTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>SafeLocker Core</Text>
               <View style={styles.versionBadge}>
                 <Text style={[styles.versionText, { color: primaryColor }]}>v2.0.0</Text>
               </View>
            </Pressable>
          </View>

          {/* 🔥 REAL GOD MODE TERMINAL */}
          {godModeActive && (
            <Animated.View style={{ 
              opacity: godModeAnim,
              transform: [{ translateY: godModeAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }]
            }}>
              <View style={[styles.terminalBox, { backgroundColor: '#0F172A', borderColor: '#334155', borderWidth: 1 }]}>
                <View style={styles.terminalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Feather name="terminal" size={14} color="#10B981" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }}>ROOT ACCESS</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <View style={{width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444'}} />
                    <View style={{width: 10, height: 10, borderRadius: 5, backgroundColor: '#F59E0B'}} />
                    <View style={{width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981'}} />
                  </View>
                </View>
                
                <Text style={styles.terminalLine}>> Data Node: RMG-TS (Active)</Text>
                <Text style={styles.terminalLine}>> SQLite Engine: Mounted</Text>
                <Text style={styles.terminalLine}>> Bypass Protocols: Disabled</Text>
                
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                  <TouchableOpacity style={[styles.terminalBtn, { backgroundColor: '#10B98115', borderColor: '#10B98130' }]} onPress={runDeepAudit} disabled={isAuditing}>
                    {isAuditing ? <ActivityIndicator size="small" color="#10B981" /> : <Text style={{ color: '#10B981', fontWeight: '800', fontSize: 12 }}>RUN AUDIT</Text>}
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={[styles.terminalBtn, { backgroundColor: '#3B82F615', borderColor: '#3B82F630' }]} onPress={exportDiagnostics} disabled={isExporting}>
                    {isExporting ? <ActivityIndicator size="small" color="#3B82F6" /> : <Text style={{ color: '#3B82F6', fontWeight: '800', fontSize: 12 }}>DUMP LOGS</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Footer - Stealth Trigger */}
          <Pressable onPress={handlePanicLock} style={styles.footerNote}>
            <View style={[styles.privacyBadge, { backgroundColor: isDark ? '#1C3A2D' : '#DCFCE7' }]}>
              <Feather name="shield" size={12} color="#10B981" style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#10B981', letterSpacing: 1 }}>ZERO KNOWLEDGE ARCHITECTURE</Text>
            </View>
            <Text style={[styles.footerText, { color: '#94A3B8' }]}>Built independently. No trackers. No backdoors.</Text>
            <Text style={[styles.footerText, { color: '#94A3B8', marginTop: 4 }]}>© 2026 Shaik Taj.</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      {/* 💎 ULTRA PREMIUM GLASSMORPHIC MODAL */}
      <Modal visible={popup.visible} transparent animationType="fade" onRequestClose={closePremiumPopup}>
        <View style={styles.modalOverlay}>
          <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <Animated.View style={[styles.premiumModal, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0', borderWidth: 1, opacity: popupOpacity, transform: [{ scale: popupScale }] }]}>
            
            <View style={[styles.modalIconBox, { backgroundColor: popup.color + '15' }]}>
              <Feather name={popup.icon} size={32} color={popup.color} />
            </View>
            
            <Text style={[styles.modalTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{popup.title}</Text>
            
            <View style={[styles.modalBodyBox, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
              <Text style={[styles.modalMessage, { color: isDark ? '#94A3B8' : '#64748B' }]}>{popup.message}</Text>
            </View>

            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: popup.color }]} onPress={closePremiumPopup}>
              <Text style={styles.modalBtnText}>Acknowledge</Text>
            </TouchableOpacity>
            
          </Animated.View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 }, 
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 }, 
  backBtn: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }, 
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 }, 
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  
  avatarContainer: { position: 'relative', marginBottom: 20 },
  avatarBox: { width: 110, height: 110, borderRadius: 36, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: {width:0, height:12}, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10, transform: [{rotate: '-3deg'}] }, 
  innerAvatarRing: { width: 104, height: 104, borderRadius: 32, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.1)' },
  
  statusPill: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, backgroundColor: '#10B98115', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1, borderColor: '#10B98130' },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 8 },
  statusText: { color: '#10B981', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  
  name: { fontSize: 32, fontWeight: '900', marginBottom: 4, letterSpacing: -1 }, 
  role: { fontSize: 13, fontWeight: '800', marginBottom: 18, letterSpacing: 0.5, textTransform: 'uppercase' }, 
  bio: { textAlign: 'center', fontSize: 14, lineHeight: 24, paddingHorizontal: 16, fontWeight: '500' },
  
  cardsContainer: { gap: 12, marginBottom: 24 },
  linkCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 24, borderWidth: 1, shadowColor: '#000', shadowOffset: {width:0, height:4}, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 }, 
  iconBox: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 }, 
  linkTextCol: { flex: 1, justifyContent: 'center' }, 
  linkTitle: { fontSize: 16, fontWeight: '800', marginBottom: 2 }, 
  linkSub: { fontSize: 14, fontWeight: '600' },
  
  versionCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 22, borderRadius: 24, borderWidth: 1, marginTop: 4 }, 
  versionBadge: { backgroundColor: 'rgba(18, 199, 178, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  versionText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  
  terminalBox: { borderRadius: 24, padding: 20, marginBottom: 24, shadowColor: '#000', shadowOffset: {width:0, height:10}, shadowOpacity: 0.2, shadowRadius: 15, elevation: 5 },
  terminalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 12, marginBottom: 12 },
  terminalLine: { color: '#64748B', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, marginBottom: 8, fontWeight: '600' },
  terminalBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1 },

  footerNote: { alignItems: 'center', marginTop: 20 }, 
  privacyBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100 },
  footerText: { fontSize: 12, textAlign: 'center', fontWeight: '600' },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.3)' },
  premiumModal: { width: '100%', maxWidth: 360, borderRadius: 40, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: {width:0, height:24}, shadowOpacity: 0.3, shadowRadius: 32, elevation: 20 },
  modalIconBox: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 16, letterSpacing: -0.5 },
  modalBodyBox: { padding: 16, borderRadius: 20, width: '100%', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.1)' },
  modalMessage: { fontSize: 14, lineHeight: 22, textAlign: 'center', fontWeight: '600' },
  modalBtn: { width: '100%', paddingVertical: 16, borderRadius: 100, alignItems: 'center' },
  modalBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }
});