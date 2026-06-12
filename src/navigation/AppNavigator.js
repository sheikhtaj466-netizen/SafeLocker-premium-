// File: src/navigation/AppNavigator.js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// 🔥 Aapki saari screens wapas aa gayin
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

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Lock" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Lock" component={LockScreen} options={{ animation: 'fade' }} />
      
      {/* 🔥 MAIN DASHBOARD JISME GALLERY, FILES, TOOLS HAIN */}
      <Stack.Screen name="MainDashboard" component={MainDashboard} options={{ animation: 'fade' }} />
      
      <Stack.Screen name="Vault" component={VaultScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="FilesScreen" component={FilesScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ScanScreen" component={ScanScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ToolsScreen" component={ToolsScreen} options={{ animation: 'slide_from_right' }} />
      
      <Stack.Screen name="SelectType" component={SelectTypeScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Form" component={FormScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="EntryDetail" component={EntryDetailScreen} options={{ animation: 'slide_from_right' }} /> 
      <Stack.Screen name="CreateType" component={CreateTypeScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Developer" component={DeveloperScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="EmailSetup" component={EmailSetupScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Recovery" component={RecoveryScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="ActivityLog" component={ActivityLogScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PreferredActions" component={PreferredActionsScreen} options={{ animation: 'slide_from_right' }} />
    </Stack.Navigator>
  );
}
