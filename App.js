import 'react-native-gesture-handler'; 
import { enableScreens } from 'react-native-screens';
enableScreens(); // 🔥 MEMORY CRASH FIX: Isko import ke turant baad call karna zaroori hai

import React, { useEffect, useRef, useState } from 'react';
import { AppState, View, StyleSheet, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

import { ThemeProvider } from './src/ThemeContext';
import { getSettings } from './src/utils/storage';
import { initDB } from './src/utils/database'; 

import AppNavigator from './src/navigation/AppNavigator';

export const navigationRef = createNavigationContainerRef();

export default function App() {
  const appState = useRef(AppState.currentState);
  const backgroundTime = useRef(null);
  
  const [appIsInactive, setAppIsInactive] = useState(false);
  const [blurEnabled, setBlurEnabled] = useState(true);
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    // Database Initialization
    const setupDatabase = async () => {
      try {
        await initDB();
        setIsDbReady(true);
      } catch (error) {
        console.error("Database Init Error:", error);
        setIsDbReady(true); 
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
        checkBlurSettings(); 
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

  // Jab tak database load na ho jaye, loader dikhao
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
