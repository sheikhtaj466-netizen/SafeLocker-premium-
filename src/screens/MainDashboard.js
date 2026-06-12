// File: src/screens/MainDashboard.js
import React, { useRef, useContext, useState, useEffect, useMemo } from 'react'; 
import { 
  View, Text, StyleSheet, Animated, Dimensions, 
  TouchableOpacity, Platform, Keyboard, FlatList 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../ThemeContext';
import { getSessionMode } from '../utils/storage'; // 🚀 ADDED TO DETECT MODE

import VaultScreen from './VaultScreen';
import ScanScreen from './ScanScreen';
import FilesScreen from './FilesScreen'; 
import ToolsScreen from './ToolsScreen'; 
import SettingsScreen from './SettingsScreen';

const { width } = Dimensions.get('window');
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

const NAV_HEIGHT = 72; 
const PILL_WIDTH = 68; 
const PILL_HEIGHT = 46; 
const TAB_WIDTH = (width - 32) / 5; 
const PILL_OFFSET = (TAB_WIDTH - PILL_WIDTH) / 2;

export default function MainDashboard({ navigation }) {
  const { isDark, themeColors } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);
  const [isDecoy, setIsDecoy] = useState(false); // 🚀 TRACK DECOY STATE

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
    // 🚀 FETCH DECOY STATE
    const checkMode = async () => {
      const mode = await getSessionMode();
      setIsDecoy(mode === 'LIMITED');
    };
    checkMode();
  }, []);

  const handleTabPress = (index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); 
    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) setCurrentIndex(viewableItems[0].index);
  }).current;

  const pillTranslateX = scrollX.interpolate({
    inputRange: [0, width, width * 2, width * 3, width * 4],
    outputRange: [PILL_OFFSET, TAB_WIDTH + PILL_OFFSET, (TAB_WIDTH * 2) + PILL_OFFSET, (TAB_WIDTH * 3) + PILL_OFFSET, (TAB_WIDTH * 4) + PILL_OFFSET],
    extrapolate: 'clamp'
  });

  const getScreenStyle = (index) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    const scale = scrollX.interpolate({ inputRange, outputRange: [0.96, 1, 0.96], extrapolate: 'clamp' });
    const opacity = scrollX.interpolate({ inputRange, outputRange: [0.6, 1, 0.6], extrapolate: 'clamp' });
    return { width, height: '100%', transform: [{ scale }], opacity };
  };

  const getIconTranslateY = (index) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    return scrollX.interpolate({ inputRange, outputRange: [2, -2, 2], extrapolate: 'clamp' });
  };

  const getIconScale = (index) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    return scrollX.interpolate({ inputRange, outputRange: [0.94, 1, 0.94], extrapolate: 'clamp' });
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
  const inactiveColor = isDark ? '#8A8A8A' : '#9AA0A6'; 
  const primaryAccent = themeColors?.primary || '#6C5CE7';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#F8F8FB' }]}>
      
      {/* 🚀 DECOY BANNER */}
      {isDecoy && (
        <View style={{ paddingTop: insets.top, backgroundColor: '#EF4444', alignItems: 'center', paddingBottom: 6 }}>
          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900', letterSpacing: 2 }}>DECOY MODE ACTIVE</Text>
        </View>
      )}

      <AnimatedFlatList
        ref={flatListRef} data={screens} keyExtractor={(item) => item.key}
        horizontal pagingEnabled scrollEnabled={isScrollEnabled} 
        showsHorizontalScrollIndicator={false} scrollEventThrottle={16} 
        bounces={false} initialNumToRender={1} maxToRenderPerBatch={2} windowSize={3}
        removeClippedSubviews={Platform.OS === 'android'}
        getItemLayout={(data, index) => ({ length: width, offset: width * index, index })}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        onViewableItemsChanged={onViewableItemsChanged} viewabilityConfig={viewabilityConfig}
        renderItem={({ item, index }) => (
          <Animated.View style={getScreenStyle(index)}>{item.component}</Animated.View>
        )}
      />

      <View style={[styles.bottomNav, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', bottom: Platform.OS === 'ios' ? insets.bottom || 12 : 12, shadowColor: isDark ? '#000' : 'rgba(17, 24, 39, 0.06)' }]}>
        <Animated.View style={[styles.activePill, { transform: [{ translateX: pillTranslateX }], backgroundColor: primaryAccent, shadowColor: primaryAccent }]} />
        {[0, 1, 2, 3, 4].map((idx) => {
          const icons = ['shield', 'grid', 'folder', 'briefcase', 'settings']; 
          const labels = ['Vault', 'Gallery', 'Files', 'Tools', 'Settings'];
          return (
            <TouchableOpacity key={idx} style={styles.navItem} activeOpacity={1} onPress={() => handleTabPress(idx)}>
              <Animated.View style={{ alignItems: 'center', transform: [{ scale: getIconScale(idx) }, { translateY: getIconTranslateY(idx) }] }}>
                <View style={styles.iconWrapper}>
                  <Animated.View style={{ position: 'absolute', opacity: getInactiveOpacity(idx) }}><Feather name={icons[idx]} size={18} color={inactiveColor} /></Animated.View>
                  <Animated.View style={{ position: 'absolute', opacity: getActiveOpacity(idx) }}><Feather name={icons[idx]} size={18} color={activeColor} /></Animated.View>
                </View>
                <View style={styles.textWrapper}>
                  <Animated.Text style={[styles.navText, { opacity: getInactiveOpacity(idx), color: inactiveColor, fontSize: 11 }]}>{labels[idx]}</Animated.Text>
                  <Animated.Text style={[styles.navText, { opacity: getActiveOpacity(idx), color: activeColor, position: 'absolute', fontSize: 11 }]}>{labels[idx]}</Animated.Text>
                </View>
              </Animated.View>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bottomNav: { 
    flexDirection: 'row', alignItems: 'center', height: NAV_HEIGHT, borderRadius: 24, position: 'absolute', left: 16, right: 16, zIndex: 100, 
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 16, elevation: 8
  }, 
  navItem: { alignItems: 'center', justifyContent: 'center', flex: 1, height: '100%', zIndex: 2 }, 
  iconWrapper: { width: 22, height: 22, justifyContent: 'center', alignItems: 'center' }, 
  textWrapper: { height: 16, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  navText: { fontWeight: '600' }, 
  activePill: { position: 'absolute', width: PILL_WIDTH, height: PILL_HEIGHT, borderRadius: 23, zIndex: 1, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 }
});
