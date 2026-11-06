// Tarjeta de una apuesta recomendada (segura, media o arriesgada).
import { View } from 'react-native';
import type { Recommendation, Tier } from '../data/supabase';
import { pct } from '../logic/format';
import { euros, failsOutOf10, payout, TIER_INFO } from '../logic/recommendations';
import { colors, fonts } from '../theme/colors';
import { Card, s, T } from './ui';

export const tierColor: Record<Tier, string> = { segura: colors.safe, media: colors.medium, arriesgada: colors.risky };

export function Badge({ tier }: { tier: Tier }) {
  return (
    <View style={{ alignSelf: 'flex-start', height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center', backgroundColor: tierColor[tier] }}>
      <T style={{ fontSize: 12, fontFamily: fonts.bold, letterSpacing: 0.5, color: colors.background }}>{TIER_INFO[tier].title}</T>
    </View>
  );
}

export function RecommendationCard({ r, stake, showMatch }: { r: Recommendation; stake: number; showMatch?: boolean }) {
  return (
    <Card style={{ borderColor: tierColor[r.tier] + '66' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Badge tier={r.tier} />
        <T style={{ fontSize: 12, color: colors.textSecondary }}>Fallas ~{failsOutOf10(r.prob)} de cada 10</T>
      </View>
      {showMatch && (
        <T style={{ fontSize: 12, color: colors.textSecondary }}>
          {r.home_name} – {r.away_name} · {new Date(r.kickoff).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </T>
      )}
      <T style={{ fontSize: 17, fontFamily: fonts.bold }}>{r.label}</T>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[['Probabilidad', pct(r.prob)], ['Cuota', r.odd.toFixed(2).replace('.', ',')], ['Recibes', euros(payout(stake, r.odd))]].map(([k, v]) => (
          <View key={k} style={s.tile}>
            <T style={{ fontSize: 11, color: colors.textSecondary }}>{k}</T>
            <T mono style={{ fontSize: 16, color: k === 'Probabilidad' ? tierColor[r.tier] : colors.text }}>{v}</T>
          </View>
        ))}
      </View>
      <T style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>{r.reason}</T>
    </Card>
  );
}
