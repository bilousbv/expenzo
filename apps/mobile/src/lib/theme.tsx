import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveTheme, THEME_COOKIE, type Theme } from '@expenzo/ui';
import { useColorScheme } from 'nativewind';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeState>({ theme: 'dark', setTheme: () => {} });

/**
 * Holds the colour scheme and hands it to NativeWind.
 *
 * NativeWind is what actually applies it — the variables live under a `.dark`
 * selector and its colour scheme is what turns that on, exactly as a class on
 * `<html>` does for the web app.
 *
 * The stored value is read asynchronously, so the app starts on the dark
 * default and corrects itself if the person chose light. That way round because
 * dark is the default: starting light and correcting to dark would flash on
 * every launch for everybody who never touched the setting.
 *
 * The same key name as the web cookie, so the two are recognisably one setting
 * even though neither can read the other's storage.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { setColorScheme } = useColorScheme();
  const [theme, setStored] = useState<Theme>('dark');

  useEffect(() => {
    let active = true;

    void AsyncStorage.getItem(THEME_COOKIE).then((value) => {
      if (active) setStored(resolveTheme(value));
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setColorScheme(theme);
  }, [theme, setColorScheme]);

  function setTheme(next: Theme) {
    setStored(next);
    // Deliberately not awaited: the scheme has already changed on screen, and
    // a write that fails should not undo what the person just chose.
    void AsyncStorage.setItem(THEME_COOKIE, next);
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  return useContext(ThemeContext);
}
