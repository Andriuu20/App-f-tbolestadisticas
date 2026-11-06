// Pantalla pendiente (README, sección 3).
import { View } from 'react-native';
import { Screen } from '../../components/Screen';
import { T } from '../../components/ui';
import { colors, fonts } from '../../theme/colors';

export default function Pending() {
  return (
    <Screen>
      <View style={{ padding: 20, gap: 8 }}>
        <T style={{ fontSize: 28, fontFamily: fonts.bold }}>Historial</T>
        <T style={{ color: colors.textSecondary }}>Próximamente. Las apuestas recomendadas y analizadas con su resultado real y el % de acierto.</T>
      </View>
    </Screen>
  );
}
