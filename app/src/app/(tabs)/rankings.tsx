// Pestaña "Rankings": equipos de una liga ordenados por un mercado, en la temporada actual.
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Empty, ErrorBox, Loading, Screen } from '../../components/Screen';
import { Card, Chips, T } from '../../components/ui';
import { getPlayedMatches } from '../../data/supabase';
import { dec } from '../../logic/format';
import { RANKING_MARKETS, rankTeams, seasonStart, type PlayedMatch, type RankingMarket } from '../../logic/rankings';
import { LEAGUES } from '../../logic/value';
import { colors, fonts } from '../../theme/colors';

export default function RankingsScreen() {
  const [league, setLeague] = useState(LEAGUES[0].id);
  const [market, setMarket] = useState<RankingMarket>('over25');
  const [matches, setMatches] = useState<PlayedMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = async () => {
    setError(null);
    try { setMatches(await getPlayedMatches(league, seasonStart().toISOString())); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  useEffect(() => { setMatches(null); load(); }, [league]); // eslint-disable-line react-hooks/exhaustive-deps

  const info = RANKING_MARKETS.find((m) => m.key === market)!;
  const rows = useMemo(() => (matches ? rankTeams(matches, market) : []), [matches, market]);
  const max = rows.length ? Math.max(...rows.map((r) => r.value)) : 1;

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <View style={{ gap: 2 }}>
          <T style={{ fontSize: 13, color: colors.textSecondary }}>Temporada actual</T>
          <T style={{ fontSize: 28, fontFamily: fonts.bold, letterSpacing: -0.5 }}>Rankings</T>
        </View>
        <Chips scroll items={LEAGUES.map((l) => ({ key: l.id, label: l.short }))} value={league} onChange={setLeague} />
        <Chips scroll variant="light" items={RANKING_MARKETS.map((m) => ({ key: m.key, label: m.label }))} value={market} onChange={setMarket} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
        refreshControl={<RefreshControl tintColor={colors.safe} refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {error ? <ErrorBox message={error} /> : !matches ? <Loading /> : rows.length === 0 ? (
          <Empty text="Todavía no hay partidos jugados esta temporada." />
        ) : (
          <Card style={{ gap: 0, paddingVertical: 6 }}>
            <View style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <T style={{ flex: 1, fontSize: 12, color: colors.textSecondary }}>{info.help}</T>
              <T style={{ width: 34, textAlign: 'right', fontSize: 12, color: colors.textSecondary }}>PJ</T>
            </View>
            {rows.map((r, i) => (
              <View key={r.teamId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9,
                borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: colors.border }}>
                <T mono style={{ width: 24, fontSize: 13, color: colors.textSecondary }}>{i + 1}</T>
                <View style={{ flex: 1, gap: 5 }}>
                  <T numberOfLines={1} style={{ fontSize: 14, fontFamily: fonts.semibold }}>{r.name}</T>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.border }}>
                    <View style={{ height: 4, borderRadius: 2, width: `${(r.value / max) * 100}%`,
                      backgroundColor: i < 3 ? colors.safe : colors.medium }} />
                  </View>
                </View>
                <T mono style={{ width: 54, textAlign: 'right', fontSize: 15, color: i < 3 ? colors.safe : colors.text }}>
                  {info.percent ? `${Math.round(r.value * 100)}%` : dec(r.value)}
                </T>
                <T mono style={{ width: 34, textAlign: 'right', fontSize: 12, color: colors.textSecondary }}>{r.played}</T>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}
