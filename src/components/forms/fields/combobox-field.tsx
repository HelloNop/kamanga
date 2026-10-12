'use client';

import * as React from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useFieldContext, useFieldInvalid, type BaseFieldProps } from '@/lib/form-context';

/**
 * Memasang isi popup satu frame setelah popup terbuka dan sudah berada di posisinya.
 * cmdk memanggil scrollIntoView pada baris pertama saat dipasang; bila popup belum diposisikan,
 * browser menggulir seluruh halaman ke atas ("melompat") saat kombo dibuka.
 */
function AfterPositioned({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  // Tinggi sementara agar posisi popup dihitung dengan ukuran mendekati akhir.
  return ready ? children : <div className='h-72' />;
}

/** Searchable select — Popover + Command per the shadcn combobox pattern. */
export function ComboboxField({
  label,
  description,
  required,
  options,
  placeholder = 'Pilih salah satu',
  searchPlaceholder = 'Cari...',
  emptyMessage = 'Tidak ada hasil.'
}: BaseFieldProps & {
  /** `description` tampil kecil di bawah nama (mis. induk wilayah) dan ikut dicari. */
  options: { value: string; label: string; description?: string; disabled?: boolean }[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
}) {
  const field = useFieldContext<string>();
  const isInvalid = useFieldInvalid();
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === field.state.value);
  const listboxId = `${field.name}-listbox`;

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name}>
        {label}
        {required && ' *'}
      </FieldLabel>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) field.handleBlur();
        }}
      >
        <PopoverTrigger
          render={
            // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- isi tombol datang dari PopoverTrigger; label lewat FieldLabel htmlFor
            <button
              type='button'
              id={field.name}
              role='combobox'
              aria-controls={listboxId}
              aria-expanded={open}
              aria-invalid={isInvalid}
              aria-describedby={isInvalid ? `${field.name}-error` : undefined}
              className='border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-transparent py-2 pr-2.5 pl-3.5 text-left text-sm transition-colors outline-none focus-visible:ring-3 aria-invalid:ring-3'
            />
          }
        >
          {selected ? (
            <span className='flex min-w-0 items-baseline gap-2'>
              <span className='max-w-full shrink-0 truncate'>{selected.label}</span>
              {selected.description && (
                <span className='text-muted-foreground min-w-0 truncate text-xs'>
                  {selected.description}
                </span>
              )}
            </span>
          ) : (
            <span className='text-muted-foreground truncate'>{placeholder}</span>
          )}
          <Icons.chevronsUpDown className='size-4 shrink-0 opacity-50' />
        </PopoverTrigger>
        <PopoverContent className='w-(--anchor-width) min-w-72 p-0'>
          <AfterPositioned>
            <Command>
              <CommandInput
                ref={(el) => el?.focus({ preventScroll: true })}
                placeholder={searchPlaceholder}
              />
              <CommandList id={listboxId}>
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <CommandGroup>
                  {options.map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.value}
                      disabled={opt.disabled}
                      keywords={[opt.label, opt.description ?? '']}
                      onSelect={(next) => {
                        field.handleChange(next);
                        setOpen(false);
                      }}
                    >
                      <Icons.check
                        className={cn(
                          'size-4 shrink-0',
                          field.state.value === opt.value ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className='min-w-0 flex-1'>
                        <span className='block truncate'>{opt.label}</span>
                        {opt.description && (
                          <span className='text-muted-foreground block truncate text-xs'>
                            {opt.description}
                          </span>
                        )}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </AfterPositioned>
        </PopoverContent>
      </Popover>
      {description && <FieldDescription>{description}</FieldDescription>}
      {isInvalid && <FieldError id={`${field.name}-error`} errors={field.state.meta.errors} />}
    </Field>
  );
}
