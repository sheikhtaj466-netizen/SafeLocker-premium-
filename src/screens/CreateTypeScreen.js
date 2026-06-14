// File: src/screens/CreateTypeScreen.js
import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ScrollView, Platform, Alert, KeyboardAvoidingView, Pressable, ActivityIndicator, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// 🔥 FIX: Correct import (saveCustomTypes)
import { saveCustomTypes, getCustomTypes, logActivity } from '../utils/storage';
import { ThemeContext } from '../ThemeContext';

export default function CreateTypeScreen({ route, navigation }) {
  const { themeColors, isDark } = useContext(ThemeContext);
  const { editTypeData } = route.params || {};

  const [typeName, setTypeName] = useState('');
  const [fields, setFields] = useState([{ id: Date.now().toString(), label: '' }]);
  
  const [focusedField, setFocusedField] = useState(null);
  const [saveState, setSaveState] = useState('idle');

  useEffect(() => {
    if (editTypeData) {
      setTypeName(editTypeData.name);
      if (editTypeData.fields && editTypeData.fields.length > 0) {
        setFields(editTypeData.fields.map(f => ({ id: f.id, label: f.label })));
      }
    }
  }, [editTypeData]);

  const isFormValid = typeName.trim().length > 0 && fields[0].label.trim().length > 0;

  const handleAddField = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFields([...fields, { id: Date.now().toString(), label: '' }]);
  };

  const handleRemoveField = (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFields(fields.filter(f => f.id !== id));
  };

  const updateField = (id, text) => setFields(fields.map(f => f.id === id ? { ...f, label: text } : f));

  // 🔥 SYSTEM ERROR FIXED & SMART REDIRECT
  const performSave = async () => {
    if (!isFormValid || saveState !== 'idle') return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaveState('loading');
    Keyboard.dismiss(); 

    try {
      const existingTypes = await getCustomTypes() || [];
      const isDuplicate = existingTypes.some(t => t.name.toLowerCase() === typeName.trim().toLowerCase() && t.id !== (editTypeData ? editTypeData.id : ''));
      
      if (isDuplicate) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Exists", `Category "${typeName.trim()}" already exists.`);
        setSaveState('idle'); return;
      }

      const validFields = fields.filter(f => f.label.trim() !== '').map((f, index) => ({
        id: `c${index + 1}`, label: f.label.trim(), placeholder: `Enter ${f.label.trim().toLowerCase()}`
      }));

      const customTypeObj = {
        id: editTypeData ? editTypeData.id : Date.now().toString(), 
        name: typeName.trim(), subtitle: 'Custom Form', icon: 'star', isCustom: true, fields: validFields
      };

      if (editTypeData) {
        const updatedTypes = existingTypes.map(t => t.id === editTypeData.id ? customTypeObj : t);
        await saveCustomTypes(updatedTypes); // 🔥 Used correct array function
        await logActivity('Settings', 'CUSTOM_TYPE_EDITED', `Template '${typeName.trim()}' updated.`, 'INFO');
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSaveState('success'); setTimeout(() => navigation.goBack(), 600); 
      } else {
        const updatedTypes = [...existingTypes, customTypeObj];
        await saveCustomTypes(updatedTypes); // 🔥 Used correct array function
        await logActivity('Settings', 'CUSTOM_TYPE_CREATED', `Template '${typeName.trim()}' created.`, 'INFO');

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSaveState('success');
        
        setTimeout(() => { navigation.replace('Form', { type: customTypeObj.name, customFields: customTypeObj.fields }); }, 600);
      }
    } catch (error) {
      setSaveState('idle'); Alert.alert('Error', error.message);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? themeColors.background : '#FFFFFF' }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={({pressed}) => [styles.backBtn, { backgroundColor: isDark ? themeColors.card : '#F3F4F8' }, pressed && {opacity: 0.7}]}>
          <Feather name="arrow-left" size={20} color={isDark ? themeColors.textDark : '#111827'} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? themeColors.textDark : '#111827' }]}>{editTypeData ? 'Edit Format' : 'New Format'}</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          <Text style={[styles.infoText, { color: themeColors.textLight }]}>Define fields for your new custom entry. You can add the real details in the next step.</Text>
          
          <Text style={[styles.sectionTitle, { color: themeColors.primary }]}>Format Name</Text>
          <View style={[ styles.inputWrapper, { backgroundColor: isDark ? themeColors.inputBg : '#F9FAFB', borderColor: isDark ? themeColors.inputBorder : '#E5E7EB' }, focusedField === 'type' && { borderColor: themeColors.primary, backgroundColor: isDark ? themeColors.card : '#FFFFFF' } ]}>
            <TextInput style={[styles.input, { color: isDark ? themeColors.textDark : '#111827', fontSize: 16 }]} placeholder="e.g. Server Logins" placeholderTextColor="#9CA3AF" value={typeName} onChangeText={setTypeName} autoCapitalize="words" onFocus={() => { Haptics.selectionAsync(); setFocusedField('type'); }} onBlur={() => setFocusedField(null)} />
          </View>

          <Text style={[styles.sectionTitle, { color: themeColors.primary, marginTop: 24 }]}>Dynamic Fields</Text>
          
          {fields.map((field, index) => (
            <View key={field.id} style={styles.dynamicFieldBox}>
              <View style={[ styles.inputWrapper, { flex: 1, backgroundColor: isDark ? themeColors.inputBg : '#F9FAFB', borderColor: isDark ? themeColors.inputBorder : '#E5E7EB' }, focusedField === field.id && { borderColor: themeColors.primary, backgroundColor: isDark ? themeColors.card : '#FFFFFF' } ]}>
                <TextInput style={[styles.input, { color: isDark ? themeColors.textDark : '#111827' }]} placeholder={`Field Name (e.g. Address, URL) *`} placeholderTextColor="#9CA3AF" value={field.label} onChangeText={(text) => updateField(field.id, text)} autoCapitalize="words" onFocus={() => { Haptics.selectionAsync(); setFocusedField(field.id); }} onBlur={() => setFocusedField(null)} />
              </View>
              {fields.length > 1 && (
                <TouchableOpacity onPress={() => handleRemoveField(field.id)} style={styles.deleteBtn}>
                  <Feather name="minus-circle" size={24} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}

          <TouchableOpacity activeOpacity={0.7} onPress={handleAddField} style={styles.addFieldBtn}>
            <View style={[styles.iconBoxStatic, { backgroundColor: themeColors.primaryLight }]}><Feather name="plus" size={16} color={themeColors.primary} /></View>
            <Text style={[styles.addFieldText, { color: themeColors.primary }]}>Add Information Field</Text>
          </TouchableOpacity>

          <Pressable disabled={!isFormValid || saveState !== 'idle'} activeOpacity={0.8} onPress={performSave} style={({ pressed }) => [styles.btnWrapper, pressed && { transform: [{ scale: 0.96 }] }]}>
            {isFormValid ? (
              <LinearGradient colors={saveState === 'success' ? ['#2ECC71', '#27AE60'] : themeColors.primaryGradient} style={styles.primaryBtn}>
                {saveState === 'loading' ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>{saveState === 'success' ? '✔ Saved' : (editTypeData ? 'Update Format' : 'Next: Add Data')}</Text>}
              </LinearGradient>
            ) : (
              <View style={[styles.primaryBtn, { backgroundColor: isDark ? themeColors.inputBg : '#E5E7EB', elevation: 0 }]}>
                <Text style={[styles.primaryBtnText, { color: isDark ? themeColors.textLight : '#9CA3AF' }]}>{editTypeData ? 'Update Format' : 'Next: Add Data'}</Text>
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
  scrollContent: { paddingHorizontal: 20, paddingBottom: 200, paddingTop: 10 },
  infoText: { fontSize: 14, lineHeight: 22, marginBottom: 24, fontWeight: '500' },
  sectionTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 1.2, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1.5 },
  input: { flex: 1, fontSize: 15, fontWeight: '600', height: '100%' },
  dynamicFieldBox: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  deleteBtn: { width: 52, height: 56, justifyContent: 'center', alignItems: 'flex-end' },
  addFieldBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 12, marginTop: 8 },
  iconBoxStatic: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  addFieldText: { fontWeight: '700', fontSize: 16 },
  btnWrapper: { marginTop: 40 },
  primaryBtn: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }
});
