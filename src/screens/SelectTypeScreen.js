// File: src/screens/SelectTypeScreen.js
import React, { useState, useCallback, useContext } from 'react';
import { 
  View, Text, StyleSheet, SafeAreaView, TextInput, 
  FlatList, Pressable, Dimensions, Platform, StatusBar, Modal, TouchableOpacity
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { getCustomTypes, saveCustomTypes } from '../utils/storage';
import { ThemeContext } from '../ThemeContext';

const { width } = Dimensions.get('window');
const BOX_WIDTH = (width - 46) / 2; 

const DEFAULT_TYPES = [
  { id: 'd1', name: 'Login', sub: 'Web & App', icon: 'log-in', bg: '#F4F6FF', iconBg: '#E0E7FF', iconColor: '#4A90E2', isCustom: false },
  { id: 'd2', name: 'Card', sub: 'Debit/Credit', icon: 'credit-card', bg: '#F8F5FF', iconBg: '#EDE4FF', iconColor: '#8A7CFF', isCustom: false },
  { id: 'd3', name: 'Bank', sub: 'A/c Details', icon: 'briefcase', bg: '#F2FBF7', iconBg: '#D1F4E0', iconColor: '#2ECC71', isCustom: false },
  { id: 'd4', name: 'Notes', sub: 'Secure Text', icon: 'file-text', bg: '#FFF7F2', iconBg: '#FFEAE0', iconColor: '#F39C12', isCustom: false },
  { id: 'd5', name: 'Wi-Fi', sub: 'Passwords', icon: 'wifi', bg: '#F2F8FF', iconBg: '#E0F0FF', iconColor: '#3498DB', isCustom: false },
  { id: 'd6', name: 'Mail', sub: 'Backup Codes', icon: 'mail', bg: '#FFF2F2', iconBg: '#FFE5E5', iconColor: '#E74C3C', isCustom: false },
];

export default function SelectTypeScreen({ navigation }) {
  const { isDark, themeColors } = useContext(ThemeContext);
  const [customTypes, setCustomTypes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useFocusEffect(useCallback(() => { loadCustomTypes(); clearSelection(); }, []));

  const loadCustomTypes = async () => {
    const types = await getCustomTypes();
    setCustomTypes(types || []);
  };

  const handlePress = (item) => {
    if (isSelectionMode) {
      if (!item.isCustom) return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      toggleSelection(item.id);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate('Form', { type: item.name, customFields: item.fields });
    }
  };

  const handleLongPress = (item) => {
    if (!item.isCustom) return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (!isSelectionMode) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setIsSelectionMode(true);
      setSelectedIds([item.id]);
    }
  };

  const toggleSelection = (id) => {
    Haptics.selectionAsync();
    if (selectedIds.includes(id)) {
      const newSelection = selectedIds.filter(selectedId => selectedId !== id);
      setSelectedIds(newSelection);
      if (newSelection.length === 0) setIsSelectionMode(false);
    } else { setSelectedIds([...selectedIds, id]); }
  };

  const clearSelection = () => { setIsSelectionMode(false); setSelectedIds([]); };

  const confirmDelete = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const remainingTypes = customTypes.filter(t => !selectedIds.includes(t.id));
    
    // 🔥 FIX: Using correct storage function
    await saveCustomTypes(remainingTypes);
    setCustomTypes(remainingTypes);
    
    setShowDeleteModal(false); clearSelection();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleEdit = () => {
    if (selectedIds.length !== 1) return;
    const typeToEdit = customTypes.find(t => t.id === selectedIds[0]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearSelection();
    navigation.navigate('CreateType', { editTypeData: typeToEdit }); 
  };

  let allTypes = [...DEFAULT_TYPES, ...customTypes];
  if (searchQuery.trim() !== '') allTypes = allTypes.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const renderTypeBox = ({ item }) => {
    const isSelected = selectedIds.includes(item.id);
    const isDimmed = isSelectionMode && !isSelected;

    return (
      <Pressable onPress={() => handlePress(item)} onLongPress={() => handleLongPress(item)} style={({ pressed }) => [
          styles.typeBox, 
          { backgroundColor: isSelected ? themeColors.primaryLight : (isDark ? themeColors.card : (item.bg || '#FAFAFB')) },
          isSelected && { borderColor: themeColors.primary, borderWidth: 2 },
          (!isSelected && !isDark) && { borderColor: '#E5E7EB', borderWidth: 1 },
          isDimmed && { opacity: 0.6 },
          pressed && { transform: [{ scale: 0.96 }] } 
        ]}>
        {isSelectionMode && item.isCustom && (
          <View style={[styles.checkbox, isSelected && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}>
            {isSelected && <Feather name="check" size={14} color="#FFF" />}
          </View>
        )}
        <View style={styles.cardHeaderRow}>
          <View style={[styles.iconBox, { backgroundColor: isDark ? themeColors.inputBg : (item.iconBg || '#E0E7FF') }]}>
            <Feather name={item.icon || 'layers'} size={20} color={isDark ? themeColors.primary : (item.iconColor || themeColors.primary)} />
          </View>
        </View>
        <View>
          <Text style={[styles.typeName, { color: isDark ? themeColors.textDark : '#1A1A1A' }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.typeSub, { color: isDark ? themeColors.textLight : '#8A8A8A' }]} numberOfLines={1}>{item.sub || 'Custom Type'}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <LinearGradient colors={isDark ? themeColors.background : ['#F6F7FB', '#FFFFFF']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {!isSelectionMode ? (
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} style={({pressed}) => [styles.backBtn, { backgroundColor: isDark ? themeColors.card : '#F3F4F8' }, pressed && {opacity: 0.7}]}>
              <Feather name="arrow-left" size={20} color={isDark ? themeColors.textDark : '#1A1A1A'} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: isDark ? themeColors.textDark : '#1A1A1A' }]}>Select Category</Text>
            <View style={{width: 40}} />
          </View>
        ) : (
          <View style={[styles.header, styles.selectionHeader, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
            <TouchableOpacity onPress={clearSelection} style={styles.backBtn}><Feather name="x" size={22} color={isDark ? '#FFF' : '#1A1A1A'} /></TouchableOpacity>
            <Text style={[styles.selectionTitle, { color: isDark ? '#FFF' : '#1A1A1A' }]}>{selectedIds.length} Selected</Text>
            <View style={styles.selectionActions}>
              {selectedIds.length === 1 && <TouchableOpacity onPress={handleEdit} style={styles.actionBtn}><Feather name="edit-2" size={20} color={themeColors.primary} /></TouchableOpacity>}
              <TouchableOpacity onPress={() => setShowDeleteModal(true)} style={styles.actionBtn}><Feather name="trash-2" size={20} color="#EF4444" /></TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.searchContainer}>
          <View style={[styles.searchBox, { backgroundColor: isDark ? themeColors.inputBg : '#FFFFFF', borderColor: isDark ? themeColors.inputBorder : '#E5E7EB' }]}>
            <Feather name="search" size={18} color="#9CA3AF" style={{ marginRight: 10 }} />
            <TextInput style={[styles.searchInput, { color: isDark ? themeColors.textDark : '#1A1A1A' }]} placeholder="Search categories..." placeholderTextColor="#9CA3AF" value={searchQuery} onChangeText={setSearchQuery} autoCorrect={false} />
          </View>
        </View>

        <FlatList data={allTypes} keyExtractor={(item) => item.id || item.name} numColumns={2} contentContainerStyle={styles.gridContent} columnWrapperStyle={{ gap: 14, marginBottom: 14 }} showsVerticalScrollIndicator={false} renderItem={renderTypeBox} />

        {/* 🔥 PREMIUM FLOATING BUTTON FOR EASY ADDITION */}
        {!isSelectionMode && (
           <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('CreateType'); }} style={({ pressed }) => [styles.floatingAddBtn, { backgroundColor: themeColors.primary }, pressed && { transform: [{ scale: 0.92 }] }]}>
             <Feather name="plus" size={28} color="#FFFFFF" />
           </Pressable>
        )}

        <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
          <View style={styles.modalOverlayCenter}>
            <View style={[styles.deleteModalBox, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
              <View style={styles.deleteWarningIcon}><Feather name="alert-triangle" size={28} color="#EF4444" /></View>
              <Text style={[styles.deleteTitle, { color: isDark ? '#FFF' : '#1A1A1A' }]}>Delete {selectedIds.length} {selectedIds.length > 1 ? 'Types' : 'Type'}?</Text>
              <Text style={styles.deleteDesc}>Vault entries using this type will remain safe, but their custom format will be lost.</Text>
              <View style={styles.deleteModalActions}>
                <TouchableOpacity style={[styles.cancelModalBtn, { backgroundColor: isDark ? themeColors.inputBg : '#F3F4F6' }]} onPress={() => setShowDeleteModal(false)}><Text style={[styles.cancelModalText, { color: isDark ? '#FFF' : '#4B5563' }]}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.confirmDeleteBtn} onPress={confirmDelete}><Text style={styles.confirmDeleteText}>Delete</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 8 : 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 56 },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  selectionHeader: { borderBottomWidth: 1, borderBottomColor: '#F3F4F8' },
  selectionTitle: { fontSize: 18, fontWeight: '700' },
  selectionActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  actionBtn: { padding: 4 },
  searchContainer: { paddingHorizontal: 16, paddingVertical: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 16, fontWeight: '500', height: '100%' },
  gridContent: { paddingHorizontal: 16, paddingBottom: 100 },
  typeBox: { width: BOX_WIDTH, height: 100, borderRadius: 20, padding: 14, justifyContent: 'space-between' },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  iconBox: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  checkbox: { position: 'absolute', top: 12, right: 12, width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  typeName: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  typeSub: { fontSize: 12, fontWeight: '500' },
  floatingAddBtn: { position: 'absolute', bottom: 30, right: 24, width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  deleteModalBox: { width: '100%', borderRadius: 24, padding: 24, alignItems: 'center' },
  deleteWarningIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  deleteTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  deleteDesc: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  deleteModalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelModalBtn: { flex: 1, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cancelModalText: { fontSize: 16, fontWeight: '700' },
  confirmDeleteBtn: { flex: 1, height: 50, borderRadius: 14, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },
  confirmDeleteText: { fontSize: 16, fontWeight: '800', color: '#FFF' }
});
