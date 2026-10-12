import * as z from 'zod';
import { norm } from '@/lib/directory/norm';

export const glossaryFormSchema = z
  .object({
    term: z.string().trim().min(2, 'Kata minimal 2 karakter').max(60, 'Maksimal 60 karakter'),
    meaning: z.string().trim().min(2, 'Arti minimal 2 karakter').max(200, 'Maksimal 200 karakter'),
    notes: z.string().max(300, 'Maksimal 300 karakter'),
    isChecked: z.boolean()
  })
  .superRefine((v, ctx) => {
    if (norm(v.term).length < 2)
      ctx.addIssue({
        code: 'custom',
        path: ['term'],
        message: 'Kata harus berisi huruf atau angka'
      });
  });

export type GlossaryFormValues = z.infer<typeof glossaryFormSchema>;

export const emptyGlossaryForm: GlossaryFormValues = {
  term: '',
  meaning: '',
  notes: '',
  isChecked: true
};
