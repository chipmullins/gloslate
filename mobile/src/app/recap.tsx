import { useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FullScreenLoader } from '@/components/bunny-loader';
import { BackIcon, ShareIcon } from '@/components/icons';
import { Button, IconButton, NightSurface, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { api, ApiError } from '@/lib/api';
import { downloadAndShare } from '@/lib/files';
import { goBack } from '@/lib/nav';

type Recap = {
  year: number; first_name: string;
  places: { name: string; kind: string; count: number }[];
  people: string[]; people_count: number; things_split: number;
  top_category: { category: string; count: number } | null;
  busiest_month: { month: number; count: number } | null;
  payments_settled: number;
};
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function names(r: Recap) {
  const people = r.people.slice(0, 2);
  const groups = r.places.filter((p) => p.kind === 'group' && !r.people.includes(p.name)).map((p) => p.name);
  const parts = [r.first_name || 'You', ...people];
  if (groups[0]) return `${parts.join(', ')} and the ${groups[0]} crew`;
  if (r.people_count > people.length) return `${parts.join(', ')} and ${r.people_count - people.length} more`;
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
}

function Stat({ n, label, sub }: { n: number; label: string; sub?: string | null }) {
  return (
    <View style={{ gap: 2 }}>
      <T style={{ fontFamily: HT.font.monoBold, fontSize: 64, lineHeight: 70, letterSpacing: -2, color: HT.color.glow }}>{n}</T>
      <T style={{ fontFamily: HT.font.displayBold, fontSize: 22, lineHeight: 28, color: HT.color.onDarkText }}>{label}</T>
      {sub ? <T style={{ fontFamily: HT.font.medium, fontSize: 14.5, lineHeight: 20, color: HT.color.darkCardMuted }}>{sub}</T> : null}
    </View>
  );
}

/** Your year on the slate (canvas "Year recap"). Never shows who paid more or who owes. */
export default function YearRecap() {
  const params = useLocalSearchParams<{ year?: string }>();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(Number(params.year) || (new Date().getMonth() === 0 ? thisYear - 1 : thisYear));
  const [recap, setRecap] = useState<Recap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const { gutter } = useLayout();

  useEffect(() => {
    let live = true;
    api<{ data: Recap }>(`/v1/recap?year=${year}`)
      .then((r) => { if (live) { setRecap(r.data); setError(null); } })
      .catch((e) => { if (live) setError(e instanceof ApiError ? e.message : "Couldn't load your year."); });
    return () => { live = false; };
  }, [year]);

  const r = recap?.year === year ? recap : null;
  if (!r && !error) return <FullScreenLoader tone="night" />;

  return (
    <NightSurface style={{ flex: 1 }} fireflies>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View style={{ width: '100%', maxWidth: HT.maxWidth.form, alignSelf: 'center', paddingHorizontal: gutter, gap: 28 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 }}>
              <IconButton night label="Back" onPress={() => goBack('/you' as Href)}><BackIcon color={HT.color.onDarkText} /></IconButton>
              <View style={{ flex: 1 }} />
              {[thisYear - 1, thisYear].map((y) => (
                <Button key={y} title={String(y)} kind={y === year ? 'onDark' : 'glass'} style={{ minHeight: 40, paddingHorizontal: 14 }} onPress={() => setYear(y)} />
              ))}
            </View>
            {error ? <T style={{ color: HT.color.onDarkText }}>{error}</T> : null}
            {r ? (
              <>
                <View style={{ gap: 10, paddingTop: 12 }}>
                  <T style={{ fontFamily: HT.font.label, fontSize: 12, letterSpacing: 2.4, color: HT.color.darkCardMuted }}>GLOSLATE · {r.year}</T>
                  <T accessibilityRole="header" style={{ fontFamily: HT.font.displayExtra, fontSize: 40, lineHeight: 44, letterSpacing: -1, color: HT.color.onDarkText }}>Your year on the slate</T>
                  <T style={{ fontFamily: HT.font.medium, fontSize: 16, lineHeight: 22, color: HT.color.darkCardMuted }}>{names(r)}</T>
                </View>
                {r.things_split === 0 ? (
                  <T style={{ fontFamily: HT.font.medium, fontSize: 16, color: HT.color.onDarkText }}>Nothing split in {r.year} yet. Your recap fills in as you go.</T>
                ) : (
                  <View style={{ gap: 26 }}>
                    <Stat n={r.places.length} label={r.places.length === 1 ? 'place you shared' : 'places you shared'} sub={r.places.slice(0, 3).map((p) => p.name).join(', ')} />
                    <Stat n={r.things_split} label={r.things_split === 1 ? 'thing split' : 'things split'}
                      sub={r.top_category ? `${r.top_category.category[0].toUpperCase()}${r.top_category.category.slice(1)} came up ${r.top_category.count} times` : null} />
                    {r.payments_settled > 0 ? (
                      <Stat n={r.payments_settled} label={r.payments_settled === 1 ? 'payment settled' : 'payments settled'}
                        sub={r.busiest_month ? `Busiest month: ${MONTHS[r.busiest_month.month]}` : null} />
                    ) : null}
                  </View>
                )}
                {r.things_split > 0 ? (
                  <Button title="Share my year" kind="onDark" icon={<ShareIcon size={18} color={HT.color.onGlow} />} loading={sharing}
                    onPress={async () => {
                      setSharing(true);
                      try { await downloadAndShare(`/v1/recap/image.png?year=${r.year}`, `gloslate-${r.year}.png`, 'image/png'); } catch { setError("Couldn't make the image."); }
                      setSharing(false);
                    }} />
                ) : null}
                <T style={{ fontFamily: HT.font.medium, fontSize: 12.5, lineHeight: 17, color: HT.color.darkCardMuted, textAlign: 'center' }}>Just what you shared. Never who paid more.</T>
              </>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </NightSurface>
  );
}
