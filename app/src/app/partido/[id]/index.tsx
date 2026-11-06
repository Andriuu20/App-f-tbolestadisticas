// Pantalla 2: ficha del partido.
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ErrorBox, Loading, Screen } from '../../../components/Screen';
import { Card, Chips, Form, Label, ModelWarning, OverUnder, PctBar, s, T } from '../../../components/ui';
import { getHeadToHead, getMatch, getStats, type MatchCard, type Odd, type Prediction } from '../../../data/supabase';
import { dec, initials, pct, time } from '../../../logic/format';
import { expectedValue, fairProbabilities, leagueShort } from '../../../logic/value';
import { colors, fonts } from '../../../theme/colors';

type Tab = 'Resumen' | 'Goles' | 'Córners' | 'Tarjetas' | 'H2H';
const TABS: Tab[] = ['Resumen', 'Goles', 'Córners', 'Tarjetas', 'H2H'];

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<{ card: MatchCard; prediction: Prediction | null; odds: Odd[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('Resumen');

  useEffect(() => {
    getMatch(Number(id)).then(setData).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  return (
    <Screen>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{
          width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border,
          backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
        }}>
          <T style={{ fontSize: 20 }}>‹</T>
        </Pressable>
        {data && (
          <T style={{ fontSize: 13, color: colors.textSecondary, flex: 1, textAlign: 'center', marginRight: 52 }}>
            {leagueShort(data.card.league_id, data.card.league_name)} · {time(data.card.kickoff)}
          </T>
        )}
      </View>
      {error ? <ErrorBox message={error} /> : !data ? <Loading /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}>
          <Header card={data.card} p={data.prediction} />
          <Chips variant="light" scroll items={TABS.map((t) => ({ key: t, label: t }))} value={tab} onChange={setTab} />
          {!data.prediction ? (
            <Card><T style={{ color: colors.textSecondary }}>Aún no hay predicción para este partido.</T></Card>
          ) : tab === 'Resumen' ? <Summary card={data.card} p={data.prediction} odds={data.odds} />
            : tab === 'Goles' ? <Goals card={data.card} p={data.prediction} />
            : tab === 'Córners' ? <Averages p={data.prediction} card={data.card} kind="corners" />
            : tab === 'Tarjetas' ? <Averages p={data.prediction} card={data.card} kind="cards" />
            : <HeadToHead card={data.card} />}
          <ModelWarning />
        </ScrollView>
      )}
    </Screen>
  );
}

function Header({ card, p }: { card: MatchCard; p: Prediction | null }) {
  const team = (name: string, form: ('V' | 'E' | 'D')[] | undefined, light: boolean) => (
    <View style={{ alignItems: 'center', gap: 8, flex: 1 }}>
      <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
        backgroundColor: light ? colors.text : colors.border }}>
        <T style={{ fontFamily: fonts.bold, fontSize: 15, color: light ? colors.background : colors.text }}>{initials(name)}</T>
      </View>
      <T numberOfLines={1} style={{ fontSize: 14, fontFamily: fonts.semibold }}>{name}</T>
      {form && <Form results={form} />}
    </View>
  );
  const played = card.status === 'FT';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
      {team(card.home_name, p?.home_recent.form, true)}
      <View style={{ alignItems: 'center', gap: 4, flex: 1 }}>
        {played ? (
          <T mono style={{ fontSize: 26 }}>{card.home_goals} – {card.away_goals}</T>
        ) : (
          <T style={{ color: colors.textSecondary, fontFamily: fonts.semibold }}>VS</T>
        )}
        <T style={{ fontSize: 11, color: colors.textSecondary }}>Goles esperados</T>
        <T mono style={{ fontSize: 15 }}>{dec(card.lambda_home)} – {dec(card.lambda_away)}</T>
      </View>
      {team(card.away_name, p?.away_recent.form, false)}
    </View>
  );
}

const findOdd = (odds: Odd[], bookmaker: string, market: string, selection: string) =>
  odds.find((o) => o.bookmaker === bookmaker && o.market === market && o.selection === selection)?.odd;

function Summary({ card, p, odds }: { card: MatchCard; p: Prediction; odds: Odd[] }) {
  const m = p.markets;
  const b365 = ['Home', 'Draw', 'Away'].map((x) => findOdd(odds, 'Bet365', 'Match Winner', x));
  const fair = b365.every(Boolean) ? fairProbabilities(b365 as number[]).probs : null;
  const rows: [string, number, number | undefined, number | undefined][] = [
    ['Local', m.home, b365[0], fair?.[0]], ['Empate', m.draw, b365[1], fair?.[1]], ['Visitante', m.away, b365[2], fair?.[2]],
  ];
  return (
    <>
      <Card>
        <Label>RESULTADO 1X2</Label>
        <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 }}>
          <View style={{ flex: m.home, backgroundColor: colors.safe }} />
          <View style={{ flex: m.draw, backgroundColor: colors.textSecondary }} />
          <View style={{ flex: m.away, backgroundColor: colors.medium }} />
        </View>
        {rows.map(([label, prob, odd, fairP]) => {
          const ev = odd ? expectedValue(prob, odd) : null;
          return (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T style={{ flex: 1, fontSize: 13 }}>{label}</T>
              <T mono style={{ width: 56, textAlign: 'right', fontSize: 14 }}>{pct(prob)}</T>
              <T mono style={{ width: 88, textAlign: 'right', fontSize: 12, color: colors.textSecondary }}>
                {odd ? `${dec(odd, 2)} · ${pct(fairP)}` : '–'}
              </T>
              <T mono style={{ width: 52, textAlign: 'right', fontSize: 12, color: colors.textSecondary }}>
                {ev === null ? '' : `${ev > 0 ? '+' : ''}${Math.round(ev * 100)}%`}
              </T>
            </View>
          );
        })}
        <T style={{ fontSize: 11, color: colors.textSecondary }}>
          Modelo · cuota Bet365 · probabilidad de la casa sin margen · valor esperado según el modelo
        </T>
      </Card>
      <Card>
        <OverUnder title="GOLES" unit="goles" over={{ '0.5': m.over[0.5], '1.5': m.over[1.5], '2.5': m.over[2.5], '3.5': m.over[3.5] }} />
        <PctBar label="Ambos marcan" p={m.btts} />
      </Card>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Card style={{ flex: 1, gap: 4 }}>
          <Label>CÓRNERS</Label>
          <T mono style={{ fontSize: 22 }}>{dec(card.corners_avg)}</T>
          <T style={{ fontSize: 12, color: colors.textSecondary }}>media por partido</T>
        </Card>
        <Card style={{ flex: 1, gap: 4 }}>
          <Label>TARJETAS</Label>
          <T mono style={{ fontSize: 22 }}>{dec(card.cards_avg)}</T>
          <T style={{ fontSize: 12, color: colors.textSecondary }}>amarillas por partido</T>
        </Card>
      </View>
      <Link href={{ pathname: '/partido/[id]/apuestas', params: { id: String(card.id) } }} asChild>
        <Pressable style={{ height: 52, borderRadius: 14, backgroundColor: colors.safe, alignItems: 'center', justifyContent: 'center' }}>
          <T style={{ color: colors.background, fontFamily: fonts.bold, fontSize: 15 }}>Ver 3 apuestas recomendadas</T>
        </Pressable>
      </Link>
    </>
  );
}

function Goals({ card, p }: { card: MatchCard; p: Prediction }) {
  const m = p.markets;
  const h = p.home_recent, a = p.away_recent;
  return (
    <>
      <Card>
        <OverUnder title="TOTAL DE GOLES (MODELO)" unit="goles" over={{ '0.5': m.over[0.5], '1.5': m.over[1.5], '2.5': m.over[2.5], '3.5': m.over[3.5], '4.5': m.over[4.5] }} />
        <PctBar label="Ambos marcan" p={m.btts} />
        <PctBar label="No marcan los dos" p={1 - m.btts} />
      </Card>
      <Card>
        <Label>GOLES DE CADA EQUIPO (MODELO)</Label>
        <PctBar label={`${card.home_name} marca`} p={m.homeOver['0.5']} />
        <PctBar label={`${card.home_name} más de 1,5`} p={m.homeOver['1.5']} />
        <PctBar label={`${card.away_name} marca`} p={m.awayOver['0.5']} />
        <PctBar label={`${card.away_name} más de 1,5`} p={m.awayOver['1.5']} />
      </Card>
      <Card>
        <Label>MARCADORES MÁS PROBABLES</Label>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {m.topScores.slice(0, 4).map((x) => (
            <View key={`${x.home}-${x.away}`} style={[s.tile, { alignItems: 'center' }]}>
              <T mono style={{ fontSize: 16 }}>{x.home}-{x.away}</T>
              <T style={{ fontSize: 11, color: colors.textSecondary }}>{pct(x.p)}</T>
            </View>
          ))}
        </View>
      </Card>
      <Card>
        <Label>ÚLTIMOS 10 PARTIDOS (HISTÓRICO)</Label>
        <RecentRow label="Más de 2,5" a={h.over['2.5']} b={a.over['2.5']} home={card.home_name} away={card.away_name} />
        <RecentRow label="Ambos marcan" a={h.btts} b={a.btts} />
        <RecentRow label="Goles a favor" a={h.goalsFor} b={a.goalsFor} decimal />
        <RecentRow label="Goles en contra" a={h.goalsAgainst} b={a.goalsAgainst} decimal />
        <RecentRow label="Más de 2,5 (local / fuera)" a={h.home.over['2.5']} b={a.away.over['2.5']} />
      </Card>
    </>
  );
}

function RecentRow({ label, a, b, home, away, decimal }: {
  label: string; a: number; b: number; home?: string; away?: string; decimal?: boolean;
}) {
  const f = (x: number) => (decimal ? dec(x) : pct(x));
  return (
    <View style={{ gap: 2 }}>
      {home && (
        <View style={{ flexDirection: 'row' }}>
          <T style={{ flex: 1 }}> </T>
          <T numberOfLines={1} style={{ width: 90, textAlign: 'right', fontSize: 11, color: colors.textSecondary }}>{home}</T>
          <T numberOfLines={1} style={{ width: 90, textAlign: 'right', fontSize: 11, color: colors.textSecondary }}>{away}</T>
        </View>
      )}
      <View style={{ flexDirection: 'row' }}>
        <T style={{ flex: 1, fontSize: 13 }}>{label}</T>
        <T mono style={{ width: 90, textAlign: 'right', fontSize: 13 }}>{f(a)}</T>
        <T mono style={{ width: 90, textAlign: 'right', fontSize: 13 }}>{f(b)}</T>
      </View>
    </View>
  );
}

function Averages({ p, card, kind }: { p: Prediction; card: MatchCard; kind: 'corners' | 'cards' }) {
  const field = kind === 'corners' ? 'cornersAvg' : 'yellowsAvg';
  const model = kind === 'corners' ? p.markets.corners : p.markets.yellows;
  const word = kind === 'corners' ? 'córners' : 'amarillas';
  return (
    <>
      {model ? (
        <Card>
          <Label>{kind === 'corners' ? 'CÓRNERS' : 'TARJETAS AMARILLAS'} ESPERADOS (MODELO)</Label>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[[card.home_name, model.home], [card.away_name, model.away], ['Total', model.total]].map(([n, v]) => (
              <View key={n as string} style={[s.tile, { alignItems: 'center' }]}>
                <T mono style={{ fontSize: 18 }}>{dec(v as number)}</T>
                <T numberOfLines={1} style={{ fontSize: 11, color: colors.textSecondary }}>{n as string}</T>
              </View>
            ))}
          </View>
          <OverUnder title="PROBABILIDAD" unit={word} over={model.over} />
        </Card>
      ) : null}
      <Card>
        <Label>MEDIA EN LOS ÚLTIMOS 10 PARTIDOS</Label>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[[card.home_name, p.home_recent[field]], [card.away_name, p.away_recent[field]]].map(([n, v]) => (
            <View key={n as string} style={[s.tile, { alignItems: 'center' }]}>
              <T mono style={{ fontSize: 18 }}>{dec(v as number | null)}</T>
              <T numberOfLines={1} style={{ fontSize: 11, color: colors.textSecondary }}>{n as string}</T>
            </View>
          ))}
        </View>
        <T style={{ fontSize: 12, color: colors.textSecondary }}>
          {word[0].toUpperCase() + word.slice(1)} de los dos equipos sumados en los partidos de cada uno.
          {kind === 'cards' && card.referee ? ` Árbitro: ${card.referee}.` : ''}
          {kind === 'cards' ? ' Solo amarillas; las rojas son raras y no se calculan.' : ''}
        </T>
      </Card>
    </>
  );
}

function HeadToHead({ card }: { card: MatchCard }) {
  const [list, setList] = useState<(MatchCard & { corners?: number; cards?: number })[] | null>(null);
  useEffect(() => {
    (async () => {
      const h2h = await getHeadToHead(card.home_id, card.away_id, card.kickoff);
      const stats = await getStats(h2h.map((m) => m.id));
      setList(h2h.map((m) => {
        const st = stats.filter((x) => x.fixture_id === m.id);
        const sum = (k: 'corners' | 'yellow_cards') => (st.length ? st.reduce((t, x) => t + (x[k] ?? 0), 0) : undefined);
        return { ...m, corners: sum('corners'), cards: sum('yellow_cards') };
      }));
    })().catch(() => setList([]));
  }, [card]);
  if (!list) return <Loading />;
  if (!list.length) return <Card><T style={{ color: colors.textSecondary }}>No hay enfrentamientos recientes guardados.</T></Card>;
  return (
    <Card>
      <Label>ÚLTIMOS ENFRENTAMIENTOS</Label>
      {list.map((m) => (
        <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T mono style={{ fontSize: 11, color: colors.textSecondary, width: 72 }}>
            {new Date(m.kickoff).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
          </T>
          <T numberOfLines={1} style={{ flex: 1, fontSize: 13 }}>{m.home_name} – {m.away_name}</T>
          <T mono style={{ fontSize: 13 }}>{m.home_goals}-{m.away_goals}</T>
          <T mono style={{ fontSize: 11, color: colors.textSecondary, width: 52, textAlign: 'right' }}>
            {m.corners !== undefined ? `${m.corners} c` : ''}
          </T>
        </View>
      ))}
      <T style={{ fontSize: 11, color: colors.textSecondary }}>c = córners totales del partido</T>
    </Card>
  );
}
