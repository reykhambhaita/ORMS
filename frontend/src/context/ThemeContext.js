import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

const ThemeContext = createContext();

const THEME_STORAGE_KEY = '@orms_theme_mode';

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState('system'); // 'light', 'dark', 'system'
  const [resolvedTheme, setResolvedTheme] = useState(systemColorScheme || 'light');

  // Load saved theme preference on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedMode) {
          setThemeMode(savedMode);
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
      }
    };
    loadTheme();
  }, []);

  // Update resolved theme when mode or system theme changes
  useEffect(() => {
    if (themeMode === 'system') {
      setResolvedTheme(systemColorScheme || 'light');
    } else {
      setResolvedTheme(themeMode);
    }
  }, [themeMode, systemColorScheme]);

  const updateThemeMode = async (newMode) => {
    try {
      setThemeMode(newMode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  const colors = {
    light: {
      background: '#fafafa',
      card: '#ffffff',
      text: '#111111',
      textSecondary: '#888888',
      textTertiary: '#666666',
      border: '#f0f0f0',
      primary: '#111111',
      primaryText: '#ffffff',
      inputBg: '#f8f9fa',
      statusCompleted: '#d1fae5',
      statusCompletedText: '#065f46',
      statusPending: '#fef3c7',
      statusPendingText: '#92400e',
      modalOverlay: 'rgba(0, 0, 0, 0.5)',
      shadow: '#000',
    },
    dark: {
      background: '#0a0a0a',
      card: '#1a1a1a',
      text: '#f2f2f2',
      textSecondary: '#a0a0a0',
      textTertiary: '#808080',
      border: '#2a2a2a',
      primary: '#f2f2f2',
      primaryText: '#000000',
      inputBg: '#2a2a2a',
      statusCompleted: '#065f46',
      statusCompletedText: '#d1fae5',
      statusPending: '#92400e',
      statusPendingText: '#fef3c7',
      modalOverlay: 'rgba(0, 0, 0, 0.7)',
      shadow: '#000',
    },
  };

  const theme = colors[resolvedTheme] || colors.light;

  const value = {
    themeMode,
    resolvedTheme,
    theme,
    setThemeMode: updateThemeMode,
    isDark: resolvedTheme === 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
