// Barra inferior: Partidos · Rankings · Para ti · Historial.
import { Tabs } from 'expo-router/tabs';
import { Text, type ColorValue } from 'react-native';
import { colors, fonts } from '../../theme/colors';

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.safe,
      tabBarInactiveTintColor: colors.textSecondary,
      tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
      tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Partidos', tabBarIcon: icon('⚽') }} />
      <Tabs.Screen name="rankings" options={{ title: 'Rankings', tabBarIcon: icon('▤') }} />
      <Tabs.Screen name="para-ti" options={{ title: 'Para ti', tabBarIcon: icon('★') }} />
      <Tabs.Screen name="historial" options={{ title: 'Historial', tabBarIcon: icon('◷') }} />
    </Tabs>
  );
}
