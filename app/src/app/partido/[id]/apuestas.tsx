// Pantalla 3: las 3 apuestas recomendadas de un partido.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { RecommendationCard } from '../../../components/RecommendationCard';
import { ErrorBox, Loading, Screen } from '../../../components/Screen';
import { Card, T } from '../../../components/ui';
import { getMatch, getRecommendations, type MatchCard, type Recommendation, type Tier } from '../../../data/supabase';
import { time } from '../../../logic/format';
import { PAST_RESULTS, TIER_INFO } from '../../../logic/recommendations';
import { colors, fonts } from '../../../theme/colors';

const TIERS: Tier[] = ['segura', 'media', 'arriesgada'];

export default function BetsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [card, setCard] = useState<MatchCard | null>(null);
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stakeText, setStakeText] = useState('10');
  const stake = Math.max(0, Number(stakeText.replace(',', '.')) || 0);

  useEffect(() => {
    Promise.all([getMatch(Number(id)), getRecommendations(Number(id))])
      .then(([m, r]) => { setCard(m.card); setRecs(r); })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  return (
    <Screen>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{
          width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border,
          backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
        }}>
          <T style={{ fontSize: 20 }}>‹</T>
        </Pressable>
        <View style={{ flex: 1 }}>
          <T style={{ fontSize: 20, fontFamily: fonts.bold }}>Apuestas recomendadas</T>
          {card && <T style={{ fontSize: 13, color: colors.textSecondary }}>{card.home_name} – {card.away_name} · {time(card.kickoff)}</T>}
        </View>
      </View>
      {error ? <ErrorBox message={error} /> : !recs ? <Loading /> : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T numberOfLines={1} style={{ fontSize: 15, flex: 1 }}>Si apuestas</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TextInput value={stakeText} onChangeText={setStakeText} keyboardType="decimal-pad" maxLength={6}
                style={{ color: colors.text, fontFamily: fonts.mono, fontSize: 18, width: 80, textAlign: 'right',
                  borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 4 }} />
              <T mono style={{ fontSize: 18 }}>€</T>
            </View>
          </Card>
          {TIERS.map((t) => {
            const r = recs.find((x) => x.tier === t);
            return r ? <RecommendationCard key={t} r={r} stake={stake} /> : (
              <Card key={t}>
                <T style={{ fontFamily: fonts.semibold, color: colors.textSecondary }}>{TIER_INFO[t].title}</T>
                <T style={{ fontSize: 13, color: colors.textSecondary }}>
                  No hay apuesta {t} en este partido: ninguna cuota de Bet365 está en el rango ({TIER_INFO[t].range}).
                </T>
              </Card>
            );
          })}
          <Card style={{ gap: 6 }}>
            <T style={{ fontSize: 12, color: colors.text, fontFamily: fonts.semibold }}>Estimaciones estadísticas, no garantías.</T>
            <T style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
              La probabilidad es la de Bet365 quitando su margen. En 12.901 partidos pasados, la segura acertó un
              {' '}{Math.round(PAST_RESULTS.segura.hit * 100)} %, pero apostando siempre se habría perdido un
              {' '}{Math.round(-PAST_RESULTS.segura.profit * 100)} % del dinero (media {Math.round(-PAST_RESULTS.media.profit * 100)} %,
              arriesgada {Math.round(-PAST_RESULTS.arriesgada.profit * 100)} %): la casa gana por su margen. Comprueba la cuota en
              Bet365 antes de apostar. Juega con responsabilidad; si el juego deja de ser un entretenimiento, pide ayuda
              (jugarbien.es).
            </T>
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}
