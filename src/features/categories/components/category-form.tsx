'use client';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useAppForm } from '@/lib/form';
import { cn } from '@/lib/utils';
import { GroupDialog } from './group-dialog';
import { createCategoryMutation, updateCategoryMutation } from '../api/mutations';
import { categoryGroupsOptions } from '../api/queries';
import type { CategoryDetail } from '../api/types';
import { doorOptionsQueryOptions } from '@/features/doors/api/queries';
import { hasOptions } from '@/features/listings/lib/format';
import {
  ATTRIBUTE_SUGGESTIONS,
  ATTRIBUTE_TYPE_OPTIONS,
  SCHEDULE_KIND_HINTS,
  SCHEDULE_KIND_LABELS,
  SCHEDULE_KINDS,
  attributeTypeLabel
} from '../constants';
import {
  categoryFormSchema,
  emptyCategoryForm,
  type CategoryFormValues
} from '../schemas/category';

function Section({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className='bg-card rounded-xl p-5 shadow-sm'>
      <h3 className='text-[1.0625rem] font-semibold'>{title}</h3>
      {description && <p className='text-muted-foreground mt-1 text-[0.8125rem]'>{description}</p>}
      <div className='mt-4 space-y-5'>{children}</div>
    </section>
  );
}

const Label = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
  <div className='mb-2 flex flex-wrap items-baseline gap-x-2'>
    <span className='text-[0.8125rem] font-semibold whitespace-nowrap'>{children}</span>
    {hint && <span className='text-muted-foreground text-xs'>{hint}</span>}
  </div>
);

/** Pilihan kelompok berbentuk pil. Kelompok baru dibuat lewat modal, bukan diketik di sini. */
function GroupPicker({
  groups,
  isOn,
  isDisabled,
  onToggle,
  onNew,
  invalid
}: {
  groups: { id: number; name: string }[];
  isOn: (id: number) => boolean;
  isDisabled?: (id: number) => boolean;
  onToggle: (id: number) => void;
  onNew: () => void;
  invalid?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2',
        invalid && 'ring-destructive/50 rounded-lg p-1.5 ring-1'
      )}
    >
      {groups.length === 0 && (
        <span className='text-muted-foreground text-sm'>Belum ada kelompok.</span>
      )}
      {groups.map((g) => {
        const on = isOn(g.id);
        return (
          <button
            key={g.id}
            type='button'
            aria-pressed={on}
            disabled={isDisabled?.(g.id)}
            onClick={() => onToggle(g.id)}
            className={cn(
              'h-9 rounded-full border px-4 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              on
                ? 'border-primary bg-primary text-primary-foreground font-medium'
                : 'hover:bg-muted'
            )}
          >
            {g.name}
          </button>
        );
      })}
      <button
        type='button'
        onClick={onNew}
        className='text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed px-3.5 text-sm transition-colors'
      >
        <Icons.add className='size-3.5' /> Kelompok baru
      </button>
    </div>
  );
}

const tidy = (v: string) => v.trim().replace(/\s+/g, ' ');

/** Daftar pilihan untuk isian bertipe Pilihan atau Pilihan ganda. Enter atau koma menambah. */
function OptionsEditor({
  value,
  onChange,
  invalid
}: {
  value: string[];
  onChange: (v: string[]) => void;
  invalid?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const next = [...value];
    for (const item of raw
      .split(/[,;\n]/)
      .map(tidy)
      .filter(Boolean))
      if (!next.some((x) => x.toLowerCase() === item.toLowerCase())) next.push(item);
    onChange(next);
    setDraft('');
  };
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed p-2',
        invalid && 'border-destructive/60'
      )}
    >
      {value.map((o) => (
        <span
          key={o}
          className='bg-muted inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs'
        >
          {o}
          <button
            type='button'
            aria-label={`Hapus pilihan ${o}`}
            onClick={() => onChange(value.filter((x) => x !== o))}
            className='hover:bg-background rounded-full p-0.5'
          >
            <Icons.close className='size-3' />
          </button>
        </span>
      ))}
      <input
        value={draft}
        maxLength={40}
        placeholder={value.length ? 'Tambah pilihan' : 'Ketik pilihan lalu Enter, mis. AC'}
        aria-label='Tambah pilihan'
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault(); // jangan mengirim form
            if (draft.trim()) add(draft);
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
        className='min-w-32 flex-1 bg-transparent px-1 text-sm outline-none'
      />
    </div>
  );
}

type AttrDraft = CategoryFormValues['attributes'][number];

const emptyDraft: AttrDraft = { key: '', label: '', type: 'text', options: [] };

function validateDraft(d: AttrDraft, others: AttrDraft[]) {
  const errors: { label?: string; options?: string } = {};
  const label = tidy(d.label);
  if (!label) errors.label = 'Nama isian wajib diisi';
  else if (others.some((o) => o.label.trim().toLowerCase() === label.toLowerCase()))
    errors.label = 'Nama isian sudah ada';
  if (hasOptions(d.type) && new Set(d.options.map((o) => o.toLowerCase())).size < 2)
    errors.options = 'Isi minimal 2 pilihan';
  return errors;
}

/** Penyunting satu isian khusus. Tombol simpan ada di sini, bukan di tombol simpan kategori. */
function AttributeEditor({
  initial,
  others,
  onSave,
  onCancel
}: {
  initial: AttrDraft;
  others: AttrDraft[];
  onSave: (a: AttrDraft) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState(initial);
  const [errors, setErrors] = useState<{ label?: string; options?: string }>({});
  const isNew = !initial.label;
  const typeHint = ATTRIBUTE_TYPE_OPTIONS.find((o) => o.value === d.type)?.hint;

  const save = () => {
    const e = validateDraft(d, others);
    setErrors(e);
    if (e.label || e.options) return;
    onSave({ ...d, label: tidy(d.label) });
  };

  return (
    <div
      role='group'
      aria-label={isNew ? 'Isian baru' : `Ubah isian ${initial.label}`}
      className='bg-muted/50 space-y-4 rounded-xl border p-4'
    >
      <div>
        <Label>Nama isian</Label>
        <Input
          autoFocus
          value={d.label}
          maxLength={60}
          placeholder='Mis. Kapasitas (orang)'
          aria-label='Nama isian'
          aria-invalid={!!errors.label}
          onChange={(e) => {
            setD({ ...d, label: e.target.value });
            setErrors({ ...errors, label: undefined });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault(); // jangan mengirim form kategori
              save();
            }
          }}
        />
        {errors.label && (
          <p role='alert' className='text-destructive mt-1.5 text-xs'>
            {errors.label}
          </p>
        )}
      </div>

      <div>
        <Label hint={typeHint}>Jenis jawaban</Label>
        <div role='group' aria-label='Jenis jawaban' className='flex flex-wrap gap-2'>
          {ATTRIBUTE_TYPE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type='button'
              aria-pressed={d.type === o.value}
              onClick={() => {
                setD({ ...d, type: o.value, options: hasOptions(o.value) ? d.options : [] });
                setErrors({ ...errors, options: undefined });
              }}
              className={cn(
                'h-9 rounded-full border-[1.5px] px-[15px] text-sm font-medium transition-colors',
                d.type === o.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card hover:bg-muted'
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {hasOptions(d.type) && (
        <div>
          <Label hint='ketik lalu Enter'>Pilihan jawaban</Label>
          <OptionsEditor
            value={d.options}
            invalid={!!errors.options}
            onChange={(options) => {
              setD({ ...d, options });
              setErrors({ ...errors, options: undefined });
            }}
          />
          {errors.options && (
            <p role='alert' className='text-destructive mt-1.5 text-xs'>
              {errors.options}
            </p>
          )}
        </div>
      )}

      <div className='flex justify-end gap-2'>
        <Button type='button' variant='ghost' size='sm' onClick={onCancel}>
          Batal
        </Button>
        <Button type='button' size='sm' onClick={save}>
          {isNew ? 'Simpan isian' : 'Simpan perubahan'}
        </Button>
      </div>
    </div>
  );
}

/** Daftar isian khusus: baris ringkas, penyunting muncul di tempat saat menambah atau mengubah. */
function AttributesField({
  value,
  onChange,
  onEditingChange,
  error
}: {
  value: AttrDraft[];
  onChange: (v: AttrDraft[]) => void;
  onEditingChange: (editing: boolean) => void;
  error?: React.ReactNode;
}) {
  // index yang sedang diubah, 'new' untuk isian baru, null bila tidak ada penyunting terbuka
  const [editing, setEditingState] = useState<number | 'new' | null>(null);
  const setEditing = (v: number | 'new' | null) => {
    setEditingState(v);
    onEditingChange(v !== null);
  };
  const used = new Set(value.map((a) => a.label.trim().toLowerCase()));
  const suggestions = ATTRIBUTE_SUGGESTIONS.filter((s) => !used.has(s.label.toLowerCase()));
  const full = value.length >= 15;
  const busy = editing !== null;

  return (
    <div className='space-y-2.5'>
      {value.length === 0 && editing !== 'new' && (
        <div className='text-muted-foreground rounded-xl border border-dashed px-4 py-5 text-center text-sm'>
          Belum ada isian khusus. Listing hanya memakai isian umum.
        </div>
      )}

      {value.map((a, i) =>
        editing === i ? (
          <AttributeEditor
            key={i}
            initial={a}
            others={value.filter((_, j) => j !== i)}
            onCancel={() => setEditing(null)}
            onSave={(next) => {
              onChange(value.map((x, j) => (j === i ? { ...next, key: x.key } : x)));
              setEditing(null);
            }}
          />
        ) : (
          <div key={i} className='bg-card flex items-center gap-3 rounded-xl border px-3.5 py-2.5'>
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-medium'>{a.label}</p>
              <p className='text-muted-foreground truncate text-xs'>
                {attributeTypeLabel(a.type)}
                {hasOptions(a.type) && a.options.length > 0 && ` · ${a.options.join(', ')}`}
              </p>
            </div>
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              disabled={busy}
              aria-label={`Ubah isian ${a.label}`}
              onClick={() => setEditing(i)}
            >
              <Icons.edit className='size-4' />
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              disabled={busy}
              aria-label={`Hapus isian ${a.label}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <Icons.trash className='size-4' />
            </Button>
          </div>
        )
      )}

      {editing === 'new' && (
        <AttributeEditor
          initial={emptyDraft}
          others={value}
          onCancel={() => setEditing(null)}
          onSave={(next) => {
            onChange([...value, next]);
            setEditing(null);
          }}
        />
      )}

      {error}

      {!busy && (
        <div className='flex flex-wrap items-center gap-2 pt-1'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={full}
            onClick={() => setEditing('new')}
          >
            <Icons.add className='mr-1.5 size-4' /> Tambah isian
          </Button>
          {full && <span className='text-muted-foreground text-xs'>Maksimal 15 isian.</span>}
          {!full && suggestions.length > 0 && (
            <span className='text-muted-foreground ml-1 text-xs'>Saran:</span>
          )}
          {!full &&
            suggestions.map((s) => (
              <button
                key={s.label}
                type='button'
                onClick={() =>
                  onChange([
                    ...value,
                    { key: '', label: s.label, type: s.type, options: s.options ?? [] }
                  ])
                }
                className='text-muted-foreground hover:text-foreground hover:bg-muted rounded-full border border-dashed px-2.5 py-0.5 text-xs transition-colors'
              >
                + {s.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

/** Satu baris saklar: judul dan keterangan di kiri, saklar di kanan. */
function SwitchRow({
  title,
  description,
  checked,
  onChange
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className='flex items-center justify-between gap-6 py-3.5 first:pt-0 last:pb-0'>
      <div className='min-w-0'>
        <p className='text-sm font-medium'>{title}</p>
        <p className='text-muted-foreground text-xs'>{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}

/** Ringkasan langsung: menunjukkan akibat pengaturan form sebelum disimpan. */
function Preview({
  v,
  nameOf,
  doorName
}: {
  v: CategoryFormValues;
  nameOf: (id: number) => string;
  doorName: string | null;
}) {
  const groups = [v.groupId, ...v.extraGroupIds].map(nameOf).filter(Boolean);
  const attrs = v.attributes.filter((a) => a.label.trim());
  const rules = [
    doorName ? `Tampil di pintu ${doorName}` : 'Tanpa pintu, hanya lewat chat',
    `Jadwal: ${SCHEDULE_KIND_LABELS[v.scheduleKind]}`,
    v.responseMinutes
      ? `Penyedia menjawab dalam ${v.responseMinutes} menit`
      : 'Batas waktu menjawab: bawaan Pengaturan',
    v.needsLocation ? 'Menanyakan lokasi ke warga' : 'Tidak menanyakan lokasi',
    v.infoOnly ? 'Hanya informasi, tanpa tombol kontak' : 'Menampilkan tombol kontak',
    v.isActive ? 'Muncul sebagai pilihan listing' : 'Disembunyikan dari pilihan'
  ];
  return (
    <div className='bg-card rounded-xl p-5 shadow-sm'>
      <h3 className='text-[1.0625rem] font-semibold'>Pratinjau</h3>
      <div className='mt-4 space-y-4 text-sm'>
        <div>
          <p className='text-muted-foreground mb-1 text-xs'>Kategori</p>
          <p className='font-medium'>
            {v.name.trim() || <span className='text-muted-foreground'>Nama kategori</span>}
          </p>
          {v.aliases.some((x) => x.trim()) && (
            <p className='text-muted-foreground mt-1.5 text-xs'>
              Juga dikenali: {v.aliases.filter((x) => x.trim()).join(', ')}
            </p>
          )}
          <div className='mt-1.5 flex flex-wrap gap-1'>
            {groups.length ? (
              groups.map((g, i) => (
                <Badge key={g} variant={i === 0 ? 'outline' : 'secondary'}>
                  {g}
                </Badge>
              ))
            ) : (
              <span className='text-muted-foreground text-xs'>Kelompok belum dipilih</span>
            )}
          </div>
        </div>
        <div>
          <p className='text-muted-foreground mb-1 text-xs'>Perilaku</p>
          <ul className='space-y-1'>
            {rules.map((r) => (
              <li key={r} className='flex gap-2'>
                <span className='text-muted-foreground'>•</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className='text-muted-foreground mb-1.5 text-xs'>Tambahan di formulir listing</p>
          {attrs.length ? (
            <ul className='space-y-1.5'>
              {attrs.map((a, i) => (
                <li
                  key={i}
                  className='bg-muted/40 flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs'
                >
                  <span className='truncate'>{a.label}</span>
                  <span className='text-muted-foreground ml-2 shrink-0'>
                    {attributeTypeLabel(a.type)}
                    {hasOptions(a.type) && ` · ${a.options.length}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className='text-muted-foreground text-xs'>Tidak ada, hanya isian umum.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CategoryForm({
  detail,
  pageTitle
}: {
  detail?: CategoryDetail;
  pageTitle: string;
}) {
  const router = useRouter();
  const isEdit = !!detail;
  const create = useMutation(createCategoryMutation);
  const update = useMutation(updateCategoryMutation);
  const { data: groups } = useSuspenseQuery(categoryGroupsOptions());
  const { data: doors } = useSuspenseQuery(doorOptionsQueryOptions());
  const [showExtra, setShowExtra] = useState((detail?.values.extraGroupIds.length ?? 0) > 0);
  // Modal "Tambah kelompok" dibuka dari pilihan utama atau tambahan; hasilnya langsung dipilih.
  const [dialogFor, setDialogFor] = useState<'main' | 'extra' | null>(null);
  // Penyunting isian khusus yang masih terbuka: isinya belum masuk daftar sampai disimpan.
  const [attrEditing, setAttrEditing] = useState(false);

  const form = useAppForm({
    defaultValues: detail?.values ?? emptyCategoryForm,
    validators: { onSubmit: categoryFormSchema },
    onSubmit: async ({ value }) => {
      try {
        if (detail) await update.mutateAsync({ id: detail.id, values: value });
        else await create.mutateAsync(value);
        toast.success(isEdit ? 'Kategori disimpan' : 'Kategori dibuat');
        router.push('/dashboard/categories');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal menyimpan kategori');
      }
    }
  });

  const nameOf = (id: number) => groups.find((g) => g.id === id)?.name ?? '';

  return (
    <form
      className='w-full max-w-6xl'
      onSubmit={(e) => {
        e.preventDefault();
        if (attrEditing) {
          toast.error('Simpan atau batalkan isian khusus yang sedang dibuka dulu.');
          return;
        }
        form.handleSubmit();
      }}
    >
      <div className='mb-[22px]'>
        <h2 className='text-[1.75rem] leading-[1.15] font-bold tracking-tight md:text-4xl'>
          {pageTitle}
        </h2>
        <p className='text-muted-foreground mt-1.5 text-[0.9375rem]'>
          {detail
            ? `Dipakai oleh ${detail.listingCount} listing.`
            : 'Kategori adalah rak tempat listing dikelompokkan, mis. Servis AC atau Katering.'}
        </p>
      </div>

      <div className='grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]'>
        <div className='min-w-0 space-y-5'>
          <Section title='Identitas'>
            <form.AppField
              name='name'
              children={(f) => (
                <f.TextField
                  label='Nama kategori'
                  required
                  placeholder='Mis. Fotografer Pernikahan'
                  autoFocus={!isEdit}
                  maxLength={80}
                />
              )}
            />

            <form.AppField
              name='aliases'
              mode='array'
              children={(f) => (
                <f.TagsField
                  label='Sebutan lain'
                  placeholder='Ketik lalu Enter. Mis. onda'
                  description='Kata lain yang dipakai warga untuk kategori ini, termasuk bahasa Minang.'
                />
              )}
            />

            <form.Field
              name='groupId'
              children={(field) => {
                const invalid = field.state.meta.errors.length > 0;
                return (
                  <div>
                    <Label hint='rak besar tempat kategori ini berada'>Kelompok *</Label>
                    <GroupPicker
                      groups={groups}
                      invalid={invalid}
                      isOn={(id) => id === field.state.value}
                      onToggle={(id) => {
                        field.handleChange(id);
                        // kelompok utama tidak perlu diulang di kelompok tambahan
                        const extras = form.getFieldValue('extraGroupIds');
                        if (extras.includes(id))
                          form.setFieldValue(
                            'extraGroupIds',
                            extras.filter((x) => x !== id)
                          );
                      }}
                      onNew={() => setDialogFor('main')}
                    />
                    {invalid && (
                      <div className='mt-2'>
                        <FieldError errors={field.state.meta.errors} />
                      </div>
                    )}
                  </div>
                );
              }}
            />

            <form.Subscribe selector={(s) => s.values.groupId}>
              {(main) =>
                showExtra ? (
                  <form.Field
                    name='extraGroupIds'
                    mode='array'
                    children={(field) => (
                      <div>
                        <Label hint='mis. Fotografer: Acara, dan juga Kreatif & Digital'>
                          Juga masuk kelompok
                        </Label>
                        <GroupPicker
                          groups={groups}
                          isOn={(id) => field.state.value.includes(id)}
                          isDisabled={(id) => id === main}
                          onToggle={(id) =>
                            field.handleChange(
                              field.state.value.includes(id)
                                ? field.state.value.filter((x) => x !== id)
                                : [...field.state.value, id]
                            )
                          }
                          onNew={() => setDialogFor('extra')}
                        />
                      </div>
                    )}
                  />
                ) : (
                  <button
                    type='button'
                    onClick={() => setShowExtra(true)}
                    className='text-muted-foreground hover:text-foreground -mt-2 w-fit text-xs underline-offset-4 hover:underline'
                  >
                    + Masuk juga ke kelompok lain
                  </button>
                )
              }
            </form.Subscribe>

            <form.AppField
              name='description'
              children={(f) => (
                <f.TextareaField
                  label='Catatan untuk tim (opsional)'
                  rows={2}
                  maxLength={500}
                  placeholder='Tidak tampil ke warga'
                />
              )}
            />
          </Section>

          <Section
            title='Pintu dan pesanan'
            description='Pintu tempat kategori ini tampil di beranda, dan cara warga memesannya.'
          >
            <form.AppField
              name='doorId'
              children={(f) => (
                <f.SelectField
                  label='Pintu utama'
                  placeholder='Pilih pintu'
                  description='Satu kategori hanya punya satu pintu utama.'
                  options={[
                    { value: '', label: '(tanpa pintu, hanya lewat chat)' },
                    ...doors.map((d) => ({
                      value: String(d.id),
                      label:
                        d.status === 'active'
                          ? d.name
                          : `${d.name} (${d.status === 'soon' ? 'segera' : 'tersembunyi'})`
                    }))
                  ]}
                />
              )}
            />
            <form.Field
              name='scheduleKind'
              children={(field) => (
                <div>
                  <Label>Jenis jadwal</Label>
                  <div
                    role='radiogroup'
                    aria-label='Jenis jadwal'
                    className='grid gap-2 sm:grid-cols-2'
                  >
                    {SCHEDULE_KINDS.map((k) => {
                      const on = field.state.value === k;
                      return (
                        <button
                          key={k}
                          type='button'
                          role='radio'
                          aria-checked={on}
                          onClick={() => field.handleChange(k)}
                          className={cn(
                            'rounded-xl border-[1.5px] p-3 text-left transition-colors',
                            on ? 'border-primary bg-primary/5' : 'bg-card hover:bg-muted/60'
                          )}
                        >
                          <span className='block text-sm font-semibold'>
                            {SCHEDULE_KIND_LABELS[k]}
                          </span>
                          <span className='text-muted-foreground mt-0.5 block text-xs leading-snug'>
                            {SCHEDULE_KIND_HINTS[k]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            />
            <form.AppField
              name='responseMinutes'
              children={(f) => (
                <f.TextField
                  label='Batas waktu menjawab (menit)'
                  type='number'
                  min={5}
                  max={1440}
                  placeholder='bawaan'
                  description='Lewat batas ini pesanan kedaluwarsa dan warga ditawari tempat lain. Kosongkan untuk memakai bawaan di Pengaturan.'
                />
              )}
            />
          </Section>

          <Section
            title='Perilaku di chatbot'
            description='Mengatur apa yang dilakukan Kamanga untuk kategori ini.'
          >
            <div className='divide-y'>
              <form.Field
                name='needsLocation'
                children={(f) => (
                  <SwitchRow
                    title='Tanyakan lokasi ke warga'
                    description='Matikan untuk usaha yang bisa dikerjakan jarak jauh, mis. desain logo.'
                    checked={f.state.value}
                    onChange={f.handleChange}
                  />
                )}
              />
              <form.Field
                name='infoOnly'
                children={(f) => (
                  <SwitchRow
                    title='Hanya informasi, tanpa tombol kontak'
                    description='Untuk objek wisata umum yang tidak punya pengelola.'
                    checked={f.state.value}
                    onChange={f.handleChange}
                  />
                )}
              />
              <form.Field
                name='isActive'
                children={(f) => (
                  <SwitchRow
                    title='Aktif'
                    description='Kategori nonaktif tidak muncul sebagai pilihan di formulir listing.'
                    checked={f.state.value}
                    onChange={f.handleChange}
                  />
                )}
              />
            </div>
          </Section>

          <Section
            title='Isian khusus listing'
            description='Pertanyaan tambahan untuk setiap listing di kategori ini, di luar isian umum (nama, lokasi, kontak, harga).'
          >
            <form.Field
              name='attributes'
              mode='array'
              children={(field) => (
                <AttributesField
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v)}
                  onEditingChange={setAttrEditing}
                  error={
                    field.state.meta.errors.length > 0 && (
                      <FieldError errors={field.state.meta.errors} />
                    )
                  }
                />
              )}
            />
          </Section>

          <details className='bg-card rounded-xl p-5 text-sm shadow-sm'>
            <summary className='cursor-pointer font-medium select-none'>
              Pengaturan lanjutan
            </summary>
            <div className='mt-4 grid gap-4 sm:grid-cols-2'>
              <form.AppField
                name='slug'
                children={(f) => (
                  <f.TextField
                    label='Slug (kode unik)'
                    description='Kosongkan agar dibuat otomatis dari nama.'
                    placeholder='fotografer-pernikahan'
                  />
                )}
              />
              <form.AppField
                name='sortOrder'
                children={(f) => (
                  <f.TextField
                    label='Urutan tampil'
                    type='number'
                    description='Angka kecil tampil lebih dulu.'
                  />
                )}
              />
            </div>
          </details>
        </div>

        <aside className='space-y-4 lg:sticky lg:top-4'>
          <form.Subscribe selector={(s) => s.values}>
            {(v) => (
              <Preview
                v={v}
                nameOf={nameOf}
                doorName={doors.find((d) => String(d.id) === v.doorId)?.name ?? null}
              />
            )}
          </form.Subscribe>
          <div className='flex flex-col gap-2'>
            <form.AppForm>
              <form.SubmitButton className='w-full'>
                {isEdit ? 'Simpan perubahan' : 'Buat kategori'}
              </form.SubmitButton>
            </form.AppForm>
            <Link
              href='/dashboard/categories'
              className={buttonVariants({ variant: 'ghost', className: 'w-full' })}
            >
              Batal
            </Link>
          </div>
        </aside>
      </div>

      <GroupDialog
        open={dialogFor !== null}
        onOpenChange={(o) => !o && setDialogFor(null)}
        onCreated={(g) => {
          if (dialogFor === 'extra') {
            const cur = form.getFieldValue('extraGroupIds');
            form.setFieldValue('extraGroupIds', [...cur, g.id]);
          } else {
            form.setFieldValue('groupId', g.id);
          }
        }}
      />
    </form>
  );
}
