// Colores y letras del boceto (README, sección 10). Cambiar aquí para rediseñar la app.
export const colors = {
  background: '#0D1117',
  card: '#161B22',
  border: '#262D36',
  text: '#E6EDF3',
  textSecondary: '#9AA4AF',
  safe: '#A3E635', // verde lima: datos altos y apuesta segura
  medium: '#58A6FF', // azul: apuesta media
  risky: '#F0883E', // naranja: apuesta arriesgada
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  mono: 'JetBrainsMono_600SemiBold',
} as const;

/** Color de un porcentaje: verde si es alto, normal si no. */
export const pctColor = (p: number | null | undefined, high = 0.6) =>
  p !== null && p !== undefined && p >= high ? colors.safe : colors.text;
