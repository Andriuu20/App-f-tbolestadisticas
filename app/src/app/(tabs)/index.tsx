// Pantalla 1: Partidos del día, con selector de día y de liga.
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Empty, ErrorBox, Loading, Screen } from '../../components/Screen';
import { MatchCard } from '../../components/MatchCard';
import { Chips, Label, ModelWarning, T } from '../../components/ui';
import { getMatches, type MatchCard as Match } from '../../data/supabase';
import { dayOptions, longDate } from '../../logic/format';
import { leagueShort, LEAGUES } from '../../logic/value';
import { colors, fonts } from '../../theme/colors';

export default function MatchesScreen() {
  const days = useMemo(() => dayOptions(), []);
  const [day, setDay] = useState(0);
  const [league, setLeague] = useState(0); // 0 = todas
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const selected = days.find((d) => d.offset === day)!;
  const load = async () => {
    setError(null);
    try {
      setMatches(await getMatches(selected.from.toISOString(), selected.to.toISOString(), league || undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => { setMatches(null); load(); }, [day, league]); // eslint-disable-line react-hooks/exhaustive-deps

  // Agrupar por liga para poner un título a cada grupo.
  const groups = useMemo(() => {
    const g = new Map<number, Match[]>();
    for (const m of matches ?? []) g.set(m.league_id, [...(g.get(m.league_id) ?? []), m]);
    return [...g.entries()];
  }, [matches]);

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <View style={{ gap: 2 }}>
          <T style={{ fontSize: 13, color: colors.textSecondary }}>{longDate(selected.from)}</T>
          <T style={{ fontSize: 28, fontFamily: fonts.bold, letterSpacing: -0.5 }}>
            {day === 0 ? 'Partidos de hoy' : day === -1 ? 'Partidos de ayer' : 'Partidos'}
          </T>
        </View>
        <Chips scroll items={days.map((d) => ({ key: d.offset, label: d.label }))} value={day} onChange={setDay} />
        <Chips scroll items={[{ key: 0, label: 'Todas' }, ...LEAGUES.map((l) => ({ key: l.id, label: l.short }))]}
          value={league} onChange={setLeague} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
        refreshControl={<RefreshControl tintColor={colors.safe} refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <ModelWarning />
        {error ? <ErrorBox message={error} /> : matches === null ? <Loading /> : matches.length === 0 ? (
          <Empty text="No hay partidos este día en estas ligas." />
        ) : groups.map(([leagueId, list]) => (
          <View key={leagueId} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6, paddingHorizontal: 4 }}>
              <Label>{leagueShort(leagueId, list[0].league_name).toUpperCase()}</Label>
              <T style={{ fontSize: 12, color: colors.textSecondary }}>+2,5 · Ambos · Córners</T>
            </View>
            {list.map((m) => <MatchCard key={m.id} m={m} />)}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
