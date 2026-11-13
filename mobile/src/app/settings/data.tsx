import { DownloadIcon } from '@/components/icons';
import { Section, SettingsPage, useMySettings } from '@/components/settings';
import { Button, T } from '@/components/ui';
import { downloadAndShare } from '@/lib/files';

export default function DataSettings() {
  const { homeId, error, setError } = useMySettings();
  const year = new Date().getFullYear();
  return (
    <SettingsPage title="Your data" error={error}>
      <Section title="Export">
        {homeId ? <Button title={`This year at home (${year} CSV)`} kind="secondary" icon={<DownloadIcon size={18} />}
          onPress={() => downloadAndShare(`/v1/households/${homeId}/export?year=${year}`, `Gloslate-${year}.csv`, 'text/csv').catch(() => setError("Couldn't export."))} /> : null}
        <Button title="Everything (JSON)" kind="secondary" icon={<DownloadIcon size={18} />}
          onPress={() => downloadAndShare('/v1/me/export', 'gloslate-my-data.json', 'application/json').catch(() => setError("Couldn't export."))} />
        <T v="small">The CSV opens in Numbers, Excel or Google Sheets. The JSON has everything Gloslate keeps about you.</T>
      </Section>
    </SettingsPage>
  );
}
