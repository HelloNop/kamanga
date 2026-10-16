import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { settingsKeys } from './queries';
import { saveSettings } from './service';
import type { SettingsFormValues } from './types';

export const saveSettingsMutation = mutationOptions({
  mutationFn: async (values: SettingsFormValues) => {
    const r = await saveSettings(values);
    if (!r.ok) throw new Error(r.message);
    return r;
  },
  onSuccess: () => getQueryClient().invalidateQueries({ queryKey: settingsKeys.all })
});
