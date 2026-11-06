// Pestaña "Historial": cómo les fue a las recomendaciones de partidos ya jugados.
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Badge, tierColor } from '../../components/RecommendationCard';
import { ErrorBox, Loading, Screen } from '../../components/Screen';
import { Card, Label, s, T } from '../../components/ui';
import { getSettledRecommendations, type Recommendation, type Tier } from '../../data/supabase';
import { PAST_RESULTS, summarize } from '../../logic/recommendations';
import { colors, fonts } from '../../theme/colors';

const TIERS: Tier[] = ['segura', 'media', 'arriesgada'];

export default function HistoryScreen() {
  const [list, setList] = useState<Recommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = async () => {
    setError(null);
    try { setList(await getSettledRecommendations()); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  useEffect(() => { load(); }, []);
  const summary = list ? summarize(list) : null;

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 2 }}>
        <T style={{ fontSize: 13, color: colors.textSecondary }}>Recomendaciones ya jugadas</T>
        <T style={{ fontSize: 28, fontFamily: fonts.bold, letterSpacing: -0.5 }}>Historial</T>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
        refreshControl={<RefreshControl tintColor={colors.safe} refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {error ? <ErrorBox message={error} /> : !list || !summary ? <Loading /> : (
          <>
            <Card>
              <Label>ACIERTO Y BENEFICIO (1 € POR APUESTA)</Label>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ width: 118 }} />
                {['Jugadas', 'Acierto', 'Beneficio'].map((h, i) => (
                  <T key={h} style={{ flex: i === 0 ? 1 : undefined, width: i === 0 ? undefined : i === 1 ? 56 : 72,
                    textAlign: 'right', fontSize: 11, color: colors.textSecondary }}>{h}</T>
                ))}
              </View>
              {TIERS.map((t) => {
                const x = summary[t];
                return (
                  <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 118 }}><Badge tier={t} /></View>
                    <T mono style={{ flex: 1, textAlign: 'right', fontSize: 13, color: colors.textSecondary }}>{x.n}</T>
                    <T mono style={{ width: 56, textAlign: 'right', fontSize: 14, color: tierColor[t] }}>
                      {x.n ? `${Math.round((x.won / x.n) * 100)}%` : '–'}
                    </T>
                    <T mono style={{ width: 72, textAlign: 'right', fontSize: 14, color: x.profit >= 0 ? colors.safe : colors.risky }}>
                      {x.n ? `${x.profit >= 0 ? '+' : ''}${x.profit.toFixed(2).replace('.', ',')} €` : '–'}
                    </T>
                  </View>
                );
              })}
              <T style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
                Referencia en 12.901 partidos pasados: segura {Math.round(PAST_RESULTS.segura.hit * 100)} % de acierto,
                media {Math.round(PAST_RESULTS.media.hit * 100)} %, arriesgada {Math.round(PAST_RESULTS.arriesgada.hit * 100)} %.
                Con cuota 1,45 hace falta acertar más del 69 % para no perder dinero.
              </T>
            </Card>
            {list.length === 0 ? (
              <Card>
                <T style={{ color: colors.textSecondary, fontSize: 13 }}>
                  Todavía no se ha jugado ningún partido con recomendación. Se irán añadiendo solas cuando terminen.
                </T>
              </Card>
            ) : list.slice(0, 100).map((r) => (
              <Card key={`${r.fixture_id}-${r.tier}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
                <View style={[s.form, { width: 26, height: 26, borderRadius: 13, backgroundColor: r.won ? colors.safe : colors.risky }]}>
                  <T style={{ fontFamily: fonts.bold, color: colors.background }}>{r.won ? '✓' : '✗'}</T>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T style={{ fontSize: 14, fontFamily: fonts.semibold }}>{r.label}</T>
                  <T style={{ fontSize: 12, color: colors.textSecondary }}>
                    {r.home_name} {r.home_goals}-{r.away_goals} {r.away_name} · {new Date(r.kickoff).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </T>
                </View>
                <T mono style={{ fontSize: 13, color: tierColor[r.tier] }}>{r.odd.toFixed(2).replace('.', ',')}</T>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
