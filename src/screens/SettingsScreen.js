// File: src/screens/SettingsScreen.js
import React, { useState, useCallback, useRef, useEffect, useContext } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Switch, Modal, TextInput, ActivityIndicator, Platform, Animated, Pressable,
  KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback, Alert
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'; 
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import * as ScreenCapture from 'expo-screen-capture';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { BlurView } from 'expo-blur'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import Svg, { Circle } from 'react-native-svg';

import { ThemeContext } from '../ThemeContext'; 

import { 
  getSettings, updateSetting, getRecoveryEmail, getMasterPin, saveMasterPin, 
  getRecoveryCode, saveRecoveryCode, getFakePin, saveFakePin, getEmailVerified, clearAllData,
  getSessionMode, getCurrentDeviceId, getSecurityState, updateSecurityState, clearSecurityState, logActivity,
  getLockProfile, saveLockProfile, getColorHistory, saveColorHistory
} from '../utils/storage';
import { exportBackup, pickAndAnalyzeBackup, processImportDecryption, processEmailDeviceDecryption } from '../utils/backup';
import { sendPremiumTestMail } from '../utils/mailService'; 

const API_BASE_URL = 'https://safelockers.sheikhtaj3010.workers.dev';

// NATIVE MATH LOGIC: HSL to HEX
const hslToHex = (h, s, l) => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
};

const SOFT_COLORS = [
  { name: 'Soft Purple', hex: '#E9E5FF', text: '#6C4EFF' }, { name: 'Soft Blue', hex: '#E3F2FD', text: '#1E88E5' },
  { name: 'Soft Green', hex: '#E6F7EC', text: '#16A34A' }, { name: 'Soft Pink', hex: '#FCE7F3', text: '#DB2777' },
  { name: 'Soft Yellow', hex: '#FFF7CC', text: '#CA8A04' }, { name: 'Soft Teal', hex: '#E0F7F4', text: '#0D9488' }
];

const GRADIENT_COLORS = [
  { name: 'Sunset Glow', hex: '#F97316', colors: ['#EC4899', '#F97316'] }, { name: 'Ocean Flow', hex: '#00BFA6', colors: ['#06B6D4', '#0D9488'] },
  { name: 'Midnight Depth', hex: '#6366F1', colors: ['#6366F1', '#6C4EFF'] }, { name: 'Forest Fresh', hex: '#22C55E', colors: ['#84CC16', '#16A34A'] }
];

const EXTENDED_PALETTE = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1',
  '#8B5CF6', '#A855F7', '#D946EF', '#EC4899', '#F43F5E', '#9F1239', '#7F1D1D', '#7C2D12', '#713F12', '#3F6212', '#14532D', '#064E3B',
  '#164E63', '#0C4A6E', '#1E3A8A', '#312E81', '#4C1D95', '#701A75', '#831843', '#0F172A', '#334155', '#64748B', '#94A3B8', '#CBD5E1'
];

// PREMIUM COLORS QUICK SELECT
const PREMIUM_5 = [
  { name: 'Lavender', hex: '#8B5CF6' },
  { name: 'Ocean', hex: '#0EA5E9' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Rose', hex: '#F43F5E' }
];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// 🔥 SMART INPUT BOX (For Backup OTP)
const SmartInputBox = ({ value, setValue, inputRef, isDark, themeColors, isError, length = 6 }) => (
  <View style={styles.otpContainer}>
    <Pressable style={styles.otpPressableArea} onPress={() => { inputRef.current?.focus(); }}>
      {Array.from({ length }).map((_, index) => {
        const isActive = value.length === index;
        const isFilled = value.length > index;
        return (
          <View key={index} style={[styles.otpDigitBoxCompact, { 
            backgroundColor: isDark ? themeColors.inputBg : '#F9FAFB', 
            borderColor: isError ? '#EF4444' : (isActive ? themeColors.primary : (isFilled ? themeColors.primary + '50' : (isDark ? '#334155' : '#E5E7EB'))),
            borderWidth: isError || isActive ? 2 : 1.5,
          }]}>
            <Text style={[styles.otpDigitText, { color: isError ? '#EF4444' : (isDark ? '#FFF' : '#111827'), fontSize: 24 }]}>{value[index] || ''}</Text>
          </View>
        );
      })}
    </Pressable>
    <TextInput 
      ref={inputRef} style={styles.hiddenInput} keyboardType="number-pad" autoCapitalize="none"
      maxLength={length} value={value} onChangeText={setValue} caretHidden={true} autoCorrect={false} blurOnSubmit={false}
    />
  </View>
);

export default function SettingsScreen({ navigation }) {
  const { isDark, toggleTheme, accentName, changeAccentColor, themeColors } = useContext(ThemeContext);
  const primaryColor = themeColors?.primary || '#12C7B2'; 
  const insets = useSafeAreaInsets(); 

  const [settings, setSettings] = useState(null); 
  const [emailStatus, setEmailStatus] = useState('unverified');
  const [fakePinStatus, setFakePinStatus] = useState('unverified');
  const [isLimited, setIsLimited] = useState(false);
  const [lockProfileState, setLockProfileState] = useState('BIO_OR_PIN');

  const [securityScore, setSecurityScore] = useState(0);
  const [showAllPrivacy, setShowAllPrivacy] = useState(false);
  const strokeDashoffset = useRef(new Animated.Value(2 * Math.PI * 24)).current; 
  const scrollY = useRef(new Animated.Value(0)).current;

  const [breakdownModal, setBreakdownModal] = useState(false); 
  const [colorPickerModal, setColorPickerModal] = useState(false);
  const [livePreviewColor, setLivePreviewColor] = useState(themeColors.primary);
  const [livePreviewName, setLivePreviewName] = useState(accentName);
  const [recentColors, setRecentColors] = useState([]);
  const [autoColorMode, setAutoColorMode] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customHex, setCustomHex] = useState(themeColors.primary); 

  // Hue Slider States
  const [isColorDragging, setIsColorDragging] = useState(false);
  const [hueBarWidth, setHueBarWidth] = useState(1);
  const [currentHue, setCurrentHue] = useState(260);

  const [pinModal, setPinModal] = useState(false);
  const [fakePinActionModal, setFakePinActionModal] = useState(false);
  const [fakePinModal, setFakePinModal] = useState(false);

  const [recoveryModal, setRecoveryModal] = useState(false);
  const [createRecoveryModal, setCreateRecoveryModal] = useState(false);
  const [customRecoveryCode, setCustomRecoveryCode] = useState('');
  const [recoveryCodeState, setRecoveryCodeState] = useState('');
  
  const [timerModal, setTimerModal] = useState(false);
  const [lockProfileModal, setLockProfileModal] = useState(false);
  const timerOptions = ['30 sec', '1 min', '2 min', '5 min', '10 min'];

  // 🔥 BACKUP EXPORT & IMPORT STATES
  const [showImportWarning, setShowImportWarning] = useState(false);
  const [showEmailRequiredModal, setShowEmailRequiredModal] = useState(false); 
  const [exportModal, setExportModal] = useState(false); 
  const [isExporting, setIsExporting] = useState(false); 
  const [exportProgress, setExportProgress] = useState(0);
  
  const [importModal, setImportModal] = useState(false);
  const [backupFileObj, setBackupFileObj] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzerStepText, setAnalyzerStepText] = useState('Checking backup...');
  const [importStep, setImportStep] = useState('INFO'); 
  const [importLinkedEmail, setImportLinkedEmail] = useState(null);
  const [maskedImportEmail, setMaskedImportEmail] = useState(null);
  const [importOtp, setImportOtp] = useState('');
  const [isImportLoading, setIsImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const importOtpInputRef = useRef(null);

  const [pendingAction, setPendingAction] = useState(null); 
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [emailRecoveryModal, setEmailRecoveryModal] = useState(false);
  const [recoveryEmailInput, setRecoveryEmailInput] = useState('');
  const [recoveryOtpInput, setRecoveryOtpInput] = useState('');
  const [emailRecoveryStep, setEmailRecoveryStep] = useState(1); 
  const [isEmailRecovering, setIsEmailRecovering] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0); 
  
  const [rawEmail, setRawEmail] = useState(''); 
  const [maskedEmail, setMaskedEmail] = useState(''); 
  const [isTestingMail, setIsTestingMail] = useState(false); 

  const [securityState, setSecurityState] = useState({ attemptCount: 0, blockUntil: 0 });
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);
  
  const [smartErrorVisible, setSmartErrorVisible] = useState(false);
  const [smartErrorMessage, setSmartErrorMessage] = useState('');
  const [smartErrorTitle, setSmartErrorTitle] = useState('Error');
  const [smartErrorOptions, setSmartErrorOptions] = useState({ targetModal: null, isLockout: false, isMissingHash: false });
  
  const errorScale = useRef(new Animated.Value(0.9)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const lockWasOnRef = useRef(false);

  const toastTranslateY = useRef(new Animated.Value(100)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [toastData, setToastData] = useState({ visible: false, message: '', icon: 'check-circle', color: primaryColor });

  const [resetStep, setResetStep] = useState(0); 
  const [isWiping, setIsWiping] = useState(false);
  const [wipeStatusText, setWipeStatusText] = useState('');
  const successAnim = useRef(new Animated.Value(0)).current;

  // Masking Helper Function
  const maskEmailString = (emailStr) => {
    if (!emailStr) return '';
    const parts = emailStr.split('@');
    if (parts.length === 2 && parts[0].length >= 3) {
  return `${parts[0].substring(0, 3)}****@${parts[1]}`;
}
    return emailStr;
  };

  const showToast = (message, icon = 'check-circle', color = primaryColor) => {
    setToastData({ visible: true, message, icon, color });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  const triggerErrorShake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start(); 
  };

  const showSmartError = (title, message, options = { targetModal: null, isLockout: false, isMissingHash: false }) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    if (options.targetModal === 'PIN') setPinModal(false);
    if (options.targetModal === 'FAKE_PIN') setFakePinModal(false);
    if (options.targetModal === 'CREATE_RECOVERY') setCreateRecoveryModal(false);
    if (options.targetModal === 'IMPORT') setImportModal(false);
    if (options.targetModal === 'EMAIL_OTP') setEmailRecoveryModal(false);

    setSmartErrorTitle(title);
    setSmartErrorMessage(message);
    setSmartErrorOptions(options);
    setSmartErrorVisible(true);
    Animated.spring(errorScale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
  };

  const closeSmartError = () => {
    Animated.timing(errorScale, { toValue: 0.8, duration: 150, useNativeDriver: true }).start(() => {
      setSmartErrorVisible(false);
      errorScale.setValue(0.9);
      const modal = smartErrorOptions.targetModal;
      if (modal === 'PIN') setTimeout(() => setPinModal(true), 150);
      if (modal === 'FAKE_PIN') setTimeout(() => setFakePinModal(true), 150);
      if (modal === 'CREATE_RECOVERY') setTimeout(() => setCreateRecoveryModal(true), 150);
      if (modal === 'IMPORT') setTimeout(() => setImportModal(true), 150);
      if (modal === 'EMAIL_OTP') setTimeout(() => setEmailRecoveryModal(true), 150);
    });
  };

  useFocusEffect(useCallback(() => { loadAllData(); global.activeFlow = 'NORMAL'; global.ignoreAppLock = false; }, []));
  useEffect(() => { return () => { restoreLockStateSafe(); }; }, []);
  useEffect(() => { let interval; if (otpCooldown > 0) interval = setInterval(() => { setOtpCooldown((prev) => prev - 1); }, 1000); return () => clearInterval(interval); }, [otpCooldown]);

  useEffect(() => { setLivePreviewColor(themeColors.primary); }, [themeColors.primary]);

  useEffect(() => {
    if (importStep === 'OTP' && importOtp.length === 6 && !isImportLoading) handleVerifyImportOTP();
  }, [importOtp]);

  useEffect(() => {
    let interval;
    if (securityState.blockUntil > 0) {
      interval = setInterval(() => {
        const now = Date.now();
        const left = Math.ceil((securityState.blockUntil - now) / 1000);
        if (left <= 0) {
          clearInterval(interval); setLockoutTimeLeft(0); clearSecurityState().then(() => setSecurityState({ attemptCount: 0, blockUntil: 0 }));
          if(smartErrorVisible && smartErrorOptions.isLockout) closeSmartError();
        } else { setLockoutTimeLeft(left); }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [securityState.blockUntil, smartErrorVisible]);

  useEffect(() => {
    let score = 20; 
    if (settings?.fakePinEnabled || fakePinStatus !== 'unverified') score += 20;
    if (emailStatus === 'verified') score += 20;
    if (recoveryCodeState) score += 20;
    if (settings?.blockScreenshots) score += 20;

    if (score > 100) score = 100;
    setSecurityScore(score);
    
    const radius = 24;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    
    Animated.spring(strokeDashoffset, { toValue: offset, friction: 8, tension: 40, useNativeDriver: false }).start();
  }, [settings, emailStatus, fakePinStatus, recoveryCodeState]);

  const loadAllData = async () => {
    const s = await getSettings(); 
    const defaultSettings = { 
      blurRecents: true, motionEffects: true, autoLockTimer: '2 min',
      hidePasswords: false, blockScreenshots: false, autoBackupReset: true, backupChecksum: true
    };
    setSettings(s ? { ...defaultSettings, ...s } : defaultSettings);
    
    const mode = await getSessionMode(); setIsLimited(mode === 'LIMITED');
    const profile = await getLockProfile(); setLockProfileState(profile);
    if (s?.autoColorMode) setAutoColorMode(true);

    let email = await getRecoveryEmail();
    if (!email) email = await AsyncStorage.getItem('SAFEGALLERY_RECOVERY_EMAIL');
    if (!email) email = await AsyncStorage.getItem('RECOVERY_EMAIL');

    let verifiedStr = await AsyncStorage.getItem('SAFEGALLERY_EMAIL_VERIFIED');
    if (!verifiedStr) verifiedStr = await AsyncStorage.getItem('EMAIL_VERIFIED');
    let isVerified = (verifiedStr === 'true');

    if (isVerified && email) {
      setEmailStatus('verified');
      email = email.replace(/['"]+/g, '').trim(); 
      setRawEmail(email); 
      setMaskedEmail(maskEmailString(email));
    } 
    else if (email) setEmailStatus('pending'); 
    else setEmailStatus('unverified');
    
    const fPin = await getFakePin(); setFakePinStatus(fPin ? 'verified' : 'unverified');
    const secState = await getSecurityState(); setSecurityState(secState);
    const history = await getColorHistory(); setRecentColors(history);
    const code = await getRecoveryCode(); setRecoveryCodeState(code || '');

    if (s?.blockScreenshots) await ScreenCapture.preventScreenCaptureAsync(); else await ScreenCapture.allowScreenCaptureAsync();
  };

  const handleToggle = async (key, value) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettings(prev => ({ ...prev, [key]: value }));
    await updateSetting(key, value);
    
    if (key === 'darkMode') {
      if (typeof toggleTheme === 'function') toggleTheme(value); 
    }

    if (key === 'blockScreenshots') {
       value ? await ScreenCapture.preventScreenCaptureAsync() : await ScreenCapture.allowScreenCaptureAsync();
       showToast(`Screenshots ${value ? 'Blocked' : 'Allowed'}`, value ? 'shield' : 'smartphone');
       await logActivity('Settings', 'Privacy Changed', `Block screenshots set to ${value}`, 'INFO');
    }
  };

  const handleTriggerTestMail = async () => {
    if (emailStatus !== 'verified' || !rawEmail) {
      showToast('No verified email found.', 'alert-triangle', '#EF4444'); return;
    }
    setIsTestingMail(true);
    const result = await sendPremiumTestMail(rawEmail);
    setIsTestingMail(false);

    if (result.success) {
      showToast('Recovery mail operational. Mail sent!', 'send', '#10B981');
      await logActivity('Security', 'Mail Tested', 'Premium test mail sent successfully.', 'INFO');
    } else {
      showToast('Recovery mail test failed.', 'alert-circle', '#EF4444');
    }
  };

  const openColorPicker = () => { 
    setLivePreviewColor(themeColors.primary); 
    setLivePreviewName(accentName || 'Custom'); 
    setCustomHex(themeColors.primary); 
    setShowCustomPicker(false); 
    setColorPickerModal(true); 
  };
  
  const selectPreviewColor = (colorObj) => {
    Haptics.selectionAsync(); let finalColor = colorObj.hex;
    if (isDark && ['#FFF7CC', '#E9E5FF', '#E3F2FD', '#E6F7EC', '#FCE7F3'].includes(finalColor)) { finalColor = colorObj.text || finalColor; }
    setLivePreviewColor(finalColor); setLivePreviewName(colorObj.name); setCustomHex(finalColor); 
  };

  const handleSystemDefault = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setAutoColorMode(false); await handleToggle('autoColorMode', false);
    selectPreviewColor({ hex: '#6C5CE7', name: 'System Default' });
  };

  const handleHexInput = (text) => {
    let formatted = text.replace(/[^0-9A-Fa-f#]/g, '').toUpperCase();
    if (!formatted.startsWith('#')) formatted = '#' + formatted.replace(/#/g, '');
    if (formatted.length > 7) formatted = formatted.substring(0, 7);
    setCustomHex(formatted);
    if (formatted.length === 7 && /^#([0-9A-F]{6})$/i.test(formatted)) { selectPreviewColor({ hex: formatted, name: 'Custom HEX' }); }
  };

  const handleHueTouch = (e) => {
    let x = Math.max(0, Math.min(e.nativeEvent.locationX, hueBarWidth));
    const h = (x / hueBarWidth) * 360;
    setCurrentHue(h);
    const newHex = hslToHex(h, 100, 50);
    setCustomHex(newHex);
    setLivePreviewColor(newHex);
    setLivePreviewName('Custom Hue');
  };

  const handleTimeBasedToggle = async (val) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setAutoColorMode(val); await handleToggle('autoColorMode', val);
    if (val) {
       const hr = new Date().getHours(); let newColor = '#6366F1'; let cName = 'Night Mode';
       if (hr >= 6 && hr < 12) { newColor = '#1E88E5'; cName = 'Morning Blue'; }
       else if (hr >= 12 && hr < 17) { newColor = '#0D9488'; cName = 'Afternoon Teal'; }
       else if (hr >= 17 && hr < 20) { newColor = '#F97316'; cName = 'Evening Orange'; }
       setLivePreviewColor(newColor); setLivePreviewName(cName); setCustomHex(newColor);
    }
  };

  const applySelectedTheme = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await changeAccentColor(livePreviewName, livePreviewColor);
      try {
        const newHistory = await saveColorHistory(livePreviewColor);
        if (newHistory) setRecentColors(newHistory);
      } catch (e) {}
      setColorPickerModal(false);
      showToast(`Theme changed to ${livePreviewName}`, 'aperture', livePreviewColor);
    } catch (error) { setColorPickerModal(false); }
  };

  const handleLockProfileChange = async (mode) => {
    if (mode === 'BIO_OR_PIN' || mode === 'DUAL') {
      const hasHardware = await LocalAuthentication.hasHardwareAsync(); const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) return showSmartError("Not Supported", "No Biometric hardware found on this device.");
      const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Authenticate to verify setup', fallbackLabel: 'Use PIN' });
      if (!auth.success) return;
    }
    await saveLockProfile(mode); setLockProfileState(mode); setLockProfileModal(false);
    showToast('Security Profile Updated', 'shield');
  };
  const getProfileDisplayName = (mode) => mode === 'PIN' ? 'PIN Only' : mode === 'DUAL' ? 'Dual Mode (PIN + Bio)' : 'Biometric or PIN';

  const openFakePinMenu = () => fakePinStatus === 'verified' ? setFakePinActionModal(true) : setFakePinModal(true); 
  const disableFakePin = async () => { 
    await saveFakePin(''); setFakePinStatus('unverified'); setFakePinActionModal(false); 
    showToast('Decoy Mode Disabled', 'x-circle', '#EF4444');
  };

  const openRecoveryCode = async () => { let code = await getRecoveryCode(); if (!code) { setCustomRecoveryCode(''); setCreateRecoveryModal(true); } else { setRecoveryCodeState(code); setRecoveryModal(true); } };
  const saveCustomRecoveryCode = async () => {
    if (!/^\d{4,6}$/.test(customRecoveryCode)) return showSmartError("Invalid", "Recovery code must be 4 to 6 digits numeric.", {targetModal: 'CREATE_RECOVERY'});
    await saveRecoveryCode(customRecoveryCode); 
    setCreateRecoveryModal(false); setRecoveryCodeState(customRecoveryCode); setRecoveryModal(true); 
  };
  const copyCode = async () => { 
    await Clipboard.setStringAsync(recoveryCodeState); 
    showToast('Code Copied Securely', 'copy'); 
  };

  const restoreLockStateSafe = async () => { 
    if (lockWasOnRef.current) { await updateSetting('lockOnExit', true); const s = await getSettings(); setSettings(s); lockWasOnRef.current = false; } 
    global.activeFlow = 'NORMAL'; global.ignoreAppLock = false; global.isAuthenticating = false;
  };

  // 🔥 BACKUP FLOW: EXPORT
  const handleExportPreCheck = async () => {
    if (isLimited) return showSmartError("Action Disabled", "Export is disabled in Limited Access Mode.");
    const isEmailVerified = await getEmailVerified(); if (!isEmailVerified) return setShowEmailRequiredModal(true);
    const s = await getSettings(); setPendingAction('EXPORT'); 
    if (s?.lockOnExit && !lockWasOnRef.current) setShowImportWarning(true); else setExportModal(true); 
  };

  const startSecureExport = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync(); const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) { 
        const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Verify identity to Export Backup', fallbackLabel: 'Use PIN' }); 
        if (!auth.success) return; 
      }
      await executeExportCore();
    } catch(e) { setExportModal(false); showSmartError("Export Failed", "Something went wrong."); }
  };

  const executeExportCore = async () => {
    try {
      setIsExporting(true); setExportProgress(0); global.activeFlow = 'IMPORT_FLOW'; 
      const result = await exportBackup("Created from Settings", false, (val) => setExportProgress(val));
      setIsExporting(false); setExportProgress(0); setExportModal(false); setTimeout(() => { global.activeFlow = 'NORMAL'; }, 1000);
      if (result.success) { 
        await updateSetting('lastExportDate', new Date().toISOString()); loadAllData(); showToast("Backup Created Fast!", "check-circle", primaryColor);
      } else if (!result.cancelled) { showSmartError("Export Failed", result.message); }
    } catch (e) { setIsExporting(false); setExportModal(false); global.activeFlow = 'NORMAL'; showSmartError("Export Failed", "Something went wrong."); }
  };

  // 🔥 BACKUP FLOW: IMPORT
  const handleImportPreCheck = async () => { const s = await getSettings(); setPendingAction('IMPORT'); if (s?.lockOnExit && !lockWasOnRef.current) setShowImportWarning(true); else executeFilePick(); };
  const handleDisableAndContinueFlow = async () => { 
    await updateSetting('lockOnExit', false); const s = await getSettings(); setSettings(s); lockWasOnRef.current = true; setShowImportWarning(false); 
    if (pendingAction === 'EXPORT') setExportModal(true); else if (pendingAction === 'RESET') setResetStep(1); else executeFilePick();  
  };

  const executeFilePick = async () => {
    try {
      global.activeFlow = 'IMPORT_FLOW'; 
      setIsAnalyzing(true); setAnalyzerStepText('Checking backup format...');
      const result = await pickAndAnalyzeBackup();
      
      if (result.success) { 
        setBackupFileObj(result.data); 
        setImportOtp('');
        
        if (result.data.linkedEmail) {
            setImportLinkedEmail(result.data.linkedEmail);
            setMaskedImportEmail(maskEmailString(result.data.linkedEmail));
            setImportStep('INFO');
        } else {
            setImportLinkedEmail(null);
            setMaskedImportEmail(null);
            setImportStep('INFO');
        }
        
        await new Promise(resolve => setTimeout(resolve, 800)); 
        setIsAnalyzing(false); 
        setImportModal(true); 
      } else { 
        setIsAnalyzing(false); await restoreLockStateSafe(); 
        if (!result.cancelled) { showSmartError("Corrupted Backup", result.message || "Invalid file selected."); }
      }
    } catch (error) {
      setIsAnalyzing(false); await restoreLockStateSafe(); showSmartError("Import Error", "Unable to open the file.");
    }
  };

  const handleSendImportOTP = async () => {
    if (!importLinkedEmail) return;
    setIsImportLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: importLinkedEmail, otpType: 'VERIFY_EMAIL' })
      });
      const data = await res.json();
      setIsImportLoading(false);
      
      if (data.success) {
        setImportStep('OTP');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => importOtpInputRef.current?.focus(), 500);
      } else {
        Alert.alert('Error', data.message);
      }
    } catch (e) {
      setIsImportLoading(false);
      Alert.alert('Network Error', 'Ensure backend is running.');
    }
  };

  const handleVerifyImportOTP = async () => {
    Keyboard.dismiss(); setIsImportLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: importLinkedEmail, otp: importOtp })
      });
      const data = await res.json();
      setIsImportLoading(false);
      
      if (data.success) { 
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); 
        executeDecryption(); 
      } else { 
        setImportOtp(''); triggerErrorShake(); setTimeout(() => importOtpInputRef.current?.focus(), 500); 
      }
    } catch (e) { setIsImportLoading(false); setImportOtp(''); triggerErrorShake(); }
  };

  const executeDecryption = async () => {
    setImportStep('IMPORTING'); setImportProgress(0);
    const result = await processImportDecryption(backupFileObj, '', (val) => setImportProgress(val));
    setImportProgress(0);
    if (result.success) { 
      setImportModal(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setShowRestartModal(true); 
    } else { 
      setImportModal(false); showSmartError("Restore Failed", result.message || "Failed to load data.", {targetModal: null}); 
    }
  };

  const handleResetPreCheck = async () => {
    if (emailStatus !== 'verified') {
      return showSmartError("Email Required", "You must link a recovery email before resetting to ensure a secure backup can be sent.");
    }
    const s = await getSettings(); setPendingAction('RESET');
    if (s?.lockOnExit && !lockWasOnRef.current) { setShowImportWarning(true); } else { setResetStep(1); }
  };

  const executePremiumWipe = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync(); 
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (hasHardware && isEnrolled) {
      const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Verify identity to permanently DESTROY Vault', fallbackLabel: 'Use Device PIN' });
      if (!auth.success) { return showToast("Wipe Cancelled", "x-circle", "#EF4444"); }
    }
    setIsWiping(true); setResetStep(2); setWipeStatusText('Erasing device data...'); 
    try {
      await clearAllData();
      setIsWiping(false); setResetStep(3); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.spring(successAnim, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }).start();
    } catch (e) { 
      setIsWiping(false); setResetStep(0); showSmartError("Wipe Failed", "Something went wrong during the secure wipe process."); 
    }
  };

  const SettingRow = ({ icon, title, subtitle, type = 'chevron', value, onPress, state, onToggle, theme = 'security', isLast, isDangerBox, disableInLimited = false, requiredBadge = false, isLoading = false }) => {
    const bgIconColor = primaryColor + '20'; 
    const iconColor = primaryColor;          
    const handlePress = () => {
      if (isLoading) return;
      if (isLimited && disableInLimited) {
        showToast("Disabled in Decoy Mode", "shield-off", themeColors.danger); return;
      }
      if (type === 'toggle' && onToggle) onToggle(!state); else if(onPress) onPress();
    };
    return (
      <TouchableOpacity 
        style={[styles.row, !isLast && { borderBottomColor: isDark ? '#334155' : '#F1F5F9', borderBottomWidth: 1 }, isDangerBox && [styles.dangerBox, isDark && { backgroundColor: '#3D2A2A', borderColor: '#FF4D4D' }], (isLimited && disableInLimited) && { opacity: 0.4 }]} 
        activeOpacity={(isLimited && disableInLimited) || type==='toggle' ? 1 : 0.7} 
        onPress={handlePress}
      >
        <View style={styles.rowLeft}>
          <View style={[styles.iconBox, { backgroundColor: bgIconColor }]}><Feather name={icon} size={22} color={iconColor} /></View>
          <View style={{ flex: 1, paddingRight: 10, justifyContent: 'center' }}>
            <Text style={[styles.rowTitle, { color: themeColors.textDark }, isDangerBox && { color: '#EF4444' }]} numberOfLines={1}>{title}</Text>
            {subtitle && <Text style={[styles.rowSub, { color: themeColors.textLight }]} numberOfLines={1}>{subtitle}</Text>}
          </View>
        </View>
        <View style={styles.rowRight}>
          {isLoading ? (
            <ActivityIndicator size="small" color={iconColor} />
          ) : (
            <>
              {requiredBadge && <View style={[styles.badge, { backgroundColor: '#10B981' + '20' }]}><Text style={[styles.badgeText, { color: '#10B981' }]}>Required</Text></View>}
              {value === 'verified' && !requiredBadge && <View style={[styles.badge, { backgroundColor: isDark ? '#1C3A2D' : '#EAFBF3' }]}><Text style={[styles.badgeText, { color: '#2ECC71' }]}>Set</Text></View>}
              {value === 'unverified' && !requiredBadge && <View style={[styles.badge, { backgroundColor: isDark ? '#3D2A2A' : '#FFEAEA' }]}><Text style={[styles.badgeText, { color: '#EF4444' }]}>Not set</Text></View>}
              {value === 'pending' && !requiredBadge && <View style={[styles.badge, { backgroundColor: isDark ? '#3D311C' : '#FFF4EA' }]}><Text style={[styles.badgeText, { color: '#F39C12' }]}>Verify</Text></View>}
              {value === 'Active' && !requiredBadge && <View style={[styles.badge, { backgroundColor: isDark ? '#1C3A2D' : '#EAFBF3' }]}><Text style={[styles.badgeText, { color: '#2ECC71' }]}>Active</Text></View>}
              {typeof value === 'string' && !['verified','unverified','pending','Active'].includes(value) && <Text style={[styles.rowValue, { color: themeColors.textLight }]}>{value}</Text>}
              {type === 'chevron' && <Feather name="chevron-right" size={20} color={isDark ? '#475569' : '#CBD5E1'} />}
              {type === 'toggle' && <Switch trackColor={{ false: isDark ? "#3D3D5C" : "#E2E8F0", true: primaryColor + "80" }} thumbColor={state ? primaryColor : (isDark ? "#8A8FA3" : "#FFFFFF")} onValueChange={handlePress} value={!!state} disabled={isLimited && disableInLimited} style={{ transform: [{ scale: 0.9 }] }} />}
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (!settings) return null;
  const headerOpacity = scrollY.interpolate({ inputRange: [140, 180], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View key={primaryColor} style={[styles.containerMain, { backgroundColor: isDark ? themeColors.background : '#F8FAFC' }]}>
      
      {toastData.visible && (
        <Animated.View style={[styles.premiumToast, { transform: [{ translateY: toastTranslateY }], opacity: toastOpacity }]} pointerEvents="none">
           <Feather name={toastData.icon} size={18} color={toastData.color} style={{marginRight: 8}} />
           <Text style={styles.smartToastText}>{toastData.message}</Text>
        </Animated.View>
      )}

      {smartErrorVisible && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 99999, elevation: 99999 }]}>
          <View style={styles.alertOverlayBg}>
            <Animated.View style={[styles.smartErrorCard, { backgroundColor: themeColors.card, transform: [{ scale: errorScale }] }]}>
              <View style={[styles.errorIconCircle, { backgroundColor: '#FEF2F2' }]}><Feather name="alert-triangle" size={32} color="#EF4444" /></View>
              <Text style={[styles.errorTitle, { color: themeColors.textDark }]}>{smartErrorTitle}</Text>
              <Text style={[styles.errorDesc, { color: themeColors.textLight }]}>{smartErrorMessage}</Text>
              {smartErrorOptions.isLockout && <Text style={[styles.timerTextDisplay, { color: themeColors.primary }]}>Try again in {lockoutTimeLeft}s</Text>}
              <View style={styles.errorActions}>
                <TouchableOpacity style={[styles.errorBtnPrimary, { backgroundColor: primaryColor }]} activeOpacity={0.8} onPress={closeSmartError} disabled={smartErrorOptions.isLockout && lockoutTimeLeft > 0}>
                  <View style={styles.errorBtnPrimaryGradient}><Text style={styles.errorBtnTryText}>{smartErrorOptions.isLockout ? (lockoutTimeLeft > 0 ? "Locked" : "Try Again") : "Got it"}</Text></View>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </View>
      )}

      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top, opacity: headerOpacity, backgroundColor: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)' }]}>
        <BlurView intensity={40} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <View style={styles.stickyHeaderContent}>
           <Text style={[styles.stickyTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Settings</Text>
           <View style={[styles.miniScorePill, { backgroundColor: securityScore > 80 ? '#10B981' + '20' : '#F59E0B' + '20' }]}>
              <Text style={{color: securityScore > 80 ? '#10B981' : '#F59E0B', fontWeight: '800', fontSize: 12}}>{securityScore}% Secure</Text>
           </View>
        </View>
      </Animated.View>

      <Animated.ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 60 }]} 
        showsVerticalScrollIndicator={false} bounces={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <Text style={[styles.headerTitleMain, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Settings</Text>

        <TouchableOpacity style={[styles.heroCard, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]} onPress={() => setBreakdownModal(true)}>
           <View style={styles.heroLeft}>
              <View style={{ width: 56, height: 56, justifyContent: 'center', alignItems: 'center' }}>
                 <Svg width="56" height="56" viewBox="0 0 56 56" style={{ position: 'absolute' }}>
                   <Circle cx="28" cy="28" r="24" stroke={isDark ? '#334155' : '#E2E8F0'} strokeWidth="4" fill="none" />
                   <AnimatedCircle 
                     cx="28" cy="28" r="24" stroke={securityScore > 80 ? '#10B981' : '#F59E0B'} strokeWidth="4" fill="none" 
                     strokeDasharray={`${2 * Math.PI * 24}`} strokeDashoffset={strokeDashoffset} strokeLinecap="round" 
                     originX="28" originY="28" rotation="-90"
                   />
                 </Svg>
                 <Text style={[styles.scoreRingText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{securityScore}</Text>
              </View>
              <View style={styles.heroTextContainer}>
                 <Text style={[styles.heroScoreText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{securityScore}/100 Score</Text>
                 <Text style={[styles.heroSubText, { color: securityScore > 80 ? '#10B981' : '#F59E0B' }]}>{securityScore > 80 ? 'Strong protection enabled' : 'Action recommended'}</Text>
              </View>
           </View>
           <Feather name="chevron-right" size={20} color={isDark ? '#475569' : '#CBD5E1'} />
        </TouchableOpacity>

        {securityScore < 100 && (
          <View style={[styles.wizardCard, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
            <Text style={[styles.wizardTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Setup Completion</Text>
            <View style={styles.wizardProgressBg}>
               <Animated.View style={[styles.wizardProgressFill, { backgroundColor: primaryColor, width: `${securityScore}%` }]} />
            </View>
            <View style={styles.wizardStepsRow}>
               <View style={styles.wizardStep}><Feather name="check-circle" size={14} color="#10B981" /><Text style={[styles.wizardStepText, {color: '#10B981'}]}>Master PIN</Text></View>
               <View style={styles.wizardStep}><Feather name={emailStatus==='verified' ? "check-circle" : "circle"} size={14} color={emailStatus==='verified' ? "#10B981" : "#94A3B8"} /><Text style={[styles.wizardStepText, {color: emailStatus==='verified' ? '#10B981' : '#94A3B8'}]}>Email</Text></View>
               <View style={styles.wizardStep}><Feather name={recoveryCodeState ? "check-circle" : "circle"} size={14} color={recoveryCodeState ? "#10B981" : "#94A3B8"} /><Text style={[styles.wizardStepText, {color: recoveryCodeState ? '#10B981' : '#94A3B8'}]}>Code</Text></View>
               <View style={styles.wizardStep}><Feather name={fakePinStatus==='verified' ? "check-circle" : "circle"} size={14} color={fakePinStatus==='verified' ? "#10B981" : "#94A3B8"} /><Text style={[styles.wizardStepText, {color: fakePinStatus==='verified' ? '#10B981' : '#94A3B8'}]}>Decoy</Text></View>
            </View>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: themeColors.textLight }]}>SECURITY CONTROLS</Text>
        <View style={[styles.card, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
          <SettingRow disableInLimited theme="security" icon="shield" title="App Lock Profile" value={getProfileDisplayName(lockProfileState)} onPress={() => setLockProfileModal(true)} />
          <SettingRow disableInLimited theme="security" icon="key" title="Change Master PIN" onPress={() => setPinModal(true)} />
          <SettingRow disableInLimited theme="security" icon="file-text" title="Recovery Code" onPress={openRecoveryCode} />
          <SettingRow disableInLimited theme="security" icon="user-x" title="Fake PIN (Decoy)" value={fakePinStatus} onPress={openFakePinMenu} />
          <SettingRow disableInLimited theme="security" icon="activity" title="Activity Log" onPress={() => navigation.navigate('ActivityLog')} isLast />
        </View>

        <Text style={[styles.sectionTitle, { color: themeColors.textLight }]}>RECOVERY IDENTITY</Text>
        <View style={[styles.card, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
          <SettingRow disableInLimited theme="email" icon="mail" title="Update Email" value={emailStatus} onPress={() => navigation.navigate('EmailSetup')} />
          <SettingRow disableInLimited theme="email" icon="check-circle" title="Enable Email Recovery" requiredBadge isLast={emailStatus !== 'verified'} />
          {emailStatus === 'verified' && (
            <>
              <SettingRow disableInLimited theme="email" icon="send" title="Test Recovery Mail" onPress={handleTriggerTestMail} isLoading={isTestingMail} />
              <SettingRow disableInLimited theme="email" icon="inbox" title="Backup Destination Mail" subtitle={maskedEmail} type="none" />
              <SettingRow disableInLimited theme="email" icon="alert-triangle" title="Emergency Wipe Mail" subtitle={maskedEmail} type="none" isLast />
            </>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: themeColors.textLight }]}>PRIVACY</Text>
        <View style={[styles.card, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
          <SettingRow theme="privacy" icon="eye-off" title="Hide passwords by default" type="toggle" state={settings.hidePasswords} onToggle={(v) => handleToggle('hidePasswords', v)} />
          <SettingRow theme="privacy" icon="smartphone" title="Block screenshots" type="toggle" state={settings.blockScreenshots} onToggle={(v) => handleToggle('blockScreenshots', v)} isLast={!showAllPrivacy} />
          {showAllPrivacy && (
            <>
              <SettingRow theme="privacy" icon="layers" title="Blur app in recents" type="toggle" state={settings.blurRecents || true} onToggle={(v) => handleToggle('blurRecents', v)} />
              <SettingRow theme="privacy" icon="clipboard" title="Clipboard auto-clear" type="toggle" state={settings.clipboardClear || true} onToggle={(v) => handleToggle('clipboardClear', v)} />
              <SettingRow theme="privacy" icon="bell-off" title="Hide sensitive notifications" type="toggle" state={settings.hideNotifs || true} onToggle={(v) => handleToggle('hideNotifs', v)} isLast />
            </>
          )}
          <TouchableOpacity style={[styles.expandBtn, { borderTopColor: isDark ? '#334155' : '#F1F5F9' }]} onPress={() => setShowAllPrivacy(!showAllPrivacy)}>
             <Text style={[styles.expandBtnText, { color: primaryColor }]}>{showAllPrivacy ? 'Show less' : 'Show 3 more'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: themeColors.textLight }]}>DATA & BACKUP</Text>
        <View style={[styles.card, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
          <SettingRow disableInLimited theme="data" icon="upload-cloud" title="Export Backup" onPress={handleExportPreCheck} />
          <SettingRow disableInLimited theme="data" icon="download-cloud" title="Restore Backup" onPress={handleImportPreCheck} />
          <SettingRow disableInLimited theme="data" icon="refresh-cw" title="Auto backup on reset" type="toggle" state={settings.autoBackupReset || true} onToggle={(v) => handleToggle('autoBackupReset', v)} />
          <SettingRow disableInLimited theme="data" icon="check-square" title="Backup verification checksum" type="toggle" state={settings.backupChecksum || true} onToggle={(v) => handleToggle('backupChecksum', v)} />
          <View style={{flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14}}><Text style={{color: themeColors.textDark, fontWeight: '600'}}>Last backup</Text><Text style={{color: themeColors.textLight, fontSize: 13}}>{settings?.lastExportDate ? new Date(settings.lastExportDate).toLocaleString() : 'Never'}</Text></View>
        </View>

        <Text style={[styles.sectionTitle, { color: themeColors.textLight }]}>APPEARANCE & DEVICE</Text>
        <View style={[styles.card, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
          <SettingRow theme="appearance" icon="moon" title="Dark mode" type="toggle" state={isDark} onToggle={(v) => handleToggle('darkMode', v)} />
          <SettingRow theme="appearance" icon="aperture" title="Accent color" subtitle={accentName || 'System Default'} onPress={openColorPicker} />
          <SettingRow theme="appearance" icon="wind" title="Motion effects" type="toggle" state={true} />
          <SettingRow theme="about" icon="user" title="Developer" onPress={() => navigation.navigate('Developer')} isLast />
        </View>

        <Text style={[styles.sectionTitle, { color: themeColors.textLight }]}>SESSION & DANGER ZONE</Text>
        <View style={[styles.card, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
          <SettingRow theme="security" icon="lock" title="Lock App Now" onPress={async () => { await logActivity('Security', 'Manual Lock', 'User manually locked the app', 'INFO'); navigation.replace('Lock'); }} />
          <SettingRow theme="security" icon="clock" title="Auto-lock timer" value={settings.autoLockTimer} onPress={() => setTimerModal(true)} isLast />
        </View>

        <TouchableOpacity style={[styles.dangerCard, { backgroundColor: isDark ? '#2D1616' : '#FEF2F2' }]} onPress={handleResetPreCheck}>
          <Feather name="trash-2" size={24} color="#EF4444" style={{marginRight: 16}} />
          <View>
             <Text style={{color: '#EF4444', fontSize: 18, fontWeight: '800'}}>Reset & Wipe Vault</Text>
             <Text style={{color: isDark ? '#FCA5A5' : '#B91C1C', fontSize: 13, marginTop: 2}}>Permanently destroy all local data</Text>
          </View>
        </TouchableOpacity>

      </Animated.ScrollView>

      {/* MODALS */}
      <Modal hardwareAccelerated={true} statusBarTranslucent={true} visible={exportModal} animationType="fade" transparent={true}>
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.alertOverlayBg}>
            <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
              <View style={{width: 64, height: 64, borderRadius: 32, backgroundColor: themeColors.inputBg, justifyContent: 'center', alignItems: 'center', marginBottom: 16}}><Feather name="upload-cloud" size={32} color={themeColors.primary} /></View>
              <Text style={[styles.modalTitle, { color: themeColors.textDark }]}>Export Backup</Text>
              
              <View style={{backgroundColor: themeColors.inputBg, padding: 16, borderRadius: 16, marginBottom: 20, width: '100%'}}>
                 <Text style={{fontSize: 13, color: themeColors.textDark, textAlign: 'center', lineHeight: 20}}>
                   Your backup will be heavily encrypted and securely locked to your registered email:
                 </Text>
                 <Text style={{fontSize: 15, fontWeight: '800', color: themeColors.primary, textAlign: 'center', marginTop: 10}}>
                   📧 {maskedEmail}
                 </Text>
                 <Text style={{fontSize: 12, color: themeColors.textLight, textAlign: 'center', marginTop: 10}}>
                   You will need access to this email to restore the backup on any device.
                 </Text>
              </View>

              {isExporting ? (
                 <View style={{width: '100%', marginBottom: 16}}>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8}}>
                       <Text style={{color: themeColors.textDark, fontWeight: '700'}}>{exportProgress > 60 ? 'Packing Files...' : 'Encrypting Data...'}</Text>
                       <Text style={{color: themeColors.primary, fontWeight: '800'}}>{exportProgress}%</Text>
                    </View>
                    <View style={{width: '100%', height: 10, backgroundColor: themeColors.inputBg, borderRadius: 100, overflow: 'hidden'}}><Animated.View style={{width: `${exportProgress}%`, height: '100%', backgroundColor: themeColors.primary, borderRadius: 100}} /></View>
                 </View>
              ) : (
                <TouchableOpacity style={{width: '100%', height: 56, backgroundColor: themeColors.primary, borderRadius: 100, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12}} onPress={startSecureExport}>
                  <Feather name="lock" size={16} color="#FFF" style={{marginRight: 8}} /><Text style={{color: '#FFF', fontSize: 16, fontWeight: 'bold'}}>Create Secure Backup</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={{width: '100%', height: 50, backgroundColor: 'transparent', borderRadius: 100, justifyContent: 'center', alignItems: 'center'}} onPress={() => !isExporting && setExportModal(false)} disabled={isExporting}><Text style={{color: themeColors.textLight, fontSize: 16, fontWeight: '700'}}>Cancel</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* IMPORT BACKUP MODAL (EMAIL OTP FLOW) */}
      {importModal && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]}>
          <View style={StyleSheet.absoluteFill}>
            <View style={styles.alertOverlayBg}>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, width: '100%' }}>
                  <View style={[styles.modalContent, { backgroundColor: themeColors.card, width: '100%' }]}>
                    
                    {importStep === 'INFO' && (
                      <>
                        <View style={{alignItems: 'center', marginBottom: 16}}><Feather name="shield" size={40} color={themeColors.primary} /></View>
                        <Text style={[styles.modalTitle, {textAlign: 'center', color: themeColors.textDark }]}>Encrypted Backup</Text>
                        
                        {importLinkedEmail ? (
                          <View style={{backgroundColor: themeColors.inputBg, padding: 16, borderRadius: 16, marginBottom: 20, width: '100%'}}>
                            <Text style={{fontSize: 13, color: themeColors.textLight, textAlign: 'center', marginBottom: 10}}>
                              This backup is protected and securely locked to the following email address:
                            </Text>
                            <Text style={{fontSize: 15, fontWeight: '800', color: themeColors.textDark, textAlign: 'center'}}>
                              📧 {maskedImportEmail}
                            </Text>
                          </View>
                        ) : (
                          <View style={{backgroundColor: themeColors.inputBg, padding: 16, borderRadius: 16, marginBottom: 20, width: '100%'}}>
                            <Text style={{fontSize: 14, color: themeColors.textDark, fontWeight: 'bold', textAlign: 'center'}}>Legacy Backup Found</Text>
                            <Text style={{fontSize: 13, color: themeColors.textLight, textAlign: 'center', marginTop: 4}}>No email lock detected. Fast restore available.</Text>
                          </View>
                        )}

                        <Text style={{fontSize: 13, color: themeColors.textLight, marginBottom: 20, textAlign: 'center'}}>
                          {importLinkedEmail ? 'To decrypt and restore your data, we need to send a verification OTP to this email.' : 'Click restore to load your direct fast backup.'}
                        </Text>
                        
                        <View style={{flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 10}}>
                          <TouchableOpacity style={[styles.modalBtnCancel, { backgroundColor: themeColors.inputBg }]} onPress={async () => { setImportModal(false); await restoreLockStateSafe(); }}><Text style={{color: themeColors.textLight, fontWeight: '600'}}>Cancel</Text></TouchableOpacity>
                          <TouchableOpacity style={[styles.modalBtnAction, { backgroundColor: themeColors.primary }]} onPress={() => { importLinkedEmail ? handleSendImportOTP() : executeDecryption() }} disabled={isImportLoading}>
                             {isImportLoading ? <ActivityIndicator color="#FFF" /> : <Text style={{color: '#FFF', fontWeight: 'bold'}}>{importLinkedEmail ? 'Send OTP' : 'Restore Data'}</Text>}
                          </TouchableOpacity>
                        </View>
                      </>
                    )}

                    {importStep === 'OTP' && (
                      <Animated.View style={{width: '100%', transform: [{ translateX: shakeAnim }]}}>
                        <View style={{alignItems: 'center', marginBottom: 16}}><Feather name="mail" size={40} color={themeColors.primary} /></View>
                        <Text style={[styles.modalTitle, {textAlign: 'center', color: themeColors.textDark }]}>Verify Identity</Text>
                        <Text style={{fontSize: 14, color: themeColors.textLight, marginBottom: 20, textAlign: 'center'}}>Enter the 6-digit OTP sent to {maskedImportEmail} to unlock your backup.</Text>
                        
                        <SmartInputBox value={importOtp} setValue={setImportOtp} inputRef={importOtpInputRef} isDark={isDark} themeColors={themeColors} isError={false} length={6} />
                        
                        {isImportLoading && <ActivityIndicator color={themeColors.primary} style={{ marginTop: 10, marginBottom: 10 }} />}
                        
                        <View style={{flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 10, marginTop: 10}}>
                          <TouchableOpacity style={[styles.modalBtnCancel, { backgroundColor: themeColors.inputBg }]} onPress={() => setImportStep('INFO')}><Text style={{color: themeColors.textLight, fontWeight: '600'}}>Back</Text></TouchableOpacity>
                          <TouchableOpacity style={[styles.modalBtnAction, { backgroundColor: themeColors.primary }]} onPress={handleVerifyImportOTP} disabled={isImportLoading || importOtp.length < 6}><Text style={{color: '#FFF', fontWeight: 'bold'}}>Verify & Restore</Text></TouchableOpacity>
                        </View>
                      </Animated.View>
                    )}

                    {importStep === 'IMPORTING' && (
                      <View style={{width: '100%', paddingVertical: 20}}>
                         <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8}}>
                            <Text style={{color: themeColors.textDark, fontWeight: '700'}}>{importProgress > 50 ? 'Restoring files...' : 'Loading data...'}</Text>
                            <Text style={{color: themeColors.primary, fontWeight: '800'}}>{importProgress}%</Text>
                         </View>
                         <View style={{width: '100%', height: 10, backgroundColor: themeColors.inputBg, borderRadius: 100, overflow: 'hidden'}}><Animated.View style={{width: `${importProgress}%`, height: '100%', backgroundColor: themeColors.primary, borderRadius: 100}} /></View>
                      </View>
                    )}

                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      <Modal hardwareAccelerated={true} statusBarTranslucent={true} visible={breakdownModal} animationType="fade" transparent={true}>
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.alertOverlayBg}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setBreakdownModal(false)} />
            <View style={[styles.modalContent, { backgroundColor: themeColors.card, width: '100%', padding: 24 }]}>
              <View style={{alignItems: 'center', marginBottom: 12}}><Feather name="pie-chart" size={40} color={primaryColor} /></View>
              <Text style={[styles.modalTitle, { color: themeColors.textDark }]}>Security Breakdown</Text>
              <Text style={{fontSize: 12, color: '#888', marginTop: 2, marginBottom: 10, textAlign: 'center'}}>Tap any item to improve your security</Text>
              
              <View style={{width: '100%'}}>
                <TouchableOpacity style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: themeColors.inputBg}} onPress={() => { setBreakdownModal(false); setTimeout(() => setPinModal(true), 400); }}>
                  <Text style={{fontSize: 15, color: themeColors.textDark, fontWeight: '500'}}>Master PIN Setup</Text>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}><Text style={{fontSize: 13, fontWeight: '600', color: '#16A34A', marginRight: 6}}>Secured</Text><Feather name="check" size={16} color="#16A34A" /></View>
                </TouchableOpacity>
                <TouchableOpacity style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: themeColors.inputBg}} onPress={() => { setBreakdownModal(false); setTimeout(() => { (settings?.fakePinEnabled || fakePinStatus !== 'unverified') ? Alert.alert('Already Set', 'Decoy mode is already configured and active.') : setFakePinModal(true) }, 400); }}>
                  <Text style={{fontSize: 15, color: themeColors.textDark, fontWeight: '500'}}>Decoy Mode</Text>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}><Text style={{fontSize: 13, fontWeight: '600', color: fakePinStatus === 'verified' ? '#16A34A' : primaryColor, marginRight: 6}}>{fakePinStatus === 'verified' ? 'Secured' : 'Set now'}</Text><Feather name={fakePinStatus === 'verified' ? "check" : "chevron-right"} size={16} color={fakePinStatus === 'verified' ? '#16A34A' : primaryColor} /></View>
                </TouchableOpacity>
                <TouchableOpacity style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: themeColors.inputBg}} onPress={() => { setBreakdownModal(false); setTimeout(() => { if(emailStatus === 'verified') { Alert.alert('Already Set', 'Recovery Email is verified and secure.'); } else { navigation.navigate('EmailSetup'); } }, 400); }}>
                  <Text style={{fontSize: 15, color: themeColors.textDark, fontWeight: '500'}}>Recovery Email</Text>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}><Text style={{fontSize: 13, fontWeight: '600', color: emailStatus === 'verified' ? '#16A34A' : primaryColor, marginRight: 6}}>{emailStatus === 'verified' ? 'Secured' : 'Set now'}</Text><Feather name={emailStatus === 'verified' ? "check" : "chevron-right"} size={16} color={emailStatus === 'verified' ? '#16A34A' : primaryColor} /></View>
                </TouchableOpacity>
                <TouchableOpacity style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: themeColors.inputBg}} onPress={() => { setBreakdownModal(false); setTimeout(() => { if(recoveryCodeState) { openRecoveryCode(); } else { setCreateRecoveryModal(true); } }, 400); }}>
                  <Text style={{fontSize: 15, color: themeColors.textDark, fontWeight: '500'}}>Recovery Code</Text>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}><Text style={{fontSize: 13, fontWeight: '600', color: recoveryCodeState ? '#16A34A' : primaryColor, marginRight: 6}}>{recoveryCodeState ? 'Secured' : 'Set now'}</Text><Feather name={recoveryCodeState ? "check" : "chevron-right"} size={16} color={recoveryCodeState ? '#16A34A' : primaryColor} /></View>
                </TouchableOpacity>
                <TouchableOpacity style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16}} onPress={() => { if(!settings?.blockScreenshots) { handleToggle('blockScreenshots', true); } else { setBreakdownModal(false); } }}>
                  <Text style={{fontSize: 15, color: themeColors.textDark, fontWeight: '500'}}>Block Screenshots</Text>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}><Text style={{fontSize: 13, fontWeight: '600', color: settings?.blockScreenshots ? '#16A34A' : primaryColor, marginRight: 6}}>{settings?.blockScreenshots ? 'Secured' : 'Set now'}</Text><Feather name={settings?.blockScreenshots ? "check" : "chevron-right"} size={16} color={settings?.blockScreenshots ? '#16A34A' : primaryColor} /></View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.deviceActionBtn, { backgroundColor: primaryColor, marginTop: 14 }]} onPress={() => setBreakdownModal(false)}><Text style={{color: '#FFF', fontSize: 16, fontWeight: 'bold'}}>Got it</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PREMIUM COLOR PICKER MODAL */}
      <Modal hardwareAccelerated={true} statusBarTranslucent={true} visible={colorPickerModal} animationType="slide" transparent={true}>
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.modalOverlayBottom}>
            <View style={[styles.colorBottomSheet, { backgroundColor: themeColors.card }]}>
              
              <View style={styles.colorHeader}>
                <View>
                  <Text style={[styles.colorModalTitle, { color: themeColors.textDark }]}>Accent Color</Text>
                  <Text style={[styles.colorModalSub, { color: themeColors.textLight }]}>Customize your app theme</Text>
                </View>
                <TouchableOpacity onPress={() => setColorPickerModal(false)} style={styles.colorCloseBtn}>
                  <Feather name="x" size={24} color={themeColors.textDark} />
                </TouchableOpacity>
              </View>

              <View style={{ backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0', zIndex: 10 }}>
                <Text style={{ color: themeColors.textLight, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 16 }}>LIVE PREVIEW</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: livePreviewColor + '20', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                       <Feather name="aperture" size={20} color={livePreviewColor} />
                    </View>
                    <Text style={{ color: themeColors.textDark, fontWeight: '800', fontSize: 16 }}>{livePreviewName}</Text>
                  </View>
                  <Switch trackColor={{ true: livePreviewColor + '80', false: isDark ? '#334155' : '#E2E8F0' }} thumbColor={livePreviewColor} value={true} />
                </View>
                <View style={{ width: '100%', height: 48, borderRadius: 100, backgroundColor: livePreviewColor, justifyContent: 'center', alignItems: 'center', marginTop: 20, shadowColor: livePreviewColor, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}>
                  <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Sample Button</Text>
                </View>
              </View>

              <ScrollView scrollEnabled={!isColorDragging} contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>

                <View style={{ marginBottom: 32, marginTop: 10 }}>
                  <Text style={[styles.colorSectionTitle, { color: themeColors.textLight }]}>CUSTOM HUE</Text>
                  <View 
                    onLayout={(e) => setHueBarWidth(e.nativeEvent.layout.width)}
                    onTouchStart={(e) => { setIsColorDragging(true); handleHueTouch(e); }}
                    onTouchMove={handleHueTouch}
                    onTouchEnd={() => setIsColorDragging(false)}
                    onTouchCancel={() => setIsColorDragging(false)}
                    style={{ height: 40, borderRadius: 100, overflow: 'hidden', borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0', position: 'relative' }}
                  >
                     <LinearGradient colors={['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000']} start={{x:0, y:0}} end={{x:1, y:0}} style={{ flex: 1 }} pointerEvents="none" />
                     <View style={{ position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 5, top: 3, left: (currentHue / 360) * hueBarWidth - 16 }} pointerEvents="none" />
                  </View>
                </View>

                <View style={styles.colorSection}>
                  <Text style={[styles.colorSectionTitle, { color: themeColors.textLight }]}>PREMIUM QUICK SELECT</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 5 }}>
                    {PREMIUM_5.map((c) => {
                      const isSelected = livePreviewColor.toUpperCase() === c.hex.toUpperCase();
                      return (
                        <TouchableOpacity key={c.name} onPress={() => selectPreviewColor({ hex: c.hex, name: c.name })} style={{ alignItems: 'center' }}>
                          <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: c.hex, justifyContent: 'center', alignItems: 'center', borderWidth: isSelected ? 3 : 0, borderColor: isDark ? '#F8FAFC' : '#0F172A', elevation: isSelected ? 6 : 0 }}>
                            {isSelected && <Feather name="check" size={20} color="#FFF" />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {!showCustomPicker ? (
                  <>
                    <View style={styles.colorSection}>
                      <Text style={[styles.colorSectionTitle, { color: themeColors.textLight }]}>SOFT UI COLORS</Text>
                      <View style={[styles.colorGrid, { paddingHorizontal: 0 }]}>
                        {SOFT_COLORS.map((c) => {
                          const isSelected = livePreviewColor === c.hex || livePreviewColor === c.text;
                          return (
                            <Pressable key={c.name} style={({pressed}) => [styles.softColorBlock, { backgroundColor: c.hex }, isSelected && { borderColor: c.text, borderWidth: 2 }, pressed && { transform: [{ scale: 0.94 }] }]} onPress={() => selectPreviewColor({ hex: c.hex, text: c.text, name: c.name })}>
                               <Text style={{color: c.text, fontWeight: '700', fontSize: 14}}>{c.name.split(' ')[1]}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    <View style={styles.colorSection}>
                      <Text style={[styles.colorSectionTitle, { color: themeColors.textLight }]}>PREMIUM GRADIENTS</Text>
                      <View style={styles.gradientGrid}>
                        {GRADIENT_COLORS.map((g) => {
                          const isSelected = livePreviewName === g.name;
                          return (
                            <Pressable key={g.name} style={({pressed}) => [styles.gradientBlock, pressed && { transform: [{ scale: 0.95 }] }]} onPress={() => selectPreviewColor({ hex: g.hex, name: g.name })}>
                              <LinearGradient colors={g.colors} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.gradientFill}>
                                 {isSelected && <Feather name="check-circle" size={24} color="#FFFFFF" style={{position: 'absolute', right: 12, top: 12}} />}
                                 <Text style={styles.gradientText}>{g.name}</Text>
                                 <Text style={styles.gradientSubText}>{g.colors[0]} → {g.colors[1]}</Text>
                              </LinearGradient>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>

                    <TouchableOpacity style={[styles.customPickerBtn, { borderColor: themeColors.separator }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowCustomPicker(true); }}>
                       <Feather name="aperture" size={18} color={themeColors.textDark} />
                       <Text style={{color: themeColors.textDark, fontWeight: '700', marginLeft: 8}}>Open Custom Color Palette</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.colorSection}>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
                      <Text style={[styles.colorSectionTitle, { color: themeColors.textLight, marginBottom: 0 }]}>CUSTOM HEX CODE</Text>
                      <TouchableOpacity onPress={() => setShowCustomPicker(false)}><Text style={{color: themeColors.primary, fontWeight: '700', fontSize: 13}}>Back to Presets</Text></TouchableOpacity>
                    </View>
                    <View style={[styles.hexInputWrapper, { backgroundColor: isDark ? themeColors.inputBg : '#F3F4F6' }]}>
                      <View style={[styles.hexPreviewDot, { backgroundColor: livePreviewColor }]} />
                      <TextInput style={[styles.hexInput, { color: themeColors.textDark }]} value={customHex} onChangeText={handleHexInput} placeholder="#HEXCODE" placeholderTextColor={themeColors.textLight} maxLength={7} autoCapitalize="characters" />
                    </View>
                    <Text style={[styles.colorSectionTitle, { color: themeColors.textLight, marginTop: 24, marginBottom: 12 }]}>EXTENDED PALETTE</Text>
                    <View style={styles.spectrumGrid}>
                      {EXTENDED_PALETTE.map((hx, idx) => {
                        const isSelected = livePreviewColor === hx;
                        return (
                          <View key={idx} style={styles.spectrumBlockWrapper}>
                            <Pressable style={({pressed}) => [styles.spectrumBlock, { backgroundColor: hx }, isSelected && styles.spectrumBlockSelected, pressed && { transform: [{ scale: 0.85 }] }]} onPress={() => { selectPreviewColor({ hex: hx, name: 'Custom' }); setCustomHex(hx); }}>
                              {isSelected && <Feather name="check" size={16} color="#FFFFFF" style={{textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 2, textShadowOffset: {width: 0, height: 1}}} />}
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </ScrollView>
              
              <View style={[styles.floatingActionBox, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.9)', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                
                <TouchableOpacity style={[styles.floatingResetBtn, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]} onPress={handleSystemDefault}>
                  <Feather name="rotate-ccw" size={20} color={isDark ? '#F8FAFC' : '#0F172A'} />
                </TouchableOpacity>
                
                <TouchableOpacity style={[styles.floatingApplyBtn, { backgroundColor: livePreviewColor }]} onPress={applySelectedTheme}>
                  <Text style={styles.floatingApplyText}>Apply Theme</Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </View>
      </Modal>

      <Modal hardwareAccelerated={true} statusBarTranslucent={true} visible={lockProfileModal} animationType="fade" transparent={true}>
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.modalOverlayCenter}>
            <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
              <View style={{alignItems: 'center', marginBottom: 12}}><Feather name="shield" size={32} color={themeColors.primary} /></View>
              <Text style={[styles.modalTitle, { color: themeColors.textDark }]}>App Lock Profile</Text>
              <Text style={styles.modalSub}>Select your preferred security level.</Text>
              <TouchableOpacity style={[styles.timerOptBtn, { borderBottomColor: themeColors.separator }]} onPress={() => handleLockProfileChange('BIO_OR_PIN')}>
                <Text style={[styles.timerOptText, { color: themeColors.textDark }, lockProfileState === 'BIO_OR_PIN' && {color: themeColors.primary, fontWeight: '700'}]}>Biometric or PIN (Default)</Text>
                {lockProfileState === 'BIO_OR_PIN' && <Feather name="check-circle" size={18} color={themeColors.primary} />}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.timerOptBtn, { borderBottomColor: themeColors.separator }]} onPress={() => handleLockProfileChange('PIN')}>
                <Text style={[styles.timerOptText, { color: themeColors.textDark }, lockProfileState === 'PIN' && {color: themeColors.primary, fontWeight: '700'}]}>PIN Only</Text>
                {lockProfileState === 'PIN' && <Feather name="check-circle" size={18} color={themeColors.primary} />}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.timerOptBtn, { borderBottomColor: themeColors.separator }]} onPress={() => handleLockProfileChange('DUAL')}>
                <View>
                   <Text style={[styles.timerOptText, { color: themeColors.textDark }, lockProfileState === 'DUAL' && {color: themeColors.primary, fontWeight: '700'}]}>Dual Mode (High Security)</Text>
                   <Text style={{fontSize: 12, color: themeColors.textLight, marginTop: 4}}>Requires both PIN and Fingerprint.</Text>
                </View>
                {lockProfileState === 'DUAL' && <Feather name="check-circle" size={18} color={themeColors.primary} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setLockProfileModal(false)} style={{marginTop: 20, alignItems: 'center'}}><Text style={{color: themeColors.textLight, fontWeight: '600'}}>Cancel</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal hardwareAccelerated={true} statusBarTranslucent={true} visible={timerModal} animationType="fade" transparent={true}>
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.modalOverlayCenter}>
            <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.modalTitle, { color: themeColors.textDark }]}>Auto-lock Timer</Text>
              <Text style={styles.modalSub}>Select inactivity time before vault locks.</Text>
              {timerOptions.map(opt => (
                <TouchableOpacity key={opt} style={[styles.timerOptBtn, { borderBottomColor: themeColors.separator }]} onPress={() => { handleToggle('autoLockTimer', opt); setTimerModal(false); }}>
                  <Text style={[styles.timerOptText, { color: themeColors.textDark }, settings?.autoLockTimer === opt && {color: themeColors.primary, fontWeight: '700'}]}>{opt}</Text>
                  {settings?.autoLockTimer === opt && <Feather name="check-circle" size={18} color={themeColors.primary} />}
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setTimerModal(false)} style={{marginTop: 20, alignItems: 'center'}}><Text style={{color: themeColors.textLight, fontWeight: '600'}}>Cancel</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal hardwareAccelerated={true} statusBarTranslucent={true} visible={showEmailRequiredModal} animationType="fade" transparent={true}>
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.modalOverlayCenter}>
            <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
              <View style={{width: 64, height: 64, borderRadius: 32, backgroundColor: themeColors.iconBg.email, justifyContent: 'center', alignItems: 'center', marginBottom: 16}}><Feather name="mail" size={32} color={themeColors.iconColor.email} /></View>
              <Text style={[styles.modalTitle, { color: themeColors.textDark }]}>Email Required</Text>
              <Text style={[styles.modalSub, {textAlign: 'center'}]}>To ensure your data can be recovered, please link your email before exporting a backup.</Text>
              <TouchableOpacity style={{width: '100%', height: 54, backgroundColor: themeColors.primary, borderRadius: 100, justifyContent: 'center', alignItems: 'center', marginBottom: 12}} onPress={() => { setShowEmailRequiredModal(false); navigation.navigate('EmailSetup'); }}><Text style={{color: '#FFF', fontSize: 16, fontWeight: 'bold'}}>Link Email Now</Text></TouchableOpacity>
              <TouchableOpacity style={{width: '100%', height: 50, backgroundColor: 'transparent', borderRadius: 100, justifyContent: 'center', alignItems: 'center'}} onPress={() => setShowEmailRequiredModal(false)}><Text style={{color: themeColors.textLight, fontSize: 16, fontWeight: '700'}}>Cancel</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal hardwareAccelerated={true} statusBarTranslucent={true} visible={createRecoveryModal} animationType="slide" transparent={true}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={StyleSheet.absoluteFill}>
            <View style={styles.modalOverlayCenter}>
              <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
                <View style={{alignItems: 'center', marginBottom: 16}}><Feather name="shield" size={40} color={themeColors.primary} /></View>
                <Text style={[styles.modalTitle, {textAlign: 'center', color: themeColors.textDark }]}>Set Recovery Code</Text>
                <Text style={[styles.modalSub, {textAlign: 'center'}]}>Enter a 4–6 digit numeric code. This will help recover your vault if you forget your PIN.</Text>
                <TextInput style={[styles.modalInput, { backgroundColor: themeColors.inputBg, borderColor: themeColors.inputBorder, color: themeColors.textDark }]} keyboardType="numeric" maxLength={6} placeholder=" • • • • " placeholderTextColor={themeColors.textLight} value={customRecoveryCode} onChangeText={setCustomRecoveryCode} />
                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, width: '100%', gap: 10}}>
                  <TouchableOpacity style={[styles.modalBtnCancel, { backgroundColor: themeColors.inputBg }]} onPress={() => { Keyboard.dismiss(); setTimeout(() => { setCreateRecoveryModal(false); }, 150); }}><Text style={{color: themeColors.textLight, fontWeight: '600'}}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtnAction, { backgroundColor: themeColors.primary }]} onPress={() => { Keyboard.dismiss(); setTimeout(() => { saveCustomRecoveryCode(); }, 150); }}><Text style={{color: '#FFF', fontWeight: 'bold'}}>Save Code</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal hardwareAccelerated={true} statusBarTranslucent={true} visible={recoveryModal} animationType="fade" transparent={true}>
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.modalOverlayCenter}>
            <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
              <View style={{alignItems: 'center', marginBottom: 16}}><Feather name="shield" size={40} color={themeColors.primary} /></View>
              <Text style={[styles.modalTitle, {textAlign: 'center', color: themeColors.textDark }]}>Recovery Code</Text>
              <Text style={[styles.modalSub, {textAlign: 'center', color: themeColors.iconColor.appearance, fontWeight: 'bold'}]}>IMPORTANT: Do not forget this. Save it offline securely.</Text>
              <View style={[styles.codeBox, { borderColor: themeColors.primary, backgroundColor: themeColors.inputBg }]}><Text style={[styles.codeText, { color: themeColors.primary }]}>{recoveryCodeState}</Text></View>
              <TouchableOpacity style={[styles.copyBtnFull, { backgroundColor: themeColors.primary }]} onPress={copyCode}><Feather name="copy" size={18} color="#FFF" style={{marginRight: 8}} /><Text style={{color: '#FFF', fontWeight: 'bold', fontSize: 16}}>I have saved this securely</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setRecoveryModal(false)} style={{marginTop: 16, alignItems: 'center'}}><Text style={{color: themeColors.textLight, fontWeight: '600'}}>Close</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal hardwareAccelerated={true} statusBarTranslucent={true} visible={showImportWarning} animationType="fade" transparent={true}>
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.modalOverlayCenter}>
            <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
              <View style={{width: 64, height: 64, borderRadius: 32, backgroundColor: themeColors.iconBg.appearance, justifyContent: 'center', alignItems: 'center', marginBottom: 16}}><Feather name="alert-triangle" size={32} color={themeColors.iconColor.appearance} /></View>
              <Text style={[styles.modalTitle, { color: themeColors.textDark }]}>Secure Session Required</Text>
              <Text style={[styles.modalSub, {textAlign: 'center'}]}>This action requires uninterrupted access. Auto-lock may interrupt the process.</Text>
              <View style={{flexDirection: 'row', backgroundColor: themeColors.inputBg, padding: 12, borderRadius: 16, marginBottom: 24, width: '100%', alignItems: 'flex-start'}}><Feather name="info" size={14} color={themeColors.textLight} /><Text style={{fontSize: 12, color: themeColors.textLight, marginLeft: 8, flex: 1, lineHeight: 18}}>Lock will be restored automatically after the process completes.</Text></View>
              <TouchableOpacity style={{width: '100%', height: 56, backgroundColor: themeColors.primary, borderRadius: 100, justifyContent: 'center', alignItems: 'center', marginBottom: 12}} onPress={handleDisableAndContinueFlow}><Text style={{color: '#FFF', fontSize: 15, fontWeight: 'bold'}}>Disable Lock & Continue</Text></TouchableOpacity>
              <TouchableOpacity style={{width: '100%', height: 50, backgroundColor: 'transparent', borderRadius: 100, justifyContent: 'center', alignItems: 'center'}} onPress={() => setShowImportWarning(false)}><Text style={{color: themeColors.textLight, fontSize: 15, fontWeight: '700'}}>Cancel</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ChangeMasterPinModal visible={pinModal} onClose={() => setPinModal(false)} isDark={isDark} themeColors={themeColors} onSaveSuccess={() => { setPinModal(false); showToast('Master PIN updated', 'key'); }} />
      <SetupFakePinModal visible={fakePinModal} onClose={() => setFakePinModal(false)} isDark={isDark} themeColors={themeColors} onSaveSuccess={() => { setFakePinModal(false); setFakePinStatus('verified'); showToast('Decoy Mode Active', 'user-x'); }} />
      
      <Modal hardwareAccelerated={true} statusBarTranslucent={true} visible={fakePinActionModal} animationType="fade" transparent={true}>
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.modalOverlayCenter}>
            <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
              <View style={{alignItems: 'center', marginBottom: 16}}><Feather name="user-check" size={40} color={themeColors.primary} /></View>
              <Text style={[styles.modalTitle, { color: themeColors.textDark }]}>Fake PIN</Text>
              <Text style={styles.modalSub}>Decoy mode is currently active.</Text>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', width: '100%', height: 60, borderBottomWidth: 1, borderBottomColor: themeColors.separator }} onPress={() => { setFakePinActionModal(false); setFakePinModal(true); }}>
                <Feather name="edit-2" size={24} color={themeColors.primary} style={{ marginRight: 16 }} />
                <Text style={{ fontSize: 16, fontWeight: '600', color: themeColors.textDark }}>Change Fake PIN</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', width: '100%', height: 60 }} onPress={disableFakePin}>
                <Feather name="x-circle" size={24} color={themeColors.danger} style={{ marginRight: 16 }} />
                <Text style={{ fontSize: 16, fontWeight: '600', color: themeColors.danger }}>Disable Fake PIN</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ width: '100%', height: 54, backgroundColor: themeColors.inputBg, borderRadius: 100, justifyContent: 'center', alignItems: 'center', marginTop: 16 }} onPress={() => setFakePinActionModal(false)}>
                <Text style={{ color: themeColors.textLight, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal hardwareAccelerated={true} statusBarTranslucent={true} visible={showRestartModal} transparent animationType="fade">
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.alertOverlayBg}>
            <View style={[styles.modalContent, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
              <View style={[styles.pulseCircle, { borderColor: primaryColor + '40', backgroundColor: primaryColor + '10' }]}><View style={[styles.iconCircle, { backgroundColor: primaryColor }]}><Feather name="refresh-cw" size={36} color="#FFF" /></View></View>
              <Text style={[styles.alertTitle, { color: themeColors.textDark }]}>Restore Complete! 🎉</Text>
              <Text style={[styles.alertMessage, { color: themeColors.textLight }]}>Your vault data has been successfully imported. The app will now automatically restart.</Text>
              <TouchableOpacity style={{ width: '100%', height: 56, borderRadius: 100, overflow: 'hidden' }} activeOpacity={0.8} onPress={async () => { setShowRestartModal(false); await updateSetting('lockOnExit', true); navigation.reset({ index: 0, routes: [{ name: 'Lock' }] }); }}>
                <LinearGradient colors={[primaryColor, primaryColor + 'DD']} style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }}>Restart App</Text></LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal hardwareAccelerated={true} statusBarTranslucent={true} visible={resetStep > 0} animationType="fade" transparent={true}>
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.alertOverlayBg}>
            <View style={[styles.premiumResetModalCompact, { backgroundColor: themeColors.card }]}>
              {resetStep === 1 && (
                <>
                  <View style={styles.resetHeaderRow}>
                    <View style={[styles.dangerIconCircle, { backgroundColor: '#FEF2F2' }]}><Feather name="alert-triangle" size={32} color="#EF4444" /></View>
                  </View>
                  <Text style={[styles.resetModalTitleCompact, { color: themeColors.textDark }]}>Wipe Vault?</Text>
                  <Text style={[styles.resetModalDescCompact, { color: themeColors.textLight, marginBottom: 24 }]}>This will permanently delete ALL passwords, photos, and files. This action CANNOT be undone.</Text>
                  <View style={styles.resetBtnRow}>
                    <TouchableOpacity style={[styles.resetBtnCancelHalf, { backgroundColor: themeColors.inputBg }]} onPress={() => setResetStep(0)}>
                      <Text style={{ color: themeColors.textDark, fontWeight: '700' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.resetBtnActionHalf} onPress={executePremiumWipe}>
                      <Text style={{ color: '#FFF', fontWeight: '800' }}>Wipe Data</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              {resetStep === 2 && (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <ActivityIndicator size="large" color="#EF4444" style={{ marginBottom: 16, transform: [{scale: 1.5}] }} />
                  <Text style={{ color: themeColors.textDark, fontSize: 18, fontWeight: '800' }}>{wipeStatusText || 'Erasing data...'}</Text>
                </View>
              )}
              {resetStep === 3 && (
                <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                  <View style={[styles.dangerIconCircle, { backgroundColor: '#ECFDF5' }]}><Feather name="check" size={32} color="#10B981" /></View>
                  <Text style={[styles.resetModalTitleCompact, { color: themeColors.textDark, marginBottom: 8 }]}>Vault Destroyed</Text>
                  <Text style={[styles.resetModalDescCompact, { color: themeColors.textLight, textAlign: 'center', marginBottom: 24 }]}>All data has been wiped. App will now restart.</Text>
                  <TouchableOpacity style={[styles.resetBtnActionHalf, { width: '100%', backgroundColor: primaryColor }]} onPress={() => { setResetStep(0); navigation.reset({ index: 0, routes: [{ name: 'Lock' }] }); }}>
                    <Text style={{ color: '#FFF', fontWeight: '800' }}>Restart App</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const ChangeMasterPinModal = ({ visible, onClose, isDark, themeColors, onSaveSuccess }) => {
  const [pinStep, setPinStep] = useState(1);
  const [tempPins, setTempPins] = useState({ current: '', new: '', confirm: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const pinInputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setPinStep(1); setTempPins({ current: '', new: '', confirm: '' }); setErrorMsg('');
      setTimeout(() => pinInputRef.current?.focus(), 300);
    }
  }, [visible]);

  const handleNext = async () => {
    const actualPin = await getMasterPin();
    if (pinStep === 1) { 
      if (tempPins.current === actualPin) { setPinStep(2); setErrorMsg(''); } 
      else { setErrorMsg('Incorrect Current PIN!'); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); setTempPins({...tempPins, current: ''}); }
    } 
    else if (pinStep === 2) { 
      if (tempPins.new.length === 4) { setPinStep(3); setErrorMsg(''); } 
      else { setErrorMsg('PIN must be 4 digits.'); } 
    } 
    else if (pinStep === 3) {
      if (tempPins.new === tempPins.confirm) {
        await saveMasterPin(tempPins.new);
        onSaveSuccess();
      } else { 
        setErrorMsg('PINs do not match.'); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setPinStep(2); setTempPins({ ...tempPins, confirm: '' }); 
      }
    }
  };

  if(!visible) return null;
  return (
    <Modal hardwareAccelerated={true} statusBarTranslucent={true} visible={visible} animationType="fade" transparent={true}>
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.alertOverlayBg}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{width: '100%', alignItems: 'center'}}>
              <View style={[styles.modalContent, { backgroundColor: themeColors.card, width: '100%' }]}>
                <View style={{alignItems: 'center', marginBottom: 16}}><Feather name="key" size={40} color={themeColors.primary} /></View>
                <Text style={[styles.modalTitle, { color: themeColors.textDark }]}>Change Master PIN</Text>
                <Text style={styles.modalSub}>{pinStep === 1 ? 'Enter CURRENT PIN' : pinStep === 2 ? 'Create NEW 4-digit PIN' : 'Confirm NEW PIN'}</Text>
                <Pressable style={styles.otpContainer} onPress={() => pinInputRef.current?.focus()}>
                  <View style={[styles.otpPressableArea, { pointerEvents: 'none' }]}>
                    {[0, 1, 2, 3].map((index) => {
                      const val = pinStep === 1 ? tempPins.current : pinStep === 2 ? tempPins.new : tempPins.confirm;
                      return (
                        <View key={index} style={[styles.otpDigitBoxCompact, { flex: 1, height: 64, marginHorizontal: 4, backgroundColor: themeColors.inputBg, borderColor: errorMsg ? '#EF4444' : (val.length === index ? themeColors.primary : 'transparent'), borderWidth: 1.5 }]}>
                          <Text style={{ fontSize: 24, color: themeColors.textDark }}>{val[index] ? '●' : ''}</Text>
                        </View>
                      );
                    })}
                  </View>
                  <TextInput ref={pinInputRef} style={[StyleSheet.absoluteFillObject, { opacity: 0 }]} keyboardType="number-pad" maxLength={4} value={pinStep === 1 ? tempPins.current : pinStep === 2 ? tempPins.new : tempPins.confirm} onChangeText={(val) => { setTempPins({ ...tempPins, [pinStep === 1 ? 'current' : pinStep === 2 ? 'new' : 'confirm']: val }); setErrorMsg(''); }} caretHidden={true} />
                </Pressable>
                {errorMsg ? <Text style={{color: '#EF4444', fontWeight: '700', marginBottom: 12}}>{errorMsg}</Text> : null}
                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, width: '100%', gap: 10}}>
                  <TouchableOpacity style={[styles.modalBtnCancel, { backgroundColor: themeColors.inputBg }]} onPress={() => { Keyboard.dismiss(); setTimeout(() => { onClose(); }, 150); }}><Text style={{color: themeColors.textLight, fontWeight: '600'}}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtnAction, { backgroundColor: themeColors.primary }]} onPress={() => { Keyboard.dismiss(); setTimeout(() => { handleNext(); }, 150); }}><Text style={{color: '#FFF', fontWeight: 'bold'}}>Next</Text></TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </View>
    </Modal>
  );
};

const SetupFakePinModal = ({ visible, onClose, isDark, themeColors, onSaveSuccess }) => {
  const [fakePinStep, setFakePinStep] = useState(1);
  const [tempFakePins, setTempFakePins] = useState({ new: '', confirm: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const fakePinInputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setFakePinStep(1); setTempFakePins({ new: '', confirm: '' }); setErrorMsg('');
      setTimeout(() => fakePinInputRef.current?.focus(), 300);
    }
  }, [visible]);

  const handleNext = async () => {
    if (fakePinStep === 1) {
      if (tempFakePins.new.length !== 4) return setErrorMsg("PIN must be 4 digits.");
      const actualPin = await getMasterPin(); 
      if (tempFakePins.new === actualPin) {
        setErrorMsg("Fake PIN cannot be same as Master PIN!"); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return;
      }
      setFakePinStep(2); setErrorMsg('');
    } else if (fakePinStep === 2) {
      if (tempFakePins.new === tempFakePins.confirm) {
        await saveFakePin(tempFakePins.new); 
        onSaveSuccess();
      } else { 
        setErrorMsg("PINs do not match."); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setFakePinStep(1); setTempFakePins({ new: '', confirm: '' }); 
      }
    }
  };

  if(!visible) return null;
  return (
    <Modal hardwareAccelerated={true} statusBarTranslucent={true} visible={visible} animationType="fade" transparent={true}>
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.alertOverlayBg}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{width: '100%', alignItems: 'center'}}>
              <View style={[styles.modalContent, { backgroundColor: themeColors.card, width: '100%' }]}>
                <View style={{alignItems: 'center', marginBottom: 16}}><Feather name="user-x" size={40} color={themeColors.primary} /></View>
                <Text style={[styles.modalTitle, {textAlign: 'center', color: themeColors.textDark }]}>Setup Fake PIN</Text>
                <Text style={[styles.modalSub, {textAlign: 'center'}]}>{fakePinStep === 1 ? 'Create a 4-digit Fake PIN for Decoy Mode.' : 'Confirm your Fake PIN.'}</Text>
                <Pressable style={styles.otpContainer} onPress={() => fakePinInputRef.current?.focus()}>
                  <View style={[styles.otpPressableArea, { pointerEvents: 'none' }]}>
                    {[0, 1, 2, 3].map((index) => {
                      const val = fakePinStep === 1 ? tempFakePins.new : tempFakePins.confirm;
                      return (
                        <View key={index} style={[styles.otpDigitBoxCompact, { flex: 1, height: 64, marginHorizontal: 4, backgroundColor: themeColors.inputBg, borderColor: errorMsg ? '#EF4444' : (val.length === index ? themeColors.primary : 'transparent'), borderWidth: 1.5 }]}>
                          <Text style={{ fontSize: 24, color: themeColors.textDark }}>{val[index] ? '●' : ''}</Text>
                        </View>
                      );
                    })}
                  </View>
                  <TextInput ref={fakePinInputRef} style={[StyleSheet.absoluteFillObject, { opacity: 0 }]} keyboardType="number-pad" maxLength={4} value={fakePinStep === 1 ? tempFakePins.new : tempFakePins.confirm} onChangeText={(val) => { setTempFakePins({ ...tempFakePins, [fakePinStep === 1 ? 'new' : 'confirm']: val }); setErrorMsg(''); }} caretHidden={true} />
                </Pressable>
                {errorMsg ? <Text style={{color: '#EF4444', fontWeight: '700', marginBottom: 12}}>{errorMsg}</Text> : null}
                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, width: '100%', gap: 10}}>
                  <TouchableOpacity style={[styles.modalBtnCancel, { backgroundColor: themeColors.inputBg }]} onPress={() => { Keyboard.dismiss(); setTimeout(() => { onClose(); }, 150); }}><Text style={{color: themeColors.textLight, fontWeight: '600'}}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtnAction, { backgroundColor: themeColors.primary }]} onPress={() => { Keyboard.dismiss(); setTimeout(() => { handleNext(); }, 150); }}><Text style={{color: '#FFF', fontWeight: 'bold'}}>Save</Text></TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  containerMain: { flex: 1, width: '100%', height: '100%' }, 
  scrollContent: { paddingBottom: 80 }, 
  headerTitleMain: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, paddingHorizontal: 20, marginBottom: 20 },
  
  heroCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 104, marginHorizontal: 20, borderRadius: 36, paddingHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 30, elevation: 5, marginBottom: 24 },
  heroLeft: { flexDirection: 'row', alignItems: 'center' },
  scoreRingText: { fontSize: 16, fontWeight: '800' },
  heroTextContainer: { marginLeft: 16 },
  heroScoreText: { fontSize: 20, fontWeight: '800' },
  heroSubText: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  
  wizardCard: { marginHorizontal: 20, borderRadius: 32, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 3, marginBottom: 24 },
  wizardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 16 },
  wizardProgressBg: { width: '100%', height: 6, borderRadius: 3, backgroundColor: '#E2E8F0', marginBottom: 16, overflow: 'hidden' },
  wizardProgressFill: { height: '100%', borderRadius: 3 },
  wizardStepsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  wizardStep: { alignItems: 'center' },
  wizardStepText: { fontSize: 11, fontWeight: '700', marginTop: 6 },

  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginTop: 12, marginBottom: 12, marginLeft: 24 },
  card: { width: '90%', alignSelf: 'center', borderRadius: 32, paddingVertical: 8, marginBottom: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 24, elevation: 2, overflow: 'hidden' },
  dangerCard: { width: '90%', alignSelf: 'center', borderRadius: 36, paddingVertical: 20, paddingHorizontal: 24, marginBottom: 140, marginTop: 10, flexDirection: 'row', alignItems: 'center' },
  expandBtn: { paddingVertical: 16, alignItems: 'center', borderTopWidth: 1 },
  expandBtnText: { fontSize: 14, fontWeight: '700' },
  
  row: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 20 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconBox: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 16 }, 
  rowTitle: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  rowSub: { fontSize: 12, marginTop: 4 },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { fontSize: 14, marginRight: 8, fontWeight: '600' },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, marginRight: 8 }, 
  badgeText: { fontSize: 11, fontWeight: '800' },
  dangerBox: { borderRadius: 24, paddingHorizontal: 16, marginTop: 8, marginBottom: 8, borderWidth: 1 },
  
  smartToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, height: 56 },
  smartToggleText: { fontSize: 15, fontWeight: '600' },

  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, height: Platform.OS === 'ios' ? 100 : 90, zIndex: 100 },
  stickyHeaderContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 14 },
  stickyTitle: { fontSize: 20, fontWeight: '800' },
  miniScorePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },

  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', borderRadius: 36, padding: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 15, alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalTitle: { fontSize: 24, fontWeight: '900', marginBottom: 10 },
  modalSub: { fontSize: 15, marginBottom: 24, lineHeight: 22, textAlign: 'center' },
  modalInput: { height: 60, borderRadius: 100, fontSize: 24, fontWeight: 'bold', letterSpacing: 10, marginBottom: 24, borderWidth: 1, width: '100%', textAlign: 'center', paddingHorizontal: 24 },
  modalBtnCancel: { flex: 1, height: 56, justifyContent: 'center', alignItems: 'center', borderRadius: 100 },
  modalBtnAction: { flex: 1, height: 56, justifyContent: 'center', alignItems: 'center', borderRadius: 100 },
  codeBox: { borderStyle: 'dashed', borderWidth: 2, padding: 20, borderRadius: 24, alignItems: 'center', marginBottom: 24, width: '100%' },
  codeText: { fontSize: 20, fontWeight: '800', letterSpacing: 4 },
  copyBtnFull: { width: '100%', height: 58, borderRadius: 100, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  timerOptBtn: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, width: '100%' },
  timerOptText: { fontSize: 16, fontWeight: '600' },
  
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.1)' },
  deviceActionBtn: { width: '100%', height: 56, borderRadius: 100, justifyContent: 'center', alignItems: 'center' },

  smartErrorCard: { width: '100%', borderRadius: 36, padding: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.25, shadowRadius: 30, elevation: 20 },
  errorIconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  errorTitle: { fontSize: 24, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
  errorDesc: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  timerTextDisplay: { fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  errorActions: { width: '100%', flexDirection: 'column', alignItems: 'center', gap: 14 },
  errorBtnPrimary: { width: '100%', height: 56, borderRadius: 100 },
  errorBtnPrimaryGradient: { flex: 1, borderRadius: 100, justifyContent: 'center', alignItems: 'center' },
  errorBtnTryText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  errorBtnTrySecondary: { width: '100%', height: 56, borderRadius: 100, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  errorBtnTryTextSecondary: { color: '#4B5563', fontSize: 16, fontWeight: '700' },

  otpContainer: { width: '100%', marginBottom: 24, alignItems: 'center' },
  otpPressableArea: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 10 },
  otpDigitBoxCompact: { flex: 1, aspectRatio: 0.85, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },

  pulseCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  alertTitle: { fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  alertMessage: { fontSize: 15, textAlign: 'center', fontWeight: '500', marginBottom: 32, lineHeight: 22 },

  analyzerBox: { width: 240, padding: 28, borderRadius: 36, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 30, elevation: 15 },
  analyzerTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  analyzerSub: { fontSize: 14, textAlign: 'center', fontWeight: '500' },

  modalOverlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  colorBottomSheet: { width: '100%', height: '90%', borderTopLeftRadius: 36, borderTopRightRadius: 36, paddingHorizontal: 24, paddingTop: 24, elevation: 20 },
  colorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  colorModalTitle: { fontSize: 26, fontWeight: '800', marginBottom: 6 },
  colorModalSub: { fontSize: 15, fontWeight: '600' },
  colorCloseBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-end' },
  
  colorSection: { marginBottom: 32 },
  colorSectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 16, marginLeft: 4 },
  
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 14 },
  softColorBlock: { width: '48%', height: 76, borderRadius: 24, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  gradientGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 14 },
  gradientBlock: { width: '48%', height: 100, borderRadius: 24, overflow: 'hidden' },
  gradientFill: { flex: 1, justifyContent: 'flex-end', padding: 14 },
  gradientText: { color: '#FFF', fontSize: 15, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 3, marginBottom: 4 },
  gradientSubText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700' },

  hexInputWrapper: { flexDirection: 'row', alignItems: 'center', height: 60, borderRadius: 100, paddingHorizontal: 20, marginBottom: 12 },
  hexPreviewDot: { width: 28, height: 28, borderRadius: 14, marginRight: 14, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  hexInput: { flex: 1, fontSize: 20, fontWeight: '800', letterSpacing: 1.5 },

  spectrumGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  spectrumBlockWrapper: { width: '16.666%', padding: 6 }, 
  spectrumBlock: { width: '100%', aspectRatio: 1, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  spectrumBlockSelected: { borderWidth: 3, borderColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },

  customPickerBtn: { width: '100%', height: 60, borderRadius: 100, borderWidth: 1.5, borderStyle: 'dashed', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12 },

  floatingActionBox: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    overflow: 'hidden'
  },
  floatingResetBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  floatingApplyBtn: {
    flex: 1,
    height: 48,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingApplyText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5
  },

  premiumToast: { 
    position: 'absolute', bottom: 120, alignSelf: 'center', zIndex: 9999999,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 14, 
    borderRadius: 999, backgroundColor: '#0F172A', 
    shadowColor: '#000', shadowOffset: {width:0,height:8}, shadowOpacity: 0.35, shadowRadius: 16, elevation: 12, 
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' 
  },
  smartToastText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginLeft: 8 },

  alertOverlayBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  
  premiumResetModalCompact: { width: '100%', borderRadius: 36, padding: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  resetHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dangerIconSmall: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  dangerIconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  resetModalTitleCompact: { fontSize: 24, fontWeight: '900' },
  resetModalDescCompact: { fontSize: 14, marginTop: 4 },
  resetBtnRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  resetBtnActionHalf: { flex: 1, height: 56, borderRadius: 100, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },
  resetBtnCancelHalf: { flex: 1, height: 56, borderRadius: 100, justifyContent: 'center', alignItems: 'center' }
});
