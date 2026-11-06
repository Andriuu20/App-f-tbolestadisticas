// Piezas visuales reutilizables con el estilo del boceto.
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { colors, fonts } from '../theme/colors';

export function T({ children, style, mono, numberOfLines }: {
  children: ReactNode; style?: TextStyle | TextStyle[]; mono?: boolean; numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={[{ color: colors.text, fontFamily: mono ? fonts.mono : fonts.regular }, style as TextStyle]}>
      {children}
    </Text>
  );
}

export const Label = ({ children }: { children: ReactNode }) => (
  <T style={{ fontSize: 12, fontFamily: fonts.semibold, letterSpacing: 1, color: colors.textSecondary }}>{children}</T>
);

export const Card = ({ children, style }: { children: ReactNode; style?: ViewStyle }) => (
  <View style={[s.card, style]}>{children}</View>
);

/** Fila de botones redondeados (días, ligas, pestañas). */
export function Chips<K extends string | number>({ items, value, onChange, variant = 'accent', scroll }: {
  items: { key: K; label: string }[]; value: K; onChange: (k: K) => void; variant?: 'accent' | 'light'; scroll?: boolean;
}) {
  const content = items.map((it) => {
    const on = it.key === value;
    const onStyle = variant === 'accent'
      ? { backgroundColor: colors.safe, borderColor: colors.safe }
      : { backgroundColor: colors.text, borderColor: colors.text };
    return (
      <Pressable key={String(it.key)} onPress={() => onChange(it.key)}
        style={[s.chip, on ? onStyle : { backgroundColor: variant === 'accent' ? colors.card : 'transparent', borderColor: colors.border }]}>
        <T style={{ fontSize: 13, fontFamily: fonts.semibold, color: on ? colors.background : variant === 'accent' ? colors.text : colors.textSecondary }}>
          {it.label}
        </T>
      </Pressable>
    );
  });
  if (scroll) {
    return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{content}</ScrollView>;
  }
  return <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{content}</View>;
}

/** Barra de porcentaje con etiqueta. */
export function PctBar({ label, p, highAt = 0.6, right }: { label: string; p: number; highAt?: number; right?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T style={{ fontSize: 13 }}>{label}</T>
        <T mono style={{ fontSize: 13, color: p >= highAt ? colors.safe : colors.text }}>{right ?? `${Math.round(p * 100)}%`}</T>
      </View>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${Math.max(0, Math.min(1, p)) * 100}%`, backgroundColor: p >= highAt ? colors.safe : colors.medium }]} />
      </View>
    </View>
  );
}

/** Forma: cuadritos V/E/D (el más reciente a la izquierda). */
export function Form({ results }: { results: ('V' | 'E' | 'D')[] }) {
  const bg = { V: colors.safe, E: colors.textSecondary, D: colors.risky };
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {results.map((r, i) => (
        <View key={i} style={[s.form, { backgroundColor: bg[r] }]}>
          <T style={{ fontSize: 10, fontFamily: fonts.bold, color: colors.background }}>{r}</T>
        </View>
      ))}
    </View>
  );
}

/** Aviso de que el modelo está en pruebas. */
export const ModelWarning = () => (
  <View style={s.warning}>
    <T style={{ fontSize: 12, color: colors.risky, fontFamily: fonts.semibold }}>Modelo en pruebas</T>
    <T style={{ fontSize: 12, color: colors.textSecondary }}>
      Las probabilidades son estimaciones y todavía aciertan menos que las casas de apuestas. No apuestes dinero con ellas.
    </T>
  </View>
);

export const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  form: { width: 18, height: 18, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  warning: { borderColor: colors.risky, borderWidth: 1, borderRadius: 12, padding: 10, gap: 2, backgroundColor: '#1F1610' },
  tile: { flex: 1, backgroundColor: colors.background, borderRadius: 10, padding: 8, gap: 2 },
});
