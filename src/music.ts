import type { ThemeId } from './audio';
import placeholder from '../music/placeholder.song?raw';

/** On with `?toneweft` in the URL or VITE_TONEWEFT=1 at build time. Off by default. */
export const USE_TONEWEFT: boolean =
  import.meta.env.VITE_TONEWEFT === '1' || new URLSearchParams(location.search).has('toneweft');

/** Song text for each theme. Replace a theme's entry when its real song lands. */
export const THEME_SONGS: Record<ThemeId, string> = {
  menu: placeholder,
  map: placeholder,
  ashen: placeholder,
  whisper: placeholder,
  frost: placeholder,
  sanctum: placeholder,
  throne: placeholder,
};
