// Pestaña "Para ti": las recomendaciones de los próximos partidos, por nivel.
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { RecommendationCard } from '../../components/RecommendationCard';
import { Empty, ErrorBox, Loading, Screen } from '../../components/Screen';
import { Chips, T } from '../../components/ui';
import { getUpcomingRecommendations, type Recommendation, type Tier } from '../../data/supabase';
import { colors, fonts } from '../../theme/colors';

export default function ForYouScreen() {
  const [tier, setTier] = useState<Tier>('segura');
  const [list, setList] = useState<Recommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = async () => {
    setError(null);
    try { setList(await getUpcomingRecommendations(tier)); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  useEffect(() => { setList(null); load(); }, [tier]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <View style={{ gap: 2 }}>
          <T style={{ fontSize: 13, color: colors.textSecondary }}>Próximos partidos</T>
          <T style={{ fontSize: 28, fontFamily: fonts.bold, letterSpacing: -0.5 }}>Para ti</T>
        </View>
        <Chips items={[{ key: 'segura', label: 'Segura' }, { key: 'media', label: 'Media' }, { key: 'arriesgada', label: 'Arriesgada' }]}
          value={tier} onChange={setTier} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
        refreshControl={<RefreshControl tintColor={colors.safe} refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {error ? <ErrorBox message={error} /> : !list ? <Loading /> : list.length === 0 ? (
          <Empty text="No hay recomendaciones de este nivel en los próximos partidos." />
        ) : list.map((r) => (
          <Link key={`${r.fixture_id}-${r.tier}`} href={{ pathname: '/partido/[id]/apuestas', params: { id: String(r.fixture_id) } }} asChild>
            <Pressable><RecommendationCard r={r} stake={10} showMatch /></Pressable>
          </Link>
        ))}
        {list && list.length > 0 && (
          <T style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center' }}>
            Importes calculados para 10 €. Toca una para cambiar la cantidad.
          </T>
        )}
      </ScrollView>
    </Screen>
  );
}
