// File: src/components/SelectableCard.js
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

export default function SelectableCard({ item, index, isSelected, isSelectionMode, onPress, onLongPress, cardWidth, collectionInfo, isDark, activeTab, sgAccent }) {
  // 🔥 SMART ACCENT COLOR FIX: Direct from global theme for premium sync
  const accentColor = sgAccent || '#6C5CE7';
  const bgTint = isSelected ? `${accentColor}15` : (isDark ? '#1E293B' : '#F8F9FB');

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const badgeScaleAnim = useRef(new Animated.Value(0)).current;
  const entranceAnim = useRef(new Animated.Value(0)).current;

  // 🎬 Staggered Entrance
  useEffect(() => {
    Animated.timing(entranceAnim, { toValue: 1, duration: 200, delay: Math.min(index * 25, 350), useNativeDriver: true }).start();
  }, [index]);

  // 🪄 Selection Mode Context Animation (Shrink unselected cards slightly)
  useEffect(() => {
    let targetScale = 1;
    if (isSelectionMode) { targetScale = isSelected ? 1 : 0.95; } 
    Animated.spring(scaleAnim, { toValue: targetScale, friction: 7, tension: 150, useNativeDriver: true }).start();
    
    if (isSelected) {
      badgeScaleAnim.setValue(0.5);
      Animated.spring(badgeScaleAnim, { toValue: 1, friction: 5, tension: 150, useNativeDriver: true }).start();
    }
  }, [isSelectionMode, isSelected]);

  const handlePressIn = () => { Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }).start(); };
  const handlePressOut = () => { Animated.spring(scaleAnim, { toValue: isSelectionMode && !isSelected ? 0.95 : 1, friction: 6, tension: 150, useNativeDriver: true }).start(); };

  const handleLongPress = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); onLongPress(item, index); };
  const handlePress = () => { if (isSelectionMode) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(item, index); };

  // 🎨 Clean Borders (V3 Spec: 2dp border for clear selection visibility)
  const borderWidth = isSelected ? 2 : 0; 
  const borderColor = isSelected ? accentColor : 'transparent';
  const showMetadata = !isSelectionMode; // 🔥 HIDE CLUTTER DURING SELECTION

  return (
    <Animated.View style={[styles.container, { width: cardWidth, height: cardWidth * 1.25, opacity: entranceAnim, transform: [{ scale: scaleAnim }, { translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] }]}>
      {/* 🔥 V3 SPEC: delayLongPress strictly at 250ms for snappy feel */}
      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onLongPress={handleLongPress} onPress={handlePress} delayLongPress={250} style={{ flex: 1 }}>
        
        <View style={[
          styles.cardWrapper, 
          { borderWidth, borderColor, backgroundColor: bgTint }, 
          isSelected && { shadowColor: accentColor, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 8 } // V3 Glow Ring
        ]}>
          
          <Image source={{ uri: item.uri }} style={styles.image} />
          {isSelected && <View style={[styles.selectedOverlay, { backgroundColor: `${accentColor}20` }]} />}

          {/* 🪄 ONLY SHOW METADATA IF NOT IN SELECTION MODE */}
          {showMetadata && item.locked && (
            <View style={styles.lockBadge}>
               <BlurView intensity={60} tint="dark" style={styles.iconBlur}>
                 <Feather name="lock" size={12} color="#FFF" />
               </BlurView>
            </View>
          )}

          {showMetadata && item.isFavorite && (
            <View style={styles.favBadge}>
              <BlurView intensity={80} tint="dark" style={styles.iconBlur}>
                <Feather name="star" size={12} color="#F59E0B" style={{ textShadowColor: 'rgba(245, 158, 11, 0.5)', textShadowRadius: 4 }}/>
              </BlurView>
            </View>
          )}

          {showMetadata && collectionInfo && activeTab === 'All' && (
            <View style={styles.collectionPillWrapper}>
              <BlurView intensity={isDark ? 60 : 80} tint={isDark ? "dark" : "light"} style={styles.collectionPill}>
                <Feather name="folder" size={12} color={collectionInfo.color} style={{ marginRight: 6 }} />
                <Text style={[styles.collectionPillText, { color: isDark ? '#FFF' : '#111' }]} numberOfLines={1}>{collectionInfo.title}</Text>
              </BlurView>
            </View>
          )}

          {/* ✅ L3: PREMIUM SELECTION BADGE */}
          {isSelected && (
            <Animated.View style={[styles.checkBadge, { transform: [{ scale: badgeScaleAnim }], backgroundColor: accentColor }]}>
              <Feather name="check" size={14} color="#FFF" />
            </Animated.View>
          )}

        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  cardWrapper: { flex: 1, borderRadius: 20, overflow: 'hidden' }, // 🚀 Rounded edge optimized
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  selectedOverlay: { ...StyleSheet.absoluteFillObject }, 
  
  // 🚀 ALIGNMENT FIX: Margins exactly 10px safe from edges, prevents corner clipping
  lockBadge: { position: 'absolute', top: 10, left: 10, width: 26, height: 26, borderRadius: 13, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  favBadge: { position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 13, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  iconBlur: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  
  collectionPillWrapper: { position: 'absolute', bottom: 10, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 12 },
  collectionPill: { flexDirection: 'row', alignItems: 'center', height: 28, borderRadius: 14, paddingHorizontal: 12, minWidth: 70, maxWidth: '100%', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  collectionPillText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },

  // 🚀 FIXED: Check badge safe distance
  checkBadge: { position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4, borderWidth: 2, borderColor: '#FFF' }
});
