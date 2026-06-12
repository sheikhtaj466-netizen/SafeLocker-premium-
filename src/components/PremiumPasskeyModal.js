import React, { useEffect, useRef, useState } from 'react';
import { 
  View, Text, StyleSheet, Modal, Animated, Easing, 
  TouchableOpacity, Dimensions, TextInput, KeyboardAvoidingView, Platform, Pressable
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function PremiumPasskeyModal({ 
  visible, 
  actionType, 
  onSuccess, 
  onFallback, 
  onCancel,
  isDark,
  themeColors
}) {
  const [fails, setFails] = useState(0);
  const [status, setStatus] = useState('IDLE'); 
  const [authMode, setAuthMode] = useState('BIO'); 
  
  const [fallbackPin, setFallbackPin] = useState('');
  const [storedPin, setStoredPin] = useState(null);
  const pinInputRef = useRef(null);

  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const rippleAnim1 = useRef(new Animated.Value(1)).current;
  const rippleAnim2 = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const content = {
    'RESET': { title: 'Confirm Vault Reset', color: '#EF4444' },
    'FORGOT_PIN': { title: 'Recover Master PIN', color: themeColors?.primary || '#6C5CE7' },
    'EMAIL_CHANGE': { title: 'Approve Email Update', color: '#3B82F6' },
    'RESTORE': { title: 'Restore Secure Backup', color: '#8B5CF6' },
    'DISABLE_SEC': { title: 'Modify Security Settings', color: '#F59E0B' }
  }[actionType] || { title: 'Authorize Action', color: themeColors?.primary || '#6C5CE7' };

  useEffect(() => {
    if (visible) {
      setFails(0); setStatus('IDLE'); setAuthMode('BIO'); setFallbackPin('');
      AsyncStorage.getItem('CUSTOM_PASSKEY_PIN').then(p => setStoredPin(p));
      
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true })
      ]).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 1250, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1250, useNativeDriver: true })
        ])
      ).start();

      startRipple();

      const timer = setTimeout(() => { triggerBiometric(); }, 120);
      return () => clearTimeout(timer);
    } else {
      scaleAnim.setValue(0.92); fadeAnim.setValue(0);
    }
  }, [visible]);

  useEffect(() => {
    if (authMode === 'PIN') {
      setTimeout(() => pinInputRef.current?.focus(), 300);
    }
  }, [authMode]);

  const startRipple = () => {
    rippleAnim1.setValue(1); rippleAnim2.setValue(1);
    Animated.loop(
      Animated.stagger(400, [
        Animated.timing(rippleAnim1, { toValue: 1.5, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(rippleAnim2, { toValue: 1.5, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true })
      ])
    ).start();
  };

  const triggerShake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start();
  };

  const triggerBiometric = async () => {
    setStatus('AUTHENTICATING');
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (!hasHardware || !isEnrolled) {
        setStatus('ERROR'); triggerShake();
        setTimeout(() => switchToNumericFallback(), 1000);
        return;
      }

      const auth = await LocalAuthentication.authenticateAsync({ 
        promptMessage: content.title, 
        fallbackLabel: 'Use Passkey PIN', 
        disableDeviceFallback: true
      });

      if (auth.success) {
        executeSuccess();
      } else if (auth.error === 'user_fallback') {
        switchToNumericFallback();
      } else {
        handleBioFailure();
      }
    } catch (e) {
      handleBioFailure();
    }
  };

  const handleBioFailure = () => {
    const newFails = fails + 1;
    setFails(newFails); setStatus('ERROR'); triggerShake();
    if (newFails >= 3) {
      setTimeout(() => switchToNumericFallback(), 1000);
    } else {
      setTimeout(() => setStatus('IDLE'), 1000);
    }
  };

  const switchToNumericFallback = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAuthMode('PIN');
    setStatus('IDLE');
    setFallbackPin('');
  };

  const handleUltimateFallback = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (actionType === 'FORGOT_PIN' && onFallback) {
      onFallback(); 
    } else {
      onCancel(); 
    }
  };

  const handlePinChange = (text) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    if (numericValue.length > fallbackPin.length) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFallbackPin(numericValue);

    if (storedPin && numericValue === storedPin) {
      executeSuccess();
    }
  };

  const submitPin = () => {
    if (fallbackPin === storedPin) {
      executeSuccess();
    } else {
      setStatus('ERROR'); triggerShake();
      setTimeout(() => { setFallbackPin(''); setStatus('IDLE'); }, 600);
    }
  };

  const executeSuccess = () => {
    setStatus('SUCCESS');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.05, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true })
    ]).start();
    setTimeout(() => onSuccess(), 800);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <BlurView intensity={isDark ? 40 : 18} tint={isDark ? "dark" : "light"} style={styles.overlay}>
<KeyboardAvoidingView behavior="padding" style={{width: '100%', alignItems: 'center'}}>
          <Animated.View style={[
            styles.modalCard, 
            { 
              backgroundColor: isDark ? themeColors.card : '#FFFFFF',
              transform: [{ scale: scaleAnim }, { translateX: shakeAnim }],
              opacity: fadeAnim,
              borderColor: status === 'ERROR' ? '#EF4444' : 'transparent',
              borderWidth: status === 'ERROR' ? 1.5 : 0
            }
          ]}>
            
            <Animated.View style={[styles.headerIconBox, { backgroundColor: content.color + '15', transform: [{ scale: pulseAnim }] }]}>
               {status === 'SUCCESS' ? ( <Feather name="check-circle" size={30} color="#10B981" /> ) : ( <Feather name="shield" size={30} color={content.color} /> )}
            </Animated.View>

            <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#111827' }]}>Authorize with Passkey</Text>
            <Text style={[styles.subtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{content.title}</Text>

            {authMode === 'BIO' ? (
              <>
                <TouchableOpacity activeOpacity={0.8} onPress={status === 'IDLE' ? triggerBiometric : null} style={[styles.bioCard, { borderColor: content.color + '40', backgroundColor: isDark ? themeColors.inputBg : '#F9FAFB' }]}>
                  <View style={styles.rippleContainer}>
                    <Animated.View style={[styles.ripple, { borderColor: content.color, opacity: rippleAnim1.interpolate({ inputRange: [1, 1.5], outputRange: [0.5, 0] }), transform: [{ scale: rippleAnim1 }] }]} />
                    <Animated.View style={[styles.ripple, { borderColor: content.color, opacity: rippleAnim2.interpolate({ inputRange: [1, 1.5], outputRange: [0.5, 0] }), transform: [{ scale: rippleAnim2 }] }]} />
                    <MaterialIcons name="fingerprint" size={32} color={content.color} />
                  </View>
                  <Text style={[styles.bioText, { color: isDark ? '#E5E7EB' : '#374151' }]}>
                    {status === 'AUTHENTICATING' ? 'Verifying...' : status === 'ERROR' ? 'Fingerprint not recognized' : status === 'SUCCESS' ? 'Verified!' : 'Touch fingerprint sensor'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.btnRow}>
                  <TouchableOpacity style={[styles.btnCancel, { backgroundColor: isDark ? themeColors.inputBg : '#F3F4F6' }]} onPress={onCancel}><Text style={[styles.btnCancelText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.btnFallback, { borderColor: content.color, backgroundColor: fails >= 2 ? content.color + '15' : 'transparent' }]} onPress={switchToNumericFallback}>
                    <Text style={[styles.btnFallbackText, { color: content.color }]}>Use Passkey PIN</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={{fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 1, marginBottom: 8}}>ENTER NUMERIC FALLBACK</Text>
                
                <View style={[styles.dynamicPinContainer, { backgroundColor: isDark ? themeColors.inputBg : '#F3F4F6', borderColor: status === 'ERROR' ? '#EF4444' : (isDark ? '#334155' : '#E5E7EB'), borderWidth: status === 'ERROR' ? 1.5 : 1 }]}>
                  <TextInput
                    ref={pinInputRef}
                    style={[styles.dynamicPinInput, { color: isDark ? '#FFF' : '#0F172A' }]}
                    keyboardType="numeric"
                    placeholder="PIN"
                    placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                    value={fallbackPin}
                    onChangeText={handlePinChange}
                    onSubmitEditing={submitPin}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={[styles.pinSubmitBtn, { backgroundColor: fallbackPin.length >= 4 ? content.color : (isDark ? '#3D4B60' : '#E2E8F0') }]}
                    onPress={submitPin}
                    disabled={fallbackPin.length < 4}
                  >
                    <Feather name="arrow-right" size={20} color={fallbackPin.length >= 4 ? '#FFF' : (isDark ? '#94A3B8' : '#94A3B8')} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={[styles.btnCancelFull, { backgroundColor: actionType === 'FORGOT_PIN' ? content.color + '10' : (isDark ? themeColors.inputBg : '#F3F4F6'), borderWidth: actionType === 'FORGOT_PIN' ? 1 : 0, borderColor: actionType === 'FORGOT_PIN' ? content.color + '40' : 'transparent' }]} 
                  onPress={handleUltimateFallback}
                >
                  <Text style={[styles.btnCancelText, { color: actionType === 'FORGOT_PIN' ? content.color : (isDark ? '#D1D5DB' : '#4B5563') }]}>
                    {actionType === 'FORGOT_PIN' ? 'Other Recovery Methods' : 'Cancel Authentication'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

          </Animated.View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 20 },
  modalCard: { width: '100%', maxWidth: 420, minHeight: 360, borderRadius: 32, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.25, shadowRadius: 30, elevation: 20 },
  headerIconBox: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -0.8, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 32 },
  bioCard: { width: '100%', height: 84, borderRadius: 22, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 32 },
  rippleContainer: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  ripple: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  bioText: { flex: 1, fontSize: 15, fontWeight: '600' },
  btnRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 12 },
  btnCancel: { flex: 1, height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  btnCancelFull: { width: '100%', height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  btnCancelText: { fontSize: 16, fontWeight: '700' },
  btnFallback: { flex: 1, height: 54, borderRadius: 16, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  btnFallbackText: { fontSize: 16, fontWeight: '800' },
  dynamicPinContainer: { width: '100%', height: 64, borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 10, marginBottom: 24 },
  dynamicPinInput: { flex: 1, fontSize: 28, fontWeight: '800', letterSpacing: 10 },
  pinSubmitBtn: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }
});
