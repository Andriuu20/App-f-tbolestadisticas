// Pantalla pendiente (README, sección 3).
import { View } from 'react-native';
import { Screen } from '../../components/Screen';
import { T } from '../../components/ui';
import { colors, fonts } from '../../theme/colors';

export default function Pending() {
  return (
    <Screen>
      <View style={{ padding: 20, gap: 8 }}>
        <T style={{ fontSize: 28, fontFamily: fonts.bold }}>Rankings</T>
        <T style={{ color: colors.textSecondary }}>Próximamente. Equipos ordenados por % de partidos con más de 2,5 goles, ambos marcan, córners y tarjetas.</T>
      </View>
    </Screen>
  );
}
