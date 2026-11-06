import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

// Pantalla provisional hasta montar "Partidos de hoy" (paso 5 del README).
export function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fútbol Stats</Text>
      <Text style={styles.subtitle}>Proyecto listo. Próximo paso: conectar API-Football.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { color: colors.safe, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 15, marginTop: 8, textAlign: 'center' },
});
