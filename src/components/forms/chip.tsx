import { cn } from '@/lib/utils';

/** Pil pilihan (dipilih/tidak). Dipakai untuk kategori, area layanan, tingkat lokasi, dll. */
export function Chip({
  on,
  disabled,
  onClick,
  children
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type='button'
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'h-9 rounded-full border-[1.5px] px-[15px] text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'
      )}
    >
      {children}
    </button>
  );
}
