// File: src/screens/EmailSetupScreen.js
import React, { useState, useEffect, useRef, useContext } from 'react';
import { 
  View, Text, StyleSheet, SafeAreaView, TextInput, 
  TouchableOpacity, ActivityIndicator, Alert, Animated, Platform, Pressable, Modal,
  KeyboardAvoidingView, ScrollView, Keyboard 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient'; 
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur'; // 🔥 Added for Premium Info Popup
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemeContext } from '../ThemeContext';
import { updateSetting, getSettings } from '../utils/storage'; 

const API_BASE_URL = 'https://safelockers.sheikhtaj3010.workers.dev';

const BP_COLORS = {
  primary: '#6C5CE7', success: '#10B981', danger: '#EF4444',
  textMain: '#111827', textSub: '#6B7280', inputBg: '#F3F4F6',
  bg: '#FAFAFB', cardBorder: '#E5E7EB', modalBorder: '#FECACA'
};

const OTPInputBox = ({ value, setValue, inputRef, isDark, themeColors, isDanger }) => (
  <View style={styles.otpContainer}>
    <Pressable style={styles.otpContainerInner} onPress={() => inputRef.current?.focus()}>
      <View style={[styles.otpPressableArea, {pointerEvents: 'none'}]}>
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const isActive = value.length === index;
          const isFilled = value.length > index;
          const activeColor = isDanger ? themeColors.danger : themeColors.primary;
          return (
            <View key={index} style={[styles.otpDigitBoxCompact, { 
              backgroundColor: isDark ? themeColors.inputBg : '#F9FAFB', 
              borderColor: isActive ? activeColor : (isFilled ? activeColor + '50' : 'transparent') 
            }]}>
              <Text style={[styles.otpDigitText, { color: isDark ? '#FFF' : '#111827' }]}>{value[index] || ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput 
        ref={inputRef} 
        style={[StyleSheet.absoluteFillObject, { opacity: 0 }]} 
        keyboardType="number-pad" 
        maxLength={6} 
        value={value} 
        onChangeText={setValue} 
        caretHidden={true} 
        autoCorrect={false} 
        blurOnSubmit={false}
        color="transparent"
      />
    </Pressable>
  </View>
);

const fetchWithRetry = async (url, options = {}, retries = 5) => {
  const customHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { ...options, headers: customHeaders });
      return response; 
    } catch (error) {
      if (i === retries - 1) {
        throw new Error("Server is unreachable after multiple attempts. Please try again.");
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

export default function EmailSetupScreen({ navigation }) {
  const { isDark, themeColors } = useContext(ThemeContext);
  const primaryColor = themeColors?.primary || '#12C7B2';
  
  const [viewState, setViewState] = useState('LOADING'); 
  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [otp, setOtp] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false); 
  const [isRemovingEmail, setIsRemovingEmail] = useState(false); 
  const [isMainActionLoading, setIsMainActionLoading] = useState(false); 
  const [isRemoveActionLoading, setIsRemoveActionLoading] = useState(false); 
  const [loadingText, setLoadingText] = useState(''); 

  const [timeLeft, setTimeLeft] = useState(30);
  const [isSuccess, setIsSuccess] = useState(false);

  const [changeEmailModalVisible, setChangeEmailModalVisible] = useState(false); 
  const [removeEmailModalVisible, setRemoveEmailModalVisible] = useState(false); 
  const [showCongratsModal, setShowCongratsModal] = useState(false); 
  const [showRemoveCongratsModal, setShowRemoveCongratsModal] = useState(false); 
  const [showOnboardingCompleteModal, setShowOnboardingCompleteModal] = useState(false);
  
  // 💡 STATE FOR INFO POPUP
  const [infoModalVisible, setInfoModalVisible] = useState(false);

  const [showSecureSessionWarning, setShowSecureSessionWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const [oldOtp, setOldOtp] = useState(''); 
  const [removeOtp, setRemoveOtp] = useState(''); 

  const scaleAnim = useRef(new Animated.Value(0)).current; 
  const sadScaleAnim = useRef(new Animated.Value(0)).current; 
  const changeEmailScaleAnim = useRef(new Animated.Value(0)).current;
  const removeEmailScaleAnim = useRef(new Animated.Value(0)).current;
  const smileSlideAnim = useRef(new Animated.Value(-100)).current;
  const sadSlideAnim = useRef(new Animated.Value(-100)).current;
  const infoScale = useRef(new Animated.Value(0.85)).current;
  const infoOpacity = useRef(new Animated.Value(0)).current;

  const otpInputRef = useRef(null);
  const oldOtpInputRef = useRef(null);
  const removeOtpInputRef = useRef(null);
  const lockWasOnRef = useRef(false);

  const isFirstTimeSetup = useRef(false);

  useEffect(() => {
    loadEmailData();
    return () => { global.otpSessionActive = false; global.otpSessionExpiry = null; restoreLockStateSafe(); };
  }, []);

  const loadEmailData = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('SAFEGALLERY_RECOVERY_EMAIL');
      const isVerified = await AsyncStorage.getItem('SAFEGALLERY_EMAIL_VERIFIED');
      if (savedEmail && isVerified === 'true') {
        setCurrentEmail(savedEmail); setViewState('MANAGE');
      } else { 
        isFirstTimeSetup.current = true; setViewState('ADD'); 
      }
    } catch (e) { isFirstTimeSetup.current = true; setViewState('ADD'); }
  };

  useEffect(() => {
    let interval;
    if (viewState === 'OTP' && timeLeft > 0 && !isSuccess) { interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000); } 
    else if (timeLeft === 0 && viewState === 'OTP') { global.otpSessionActive = false; }
    return () => clearInterval(interval);
  }, [viewState, timeLeft, isSuccess]);

  useEffect(() => { if (otp.length === 6 && !isLoading && !isSuccess) verifyOtp(); }, [otp]);

  const restoreLockStateSafe = async () => { 
    if (lockWasOnRef.current) { await updateSetting('lockOnExit', true); lockWasOnRef.current = false; } 
    global.activeFlow = 'NORMAL'; global.ignoreAppLock = false; global.isAuthenticating = false;
  };

  // 💡 INFO POPUP CONTROLS
  const showInfoPopup = () => {
    setInfoModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.spring(infoScale, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
      Animated.timing(infoOpacity, { toValue: 1, duration: 200, useNativeDriver: true })
    ]).start();
  };

  const closeInfoPopup = () => {
    Animated.parallel([
      Animated.timing(infoScale, { toValue: 0.85, duration: 200, useNativeDriver: true }),
      Animated.timing(infoOpacity, { toValue: 0, duration: 200, useNativeDriver: true })
    ]).start(() => setInfoModalVisible(false));
  };

  const runSmileAnimationFlow = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setShowCongratsModal(true);
    Animated.parallel([ Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }), Animated.spring(smileSlideAnim, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }) ]).start();
  };

  const runSadAnimationFlow = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); setShowRemoveCongratsModal(true);
    Animated.parallel([ Animated.spring(sadScaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }), Animated.spring(sadSlideAnim, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }) ]).start();
  };

  const maskEmailSmart = (emailText) => {
    if (!emailText || !emailText.includes('@')) return emailText;
    const [name, domain] = emailText.split('@');
    if (name.length <= 2) return `${name}***@${domain}`;
    return `${name.substring(0, 2)}****${name.slice(-2)}@${domain}`;
  };

  const sendOtp = async () => {
    Keyboard.dismiss(); 
    const cleanEmail = newEmail.toLowerCase().trim();
    if (!cleanEmail.includes('@')) return Alert.alert('Invalid', 'Please enter a valid email address.');
    if (cleanEmail === currentEmail) return Alert.alert('Already Linked', 'This email is already linked.');

    setIsLoading(true); setLoadingText('Connecting to server...'); 
    try {
      const res = await fetchWithRetry(`${API_BASE_URL}/send-otp`, { method: 'POST', body: JSON.stringify({ email: cleanEmail, otpType: 'VERIFY_EMAIL' }) });
      const data = await res.json();
      setIsLoading(false); setLoadingText('');
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        global.otpSessionActive = true; global.otpSessionExpiry = Date.now() + 5 * 60000; 
        setViewState('OTP'); setTimeLeft(30); setOtp(''); setTimeout(() => otpInputRef.current?.focus(), 600); 
      } else { Alert.alert('Email Error', data.message || 'Could not send OTP.'); }
    } catch (e) { setIsLoading(false); setLoadingText(''); Alert.alert('Connection Failed', e.message); }
  };

  const verifyOtp = async () => {
    Keyboard.dismiss(); setIsLoading(true);
    try {
      const cleanEmail = newEmail.toLowerCase().trim();
      const res = await fetchWithRetry(`${API_BASE_URL}/verify-otp`, { method: 'POST', body: JSON.stringify({ email: cleanEmail, otp }) });
      const data = await res.json();
      if (data.success) {
        await AsyncStorage.setItem('SAFEGALLERY_RECOVERY_EMAIL', cleanEmail); await AsyncStorage.setItem('RECOVERY_EMAIL', cleanEmail);
        await AsyncStorage.setItem('SAFEGALLERY_EMAIL_VERIFIED', 'true');
        await updateSetting('recoveryEmail', cleanEmail); await updateSetting('emailRecovery', true);

        setCurrentEmail(cleanEmail); global.otpSessionActive = false; setIsLoading(false); setIsSuccess(true);
        runSmileAnimationFlow();

        setTimeout(() => {
          setShowCongratsModal(false); scaleAnim.setValue(0); smileSlideAnim.setValue(-100); setIsSuccess(false);
          if (isFirstTimeSetup.current) { setShowOnboardingCompleteModal(true); } else { setViewState('MANAGE'); }
        }, 2200); 
      } else { 
        setIsLoading(false); setOtp(''); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); 
        Alert.alert('Verification Failed', data.message || 'Incorrect OTP entered.'); setTimeout(() => otpInputRef.current?.focus(), 300); 
      }
    } catch (error) { setIsLoading(false); setOtp(''); Alert.alert('Network Error', error.message); }
  };

  const handleSecurePreCheck = async (actionType) => {
    const s = await getSettings();
    setPendingAction(actionType);
    if (s?.lockOnExit && !lockWasOnRef.current) {
      setShowSecureSessionWarning(true);
    } else {
      executePendingAction(actionType);
    }
  };

  const handleDisableAndContinueFlow = async () => {
    await updateSetting('lockOnExit', false);
    lockWasOnRef.current = true;
    setShowSecureSessionWarning(false);
    executePendingAction(pendingAction);
  };

  const executePendingAction = (action) => {
    if (action === 'CHANGE_EMAIL') initiateChangeEmail();
    else if (action === 'REMOVE_EMAIL') initiateRemoveEmail();
  };

  const initiateChangeEmail = async () => {
    setIsMainActionLoading(true);
    try {
      const res = await fetchWithRetry(`${API_BASE_URL}/send-otp`, { method: 'POST', body: JSON.stringify({ email: currentEmail, otpType: 'VERIFY_EMAIL' }) });
      const data = await res.json();
      setIsMainActionLoading(false);
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        global.activeFlow = 'OTP_FLOW'; global.ignoreAppLock = true;
        setOldOtp(''); setChangeEmailModalVisible(true);
        Animated.spring(changeEmailScaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }).start();
      } else { Alert.alert('Error', data.message || 'Failed to send OTP.'); }
    } catch (e) { setIsMainActionLoading(false); Alert.alert('Network Error', e.message); }
  };

  const verifyOldOtp = async () => {
    Keyboard.dismiss();
    if (oldOtp.length !== 6) return Alert.alert('Invalid', 'Enter 6-digit OTP.');
    setIsChangingEmail(true);
    try {
      const res = await fetchWithRetry(`${API_BASE_URL}/verify-otp`, { method: 'POST', body: JSON.stringify({ email: currentEmail, otp: oldOtp }) });
      const data = await res.json();
      setIsChangingEmail(false);
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setChangeEmailModalVisible(false); changeEmailScaleAnim.setValue(0);
        await restoreLockStateSafe(); 
        setNewEmail(''); isFirstTimeSetup.current = true; setViewState('ADD');
      } else { Alert.alert('Error', data.message || 'Wrong OTP'); setOldOtp(''); setTimeout(() => oldOtpInputRef.current?.focus(), 300); }
    } catch (e) { setIsChangingEmail(false); Alert.alert('Error', e.message); }
  };

  const initiateRemoveEmail = async () => {
    setIsRemoveActionLoading(true);
    try {
      const res = await fetchWithRetry(`${API_BASE_URL}/send-otp`, { method: 'POST', body: JSON.stringify({ email: currentEmail, otpType: 'VERIFY_EMAIL' }) });
      const data = await res.json();
      setIsRemoveActionLoading(false);
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        global.activeFlow = 'OTP_FLOW'; global.ignoreAppLock = true;
        setRemoveOtp(''); setRemoveEmailModalVisible(true);
        Animated.spring(removeEmailScaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }).start();
      } else { Alert.alert('Error', data.message || 'Failed to send OTP.'); }
    } catch (e) { setIsRemoveActionLoading(false); Alert.alert('Network Error', e.message); }
  };

  const verifyRemoveOtp = async () => {
    Keyboard.dismiss();
    if (removeOtp.length !== 6) return Alert.alert('Invalid', 'Enter 6-digit OTP.');
    setIsRemovingEmail(true);
    try {
      const res = await fetchWithRetry(`${API_BASE_URL}/verify-otp`, { method: 'POST', body: JSON.stringify({ email: currentEmail, otp: removeOtp }) });
      const data = await res.json();
      setIsRemovingEmail(false);
      if (data.success) {
        await AsyncStorage.multiRemove(['RECOVERY_EMAIL', 'SAFEGALLERY_RECOVERY_EMAIL', 'SAFEGALLERY_EMAIL_VERIFIED']);
        await updateSetting('recoveryEmail', ''); await updateSetting('emailRecovery', false); 
        await restoreLockStateSafe(); 
        setRemoveEmailModalVisible(false); removeEmailScaleAnim.setValue(0);
        runSadAnimationFlow();
        setTimeout(() => { 
          setShowRemoveCongratsModal(false); sadScaleAnim.setValue(0); sadSlideAnim.setValue(-100); 
          setCurrentEmail(''); setNewEmail(''); isFirstTimeSetup.current = true; setViewState('ADD'); 
        }, 2200); 
      } else { Alert.alert('Error', data.message || 'Wrong OTP'); setRemoveOtp(''); setTimeout(() => removeOtpInputRef.current?.focus(), 300); }
    } catch (e) { setIsRemovingEmail(false); Alert.alert('Error', e.message); }
  };

  const handleBackPress = () => {
    Keyboard.dismiss();
    if (isFirstTimeSetup.current && viewState === 'ADD') { Alert.alert("Action Required", "Linking an email is mandatory to secure your vault against data loss."); return; }
    global.otpSessionActive = false;
    if (viewState === 'OTP') setViewState('ADD');
    else if (viewState === 'ADD' && currentEmail) setViewState('MANAGE');
    else navigation.goBack();
  };

  if (viewState === 'LOADING') return (<View style={[styles.container, {backgroundColor: isDark ? themeColors.background : '#FAFAFB', justifyContent: 'center', alignItems: 'center'}]}><ActivityIndicator size="large" color={themeColors.primary} /></View>);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#121212' : '#FAFAFB' }]}>
      
      {/* 🚀 PREMIUM INFO GUIDE OVERLAY (I-BUTTON POPUP) */}
      {infoModalVisible && (
        <Modal transparent animationType="fade" visible={true} onRequestClose={closeInfoPopup}>
          <View style={styles.premiumSuccessOverlay}>
            <BlurView intensity={25} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeInfoPopup} />
            
            <Animated.View style={[styles.infoCard, { backgroundColor: isDark ? themeColors.card : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0', transform: [{ scale: infoScale }], opacity: infoOpacity }]}>
              
              <View style={[styles.infoIconBox, { backgroundColor: primaryColor + '15' }]}>
                <Feather name="mail" size={28} color={primaryColor} />
              </View>
              
              <Text style={[styles.infoTitle, { color: isDark ? '#FFF' : '#111827' }]}>OTP Delivery Guide</Text>
              <Text style={[styles.infoSub, { color: themeColors.textLight }]}>Having trouble finding your verification code?</Text>
              
              <View style={styles.infoListContainer}>
                <View style={styles.infoRow}>
                  <Feather name="alert-circle" size={20} color={primaryColor} style={styles.infoRowIcon} />
                  <View style={styles.infoTextContainer}>
                    <Text style={[styles.infoRowTitle, { color: isDark ? '#E2E8F0' : '#1F2937' }]}>Check Spam or Junk</Text>
                    <Text style={[styles.infoRowSub, { color: isDark ? '#94A3B8' : '#6B7280' }]}>Automated verification emails often get flagged by providers like Gmail. Please check your spam folder.</Text>
                  </View>
                </View>
                
                <View style={styles.infoRow}>
                  <Feather name="check-circle" size={20} color={primaryColor} style={styles.infoRowIcon} />
                  <View style={styles.infoTextContainer}>
                    <Text style={[styles.infoRowTitle, { color: isDark ? '#E2E8F0' : '#1F2937' }]}>Mark as "Not Spam"</Text>
                    <Text style={[styles.infoRowSub, { color: isDark ? '#94A3B8' : '#6B7280' }]}>If you find the OTP in spam, mark it as safe. This ensures future recovery codes arrive directly in your inbox.</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Feather name="clock" size={20} color={primaryColor} style={styles.infoRowIcon} />
                  <View style={styles.infoTextContainer}>
                    <Text style={[styles.infoRowTitle, { color: isDark ? '#E2E8F0' : '#1F2937' }]}>Network Delays</Text>
                    <Text style={[styles.infoRowSub, { color: isDark ? '#94A3B8' : '#6B7280' }]}>Sometimes mail servers experience heavy traffic. It may take up to 2 minutes for the email to arrive.</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: primaryColor, height: 52, marginTop: 10, width: '100%' }]} onPress={closeInfoPopup}>
                <Text style={styles.btnText}>I Understand</Text>
              </TouchableOpacity>

            </Animated.View>
          </View>
        </Modal>
      )}

      {/* 🔥 SYMMETRIC HEADER WITH I-BUTTON */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={[styles.backBtn, { backgroundColor: isDark ? themeColors.inputBg : '#FFFFFF' }]}>
          <Feather name="arrow-left" size={22} color={isDark ? '#FFF' : '#111827'} />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { color: isDark ? '#FFF' : '#111827' }]}>Recovery Email</Text>
        
        {/* Right Info Button (Shows only on OTP screen) */}
        {viewState === 'OTP' ? (
          <TouchableOpacity onPress={showInfoPopup} style={[styles.backBtn, { backgroundColor: isDark ? themeColors.inputBg : '#FFFFFF' }]}>
            <Feather name="info" size={22} color={isDark ? '#FFF' : '#111827'} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44, height: 44 }} />
        )}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          
          {viewState === 'MANAGE' && (
            <View style={styles.centerBlock}>
              <View style={[styles.premiumManageCard, { backgroundColor: isDark ? themeColors.card : '#FFFFFF', borderColor: isDark ? themeColors.separator : '#E5E7EB' }]}>
                
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24}}>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <View style={[styles.iconShieldSmall, { backgroundColor: themeColors.primary + '15' }]}><Feather name="mail" size={20} color={themeColors.primary} /></View>
                    <Text style={{fontSize: 13, fontWeight: '800', color: themeColors.textLight, letterSpacing: 1.5, marginLeft: 12}}>RECOVERY LINKED</Text>
                  </View>
                  <View style={styles.premiumVerifiedBadge}>
                    <Feather name="check-circle" size={12} color="#10B981" style={{marginRight: 4}}/>
                    <Text style={styles.premiumVerifiedText}>Secured</Text>
                  </View>
                </View>
                
                <Text style={[styles.premiumEmailText, { color: isDark ? '#FFF' : '#111827' }]}>{maskEmailSmart(currentEmail)}</Text>
                
                <View style={styles.actionRowGrid}>
                  <TouchableOpacity style={[styles.premiumActionBtn, { backgroundColor: isDark ? themeColors.inputBg : '#F3F4F6' }]} onPress={() => handleSecurePreCheck('CHANGE_EMAIL')} disabled={isMainActionLoading}>
                    {isMainActionLoading ? <ActivityIndicator color={themeColors.primary} /> : <><Feather name="edit-2" size={16} color={themeColors.primary} style={{marginRight: 8}}/><Text style={[styles.premiumActionText, { color: themeColors.primary }]}>Update</Text></>}
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={[styles.premiumActionBtn, { backgroundColor: themeColors.danger + '10' }]} onPress={() => handleSecurePreCheck('REMOVE_EMAIL')} disabled={isRemoveActionLoading}>
                    {isRemoveActionLoading ? <ActivityIndicator color={themeColors.danger} /> : <><Feather name="trash-2" size={16} color={themeColors.danger} style={{marginRight: 8}}/><Text style={[styles.premiumActionText, { color: themeColors.danger }]}>Remove</Text></>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {viewState === 'ADD' && (
            <View style={styles.centerBlock}>
              <View style={[styles.iconShieldLarge, { backgroundColor: themeColors.primary + '15' }]}><Feather name="mail" size={32} color={themeColors.primary} /></View>
              <Text style={[styles.title, { color: isDark ? '#FFF' : '#111827' }]}>Link Recovery Email</Text>
              <Text style={[styles.subtitle, { color: themeColors.textLight }]}>Adding an email ensures you can recover your vault if you forget your Master PIN.</Text>
              <TextInput style={[styles.inputBox, { backgroundColor: isDark ? themeColors.inputBg : '#FFF', color: isDark ? '#FFF' : '#111827', borderColor: isDark ? themeColors.separator : '#E5E7EB' }]} placeholder="Enter new email address" placeholderTextColor={themeColors.textLight} keyboardType="email-address" autoCapitalize="none" value={newEmail} onChangeText={setNewEmail} />
              
              {/* 🔥 FIXED SHADOW BLEED LOGIC HERE */}
              <TouchableOpacity 
                style={[
                  styles.primaryBtn, 
                  { backgroundColor: newEmail.includes('@') && !isLoading ? themeColors.primary : themeColors.primary + '40' },
                  (!newEmail.includes('@') || isLoading) && { elevation: 0, shadowOpacity: 0 }
                ]} 
                onPress={sendOtp} 
                disabled={isLoading || !newEmail.includes('@')}
              >
                {isLoading ? ( <View style={{flexDirection: 'row', alignItems: 'center'}}><ActivityIndicator color="#FFF" style={{marginRight: 8}} /><Text style={{color: '#FFF', fontWeight: 'bold'}}>{loadingText || 'Sending...'}</Text></View> ) : ( <Text style={[styles.btnText, !newEmail.includes('@') && {opacity: 0.8}]}>Send Code</Text> )}
              </TouchableOpacity>
            </View>
          )}

          {viewState === 'OTP' && (
            <View style={styles.centerBlock}>
              <View style={[styles.iconShieldLarge, { backgroundColor: themeColors.primary + '15' }]}><Feather name="shield" size={32} color={themeColors.primary} /></View>
              <Text style={[styles.title, { color: isDark ? '#FFF' : '#111827' }]}>Verify Email</Text>
              <Text style={[styles.subtitle, { color: themeColors.textLight }]}>Code sent to {maskEmailSmart(newEmail)}</Text>
              
              <OTPInputBox value={otp} setValue={setOtp} inputRef={otpInputRef} isDark={isDark} themeColors={themeColors} />
              
              {/* 🔥 FIXED SHADOW BLEED LOGIC HERE */}
              <TouchableOpacity 
                style={[
                  styles.primaryBtn, 
                  { backgroundColor: otp.length === 6 && !isLoading ? themeColors.primary : themeColors.primary + '40' },
                  (otp.length !== 6 || isLoading) && { elevation: 0, shadowOpacity: 0 }
                ]} 
                onPress={verifyOtp} 
                disabled={isLoading || otp.length !== 6}
              >
                {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.btnText, otp.length !== 6 && {opacity: 0.8}]}>Verify & Save</Text>}
              </TouchableOpacity>

              <View style={{ alignItems: 'center', marginBottom: 24, marginTop: 24 }}>
                <TouchableOpacity disabled={timeLeft > 0 || isLoading} onPress={sendOtp} style={{ marginBottom: 8 }}><Text style={{ fontSize: 14, color: timeLeft > 0 ? themeColors.textLight : themeColors.primary, fontWeight: '700' }}>{timeLeft > 0 ? `Resend code in ${timeLeft}s` : 'Resend Code'}</Text></TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', opacity: 0.6 }}><Feather name="info" size={12} color={themeColors.textLight} style={{ marginRight: 6 }} /><Text style={{ fontSize: 11, color: themeColors.textLight, fontWeight: '500', letterSpacing: 0.2 }}>Not in your inbox? Please check your spam folder.</Text></View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* --- MODALS --- */}
      <Modal visible={showSecureSessionWarning} animationType="fade" transparent={true}>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <View style={{width: 64, height: 64, borderRadius: 32, backgroundColor: themeColors.iconBg.appearance, justifyContent: 'center', alignItems: 'center', marginBottom: 16}}><Feather name="alert-triangle" size={32} color={themeColors.iconColor.appearance} /></View>
            <Text style={[styles.modalTitle, { color: themeColors.textDark }]}>Secure Session Required</Text>
            <Text style={[styles.modalSub, {textAlign: 'center'}]}>This action requires uninterrupted access. Auto-lock may interrupt the process.</Text>
            <View style={{flexDirection: 'row', backgroundColor: themeColors.inputBg, padding: 12, borderRadius: 12, marginBottom: 24, width: '100%', alignItems: 'flex-start'}}><Feather name="info" size={14} color={themeColors.textLight} /><Text style={{fontSize: 12, color: themeColors.textLight, marginLeft: 8, flex: 1, lineHeight: 18}}>Lock will be restored automatically after the process completes.</Text></View>
            <TouchableOpacity style={{width: '100%', height: 50, backgroundColor: themeColors.primary, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12}} onPress={handleDisableAndContinueFlow}><Text style={{color: '#FFF', fontSize: 15, fontWeight: 'bold'}}>Disable Lock & Continue</Text></TouchableOpacity>
            <TouchableOpacity style={{width: '100%', height: 50, backgroundColor: 'transparent', borderRadius: 14, justifyContent: 'center', alignItems: 'center'}} onPress={() => setShowSecureSessionWarning(false)}><Text style={{color: themeColors.textLight, fontSize: 15, fontWeight: '700'}}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={changeEmailModalVisible} transparent animationType="fade" onShow={() => setTimeout(() => oldOtpInputRef.current?.focus(), 200)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlayCenter}>
          <Animated.View style={[styles.premiumResetModalCompact, { backgroundColor: themeColors.card, transform: [{ scale: changeEmailScaleAnim }] }]}>
            <View style={styles.resetHeaderRow}>
              <View style={[styles.dangerIconSmall, { backgroundColor: themeColors.primary + '15' }]}><Feather name="shield" size={24} color={themeColors.primary} /></View>
              <View style={{ flex: 1 }}><Text style={[styles.resetModalTitleCompact, { color: themeColors.textDark }]}>Security Check</Text><Text style={[styles.resetModalDescCompact, { color: themeColors.textLight }]}>OTP sent to: {maskEmailSmart(currentEmail)}</Text></View>
            </View>
            <OTPInputBox value={oldOtp} setValue={setOldOtp} inputRef={oldOtpInputRef} isDark={isDark} themeColors={themeColors} />
            <View style={styles.resetBtnRow}>
              <TouchableOpacity style={[styles.resetBtnCancelHalf, { backgroundColor: themeColors.inputBg }]} onPress={async () => { setChangeEmailModalVisible(false); await restoreLockStateSafe(); }}><Text style={{ color: themeColors.textLight, fontSize: 15, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
              
              {/* 🔥 FIXED SHADOW BLEED LOGIC HERE */}
              <TouchableOpacity 
                style={[
                  styles.resetBtnActionHalf, 
                  { backgroundColor: oldOtp.length === 6 ? themeColors.primary : themeColors.primary + '40' },
                  oldOtp.length !== 6 && { elevation: 0, shadowOpacity: 0 }
                ]} 
                onPress={verifyOldOtp} 
                disabled={isChangingEmail || oldOtp.length !== 6}
              >
                {isChangingEmail ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800', opacity: oldOtp.length !== 6 ? 0.8 : 1 }}>Verify</Text>}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={removeEmailModalVisible} transparent animationType="fade" onShow={() => setTimeout(() => removeOtpInputRef.current?.focus(), 200)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlayCenter}>
          <Animated.View style={[styles.premiumResetModalCompact, { backgroundColor: themeColors.card, transform: [{ scale: removeEmailScaleAnim }] }]}>
            <View style={styles.resetHeaderRow}>
              <View style={[styles.dangerIconSmall, { backgroundColor: '#FEE2E2' }]}><Feather name="trash-2" size={24} color="#EF4444" /></View>
              <View style={{ flex: 1 }}><Text style={[styles.resetModalTitleCompact, { color: themeColors.textDark }]}>Remove Email</Text><Text style={[styles.resetModalDescCompact, { color: themeColors.textLight }]}>OTP sent to: {maskEmailSmart(currentEmail)}</Text></View>
            </View>
            <OTPInputBox value={removeOtp} setValue={setRemoveOtp} inputRef={removeOtpInputRef} isDark={isDark} themeColors={themeColors} isDanger />
            <View style={styles.resetBtnRow}>
              <TouchableOpacity style={[styles.resetBtnCancelHalf, { backgroundColor: themeColors.inputBg }]} onPress={async () => { setRemoveEmailModalVisible(false); await restoreLockStateSafe(); }}><Text style={{ color: themeColors.textLight, fontSize: 15, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
              
              {/* 🔥 FIXED SHADOW BLEED LOGIC HERE */}
              <TouchableOpacity 
                style={[
                  styles.resetBtnActionHalf, 
                  { backgroundColor: removeOtp.length === 6 ? '#EF4444' : '#EF4444' + '40' },
                  removeOtp.length !== 6 && { elevation: 0, shadowOpacity: 0 }
                ]} 
                onPress={verifyRemoveOtp} 
                disabled={isRemovingEmail || removeOtp.length !== 6}
              >
                {isRemovingEmail ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800', opacity: removeOtp.length !== 6 ? 0.8 : 1 }}>Remove</Text>}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showCongratsModal} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <Animated.View style={[styles.congratsCard, { backgroundColor: themeColors.card, transform: [{ scale: scaleAnim }] }]}>
            <Animated.View style={{ alignItems: 'center', justifyContent: 'center', position: 'relative', transform: [{translateY: smileSlideAnim}] }}><Animated.Text style={{fontSize: 64, position: 'absolute', top: -110}}>🎉</Animated.Text><Text style={[styles.congratsTitle, { color: themeColors.textDark, fontWeight: '900', marginTop: 15 }]}>Verified!</Text></Animated.View>
            <Text style={[styles.congratsSub, {color: themeColors.textLight}]}>Your email has been securely linked. Redirecting...</Text>
            <ActivityIndicator size="small" color="#10B981" style={{marginTop: 10}} />
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={showRemoveCongratsModal} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <Animated.View style={[styles.congratsCard, { backgroundColor: themeColors.card, transform: [{ scale: sadScaleAnim }] }]}>
            <Animated.View style={{ alignItems: 'center', justifyContent: 'center', position: 'relative', transform: [{translateY: sadSlideAnim}] }}><Animated.Text style={{fontSize: 64, position: 'absolute', top: -110}}>🗑️</Animated.Text><Text style={[styles.congratsTitle, { color: themeColors.textDark, fontWeight: '900', marginTop: 15 }]}>Removed</Text></Animated.View>
            <Text style={[styles.congratsSub, {color: themeColors.textLight}]}>Your recovery email has been successfully removed. Redirecting...</Text>
            <ActivityIndicator size="small" color={BP_COLORS.danger} style={{marginTop: 10}} />
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={showOnboardingCompleteModal} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.premiumModal, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
            <View style={[styles.pulseCircle, { borderColor: primaryColor + '40', backgroundColor: primaryColor + '10' }]}>
              <View style={[styles.iconCircle, { backgroundColor: primaryColor }]}><Feather name="shield" size={36} color="#FFF" /></View>
            </View>
            <Text style={[styles.alertTitle, { color: themeColors.textDark }]}>Setup Complete 🛡️</Text>
            <Text style={[styles.alertMessage, { color: themeColors.textLight }]}>Your vault is now fully secured with email recovery. Please lock and enter to access your private vault.</Text>
            <TouchableOpacity style={{ width: '100%', height: 60, borderRadius: 16, overflow: 'hidden' }} activeOpacity={0.8} onPress={() => { setShowOnboardingCompleteModal(false); navigation.reset({ index: 0, routes: [{ name: 'Lock' }] }); }}>
              <LinearGradient colors={[primaryColor, primaryColor + 'DD']} style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 }}>Lock & Enter</Text>
                <Feather name="lock" size={20} color="#FFF" style={{ marginLeft: 8 }} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, 
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 20, paddingBottom: 10 }, 
  backBtn: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', elevation: 2, borderWidth: 1, borderColor: 'rgba(156, 163, 175, 0.15)' }, 
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' }, 
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 }, centerBlock: { width: '100%', alignItems: 'center', paddingBottom: 40 },
  
  premiumManageCard: { width: '100%', borderRadius: 28, padding: 24, borderWidth: 1.5, elevation: 8, shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.1, shadowRadius: 15 },
  iconShieldSmall: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  premiumVerifiedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  premiumVerifiedText: { fontSize: 12, fontWeight: '800', color: '#10B981' },
  premiumEmailText: { fontSize: 22, fontWeight: '800', marginBottom: 32, letterSpacing: -0.5 },
  actionRowGrid: { flexDirection: 'row', gap: 12, width: '100%' },
  premiumActionBtn: { flex: 1, height: 50, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  premiumActionText: { fontSize: 15, fontWeight: '700' },
  
  iconShieldLarge: { width: 72, height: 72, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }, 
  title: { fontSize: 26, fontWeight: '800', marginBottom: 12, textAlign: 'center', letterSpacing: -0.5 }, subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32, paddingHorizontal: 10 },
  inputBox: { width: '100%', height: 60, borderRadius: 16, fontSize: 16, paddingHorizontal: 20, marginBottom: 24, borderWidth: 1 }, 
  primaryBtn: { width: '100%', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 }, btnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  
  otpContainer: { width: '100%', marginBottom: 32, alignItems: 'center' },
  otpContainerInner: { width: '100%', height: 64, position: 'relative' },
  otpPressableArea: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 10 }, 
  otpDigitBoxCompact: { flex: 1, height: 64, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }, 
  otpDigitText: { fontSize: 24, fontWeight: '800' }, 
  
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }, 
  modalContent: { width: '100%', borderRadius: 28, padding: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 12, alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 10 },
  modalSub: { fontSize: 15, marginBottom: 24, lineHeight: 22, textAlign: 'center', color: '#6B7280' },
  congratsCard: { width: '85%', borderRadius: 32, padding: 32, alignItems: 'center', elevation: 15 }, congratsIconBox: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }, congratsTitle: { fontSize: 28, fontWeight: '800', marginBottom: 10 }, congratsSub: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  premiumModal: { width: '100%', borderRadius: 32, padding: 32, alignItems: 'center', elevation: 20, overflow: 'hidden' }, pulseCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }, iconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' }, alertTitle: { fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 12 }, alertMessage: { fontSize: 15, textAlign: 'center', fontWeight: '500', marginBottom: 32, lineHeight: 22 },

  premiumResetModalCompact: { width: '100%', borderRadius: 28, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.15, shadowRadius: 30, elevation: 15 },
  resetHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  dangerIconSmall: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  resetModalTitleCompact: { fontSize: 22, fontWeight: '800' },
  resetModalDescCompact: { fontSize: 13, marginTop: 2 },
  resetBtnRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  resetBtnActionHalf: { flex: 1, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  resetBtnCancelHalf: { flex: 1, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },

  // 💡 PREMIUM INFO POPUP STYLES
  premiumSuccessOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.5)' },
  infoCard: { width: '100%', maxWidth: 340, padding: 28, borderRadius: 36, alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 20}, shadowOpacity: 0.25, shadowRadius: 30, elevation: 20, borderWidth: 1 },
  infoIconBox: { width: 64, height: 64, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  infoTitle: { fontSize: 22, fontWeight: '900', marginBottom: 6, letterSpacing: -0.5, textAlign: 'center' },
  infoSub: { fontSize: 14, textAlign: 'center', fontWeight: '500', marginBottom: 24 },
  infoListContainer: { width: '100%', gap: 16, marginBottom: 24 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 4 },
  infoRowIcon: { marginTop: 2, marginRight: 12 },
  infoTextContainer: { flex: 1 },
  infoRowTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  infoRowSub: { fontSize: 13, lineHeight: 20, fontWeight: '500' }
});
