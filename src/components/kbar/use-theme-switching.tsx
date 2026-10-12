import { useRegisterActions } from 'kbar';
import { useTheme } from 'next-themes';

const useThemeSwitching = () => {
  const { theme, setTheme } = useTheme();

  const themeActions = [
    {
      id: 'toggleDarkLight',
      name: 'Ganti Mode Gelap/Terang',
      shortcut: ['d', 'd'],
      section: 'Tema',
      perform: () => setTheme(theme === 'light' ? 'dark' : 'light')
    },
    {
      id: 'setLightTheme',
      name: 'Mode Terang',
      section: 'Tema',
      perform: () => setTheme('light')
    },
    {
      id: 'setDarkTheme',
      name: 'Mode Gelap',
      section: 'Tema',
      perform: () => setTheme('dark')
    }
  ];

  useRegisterActions(themeActions, [theme]);
};

export default useThemeSwitching;
