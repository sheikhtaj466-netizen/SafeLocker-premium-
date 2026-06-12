// File: src/ThemeContext.js
import React, { createContext, useState, useEffect } from 'react';
import { useColorScheme, Appearance, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ThemeContext = createContext();

// 🚀 PREMIUM 16 MINIMALIST PRESETS
export const PREMIUM_PRESETS = [
  { name: 'Lavender', hex: '#8B5CF6' }, { name: 'Ocean', hex: '#0EA5E9' },
  { name: 'Mint', hex: '#10B981' }, { name: 'Rose', hex: '#F43F5E' },
  { name: 'Sunset', hex: '#F97316' }, { name: 'Amber', hex: '#F59E0B' },
  { name: 'Emerald', hex: '#059669' }, { name: 'Cyan', hex: '#06B6D4' },
  { name: 'Indigo', hex: '#6366F1' }, { name: 'Violet', hex: '#7C3AED' },
  { name: 'Fuchsia', hex: '#C026D3' }, { name: 'Pink', hex: '#DB2777' },
  { name: 'Crimson', hex: '#BE123C' }, { name: 'Rust', hex: '#B91C1C' },
  { name: 'Slate', hex: '#475569' }, { name: 'Zinc', hex: '#52525B' },
];

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemScheme === 'dark');
  const [accentName, setAccentName] = useState('Lavender');
  const [accentHex, setAccentHex] = useState('#8B5CF6'); 

  useEffect(() => { 
    loadTheme(); 
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      AsyncStorage.getItem('DARK_MODE').then(savedDark => {
        if (savedDark === null) setIsDark(colorScheme === 'dark');
      });
    });
    return () => subscription.remove();
  }, []);

  const loadTheme = async () => {
    try {
      const savedDark = await AsyncStorage.getItem('DARK_MODE');
      if (savedDark !== null) setIsDark(savedDark === 'true');
      else setIsDark(systemScheme === 'dark');
      
      const savedAccentName = await AsyncStorage.getItem('ACCENT_NAME');
      const savedAccentHex = await AsyncStorage.getItem('ACCENT_HEX');
      if (savedAccentName) setAccentName(savedAccentName);
      if (savedAccentHex) setAccentHex(savedAccentHex);
    } catch (e) { console.log("Error loading theme", e); }
  };

  const toggleTheme = async (value) => {
    setIsDark(value);
    await AsyncStorage.setItem('DARK_MODE', value ? 'true' : 'false');
  };

  const changeAccentColor = async (name, hex) => {
    try {
      const safeName = name || 'Lavender';
      const safeHex = hex || '#8B5CF6';
      setAccentName(safeName); 
      setAccentHex(safeHex);
      await AsyncStorage.setItem('ACCENT_NAME', safeName);
      await AsyncStorage.setItem('ACCENT_HEX', safeHex);
    } catch (e) { console.log("Error saving accent", e); }
  };

  const primaryColor = accentHex || '#8B5CF6';
  const primaryLight = primaryColor + '20'; 
  const primaryGradient = [primaryColor, primaryColor + 'CC']; 

  const themeColors = {
    background: isDark ? ['#0F172A', '#0F172A'] : ['#F8FAFC', '#F8FAFC'],
    card: isDark ? '#1E293B' : '#FFFFFF',
    textDark: isDark ? '#F8FAFC' : '#0F172A',
    textLight: isDark ? '#94A3B8' : '#64748B',
    primary: primaryColor,
    primaryLight: primaryLight,
    primaryGradient: primaryGradient,
    separator: isDark ? '#334155' : '#E2E8F0',
    inputBg: isDark ? '#0F172A' : '#F1F5F9',
    inputBorder: isDark ? '#334155' : '#E2E8F0',
    danger: '#EF4444',
    success: '#10B981',
    iconBg: { 
      default: primaryLight, 
      danger: isDark ? '#450A0A' : '#FEE2E2',
      security: isDark ? '#450A0A' : '#FEE2E2', 
      email: isDark ? '#1E3A8A' : '#DBEAFE',    
      privacy: isDark ? '#312E81' : '#E0E7FF',  
      data: isDark ? '#064E3B' : '#D1FAE5',     
      appearance: isDark ? '#4C1D95' : '#F3E8FF',
      about: isDark ? '#334155' : '#F1F5F9'     
    },
    iconColor: { 
      default: primaryColor, 
      danger: '#EF4444',
      security: '#EF4444', 
      email: '#3B82F6',    
      privacy: '#6366F1',  
      data: '#10B981',     
      appearance: '#8B5CF6',
      about: '#64748B'     
    }
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, accentName, accentHex, changeAccentColor, themeColors }}>
      {children}
    </ThemeContext.Provider>
  );
};
