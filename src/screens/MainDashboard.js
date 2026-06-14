// File: src/screens/MainDashboard.js
import React, { useRef, useContext, useState, useEffect, useMemo } from 'react'; 
import { 
  View, Text, StyleSheet, Animated, Dimensions, 
  TouchableOpacity, Platform, Keyboard, FlatList, InteractionManager 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur'; 

import { ThemeContext } from '../ThemeContext';
import { getSessionMode } from '../utils/storage'; 

import VaultScreen from './VaultScreen';
import ScanScreen from './ScanScreen';
import FilesScreen from './FilesScreen'; 
import ToolsScreen from './ToolsScreen'; 
import SettingsScreen from './SettingsScreen';

// 🔥 ULTRA SMART MATH: 100% Perfect Alignment for ANY Screen Size
const { width } = Dimensions.get('window');
const NAV_HEIGHT = 72; 
const NAV_MARGIN = 16;
const TAB_BAR_WIDTH = width - (NAV_MARGIN * 2);
const TAB_WIDTH = TAB_BAR_WIDTH / 5; 
const PILL_WIDTH = TAB_WIDTH * 0.85; // Pill always stays inside the tab (85% width)
const PILL_HEIGHT = 46; 
const PILL_OFFSET = (TAB_WIDTH - PILL_WIDTH) / 2;
const PILL_TOP_OFFSET = (NAV_HEIGHT - PILL_HEIGHT) / 2; // Perfectly centers the pill vertically

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

export default function MainDashboard({ navigation }) {
  const { isDark, themeColors } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);
  
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);
  const [isDecoy, setIsDecoy] = useState(false); 
  const [renderCount, setRenderCount] = useState(1); 

  // 🚀 PROGRESSIVE MOUNTING: App fast start hoga aur background me screens load hongi
  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => { setRenderCount(5); }, 400); 
    });
  }, []);

  const screens = useMemo(() => [
    { key: 'vault', component: <VaultScreen navigation={navigation} setSwipeEnabled={setIsScrollEnabled} /> },
    { key: 'gallery', component: <ScanScreen navigation={navigation} setSwipeEnabled={setIsScrollEnabled} /> },
    { key: 'files', component: <FilesScreen navigation={navigation} setSwipeEnabled={setIsScrollEnabled} /> },
    { key: 'tools', component: <ToolsScreen setSwipeEnabled={setIsScrollEnabled} /> }, 
    { key: 'settings', component: <SettingsScreen navigation={navigation} setSwipeEnabled={setIsScrollEnabled} /> }
  ], [navigation]);

  useEffect(() => {
    const kbShow = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setIsScrollEnabled(false));
    const kbHide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setIsScrollEnabled(true));
    return () => { kbShow.remove(); kbHide.remove(); };
  }, []);

  useEffect(() => {
    const checkMode = async () => {
      const mode = await getSessionMode();
      setIsDecoy(mode === 'LIMITED');
    };
    checkMode();
  }, []);

  // 🚀 SMART HAPTICS (No JS Thread Lag)
  useEffect(() => {
    const listener = scrollX.addListener(({ value }) => {
      const index = Math.round(value / width);
      if (currentIndexRef.current !== index) {
        currentIndexRef.current = index;
        setCurrentIndex(index);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    });
    return () => scrollX.removeListener(listener);
  }, [width]);

  const handleTabPress = (index) => {
    Haptics.selectionAsync(); 
    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  // 🔥 FLAWLESS TRANSLATION MATH
  const pillTranslateX = scrollX.interpolate({
    inputRange: [0, width, width * 2, width * 3, width * 4],
    outputRange: [
      PILL_OFFSET, 
      TAB_WIDTH + PILL_OFFSET, 
      (TAB_WIDTH * 2) + PILL_OFFSET, 
      (TAB_WIDTH * 3) + PILL_OFFSET, 
      (TAB_WIDTH * 4) + PILL_OFFSET
    ],
    extrapolate: 'clamp'
  });

  const getScreenStyle = (index) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    const scale = scrollX.interpolate({ inputRange, outputRange: [0.96, 1, 0.96], extrapolate: 'clamp' });
    const opacity = scrollX.interpolate({ inputRange, outputRange: [0.4, 1, 0.4], extrapolate: 'clamp' });
    return { width, height: '100%', transform: [{ scale }], opacity };
  };

  const getIconTranslateY = (index) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    return scrollX.interpolate({ inputRange, outputRange: [2, -2, 2], extrapolate: 'clamp' });
  };

  const getIconScale = (index) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    return scrollX.interpolate({ inputRange, outputRange: [0.92, 1.05, 0.92], extrapolate: 'clamp' });
  };

  const getActiveOpacity = (targetIndex) => {
    const start = (targetIndex - 0.5) * width;
    const end = (targetIndex + 0.5) * width;
    return scrollX.interpolate({ inputRange: [start - 0.1, start, end, end + 0.1], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
  };

  const getInactiveOpacity = (targetIndex) => {
    const start = (targetIndex - 0.5) * width;
    const end = (targetIndex + 0.5) * width;
    return scrollX.interpolate({ inputRange: [start - 0.1, start, end, end + 0.1], outputRange: [1, 0, 0, 1], extrapolate: 'clamp' });
  };

  const activeColor = '#FFFFFF'; 
  const inactiveColor = isDark ? '#6B7280' : '#9CA3AF'; 
  const primaryAccent = themeColors?.primary || '#8B5CF6';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8F9FB' }]}>
      
      {isDecoy && (
        <View style={{ paddingTop: insets.top, backgroundColor: '#EF4444', alignItems: 'center', paddingBottom: 6 }}>
          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900', letterSpacing: 2 }}>DECOY MODE ACTIVE</Text>
        </View>
      )}

      {/* 🚀 BUTTER SMOOTH FLATLIST ENGINE */}
      <AnimatedFlatList
        ref={flatListRef} data={screens} keyExtractor={(item) => item.key}
        horizontal pagingEnabled scrollEnabled={isScrollEnabled} 
        showsHorizontalScrollIndicator={false} scrollEventThrottle={16} 
        bounces={false} 
        initialNumToRender={renderCount} 
        maxToRenderPerBatch={2} 
        windowSize={5} // Prevents memory overload while swiping
        removeClippedSubviews={false} // Magic trick for Android Swipe Smoothness
        getItemLayout={(data, index) => ({ length: width, offset: width * index, index })}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        renderItem={({ item, index }) => (
          <Animated.View style={getScreenStyle(index)}>{item.component}</Animated.View>
        )}
      />

      {/* 💎 FLAWLESS BOTTOM NAVIGATION */}
      <View style={[styles.bottomNavContainer, { bottom: Platform.OS === 'ios' ? insets.bottom || 12 : 12, left: NAV_MARGIN, right: NAV_MARGIN }]}>
        <BlurView intensity={isDark ? 35 : 70} tint={isDark ? "dark" : "light"} style={styles.blurNav}>
          
          {/* 🔥 FIXED PILL ALIGNMENT */}
          <Animated.View style={[
            styles.activePill, 
            { 
              transform: [{ translateX: pillTranslateX }], 
              backgroundColor: primaryAccent, 
              shadowColor: primaryAccent 
            }
          ]} />
          
          {[0, 1, 2, 3, 4].map((idx) => {
            const icons = ['shield', 'grid', 'folder', 'briefcase', 'settings']; 
            const labels = ['Vault', 'Gallery', 'Files', 'Tools', 'Settings'];
            return (
              <TouchableOpacity key={idx} style={styles.navItem} activeOpacity={1} onPress={() => handleTabPress(idx)}>
                <Animated.View style={{ alignItems: 'center', transform: [{ scale: getIconScale(idx) }, { translateY: getIconTranslateY(idx) }] }}>
                  <View style={styles.iconWrapper}>
                    <Animated.View style={{ position: 'absolute', opacity: getInactiveOpacity(idx) }}><Feather name={icons[idx]} size={20} color={inactiveColor} /></Animated.View>
                    <Animated.View style={{ position: 'absolute', opacity: getActiveOpacity(idx) }}><Feather name={icons[idx]} size={20} color={activeColor} /></Animated.View>
                  </View>
                  <View style={styles.textWrapper}>
                    <Animated.Text style={[styles.navText, { opacity: getInactiveOpacity(idx), color: inactiveColor }]}>{labels[idx]}</Animated.Text>
                    <Animated.Text style={[styles.navText, { opacity: getActiveOpacity(idx), color: activeColor, position: 'absolute' }]}>{labels[idx]}</Animated.Text>
                  </View>
                </Animated.View>
              </TouchableOpacity>
            )
          })}
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bottomNavContainer: {
    position: 'absolute', zIndex: 100,
    borderRadius: 28, overflow: 'hidden', // Ensures glass effect doesn't bleed
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 15
  },
  blurNav: { 
    flexDirection: 'row', alignItems: 'center', height: NAV_HEIGHT, width: '100%',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.92)' 
  }, 
  navItem: { alignItems: 'center', justifyContent: 'center', width: TAB_WIDTH, height: '100%', zIndex: 2 }, 
  iconWrapper: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }, 
  textWrapper: { height: 16, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  navText: { fontWeight: '800', fontSize: 10.5, letterSpacing: 0.2 }, 
  
  // 🔥 THE MASTER FIX: Absolute strictly bound to Top & Left coordinates
  activePill: { 
    position: 'absolute', 
    left: 0, 
    top: PILL_TOP_OFFSET, 
    width: PILL_WIDTH, 
    height: PILL_HEIGHT, 
    borderRadius: PILL_HEIGHT / 2, 
    zIndex: 1, 
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 5 
  }
});
