// tamagui.config.ts
import { config } from '@tamagui/config/v3';
import { createTamagui, createTokens } from 'tamagui';

const tokens = createTokens({
  ...config.tokens,
  color: {
    ...config.tokens.color,
    primary: '#111111',
    primaryLight: '#444444',
    accent: '#111111',
    inputBg: '#FFFFFF',
    inputBorder: '#F0F0F0',
    text: '#111111',
    textSecondary: '#888888',
    background: '#FAFAFA',
  },
});

export default createTamagui({
  ...config,
  tokens,
});