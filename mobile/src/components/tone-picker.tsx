import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { api } from '@/lib/api';

export type ToneKey = 'gentle' | 'plain' | 'cheeky';
type Example = { title: string; body: string };
export type Tone = { key: ToneKey; label: string; blurb: string; examples: { request: Example; reminder: Example; share: string } };
type Catalog = { data: Tone[]; default: ToneKey };

// The words live on the server (one place for push, share text, request page
// and this preview). Loaded once per app run.
let cached: Promise<Catalog> | null = null;
export function loadTones(force = false) {
  if (!cached || force) cached = api<Catalog>('/v1/reminder_tones').catch((e) => { cached = null; throw e; });
  return cached;
}

/**
 * Gentle · Plain · Cheeky. `preview` shows what the chosen tone sounds like
 * ("reminder" for auto-nudges, "share" for the request text). Without a
 * `value`, it starts on your saved tone.
 */
export function TonePicker({ value, onChange, preview, label = 'How Gloslate asks' }: {
  value?: ToneKey; onChange: (t: ToneKey) => void; preview?: 'reminder' | 'share'; label?: string;
}) {
  const [tones, setTones] = useState<Tone[] | null>(null);
  const [picked, setPicked] = useState<ToneKey | undefined>(value);
  useEffect(() => {
    loadTones().then((c) => {
      setTones(c.data);
      if (!value) { setPicked(c.default); onChange(c.default); }
    }).catch(() => {});
    // Only on mount: the saved default seeds the choice once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!tones) return null; // Older server or offline: requests just use your saved tone.
  const current = tones.find((t) => t.key === (value ?? picked)) ?? tones[1];
  const ex = preview === 'reminder' ? `${current.examples.reminder.title}\n${current.examples.reminder.body}` : preview === 'share' ? current.examples.share : null;

  return (
    <View style={{ gap: 8 }}>
      <T v="label">{label}</T>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8 }}>
        {tones.map((t) => {
          const on = t.key === current.key;
          return (
            <Pressable key={t.key} accessibilityRole="radio" accessibilityLabel={`${t.label}. ${t.blurb}`} accessibilityState={{ checked: on }}
              onPress={() => { setPicked(t.key); onChange(t.key); }}
              style={{ flex: 1, minHeight: 44, borderRadius: HT.radius.tile, alignItems: 'center', justifyContent: 'center', paddingVertical: 6,
                borderWidth: on ? 1.5 : 1, borderColor: on ? HT.color.brand : HT.color.chipBorder, backgroundColor: on ? HT.color.brandTint : HT.color.surface }}>
              <T v="strong" style={{ fontSize: 13.5, color: on ? HT.color.brand : HT.color.ink }}>{t.label}</T>
            </Pressable>
          );
        })}
      </View>
      {ex ? (
        <View accessibilityLabel={`Example: ${ex}`} style={{ backgroundColor: HT.color.ground, borderRadius: HT.radius.tile, padding: 12, borderWidth: 1, borderColor: HT.color.hairline }}>
          <T v="small" style={{ color: HT.color.ink }}>{ex}</T>
        </View>
      ) : null}
    </View>
  );
}
