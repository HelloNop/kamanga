import { Plus_Jakarta_Sans } from 'next/font/google';

// Satu-satunya huruf panel. Variabelnya dipakai tema di src/styles/themes/kamanga.css.
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta'
});

export const fontVariables = plusJakarta.variable;
