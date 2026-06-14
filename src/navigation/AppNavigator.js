// File: src/navigation/AppNavigator.js
import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LockScreen from '../screens/LockScreen';
import MainDashboard from '../screens/MainDashboard'; 
import VaultScreen from '../screens/VaultScreen';
import FilesScreen from '../screens/FilesScreen'; 
import ScanScreen from '../screens/ScanScreen'; 
import ToolsScreen from '../screens/ToolsScreen'; 
import SelectTypeScreen from '../screens/SelectTypeScreen';
import FormScreen from '../screens/FormScreen';
import EntryDetailScreen from '../screens/EntryDetailScreen';
import CreateTypeScreen from '../screens/CreateTypeScreen';
import SettingsScreen from '../screens/SettingsScreen';   
import DeveloperScreen from '../screens/DeveloperScreen'; 
import EmailSetupScreen from '../screens/EmailSetupScreen'; 
import RecoveryScreen from '../screens/RecoveryScreen'; 
import ActivityLogScreen from '../screens/ActivityLogScreen';
import PreferredActionsScreen from '../screens/PreferredActionsScreen';

const Stack = createNativeStackNavigator();

// 🔥 PREMIUM TRANSITION CONFIGURATION
const screenConfig = {
  headerShown: false,
  gestureEnabled: true, // Swiping back enabled
  fullScreenGestureEnabled: true, // iPhone style full swipe
  animationDuration: 250, // Butter smooth transition timing
};

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Lock" screenOptions={screenConfig}>
      {/* Auth & Main Screens */}
      <Stack.Screen name="Lock" component={LockScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="MainDashboard" component={MainDashboard} options={{ animation: 'fade' }} />
      
      {/* Primary Features */}
      <Stack.Screen name="Vault" component={VaultScreen} options={{ animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right' }} />
      <Stack.Screen name="FilesScreen" component={FilesScreen} options={{ animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right' }} />
      <Stack.Screen name="ScanScreen" component={ScanScreen} options={{ animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right' }} />
      <Stack.Screen name="ToolsScreen" component={ToolsScreen} options={{ animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right' }} />
      
      {/* 🚀 SMART MODALS (Niche se upar aayenge premium feel ke sath) */}
      <Stack.Screen name="SelectType" component={SelectTypeScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Form" component={FormScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="EntryDetail" component={EntryDetailScreen} options={{ presentation: 'card', animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right' }} /> 
      <Stack.Screen name="CreateType" component={CreateTypeScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      
      {/* Settings & Configs */}
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Developer" component={DeveloperScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="EmailSetup" component={EmailSetupScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Recovery" component={RecoveryScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="ActivityLog" component={ActivityLogScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PreferredActions" component={PreferredActionsScreen} options={{ animation: 'slide_from_right' }} />
    </Stack.Navigator>
  );
}
