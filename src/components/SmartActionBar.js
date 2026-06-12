// File: src/components/SmartActionBar.js
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

export default function SmartActionBar({ selectedCount, onClearSelection, onActionTrigger, isDark }) {
  const insets = useSafeAreaInsets();
  const slideYAnim = useRef(new Animated.Value(-20)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideYAnim, { toValue: 0, tension: 100, friction: 10, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true })
    ]).start();
  }, []);

  const handleAction = (actionType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onActionTrigger) onActionTrigger(actionType);
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onClearSelection) onClearSelection();
  };

  return (
    <Animated.View style={[
      styles.animatedContainer, 
      { top: insets.top + 12, opacity: fadeAnim, transform: [{ translateY: slideYAnim }] }
    ]}>
      <BlurView intensity={isDark ? 45 : 85} tint={isDark ? "dark" : "light"} style={styles.blurBar}>
        
        {/* 📌 Left Section */}
        <View style={styles.leftSection}>
          <TouchableOpacity onPress={handleClear} style={styles.closeBtn} activeOpacity={0.6}>
            <Feather name="x" size={24} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>
          <Text style={[styles.countText, { color: isDark ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>
            {selectedCount > 99 && width < 360 ? '99+' : `${selectedCount} Selected`}
          </Text>
        </View>

        {/* ⚡ Right Section (Added Gap & Margin to prevent touching) */}
        <View style={styles.rightSection}>
          <TouchableOpacity onPress={() => handleAction('favorite')} style={styles.iconButton}>
            <Feather name="star" size={20} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleAction('move')} style={styles.iconButton}>
            <Feather name="folder" size={20} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleAction('share')} style={styles.iconButton}>
            <Feather name="share-2" size={20} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleAction('delete')} style={[styles.iconButton, styles.deleteBtn]}>
            <Feather name="trash-2" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animatedContainer: { position: 'absolute', left: 16, right: 16, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 10 },
  blurBar: { height: 60, borderRadius: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 8, paddingRight: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.4)' },
  leftSection: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }, // 🚀 MARGIN RIGHT ADDED
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22 },
  countText: { fontSize: 18, fontWeight: '800', marginLeft: 4, letterSpacing: -0.3 },
  rightSection: { flexDirection: 'row', alignItems: 'center', gap: 6 }, // 🚀 GAPS ADJUSTED
  iconButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)' }
});
