// Raíz de la app: letras del boceto, tema oscuro y navegación.
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { colors } from '../theme/colors';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.background, card: colors.background, border: colors.border, primary: colors.safe, text: colors.text },
};

export default function RootLayout() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold, JetBrainsMono_600SemiBold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  return (
    <ThemeProvider value={theme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
