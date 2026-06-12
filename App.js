import 'react-native-gesture-handler'; // 🚀 STRICT RULE: Ye hamesha line 1 pe hona chahiye!
import React, { useEffect, useRef, useState } from 'react';
import { AppState, View, StyleSheet, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

import { ThemeProvider } from './src/ThemeContext';
import { getSettings } from './src/utils/storage';
import { initDB } from './src/utils/database'; 

// 🔥 NAVIGATION FIX: Aapka banaya hua AppNavigator yahan import kiya hai
import AppNavigator from './src/navigation/AppNavigator';

export const navigationRef = createNavigationContainerRef();

export default function App() {
  const appState = useRef(AppState.currentState);
  const backgroundTime = useRef(null);
  
  const [appIsInactive, setAppIsInactive] = useState(false);
  const [blurEnabled, setBlurEnabled] = useState(true);

  // 🔥 LAG & STUCK FIX: Database ready hone tak app ko rokne ke liye state
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    // 🚀 STEP 1: App khulte hi Database ready karo aur WAIT karo
    const setupDatabase = async () => {
      try {
        await initDB();
        setIsDbReady(true); // Jab DB ready ho jaye, tabhi app start karo
      } catch (error) {
        console.error("Database Init Error:", error);
        setIsDbReady(true); // Error aaye toh bhi app stuck na ho
      }
    };
    
    setupDatabase();

    const checkBlurSettings = async () => {
      const s = await getSettings();
      if (s && s.blurRecents !== undefined) {
        setBlurEnabled(s.blurRecents);
      }
    };
    checkBlurSettings();

    const subscription = AppState.addEventListener('change', async nextAppState => {
      // Blur Logic
      if (nextAppState.match(/inactive|background/)) {
        setAppIsInactive(true);
      } else {
        setAppIsInactive(false);
        checkBlurSettings(); // Re-check when coming to foreground
      }

      // Auto Lock Logic
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (backgroundTime.current) {
          const timeAwaySeconds = (Date.now() - backgroundTime.current) / 1000;
          
          const settings = await getSettings();
          let timeLimit = 120; // Default 2 minutes
          
          if (settings?.autoLockTimer === '30 sec') timeLimit = 30;
          if (settings?.autoLockTimer === '1 min') timeLimit = 60;
          if (settings?.autoLockTimer === '2 min') timeLimit = 120;
          if (settings?.autoLockTimer === '5 min') timeLimit = 300;
          if (settings?.autoLockTimer === '10 min') timeLimit = 600;

          if (timeAwaySeconds >= timeLimit) {
            if (navigationRef.isReady()) {
              const currentRoute = navigationRef.getCurrentRoute();
              if (currentRoute && currentRoute.name !== 'Lock') {
                navigationRef.reset({ index: 0, routes: [{ name: 'Lock' }] });
              }
            }
          }
        }
      } 
      else if (nextAppState.match(/inactive|background/)) {
        backgroundTime.current = Date.now();
      }
      
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  // 🔥 Jab tak database load nahi hota, loader dikhao
  if (!isDbReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <NavigationContainer ref={navigationRef}>
            {/* 🔥 Yahan pura purana stack hatakar apka real AppNavigator daal diya */}
            <AppNavigator />
          </NavigationContainer>
        </ThemeProvider>
      </SafeAreaProvider>

      {/* Global Blur Overlay for Recents */}
      {appIsInactive && blurEnabled && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
        </View>
      )}
    </GestureHandlerRootView>
  );
}
