// File: src/screens/LockScreen.js
import React, { useState, useEffect, useRef, useContext } from 'react';
import { 
  View, Text, StyleSheet, SafeAreaView, 
  Modal, Animated, ActivityIndicator, Alert, AppState, TextInput, 
  Pressable, TouchableOpacity, Platform, KeyboardAvoidingView, Keyboard, 
  TouchableWithoutFeedback, InteractionManager
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons'; 
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

import { 
  getMasterPin, setSessionMode, updateSetting, getRecoveryEmail, 
  getRecoveryCode, saveMasterPin, getFakePin, getLockProfile, logActivity, getSettings,
  setActiveVaultKey, clearActiveVaultKey 
} from '../utils/storage';
import { ThemeContext } from '../ThemeContext';
import { CryptoEngine } from '../utils/cryptoEngine'; 
import { getDB } from '../utils/database';

const API_BASE_URL = 'https://safelockers.sheikhtaj3010.workers.dev'; 

const fetchWithRetry = async (url, options = {}, retries = 3) => {
  const customHeaders = { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(options.headers || {}) };
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); 
      const response = await fetch(url, { ...options, headers: customHeaders, signal: controller.signal });
      clearTimeout(timeoutId); 
      return response; 
    } catch (error) {
      if (i === retries - 1) throw new Error("Server timeout or unreachable. Please try again.");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
};

export default function LockScreen({ navigation }) {
  const { isDark, themeColors } = useContext(ThemeContext);
  const insets = useSafeAreaInsets(); 
  const primaryColor = themeColors?.primary || '#8B5CF6';

  const [pin, setPin] = useState('');
  const [savedPin, setSavedPin] = useState(null); 
  const [fakePinState, setFakePinState] = useState(null); 
  const [lockProfile, setLockProfile] = useState('BIO_OR_PIN'); 
  
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [setupStep, setSetupStep] = useState(1); 
  const [tempSetupPin, setTempSetupPin] = useState('');

  const [isError, setIsError] = useState(false);
  const [dynamicSubtitle, setDynamicSubtitle] = useState("Enter PIN to unlock");
  const [attempts, setAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [appState, setAppState] = useState(AppState.currentState);
  
  const [recoveryModalVisible, setRecoveryModalVisible] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState('OPTIONS'); 
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false);

  const [savedEmail, setSavedEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpInput, setOtpInput] = useState('');
  
  const [savedCode, setSavedCode] = useState(null);
  const [codeInput, setCodeInput] = useState('');
  
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [resetStep, setResetStep] = useState(1);

  const [mandatoryEmailModal, setMandatoryEmailModal] = useState(false);
  const [pendingVaultMode, setPendingVaultMode] = useState('FULL');
  const [isDecrypting, setIsDecrypting] = useState(false);

  const entranceAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const dotScales = useRef([new Animated.Value(0.6), new Animated.Value(0.6), new Animated.Value(0.6), new Animated.Value(0.6)]).current;
  const idleTimer = useRef(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => { 
      clearActiveVaultKey();
      await loadInitialSetup(); 
      if (mandatoryEmailModal) checkAndProceed(pendingVaultMode);
      entranceAnim.setValue(0);
      Animated.spring(entranceAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }).start();
    });
    return unsubscribe;
  }, [navigation, mandatoryEmailModal, pendingVaultMode]);

  useEffect(() => {
    loadInitialSetup();
    Animated.spring(entranceAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }).start();
    const subscription = AppState.addEventListener('change', nextAppState => setAppState(nextAppState));
    return () => { subscription.remove(); clearTimeout(idleTimer.current); };
  }, []);

  useEffect(() => {
    let interval;
    if (otpCooldown > 0) interval = setInterval(() => setOtpCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [otpCooldown]);

  useEffect(() => {
    dotScales.forEach((anim, index) => {
      const isFilled = index < pin.length;
      Animated.spring(anim, { 
        toValue: isFilled ? 1.2 : 0.6, 
        speed: 28, bounciness: 12, useNativeDriver: true 
      }).start();
    });
  }, [pin]);

  useEffect(() => {
    let interval;
    if (lockoutTimer > 0) interval = setInterval(() => setLockoutTimer(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  const loadInitialSetup = async () => {
    global.isDecoyMode = false; 
    const fPin = await getFakePin(); setFakePinState(fPin);
    const profile = await getLockProfile(); setLockProfile(profile);
    const code = await getRecoveryCode(); setSavedCode(code);
    
    let e = await AsyncStorage.getItem('SAFEGALLERY_RECOVERY_EMAIL') || await AsyncStorage.getItem('RECOVERY_EMAIL');
    if (e) {
      setSavedEmail(e); const parts = e.split('@');
      if (parts.length === 2) setMaskedEmail(`${parts[0].substring(0, 2)}***@${parts[1]}`);
    } else setSavedEmail('');

    const p = await getMasterPin();
    if (p) {
      setSavedPin(p); setIsFirstTime(false); setDynamicSubtitle("Enter PIN to unlock");
      if (profile === 'BIO_OR_PIN' && !mandatoryEmailModal) setTimeout(() => triggerBiometric(true), 600);
    } else {
      setSavedPin(null); setIsFirstTime(true); setSetupStep(1); setTempSetupPin(''); setPin('');
    }
  };

  const checkAndProceed = async (mode) => {
    setPendingVaultMode(mode);
    let currentEmail = await AsyncStorage.getItem('SAFEGALLERY_RECOVERY_EMAIL') || await AsyncStorage.getItem('RECOVERY_EMAIL');
    if (!currentEmail || currentEmail.trim() === '') setMandatoryEmailModal(true); 
    else { setMandatoryEmailModal(false); unlockVault(mode); }
  };

  const handleGoToEmailSetup = () => { setMandatoryEmailModal(false); navigation.navigate('EmailSetup', { isFromOnboarding: true }); };

  const unlockVault = async (mode) => {
    clearTimeout(idleTimer.current);
    await updateSetting('lastUnlocked', `Today • ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
    await setSessionMode(mode); 
    global.isDecoyMode = (mode === 'LIMITED'); 
    await logActivity('Auth', 'VAULT_UNLOCKED', `Vault accessed in ${mode === 'LIMITED' ? 'Decoy' : 'Full'} Mode.`, 'WORKFLOW');
    
    Animated.timing(entranceAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
       navigation.replace('MainDashboard'); 
    });
  };

  const triggerMainShake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -12, duration: 50, useNativeDriver: true }), 
      Animated.timing(shakeAnim, { toValue: 12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }), 
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start();
  };

  const resetIdleTimer = () => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => { if (pin.length > 0) setPin(''); }, 6000);
  };

  const handleKeyPress = (num) => {
    if (lockoutTimer > 0 || isDecrypting) { if(!isDecrypting) triggerMainShake(); return; }
    if (pin.length === 0 && !isError && attempts < 3) setDynamicSubtitle("Enter PIN to unlock"); 
    
    resetIdleTimer();
    
    if (pin.length < 4) {
      const newPinValue = pin + num; 
      setPin(newPinValue); 
      setIsError(false); 
      
      if (newPinValue.length === 4) {
        setIsDecrypting(true); 
        InteractionManager.runAfterInteractions(() => {
          setTimeout(() => { 
            if (isFirstTime) handleSetupFlow(newPinValue); else verifyPin(newPinValue); 
          }, 50);
        });
      }
    }
  };

  const handleSetupFlow = async (enteredPin) => {
    if (setupStep === 1) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setTempSetupPin(enteredPin);
      setPin(''); setSetupStep(2); setIsDecrypting(false);
    } else if (setupStep === 2) {
      if (enteredPin === tempSetupPin) {
        try {
          await CryptoEngine.setupVaultKey(enteredPin);
          const vaultKey = await CryptoEngine.getVaultKey(enteredPin);
          setActiveVaultKey(vaultKey); 
          await saveMasterPin(enteredPin); setSavedPin(enteredPin); setIsFirstTime(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await logActivity('Auth', 'MASTER_PIN_CREATED', 'Initial Master PIN created.', 'IMPORTANT');
          setIsDecrypting(false); checkAndProceed('FULL');
        } catch(e) { 
          setIsDecrypting(false); 
          Alert.alert("Encryption Error", "Failed to generate security keys. Please restart the app."); 
        }
      } else {
        setIsDecrypting(false); setIsError(true); triggerMainShake(); setDynamicSubtitle('PINs do not match');
        setTimeout(() => { setPin(''); setTempSetupPin(''); setSetupStep(1); setIsError(false); setDynamicSubtitle("Create 4-digit Master PIN"); }, 1000);
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0 && !isDecrypting) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPin(pin.slice(0, -1)); setIsError(false); resetIdleTimer(); }
  };

  const clearAllPin = () => { 
    if (pin.length > 0 && !isDecrypting) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setPin(''); setIsError(false); }
  };

  const verifyPin = async (enteredPin) => {
    if (enteredPin === savedPin) {
      let vaultKey;
      try { vaultKey = await CryptoEngine.getVaultKey(enteredPin); } catch(e) {}
      if (!vaultKey) { await CryptoEngine.setupVaultKey(enteredPin); vaultKey = await CryptoEngine.getVaultKey(enteredPin); }
      setIsDecrypting(false);

      if (vaultKey) {
        setActiveVaultKey(vaultKey);
        if (lockProfile === 'DUAL') await executeDualBiometric('FULL');
        else { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setAttempts(0); checkAndProceed('FULL'); }
      } else {
        Alert.alert("Security Check Failed", "Data corrupted. Please restart the app."); setPin('');
      }
    } else if (fakePinState && enteredPin === fakePinState) {
      const decoyKey = CryptoEngine.deriveKeyFromPin(enteredPin).toString(); setActiveVaultKey(decoyKey); setIsDecrypting(false);
      if (lockProfile === 'DUAL') await executeDualBiometric('LIMITED');
      else { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setAttempts(0); await logActivity('Auth', 'DECOY_MODE_ACCESS', 'Decoy Vault accessed.', 'CRITICAL'); await unlockVault('LIMITED'); }
    } else {
      setIsDecrypting(false); setIsError(true); triggerMainShake();
      const newAttempts = attempts + 1; setAttempts(newAttempts);
      if (newAttempts >= 5) setDynamicSubtitle("Take a breath. Try again."); else if (newAttempts >= 3) setDynamicSubtitle("Still not right."); else setDynamicSubtitle("Enter PIN to unlock");
      await logActivity('Auth', 'FAILED_UNLOCK_ATTEMPT', `Invalid PIN attempt (${newAttempts}/5).`, 'CRITICAL');
      if (newAttempts >= 10) setLockoutTimer(120); else if (newAttempts >= 5) setLockoutTimer(30); 
      setTimeout(() => { setPin(''); setIsError(false); }, 800); 
    }
  };

  const executeDualBiometric = async (sessionMode) => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync(); const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Dual Security: Verify Biometric', fallbackLabel: 'Use PIN', disableDeviceFallback: true });
        if (auth.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setAttempts(0);
          if(sessionMode === 'LIMITED') await unlockVault(sessionMode); else checkAndProceed(sessionMode); 
        } else {
          setIsError(true); triggerMainShake(); setDynamicSubtitle("Biometric failed");
          await logActivity('Auth', 'BIOMETRIC_FAILED', 'Dual verification biometric failed.', 'CRITICAL');
          setTimeout(() => { setPin(''); setIsError(false); setDynamicSubtitle("Enter PIN to unlock"); }, 1500);
        }
      } else { if(sessionMode === 'LIMITED') await unlockVault(sessionMode); else checkAndProceed(sessionMode); }
    } catch(e) { setPin(''); }
  };

  const triggerBiometric = async (isAutoTrigger = false) => {
    if (isFirstTime || mandatoryEmailModal) return; 
    if (!isAutoTrigger && lockProfile === 'PIN') return; 
    if (!isAutoTrigger && lockProfile === 'DUAL') return Alert.alert('Dual Mode Active', 'Please enter your Master PIN first.');

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync(); const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Secure Vault', fallbackLabel: 'Use PIN', disableDeviceFallback: true });
        if (auth.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setIsDecrypting(true);
          
          InteractionManager.runAfterInteractions(() => {
            setTimeout(async () => {
              const p = await getMasterPin();
              let vaultKey;
              try { vaultKey = await CryptoEngine.getVaultKey(p); } catch(e) {}
              if (!vaultKey) { await CryptoEngine.setupVaultKey(p); vaultKey = await CryptoEngine.getVaultKey(p); }
              setActiveVaultKey(vaultKey);
              setIsDecrypting(false);
              checkAndProceed('FULL'); 
            }, 50);
          });
        } else if (!isAutoTrigger) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logActivity('Auth', 'BIOMETRIC_FAILED', 'Primary biometric unlock failed.', 'CRITICAL');
        }
      }
    } catch (e) { setIsDecrypting(false); }
  };

  const openRecoveryModal = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('Recovery'); };

  // 💎 ULTRA-MINIMALIST GHOST KEYPAD BUTTON (No background circle until pressed)
  const KeypadButton = ({ num, onPress, icon, onLongPress }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const bgOpacity = useRef(new Animated.Value(0)).current; 
    
    const handlePressIn = () => { 
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 0.85, speed: 40, bounciness: 8, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 100, useNativeDriver: true })
      ]).start(); 
    };
    const handlePressOut = () => { 
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, speed: 30, bounciness: 12, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 0, duration: 250, useNativeDriver: true })
      ]).start(); 
    };

    return (
      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress} onLongPress={onLongPress}>
        <Animated.View style={[styles.padButton, { transform: [{ scale: scaleAnim }] }]}>
          {/* Subtle ghost background only visible on press */}
          <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 37, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', opacity: bgOpacity }]} />
          {icon ? icon : <Text style={[styles.padButtonText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{num}</Text>}
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.containerMain, { backgroundColor: isDark ? '#020617' : '#FFFFFF' }]}>
      
      {appState !== 'active' && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}>
          <BlurView intensity={100} style={StyleSheet.absoluteFill} tint={isDark ? "dark" : "light"} />
          <View style={{flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center'}}>
             <View style={styles.blurShieldBox}><Feather name="shield" size={48} color={primaryColor} /></View>
             <Text style={{marginTop: 16, fontSize: 20, fontWeight: '900', color: isDark ? '#F8FAFC' : '#0F172A', letterSpacing: -0.5}}>Vault Locked</Text>
          </View>
        </View>
      )}

      <SafeAreaView style={styles.safeAreaFlex}>
        <Animated.View style={[styles.mainContent, { opacity: entranceAnim, transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }]}>
          
          {/* TOP SECTION: Fully Minimalist */}
          <View style={styles.topBlock}>
            <Feather name={isFirstTime ? "shield" : "lock"} size={32} color={primaryColor} style={{ marginBottom: 16 }} />
            <Text style={[styles.appName, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>SafeLocker</Text>
            <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>{isFirstTime ? (setupStep === 1 ? "Create 4-digit Master PIN" : "Confirm Master PIN") : dynamicSubtitle}</Text>
          </View>

          {/* DOTS SECTION */}
          <Animated.View style={[styles.pinDisplayContainer, { transform: [{ translateX: shakeAnim }] }]}>
            {lockoutTimer > 0 ? (
              <View style={[styles.lockoutBox, { backgroundColor: isDark ? '#450A0A' : '#FEF2F2' }]}><Feather name="alert-triangle" size={14} color="#EF4444" /><Text style={styles.lockoutText}>Try again in {lockoutTimer}s</Text></View>
            ) : isDecrypting ? (
              <ActivityIndicator size="small" color={primaryColor} style={{ paddingVertical: 8 }} />
            ) : isError ? (
              <Text style={[styles.errorText, { color: '#EF4444' }]}>{isFirstTime ? 'PINs do not match' : 'Incorrect PIN'}</Text>
            ) : (
              <View style={styles.dotsContainer}>
                {[0, 1, 2, 3].map(i => (
                  <View key={i} style={[styles.dotWrapper]}>
                    <Animated.View style={[styles.dotFluid, { 
                      backgroundColor: pin.length > i ? primaryColor : (isDark ? '#334155' : '#E2E8F0'), 
                      transform: [{ scale: dotScales[i] }], 
                      shadowColor: pin.length > i ? primaryColor : 'transparent' 
                    }]} />
                  </View>
                ))}
              </View>
            )}
          </Animated.View>

          {/* FORGOT PIN TEXT */}
          <View style={styles.forgotPinWrapper}>
            {!isFirstTime && (
              <Pressable onPress={openRecoveryModal} style={({ pressed }) => [pressed && { transform: [{ scale: 0.96 }], opacity: 0.8 }]}>
                <Text style={[styles.forgotPinText, { color: primaryColor }]}>Forgot PIN?</Text>
              </Pressable>
            )}
          </View>

          {/* REDUCED GAP TO KEYPAD */}
          <View style={{ height: 40 }} /> 

          {/* 💎 SLEEK BARE-BONES KEYPAD */}
          <View style={styles.keypadWrapper}>
            {[[1,2,3], [4,5,6], [7,8,9]].map((row, i) => (
              <View key={i} style={styles.padRow}>{row.map(num => <KeypadButton key={num} num={num.toString()} onPress={() => handleKeyPress(num.toString())} />)}</View>
            ))}
            <View style={styles.padRow}>
              {isFirstTime ? ( <View style={styles.emptyButtonSpace} /> ) : (
                <KeypadButton onPress={() => triggerBiometric(false)} icon={<MaterialIcons name="fingerprint" size={28} color={lockProfile === 'BIO_OR_PIN' ? primaryColor : (isDark ? '#475569' : '#94A3B8')} />} />
              )}
              <KeypadButton num="0" onPress={() => handleKeyPress('0')} />
              <KeypadButton onPress={handleDelete} onLongPress={clearAllPin} icon={<Feather name="delete" size={24} color={isDark ? '#F8FAFC' : '#0F172A'} />} />
            </View>
          </View>
        </Animated.View>
      </SafeAreaView>

      <Modal visible={mandatoryEmailModal} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.onboardingCard, { backgroundColor: isDark ? themeColors.card : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
            <View style={[styles.onboardingIconBox, { backgroundColor: primaryColor + '15' }]}><Feather name="mail" size={32} color={primaryColor} /></View>
            <Text style={[styles.onboardingTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Action Required</Text>
            <Text style={[styles.onboardingSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>Adding a recovery email is mandatory to secure your vault from permanent data loss.</Text>
            <TouchableOpacity style={[styles.onboardingBtnActionFull, { backgroundColor: primaryColor }]} onPress={handleGoToEmailSetup}>
              <Text style={styles.onboardingBtnTextAction}>Set up Email</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  containerMain: { flex: 1 }, 
  safeAreaFlex: { flex: 1 }, 
  mainContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 16 }, // Perfectly vertically centered
  
  // 💎 Ultra-Minimalist Top Block
  topBlock: { alignItems: 'center', width: '100%', marginBottom: 12 }, 
  appName: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 }, 
  subtitle: { fontSize: 14, marginTop: 4, fontWeight: '500' },
  
  // 💎 Minimalist Dots
  pinDisplayContainer: { minHeight: 32, justifyContent: 'center', alignItems: 'center', marginTop: 32, marginBottom: 16 }, 
  dotsContainer: { flexDirection: 'row', gap: 20 }, 
  dotWrapper: { width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  dotFluid: { width: 12, height: 12, borderRadius: 6, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 },
  
  errorText: { fontSize: 14, fontWeight: '800' }, 
  lockoutBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100 }, 
  lockoutText: { color: '#EF4444', fontSize: 13, fontWeight: '800', marginLeft: 8 },
  
  forgotPinWrapper: { minHeight: 24, justifyContent: 'center', alignItems: 'center' }, 
  forgotPinText: { fontSize: 13, fontWeight: '800' },
  
  // 💎 Minimalist Bare Keypad
  keypadWrapper: { alignItems: 'center', marginBottom: 16 }, 
  padRow: { flexDirection: 'row', gap: 24, marginBottom: 16 }, 
  padButton: { width: 74, height: 74, borderRadius: 37, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' }, 
  padButtonText: { fontSize: 32, fontWeight: '300', fontFamily: Platform.OS === 'ios' ? 'HelveticaNeue-Light' : 'sans-serif-light' }, 
  emptyButtonSpace: { width: 74, height: 74 },
  
  blurShieldBox: { width: 100, height: 100, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }, 
  onboardingCard: { width: '100%', maxWidth: 340, borderRadius: 40, padding: 32, alignItems: 'center', borderWidth: 1 }, 
  onboardingIconBox: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }, 
  onboardingTitle: { fontSize: 24, fontWeight: '900', marginBottom: 12, textAlign: 'center', letterSpacing: -0.5 }, 
  onboardingSub: { fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 32, fontWeight: '500' }, 
  onboardingBtnActionFull: { width: '100%', height: 56, justifyContent: 'center', alignItems: 'center', borderRadius: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 }, 
  onboardingBtnTextAction: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }
});
