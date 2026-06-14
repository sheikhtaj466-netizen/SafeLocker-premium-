// File: src/screens/RecoveryScreen.js
import React, { useState, useEffect, useRef, useContext } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, TextInput, 
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Pressable, Keyboard, Modal
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur'; 

import { ThemeContext } from '../ThemeContext';
import { 
  getRecoveryEmail, getEmailVerified, getRecoveryCode, 
  saveMasterPin, clearAllData
} from '../utils/storage';

import { getDB } from '../utils/database';
import { CryptoEngine } from '../utils/cryptoEngine';

const API_BASE_URL = 'https://safelockers.sheikhtaj3010.workers.dev';

// 🔥 SMART BOX FOR 6-DIGIT EMAIL OTP
const SmartInputBox = ({ value, setValue, inputRef, isDark, themeColors, isError, length = 6 }) => (
  <View style={styles.otpContainer}>
    <Pressable style={styles.otpPressableArea} onPress={() => { inputRef.current?.focus(); }}>
      {Array.from({ length }).map((_, index) => {
        const isActive = value.length === index;
        const isFilled = value.length > index;
        return (
          <View key={index} style={[styles.otpDigitBox, { 
            backgroundColor: isDark ? themeColors.inputBg : '#FFFFFF', 
            borderColor: isError ? '#EF4444' : (isActive ? themeColors.primary : (isFilled ? themeColors.primary + '60' : (isDark ? '#334155' : '#E5E7EB'))),
            borderWidth: isError || isActive ? 2 : 1.5,
          }]}>
            <Text style={[styles.otpDigitText, { color: isError ? '#EF4444' : (isDark ? '#FFF' : '#111827'), fontSize: 24 }]}>
              {value[index] || ''}
            </Text>
          </View>
        );
      })}
    </Pressable>
    <TextInput 
      ref={inputRef} style={styles.hiddenInput} 
      keyboardType="number-pad" autoCapitalize="none"
      maxLength={length} value={value} onChangeText={setValue} 
      caretHidden={true} autoCorrect={false} blurOnSubmit={false}
    />
  </View>
);

export default function RecoveryScreen({ navigation }) {
  const { isDark, themeColors } = useContext(ThemeContext);
  const primaryColor = themeColors?.primary || '#A78BFA'; 

  const [step, setStep] = useState('OPTIONS'); 
  const [otpPurpose, setOtpPurpose] = useState(''); 
  const [loading, setLoading] = useState(false);
  
  const [savedEmail, setSavedEmail] = useState(null);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [savedCode, setSavedCode] = useState(null);

  const [otp, setOtp] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [isError, setIsError] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [resendTimer, setResendTimer] = useState(30); 
  
  // 💡 STATE FOR INFO POPUP
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  
  // Animations
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const wipeFadeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.5)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const infoScale = useRef(new Animated.Value(0.85)).current;
  const infoOpacity = useRef(new Animated.Value(0)).current;

  const otpInputRef = useRef(null);
  const codeInputRef = useRef(null);

  useEffect(() => { loadRecoveryMethods(); }, []);

  // Timer Logic
  useEffect(() => {
    let interval;
    if (step === 'EMAIL_OTP' && resendTimer > 0) {
      interval = setInterval(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  const loadRecoveryMethods = async () => {
    const email = await getRecoveryEmail();
    const verified = await getEmailVerified();
    const code = await getRecoveryCode();
    
    setSavedEmail(email);
    setIsEmailVerified(verified);
    setSavedCode(code);
  };

  const triggerErrorShake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setIsError(true);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start(() => setIsError(false)); 
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

  useEffect(() => {
    if (step === 'EMAIL_OTP' && otp.length === 6 && !loading) handleVerifyOTP();
  }, [otp]);

  useEffect(() => {
    if (step === 'CODE_ENTRY' && inputCode.length >= 4 && !loading) {
        const cleanSaved = savedCode ? savedCode.replace(/[^0-9]/g, '') : '';
        if(cleanSaved && inputCode.length === cleanSaved.length) {
            handleVerifyCode();
        }
    }
  }, [inputCode]);

  const handleSendOTP = async (purpose) => {
    if (!isEmailVerified || !savedEmail) {
      return Alert.alert("Not Available", "You haven't verified a recovery email.");
    }
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: savedEmail, otpType: purpose === 'RESET_VAULT' ? 'CRITICAL_RESET' : 'VERIFY_EMAIL' })
      });
      const data = await res.json();
      setLoading(false);
      
      if (data.success) {
        setOtpPurpose(purpose);
        setStep('EMAIL_OTP');
        setOtp('');
        setResendTimer(30); 
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => otpInputRef.current?.focus(), 500); 
      } else { Alert.alert('Error', data.message); }
    } catch (e) { setLoading(false); Alert.alert('Network Error', 'Ensure backend is running.'); }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) return;
    Keyboard.dismiss(); setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: savedEmail, otp })
      });
      const data = await res.json();
      setLoading(false);
      
      if (data.success) { 
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); 
        if (otpPurpose === 'RESET_VAULT') startWipingProcess(); else setStep('NEW_PIN'); 
      } 
      else { setOtp(''); triggerErrorShake(); setTimeout(() => otpInputRef.current?.focus(), 500); }
    } catch (e) { setLoading(false); setOtp(''); triggerErrorShake(); }
  };

  const handleVerifyCode = () => {
    if (!inputCode.trim()) return;
    const cleanInput = inputCode.replace(/[^0-9]/g, '');
    const cleanSaved = savedCode ? savedCode.replace(/[^0-9]/g, '') : '';

    if (cleanInput === cleanSaved && cleanSaved !== '') {
      Keyboard.dismiss(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setStep('NEW_PIN');
    } else { setInputCode(''); triggerErrorShake(); setTimeout(() => codeInputRef.current?.focus(), 500); }
  };

  const initiateSafeReset = () => {
    Alert.alert(
      "Safe Reset Vault", 
      "This action will permanently WIPE all your encrypted data to protect your privacy. To proceed, we need to verify your identity via Email OTP.", 
      [
        { text: "Cancel", style: "cancel" },
        { text: "Send OTP", style: "destructive", onPress: () => handleSendOTP('RESET_VAULT') }
      ]
    );
  };

  const startWipingProcess = () => {
    setStep('WIPING_ANIMATION');
    Animated.timing(wipeFadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start(async () => {
      try {
        await clearAllData();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => { navigation.replace('Lock'); }, 1500);
      } catch (error) { Alert.alert("Error", "Could not complete vault reset."); setStep('OPTIONS'); }
    });
  };

  const showPremiumSuccess = () => {
    setSuccessModalVisible(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
      Animated.timing(successOpacity, { toValue: 1, duration: 250, useNativeDriver: true })
    ]).start();

    setTimeout(() => {
      Animated.timing(successOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
         setSuccessModalVisible(false);
         navigation.replace('Lock');
      });
    }, 1800);
  };

  const handleSetNewPin = async () => {
    if (newPin.length !== 4 || confirmPin.length !== 4) return;
    if (newPin !== confirmPin) {
       triggerErrorShake(); setNewPin(''); setConfirmPin('');
       return Alert.alert("Error", "PINs do not match.");
    }
    
    setLoading(true);
    try {
      const masterKey = await CryptoEngine.recoverVaultKey();
      
      if (masterKey) {
        await CryptoEngine.resetPinWithRecovery(masterKey, newPin);
        await saveMasterPin(newPin); 
        setLoading(false);
        showPremiumSuccess(); 
      } else {
        setLoading(false);
        Alert.alert("Security Alert", "Recovery token is missing or corrupted.");
      }
    } catch (error) {
      setLoading(false);
      Alert.alert("System Error", "Failed to secure vault with new PIN.");
    }
  };

  const getMaskedEmail = (email) => {
    if (!email) return '';
    const [name, domain] = email.split('@');
    if (name.length <= 3) return email; 
    return `${name.substring(0, 2)}****${name.slice(-2)}@${domain}`;
  };

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
              <Text style={[styles.infoSub, { color: themeColors.textLight }]}>Having trouble finding your recovery code?</Text>
              
              <View style={styles.infoListContainer}>
                <View style={styles.infoRow}>
                  <Feather name="alert-circle" size={20} color={primaryColor} style={styles.infoRowIcon} />
                  <View style={styles.infoTextContainer}>
                    <Text style={[styles.infoRowTitle, { color: isDark ? '#E2E8F0' : '#1F2937' }]}>Check Spam or Junk</Text>
                    <Text style={[styles.infoRowSub, { color: isDark ? '#94A3B8' : '#6B7280' }]}>Automated security emails often get flagged by providers like Gmail. Please check your spam folder.</Text>
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

              <TouchableOpacity style={[styles.btn, { backgroundColor: primaryColor, height: 52, marginTop: 10, width: '100%' }]} onPress={closeInfoPopup}>
                <Text style={styles.btnText}>I Understand</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* 🚀 PREMIUM SUCCESS OVERLAY */}
      {successModalVisible && (
        <Modal transparent animationType="none" visible={true}>
          <BlurView intensity={50} tint="dark" style={styles.premiumSuccessOverlay}>
            <Animated.View style={[styles.successCard, { backgroundColor: isDark ? themeColors.card : '#FFFFFF', transform: [{ scale: successScale }], opacity: successOpacity }]}>
              <View style={styles.successIconBox}><Feather name="check" size={40} color="#10B981" /></View>
              <Text style={[styles.successTitle, { color: isDark ? '#FFF' : '#111827' }]}>PIN Updated</Text>
              <Text style={[styles.successSub, { color: themeColors.textLight }]}>Your vault is now secured with your new PIN.</Text>
            </Animated.View>
          </BlurView>
        </Modal>
      )}

      {/* HEADER */}
      {step !== 'WIPING_ANIMATION' && (
        <View style={[styles.header, { paddingTop: Platform.OS === 'android' ? 20 : 0 }]}>
          <TouchableOpacity onPress={() => step === 'OPTIONS' ? navigation.goBack() : setStep('OPTIONS')} style={[styles.actionBtn, { backgroundColor: isDark ? themeColors.inputBg : '#FFFFFF', borderColor: isDark ? themeColors.separator : '#E5E7EB' }]}>
            <Feather name="arrow-left" size={22} color={isDark ? '#FFF' : '#111827'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: isDark ? '#FFF' : '#111827' }]}>{step === 'EMAIL_OTP' ? 'Recovery Email' : 'Account Recovery'}</Text>
          {step === 'EMAIL_OTP' ? (
            <TouchableOpacity onPress={showInfoPopup} style={[styles.actionBtn, { backgroundColor: isDark ? themeColors.inputBg : '#FFFFFF', borderColor: isDark ? themeColors.separator : '#E5E7EB' }]}>
              <Feather name="info" size={22} color={isDark ? '#FFF' : '#111827'} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44, height: 44 }} />
          )}
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          {/* OPTIONS SCREEN */}
          {step === 'OPTIONS' && (
            <View style={styles.content}>
              <View style={[styles.iconCircle, { backgroundColor: themeColors.primaryLight }]}><Feather name="shield" size={40} color={primaryColor} /></View>
              <Text style={[styles.title, { color: isDark ? '#FFF' : '#111827' }]}>Forgot Master PIN?</Text>
              <Text style={[styles.subtitle, { color: themeColors.textLight }]}>Choose a secure method to verify your identity and restore access to your vault.</Text>

              <TouchableOpacity style={[styles.optionCard, { backgroundColor: isDark ? themeColors.card : '#FFFFFF', borderColor: isDark ? themeColors.separator : '#F3F4F6' }, !isEmailVerified && { opacity: 0.6 }]} activeOpacity={0.7} onPress={() => handleSendOTP('RECOVER_PIN')}>
                <View style={[styles.optionIcon, { backgroundColor: themeColors.iconBg.email }]}><Feather name="mail" size={24} color={themeColors.iconColor.email} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: isDark ? '#FFF' : '#111827' }]}>Email Recovery</Text>
                  <Text style={[styles.optionSub, { color: themeColors.textLight }]}>{isEmailVerified ? `Send OTP to ${getMaskedEmail(savedEmail)}` : 'Not setup'}</Text>
                </View>
                <Feather name="chevron-right" size={20} color={themeColors.textLight} />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.optionCard, { backgroundColor: isDark ? themeColors.card : '#FFFFFF', borderColor: isDark ? themeColors.separator : '#F3F4F6' }]} activeOpacity={0.7} onPress={() => { setStep('CODE_ENTRY'); setTimeout(() => codeInputRef.current?.focus(), 500); }}>
                <View style={[styles.optionIcon, { backgroundColor: themeColors.iconBg.security }]}><Feather name="key" size={24} color={themeColors.iconColor.security} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: isDark ? '#FFF' : '#111827' }]}>Use Recovery Code</Text>
                  <Text style={[styles.optionSub, { color: themeColors.textLight }]}>Enter your offline security key</Text>
                </View>
                <Feather name="chevron-right" size={20} color={themeColors.textLight} />
              </TouchableOpacity>

              <View style={{ marginTop: 40, alignItems: 'center' }}>
                <Text style={{ color: themeColors.textLight, fontSize: 13, marginBottom: 12 }}>Lost all recovery access?</Text>
                <TouchableOpacity onPress={initiateSafeReset}>
                  <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 15 }}>Safe Reset Vault</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* OTP SCREEN */}
          {step === 'EMAIL_OTP' && (
            <View style={styles.content}>
              <View style={[styles.iconCircle, { backgroundColor: otpPurpose === 'RESET_VAULT' ? '#FEF2F2' : primaryColor + '15' }]}>
                <Feather name={otpPurpose === 'RESET_VAULT' ? "alert-triangle" : "shield"} size={36} color={otpPurpose === 'RESET_VAULT' ? "#EF4444" : primaryColor} />
              </View>
              
              <Text style={[styles.title, { color: isDark ? '#FFF' : '#111827' }]}>Verify Email</Text>
              <Text style={[styles.subtitle, { color: themeColors.textLight }]}>Code sent to {getMaskedEmail(savedEmail)}</Text>
              
              <Animated.View style={{ width: '100%', transform: [{ translateX: shakeAnim }], marginBottom: 16 }}>
                <SmartInputBox value={otp} setValue={setOtp} inputRef={otpInputRef} isDark={isDark} themeColors={themeColors} isError={isError} length={6} />
              </Animated.View>

              {/* 🔥 FIXED SHADOW BLEED LOGIC HERE */}
              <TouchableOpacity 
                style={[
                  styles.btn, 
                  { backgroundColor: otp.length === 6 && !loading ? primaryColor : primaryColor + '40' },
                  (otp.length !== 6 || loading) && { elevation: 0, shadowOpacity: 0 } // Fixes Android shadow bleed
                ]} 
                onPress={handleVerifyOTP}
                disabled={otp.length !== 6 || loading}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.btnText, (otp.length !== 6 || loading) && { opacity: 0.8 }]}>Verify & Save</Text>}
              </TouchableOpacity>

              <View style={styles.footerInfoBox}>
                {resendTimer > 0 ? (
                  <Text style={[styles.resendText, { color: isDark ? '#9CA3AF' : '#4B5563' }]}>Resend code in <Text style={{fontWeight: '800'}}>{resendTimer}s</Text></Text>
                ) : (
                  <TouchableOpacity onPress={() => handleSendOTP(otpPurpose)}>
                    <Text style={[styles.resendActiveText, { color: primaryColor }]}>Resend Code</Text>
                  </TouchableOpacity>
                )}
                
                <View style={styles.spamNoteRow}>
                  <Feather name="info" size={14} color={isDark ? '#9CA3AF' : '#9CA3AF'} style={{ marginTop: 2 }} />
                  <Text style={[styles.spamNoteText, { color: isDark ? '#9CA3AF' : '#9CA3AF' }]}>Not in your inbox? Please check your spam folder.</Text>
                </View>
              </View>
            </View>
          )}

          {/* CODE ENTRY SCREEN */}
          {step === 'CODE_ENTRY' && (
            <View style={styles.content}>
              <View style={[styles.iconCircle, { backgroundColor: themeColors.iconBg.security }]}><Feather name="key" size={40} color={themeColors.iconColor.security} /></View>
              <Text style={[styles.title, { color: isDark ? '#FFF' : '#111827' }]}>Recovery Code</Text>
              <Text style={[styles.subtitle, { color: themeColors.textLight }]}>Enter your 4 to 6 digit offline recovery code.</Text>
              
              <Animated.View style={{ width: '100%', transform: [{ translateX: shakeAnim }] }}>
                <TextInput 
                  ref={codeInputRef}
                  style={[styles.input, { backgroundColor: isDark ? themeColors.inputBg : '#FFFFFF', color: isDark ? '#FFF' : '#111827', borderColor: isError ? '#EF4444' : (isDark ? themeColors.separator : '#E5E7EB') }]} 
                  value={inputCode} 
                  onChangeText={(v) => { setInputCode(v); setIsError(false); }} 
                  keyboardType="number-pad" 
                  maxLength={6} 
                  placeholder="• • • • • •" 
                  placeholderTextColor={themeColors.textLight} 
                  autoFocus 
                />
              </Animated.View>

              {/* 🔥 FIXED SHADOW BLEED LOGIC HERE */}
              <TouchableOpacity 
                style={[
                  styles.btn, 
                  { backgroundColor: inputCode.length >= 4 && !loading ? primaryColor : primaryColor + '40', marginTop: 24 },
                  (inputCode.length < 4 || loading) && { elevation: 0, shadowOpacity: 0 }
                ]} 
                onPress={handleVerifyCode}
                disabled={inputCode.length < 4 || loading}
              >
                <Text style={[styles.btnText, (inputCode.length < 4 || loading) && { opacity: 0.8 }]}>Verify Code</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* NEW PIN SCREEN */}
          {step === 'NEW_PIN' && (
            <View style={styles.content}>
              <View style={[styles.iconCircle, { backgroundColor: '#EAFBF3' }]}><Feather name="check" size={40} color="#2ECC71" /></View>
              <Text style={[styles.title, { color: isDark ? '#FFF' : '#111827' }]}>Identity Verified</Text>
              <Text style={[styles.subtitle, { color: themeColors.textLight }]}>Create a new 4-digit Master PIN to secure your vault. No data will be lost.</Text>
              
              <Animated.View style={{ width: '100%', transform: [{ translateX: shakeAnim }] }}>
                <TextInput style={[styles.input, { backgroundColor: isDark ? themeColors.inputBg : '#FFFFFF', color: isDark ? '#FFF' : '#111827', borderColor: isError ? '#EF4444' : (isDark ? themeColors.separator : '#E5E7EB') }]} value={newPin} onChangeText={(v) => { setNewPin(v); setIsError(false); }} keyboardType="number-pad" maxLength={4} placeholder="New PIN" placeholderTextColor={themeColors.textLight} secureTextEntry autoFocus />
                <TextInput style={[styles.input, { marginTop: 16, backgroundColor: isDark ? themeColors.inputBg : '#FFFFFF', color: isDark ? '#FFF' : '#111827', borderColor: isError ? '#EF4444' : (isDark ? themeColors.separator : '#E5E7EB') }]} value={confirmPin} onChangeText={(v) => { setConfirmPin(v); setIsError(false); }} keyboardType="number-pad" maxLength={4} placeholder="Confirm PIN" placeholderTextColor={themeColors.textLight} secureTextEntry />
              </Animated.View>

              {loading ? (
                <ActivityIndicator color={primaryColor} style={{ marginTop: 30 }} size="large" />
              ) : (
                /* 🔥 FIXED SHADOW BLEED LOGIC HERE */
                <TouchableOpacity 
                  style={[
                    styles.btn, 
                    { backgroundColor: newPin.length === 4 && confirmPin.length === 4 ? primaryColor : primaryColor + '40', marginTop: 24 },
                    (newPin.length < 4 || confirmPin.length < 4) && { elevation: 0, shadowOpacity: 0 }
                  ]} 
                  onPress={handleSetNewPin} 
                  disabled={newPin.length < 4 || confirmPin.length < 4}
                >
                  <Text style={[styles.btnText, (newPin.length < 4 || confirmPin.length < 4) && { opacity: 0.8 }]}>Save New PIN</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {step === 'WIPING_ANIMATION' && (
             <Animated.View style={[styles.content, { flex: 1, justifyContent: 'center', opacity: wipeFadeAnim, marginTop: 100 }]}>
               <ActivityIndicator size="large" color="#EF4444" />
               <Text style={[styles.title, { color: isDark ? '#FFF' : '#111827', marginTop: 24 }]}>Securely Erasing Data...</Text>
               <Text style={[styles.subtitle, { color: themeColors.textLight }]}>Please do not close the app. Ensuring no traces are left behind.</Text>
             </Animated.View>
          )}

        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  actionBtn: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  content: { paddingHorizontal: 24, paddingTop: 20, alignItems: 'center' },
  iconCircle: { width: 88, height: 88, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '900', marginBottom: 12, textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32, fontWeight: '500' },
  optionCard: { width: '100%', flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2, borderWidth: 1 },
  optionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  optionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  optionSub: { fontSize: 13, fontWeight: '600' },
  
  input: { width: '100%', height: 60, borderRadius: 16, paddingHorizontal: 20, borderWidth: 1.5, letterSpacing: 10, textAlign: 'center', fontSize: 24, fontWeight: 'bold' },
  btn: { width: '100%', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#A78BFA', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  
  otpContainer: { width: '100%', marginBottom: 16, alignItems: 'center' },
  otpPressableArea: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 8 },
  otpDigitBox: { flex: 1, aspectRatio: 0.85, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  otpDigitText: { fontWeight: '900' },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },

  footerInfoBox: { alignItems: 'center', marginTop: 32, width: '100%' },
  resendText: { fontSize: 15, fontWeight: '600', marginBottom: 16 },
  resendActiveText: { fontSize: 15, fontWeight: '800', marginBottom: 16 },
  spamNoteRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 6, paddingHorizontal: 10 },
  spamNoteText: { fontSize: 12, fontWeight: '500', textAlign: 'center', lineHeight: 18, flexShrink: 1 },

  premiumSuccessOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.5)' },
  successCard: { width: '100%', maxWidth: 280, padding: 32, borderRadius: 36, alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 16}, shadowOpacity: 0.2, shadowRadius: 24, elevation: 15, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' },
  successIconBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(16, 185, 129, 0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successTitle: { fontSize: 20, fontWeight: '900', marginBottom: 6, letterSpacing: -0.5 },
  successSub: { fontSize: 14, textAlign: 'center', fontWeight: '500', lineHeight: 22 },

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
