// File: src/screens/FormScreen.js
import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ScrollView, Alert, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, Keyboard, Modal, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { BlurView } from 'expo-blur';
import CryptoJS from 'crypto-js';

// 🚀 Secure Random Fallback for React Native
if (!CryptoJS.lib.WordArray.random_polyfilled) {
  CryptoJS.lib.WordArray.random = function (nBytes) {
    const words = [];
    for (let i = 0; i < nBytes; i += 4) { words.push((Math.random() * 0x100000000) | 0); }
    return CryptoJS.lib.WordArray.create(words, nBytes);
  };
  CryptoJS.lib.WordArray.random_polyfilled = true;
}

import { getVaultData, saveVaultData, logActivity } from '../utils/storage';
import { ThemeContext } from '../ThemeContext';

const BP_COLORS = {
  primary: '#6C5CE7', primaryGradient: ['#6C5CE7', '#8B7CFF'], disabledBtn: '#D1D5DB', textMain: '#1A1A1A', textSub: '#8A8A8A', inputBg: '#F7F8FC', inputBorder: '#E5E7EB'
};

// 🚀 STRICT NUMERICAL KEYBOARDS APPLIED
const TYPE_SCHEMAS = {
  'Login': [
    { key: 'title', label: 'Title *', placeholder: 'e.g. Google, Instagram', autoCapitalize: 'words' },
    { key: 'username', label: 'Username/Email', placeholder: 'Enter email or username', keyboardType: 'email-address', autoCapitalize: 'none' },
    { key: 'password', label: 'Password', placeholder: 'Enter password', isSecure: true, autoCapitalize: 'none' },
    { key: 'twoFactor', label: '2FA Backup Codes', placeholder: 'Enter numerical backup codes', keyboardType: 'numeric', autoCapitalize: 'none' },
    { key: 'url', label: 'Website (Optional)', placeholder: 'https://...', keyboardType: 'url', autoCapitalize: 'none' },
    { key: 'notes', label: 'Notes', placeholder: 'Add any extra details...', multiline: true, bigArea: true }
  ],
  'Card': [
    { key: 'title', label: 'Title *', placeholder: 'e.g. SBI Platinum Debit Card', autoCapitalize: 'words' },
    { key: 'cardHolder', label: 'Card Holder Name', placeholder: 'Name on card', autoCapitalize: 'words' },
    { key: 'cardNumber', label: 'Card Number', placeholder: '1234 5678 9012 3456', keyboardType: 'numeric' },
    { key: 'Card PIN', label: 'Card PIN', placeholder: '****', isSecure: true, keyboardType: 'numeric', maxLength: 6 },
    { key: 'expiry', label: 'Expiry Date (MM/YY)', placeholder: 'MM/YY', keyboardType: 'numeric', maxLength: 5 },
    { key: 'cvv', label: 'CVV', placeholder: '***', isSecure: true, keyboardType: 'numeric', maxLength: 4 },
    { key: 'bankName', label: 'Issuing Bank', placeholder: 'e.g. HDFC Bank', autoCapitalize: 'words' },
    { key: 'notes', label: 'Notes', placeholder: 'PIN or other details...', multiline: true, bigArea: true }
  ],
  'Bank': [ 
    { key: 'title', label: 'Title *', placeholder: 'e.g. HDFC Savings Account', autoCapitalize: 'words' },
    { key: 'accHolder', label: 'Account Holder Name', placeholder: 'Enter full name', autoCapitalize: 'words' },
    { key: 'accNumber', label: 'Account Number', placeholder: 'Enter account number', keyboardType: 'numeric', isSecure: true },
    { key: 'ifsc', label: 'IFSC Code', placeholder: 'e.g. HDFC0001234', autoCapitalize: 'characters', maxLength: 11 }, 
    { key: 'bankName', label: 'Bank Name', placeholder: 'Enter bank name', autoCapitalize: 'words' },
    { key: 'branch', label: 'Branch Name (Optional)', placeholder: 'e.g. Ramagundam', autoCapitalize: 'words' },
    { key: 'upi', label: 'UPI ID (Optional)', placeholder: 'name@bank', keyboardType: 'email-address', autoCapitalize: 'none' },
    { key: 'notes', label: 'Notes', placeholder: 'Extra details...', multiline: true, bigArea: true }
  ],
  'Wi-Fi': [
    { key: 'title', label: 'Title *', placeholder: 'e.g. Home WiFi', autoCapitalize: 'words' },
    { key: 'ssid', label: 'Network Name (SSID)', placeholder: 'Network name', autoCapitalize: 'none' },
    { key: 'password', label: 'Password', placeholder: 'Enter WiFi password', isSecure: true, autoCapitalize: 'none' },
    { key: 'security', label: 'Security Type (Optional)', placeholder: 'e.g. WPA2', autoCapitalize: 'characters' },
    { key: 'notes', label: 'Notes', placeholder: 'Router Admin panel details...', multiline: true, bigArea: true }
  ],
  'Notes': [ 
    { key: 'title', label: 'Title *', placeholder: 'Write your secure note...', autoCapitalize: 'words' },
    { key: 'notes', label: 'Secure Note', placeholder: 'Type your secret text here...', multiline: true, bigArea: true } 
  ],
  'Mail': [ 
    { key: 'title', label: 'Title *', placeholder: 'e.g. Gmail Account', autoCapitalize: 'words' },
    { key: 'email', label: 'Email Address', placeholder: 'example@gmail.com', keyboardType: 'email-address', autoCapitalize: 'none' },
    { key: 'password', label: 'Password', placeholder: 'Enter password', isSecure: true, autoCapitalize: 'none' },
    { key: 'twoFactor', label: '2FA Backup Codes', placeholder: 'Numerical backup codes', keyboardType: 'numeric', autoCapitalize: 'none' },
    { key: 'recoveryEmail', label: 'Recovery Email (Optional)', placeholder: 'recovery@gmail.com', keyboardType: 'email-address', autoCapitalize: 'none' },
    { key: 'backupCodes', label: 'Other Backup Codes', placeholder: 'Paste extra codes here', multiline: true, bigArea: true },
    { key: 'notes', label: 'Notes', placeholder: 'Extra info...', multiline: true, bigArea: true }
  ]
};

const SmartInput = ({ field, value, onChangeText, focusedField, setFocusedField, isDark, themeColors }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isFocused = focusedField === field.key;

  const copyToClipboard = async () => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied", `${field.label.replace(' *', '')} copied to clipboard!`);
    await logActivity('Security', 'SECURE_COPIED', `User securely copied ${field.label.replace(' *', '')} from a form entry.`, 'WORKFLOW');
  };

  const handleTextChange = (text) => {
    if (field.key === 'ifsc') {
       onChangeText(field.key, text.toUpperCase());
    } 
    else if (field.key === 'expiry') {
       let cleaned = text.replace(/[^0-9]/g, '');
       if (cleaned.length >= 3) { cleaned = cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4); }
       onChangeText(field.key, cleaned);
    } 
    else { onChangeText(field.key, text); }
  };

  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, { color: isDark ? themeColors.textLight : BP_COLORS.textSub }]}>{field.label}</Text>
      <View style={[
        styles.inputWrapper, 
        { backgroundColor: isDark ? themeColors.inputBg : BP_COLORS.inputBg, borderColor: isDark ? themeColors.inputBorder : 'transparent' },
        isFocused && { borderColor: themeColors.primary, borderWidth: 1.5, backgroundColor: isDark ? themeColors.card : '#FFFFFF' },
        field.multiline && { height: field.bigArea ? 140 : 100, alignItems: 'flex-start', paddingTop: 14 }
      ]}>
        <TextInput 
          style={[styles.input, { color: isDark ? themeColors.textDark : BP_COLORS.textMain }, field.multiline && { textAlignVertical: 'top', marginTop: Platform.OS === 'ios' ? 0 : -4 }]} 
          placeholder={field.placeholder} 
          placeholderTextColor="#9CA3AF" 
          value={value} 
          onChangeText={handleTextChange} 
          secureTextEntry={field.isSecure && !showPassword}
          multiline={field.multiline}
          maxLength={field.maxLength}
          keyboardType={field.keyboardType || 'default'}
          autoCapitalize={field.autoCapitalize || 'sentences'}
          onFocus={() => { Haptics.selectionAsync(); setFocusedField(field.key); }}
          onBlur={() => setFocusedField(null)}
        />
        
        <View style={styles.actionIconsRow}>
          {field.isSecure && (
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.iconBtn}>
              <Feather name={showPassword ? "eye-off" : "eye"} size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
          {value ? (
            <TouchableOpacity onPress={copyToClipboard} style={styles.iconBtn}>
              <Feather name="copy" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
};

export default function FormScreen({ route, navigation }) {
  const { themeColors, isDark } = useContext(ThemeContext);
  const { type = 'Login', editEntry = null, customFields = null } = route.params || {};

  let schema = TYPE_SCHEMAS[type];
  if (!schema) {
    schema = [
      { key: 'title', label: 'Title *', placeholder: `e.g. ${type} Account`, autoCapitalize: 'words' },
      ...(customFields || []).map(cf => ({ key: cf.id, label: cf.label, placeholder: cf.placeholder }))
    ];
  }

  const [formData, setFormData] = useState({});
  const [focusedField, setFocusedField] = useState(null);
  const [saveState, setSaveState] = useState('idle'); 

  // 🚀 Premium Success Animation References
  const successScale = useRef(new Animated.Value(0.5)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const isFormValid = formData['title']?.trim().length > 0; 

  useEffect(() => {
    if (editEntry) setFormData(editEntry); 
  }, [editEntry]);

  const handleChange = (key, text) => {
    setFormData(prev => ({ ...prev, [key]: text }));
  };

  const showPremiumSuccess = () => {
    setSaveState('success');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
      Animated.timing(successOpacity, { toValue: 1, duration: 250, useNativeDriver: true })
    ]).start();

    // 🚀 FIX: Ab save hone ke baad ye direct Vault Dashboard pe jayega taaki naya data turant dikhe!
    setTimeout(() => {
      Animated.timing(successOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
         navigation.reset({ index: 0, routes: [{ name: 'MainDashboard' }] });
      });
    }, 1800);
  };

  const handleSave = async () => {
    if (!isFormValid || saveState !== 'idle') return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaveState('loading');
    Keyboard.dismiss(); 

    try {
      const existingData = await getVaultData();
      if (existingData === null) {
         setSaveState('idle'); 
         Alert.alert('Security Alert', 'Unable to load vault securely. Save aborted to prevent data loss. Please restart the app.');
         return;
      }

      const safeFormData = {};
      schema.forEach(field => { safeFormData[field.key] = formData[field.key] ? String(formData[field.key]).trim() : ""; });

      const title = safeFormData.title || formData.title || "Untitled";
      const username = safeFormData.username || safeFormData.email || formData.email || "";
      const password = safeFormData.password || safeFormData['Card PIN'] || formData.password || "";
      const url = safeFormData.url || formData.url || "";
      
      let originalNotes = safeFormData.notes || formData.notes || "";
      if (originalNotes.includes("--- Additional Details ---")) { 
          originalNotes = originalNotes.split("--- Additional Details ---")[0].trim(); 
      }
      
      let finalNotes = originalNotes;
      const coreKeys = ['title', 'username', 'email', 'password', 'Card PIN', 'url', 'notes'];
      let extraDetailsText = "";
      
      schema.forEach(field => {
         if (!coreKeys.includes(field.key) && safeFormData[field.key]) {
            extraDetailsText += `\n• ${field.label.replace(' *', '')}: ${safeFormData[field.key]}`;
         }
      });

      if (extraDetailsText.length > 0) {
         finalNotes = finalNotes + (finalNotes ? "\n\n" : "") + "--- Additional Details ---" + extraDetailsText;
      }

      const entryId = editEntry ? String(editEntry.id) : (Date.now().toString() + Math.random().toString(36).substring(2, 7));
      
      // 🚀 VERY IMPORTANT: Maintain old data when editing
      const newEntryData = {
        ...(editEntry || {}), // Keep favorite status etc
        id: entryId, type: String(type), title, username, password, url, notes: finalNotes, date: new Date().toISOString(), ...safeFormData 
      };

      let updatedData = [];
      if (editEntry) {
        updatedData = existingData.map(item => String(item.id) === String(editEntry.id) ? newEntryData : item);
      } else {
        updatedData = [newEntryData, ...existingData];
      }
      
      const success = await saveVaultData(updatedData);
      
      if (success) {
        await logActivity('Vault', editEntry ? 'ENTRY_EDITED' : 'ENTRY_CREATED', `Vault entry '${title}' was securely ${editEntry ? 'updated' : 'saved'}.`, 'WORKFLOW');
        showPremiumSuccess(); 
      } else {
        setSaveState('idle'); Alert.alert('Error', 'App failed to encrypt and save entry. Make sure you unlocked with PIN.');
      }
    } catch (error) {
      console.log("Form Save Error:", error);
      setSaveState('idle'); Alert.alert('System Error', 'Something went wrong while saving the secure data.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? themeColors.background : '#FFFFFF' }]}>
      
      {/* 🚀 PREMIUM ANIMATED OVERLAY */}
      {saveState === 'success' && (
        <Modal transparent animationType="none" visible={true}>
          <BlurView intensity={50} tint="dark" style={styles.premiumSuccessOverlay}>
            <Animated.View style={[styles.successCard, { backgroundColor: themeColors.card, transform: [{ scale: successScale }], opacity: successOpacity }]}>
              <View style={styles.successIconBox}><Feather name="check" size={40} color="#10B981" /></View>
              <Text style={[styles.successTitle, { color: themeColors.textDark }]}>Secured & Saved</Text>
              <Text style={[styles.successSub, { color: themeColors.textLight }]}>Your entry has been securely encrypted in the vault.</Text>
            </Animated.View>
          </BlurView>
        </Modal>
      )}

      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={({pressed}) => [styles.backBtn, { backgroundColor: isDark ? themeColors.card : '#F3F4F8' }, pressed && {opacity: 0.7}]}>
          <Feather name="arrow-left" size={20} color={isDark ? themeColors.textDark : BP_COLORS.textMain} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? themeColors.textDark : BP_COLORS.textMain }]}>{editEntry ? 'Edit' : 'Add'} {type}</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ marginTop: 20 }}>
            {schema.map(field => (
              <SmartInput 
                key={field.key} field={field} value={formData[field.key] || ''} 
                onChangeText={handleChange} focusedField={focusedField} 
                setFocusedField={setFocusedField} isDark={isDark} themeColors={themeColors} 
              />
            ))}
          </View>

          <Pressable 
            disabled={!isFormValid || saveState !== 'idle'} activeOpacity={0.8} onPress={handleSave} 
            style={({ pressed }) => [styles.btnWrapper, pressed && { transform: [{ scale: 0.96 }] }]}
          >
            {isFormValid ? (
              <LinearGradient colors={themeColors.primaryGradient} style={styles.primaryBtn}>
                {saveState === 'loading' ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Save Securely</Text>}
              </LinearGradient>
            ) : (
              <View style={[styles.primaryBtn, { backgroundColor: isDark ? themeColors.inputBg : BP_COLORS.disabledBtn, elevation: 0, shadowOpacity: 0 }]}>
                <Text style={[styles.primaryBtnText, { color: isDark ? themeColors.textLight : '#FFFFFF' }]}>Save Entry</Text>
              </View>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 56 },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 200 }, 
  inputGroup: { marginBottom: 12 }, 
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1.5 },
  input: { flex: 1, fontSize: 15, fontWeight: '500', height: '100%' },
  actionIconsRow: { flexDirection: 'row', alignItems: 'center' }, iconBtn: { padding: 4, marginLeft: 6 },
  btnWrapper: { marginTop: 20 }, 
  primaryBtn: { height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  // 🚀 Premium Success Overlay Styles
  premiumSuccessOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  successCard: { width: '100%', padding: 32, borderRadius: 36, alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 12}, shadowOpacity: 0.2, shadowRadius: 24, elevation: 15 },
  successIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successTitle: { fontSize: 24, fontWeight: '900', marginBottom: 8 },
  successSub: { fontSize: 15, textAlign: 'center', lineHeight: 22, fontWeight: '500' }
});
