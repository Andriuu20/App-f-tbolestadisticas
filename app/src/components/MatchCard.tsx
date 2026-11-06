// Tarjeta de un partido en la lista: hora, equipos y 3 datos rápidos.
import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';
import type { MatchCard as Match } from '../data/supabase';
import { dec, pct, time } from '../logic/format';
import { colors, fonts, pctColor } from '../theme/colors';
import { Card, s, T } from './ui';

export function MatchCard({ m }: { m: Match }) {
  const played = m.status === 'FT';
  return (
    <Link href={{ pathname: '/partido/[id]', params: { id: String(m.id) } }} asChild>
      <Pressable>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <T mono style={{ fontSize: 13, color: colors.textSecondary, width: 44 }}>{time(m.kickoff)}</T>
            <View style={{ flex: 1, gap: 6 }}>
              {[['home', m.home_name, m.home_goals], ['away', m.away_name, m.away_goals]].map(([k, name, goals]) => (
                <View key={k as string} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T numberOfLines={1} style={{ fontSize: 15, fontFamily: fonts.semibold, flex: 1 }}>{name as string}</T>
                  {played && <T mono style={{ fontSize: 15 }}>{String(goals)}</T>}
                </View>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={s.tile}>
              <T style={{ fontSize: 11, color: colors.textSecondary }}>Más de 2,5</T>
              <T mono style={{ fontSize: 16, color: pctColor(m.p_over25) }}>{pct(m.p_over25)}</T>
            </View>
            <View style={s.tile}>
              <T style={{ fontSize: 11, color: colors.textSecondary }}>Ambos marcan</T>
              <T mono style={{ fontSize: 16, color: pctColor(m.p_btts) }}>{pct(m.p_btts)}</T>
            </View>
            <View style={s.tile}>
              <T style={{ fontSize: 11, color: colors.textSecondary }}>Córners media</T>
              <T mono style={{ fontSize: 16, color: pctColor(m.corners_avg ? m.corners_avg / 16.5 : null) }}>{dec(m.corners_avg)}</T>
            </View>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}
