// File: src/screens/EntryDetailScreen.js
import React, { useState, useContext } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { ThemeContext } from '../ThemeContext';
import { getVaultData, saveVaultData, logActivity } from '../utils/storage';

// 🧠 THE SMART SCHEMA (Ye batayega kis field ka kya naam dikhana hai aur kon secure hai)
const TYPE_SCHEMAS = {
  'Login': { username: { label: 'Username / Email' }, password: { label: 'Password', isSecure: true }, twoFactor: { label: '2FA Secret' }, url: { label: 'Website' }, notes: { label: 'Notes' } },
  'Card': { cardHolder: { label: 'Card Holder Name' }, cardNumber: { label: 'Card Number' }, 'Card PIN': { label: 'Card PIN', isSecure: true }, expiry: { label: 'Expiry Date' }, cvv: { label: 'CVV', isSecure: true }, bankName: { label: 'Issuing Bank' }, notes: { label: 'Notes' } },
  'Bank': { accHolder: { label: 'Account Holder Name' }, accNumber: { label: 'Account Number', isSecure: true }, ifsc: { label: 'IFSC Code' }, bankName: { label: 'Bank Name' }, branch: { label: 'Branch Name' }, upi: { label: 'UPI ID' }, notes: { label: 'Notes' } },
  'Wi-Fi': { ssid: { label: 'Network Name (SSID)' }, password: { label: 'Password', isSecure: true }, security: { label: 'Security Type' }, notes: { label: 'Notes' } },
  'Notes': { notes: { label: 'Secure Note' } },
  'Mail': { email: { label: 'Email Address' }, password: { label: 'Password', isSecure: true }, twoFactor: { label: '2FA Secret' }, recoveryEmail: { label: 'Recovery Email' }, backupCodes: { label: 'Backup Codes' }, notes: { label: 'Notes' } }
};

// 🧩 DYNAMIC FIELD COMPONENT
const DetailField = ({ label, value, isSecure, isDark, themeColors }) => {
  const [revealed, setRevealed] = useState(!isSecure);

  const copyToClip = async () => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied", `${label} copied to clipboard!`);
    await logActivity('Security', 'SECURE_COPIED', `User copied ${label} from vault details.`, 'WORKFLOW');
  };

  if (!value || value.trim() === '') return null;

  return (
    <View style={[styles.fieldContainer, { borderBottomColor: isDark ? themeColors.separator : '#F3F4F6' }]}>
      <Text style={[styles.fieldLabel, { color: isDark ? themeColors.textLight : '#6B7280' }]}>{label}</Text>
      
      <View style={styles.fieldRow}>
        <Text style={[styles.fieldValue, { color: isDark ? themeColors.textDark : '#111827' }]}>
          {revealed ? value : '••••••••••••'}
        </Text>
        
        <View style={styles.actionRow}>
          {isSecure && (
            <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRevealed(!revealed); }} style={[styles.iconBtn, { backgroundColor: isDark ? '#1E293B' : '#EAF8F5' }]}>
              <Feather name={revealed ? "eye-off" : "eye"} size={20} color="#1ABC9C" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={copyToClip} style={[styles.iconBtn, { backgroundColor: isDark ? '#1E293B' : '#EAF8F5' }]}>
            <Feather name="copy" size={20} color="#1ABC9C" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default function EntryDetailScreen({ route, navigation }) {
  const { themeColors, isDark } = useContext(ThemeContext);
  const { entry } = route.params;

  if (!entry) {
    navigation.goBack();
    return null;
  }

  const handleDelete = () => {
    Alert.alert(
      "Delete Entry",
      "Are you sure you want to delete this secure entry? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const currentData = await getVaultData();
            const newData = currentData.filter(item => item.id !== entry.id);
            const success = await saveVaultData(newData);
            
            if (success) {
              await logActivity('Vault', 'ENTRY_DELETED', `Vault entry '${entry.title}' was deleted.`, 'CRITICAL');
              navigation.goBack();
            } else {
              Alert.alert("Error", "Failed to delete entry.");
            }
          }
        }
      ]
    );
  };

  const ignoredKeys = ['id', 'type', 'title', 'date', 'createdAt', 'updatedAt', 'customFields'];
  const schema = TYPE_SCHEMAS[entry.type] || {};
  
  const renderKeys = Object.keys(entry).filter(key => !ignoredKeys.includes(key) && entry[key] !== '');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? themeColors.background : '#F9FAFB' }]}>
      
      {/* 🔝 HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.roundBtn, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
          <Feather name="arrow-left" size={22} color={isDark ? themeColors.textDark : '#111827'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? themeColors.textDark : '#111827' }]}>Details</Text>
        <TouchableOpacity 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate('Form', { type: entry.type, editEntry: entry });
          }} 
          style={[styles.roundBtn, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}
        >
          <Feather name="edit-2" size={20} color={isDark ? themeColors.textDark : '#111827'} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* TITLE & TYPE */}
        <View style={styles.titleSection}>
          <Text style={[styles.mainTitle, { color: isDark ? themeColors.textDark : '#111827' }]}>{entry.title}</Text>
          <Text style={styles.typeBadge}>{entry.type.toUpperCase()} ACCOUNT</Text>
        </View>

        {/* 📦 THE SMART CARD */}
        <View style={[styles.card, { backgroundColor: isDark ? themeColors.card : '#FFFFFF', borderColor: isDark ? themeColors.separator : '#F3F4F6' }]}>
          
          {renderKeys.map(key => {
            const fieldDef = schema[key] || { 
              label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), 
              isSecure: false 
            };

            return (
              <DetailField 
                key={key} 
                label={fieldDef.label} 
                value={entry[key]} 
                isSecure={fieldDef.isSecure} 
                isDark={isDark} 
                themeColors={themeColors} 
              />
            );
          })}

          {/* 🔥 RENDER CUSTOM FIELDS */}
          {entry.customFields && entry.customFields.map((cf, index) => (
            <DetailField 
              key={cf.id || `custom_${index}`} 
              label={cf.label || `Custom Field ${index + 1}`} 
              value={cf.value} 
              isSecure={false} 
              isDark={isDark} 
              themeColors={themeColors} 
            />
          ))}

          {/* DATE CREATED */}
          {entry.date && (
            <DetailField 
              label="Date Saved" 
              value={new Date(entry.date).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 
              isSecure={false} 
              isDark={isDark} 
              themeColors={themeColors} 
            />
          )}

        </View>

        {/* 🚨 DELETE BUTTON */}
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>Delete Entry</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  roundBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  
  titleSection: { alignItems: 'center', marginBottom: 24, marginTop: 10 },
  mainTitle: { fontSize: 32, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  typeBadge: { fontSize: 13, fontWeight: '800', color: '#6C5CE7', letterSpacing: 1.5 },
  
  card: { borderRadius: 24, padding: 20, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 1, marginBottom: 30 },
  
  fieldContainer: { paddingVertical: 16, borderBottomWidth: 1 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldValue: { flex: 1, fontSize: 18, fontWeight: '700', marginRight: 16 },
  
  actionRow: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  
  deleteBtn: { backgroundColor: '#FEF2F2', paddingVertical: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FEE2E2', marginBottom: 20 },
  deleteBtnText: { color: '#EF4444', fontSize: 16, fontWeight: '800' }
});
