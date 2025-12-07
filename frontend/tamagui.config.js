// tamagui.config.ts
import { config } from '@tamagui/config/v3';
import { createTamagui, createTokens } from 'tamagui';

const tokens = createTokens({
  ...config.tokens,
  color: {
    ...config.tokens.color,
    primary: '#003D52',
    primaryLight: '#0A2E3C',
    accent: '#00D9FF',
    inputBg: '#0D3847',
    inputBorder: '#1A4A5C',
    text: '#FFFFFF',
    textSecondary: '#7A9CA5',
  },
});

export default createTamagui({
  ...config,
  tokens,
});