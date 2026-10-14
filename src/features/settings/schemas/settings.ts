import * as z from 'zod';
import type { WaTemplate } from '@/lib/engines/contracts';
import { EDITABLE_TEMPLATES, templateProblem } from '../lib/templates';

export const settingsFormSchema = z
  .object({
    defaultResponseMinutes: z
      .number({ error: 'Wajib diisi' })
      .int('Bilangan bulat')
      .min(5, 'Minimal 5 menit')
      .max(1440, 'Maksimal 1440 menit (24 jam)'),
    reminderMinutesBefore: z
      .number({ error: 'Wajib diisi' })
      .int('Bilangan bulat')
      .min(15, 'Minimal 15 menit')
      .max(2880, 'Maksimal 2880 menit (2 hari)'),
    // Teks pengganti per template; kosong = teks bawaan.
    waTemplates: z.record(z.string(), z.string().max(1000, 'Maksimal 1000 karakter'))
  })
  .superRefine((v, ctx) => {
    for (const [t, text] of Object.entries(v.waTemplates)) {
      if (!(EDITABLE_TEMPLATES as string[]).includes(t)) {
        ctx.addIssue({
          code: 'custom',
          path: ['waTemplates', t],
          message: 'Template tidak dikenal'
        });
        continue;
      }
      const problem = templateProblem(t as WaTemplate, text);
      if (problem) ctx.addIssue({ code: 'custom', path: ['waTemplates', t], message: problem });
    }
  });

export type SettingsFormValues = z.infer<typeof settingsFormSchema>;
