// Contenedor común de pantalla: fondo oscuro y márgenes de la zona segura.
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { T } from './ui';

export const Screen = ({ children }: { children: ReactNode }) => (
  // En la web, el hueco de la barra de estado del iPhone lo deja public/index.html (padding-top).
  <SafeAreaView edges={Platform.OS === 'web' ? [] : ['top']} style={{ flex: 1, backgroundColor: colors.background }}>
    {children}
  </SafeAreaView>
);

export const Loading = () => (
  <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={colors.safe} /></View>
);

export const ErrorBox = ({ message }: { message: string }) => (
  <View style={{ padding: 24 }}>
    <T style={{ color: colors.risky, textAlign: 'center' }}>No se han podido cargar los datos.</T>
    <T style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 12, marginTop: 4 }}>{message}</T>
  </View>
);

export const Empty = ({ text }: { text: string }) => (
  <View style={{ padding: 32 }}><T style={{ color: colors.textSecondary, textAlign: 'center' }}>{text}</T></View>
);
