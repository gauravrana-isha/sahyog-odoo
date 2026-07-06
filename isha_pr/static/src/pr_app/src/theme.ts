import { createTheme, type MantineColorsTuple } from '@mantine/core';

/**
 * Sahyog "Earthen Warmth" theme.
 *
 * Custom palettes (all 10-shade, index 0 lightest → 9 darkest):
 *   clay  — terracotta. Primary/brand color.
 *   sand  — warm neutral. Muted states, unavailability.
 *   sage  — earthy green. Success, programs.
 *   ochre — warm amber. Pending states, breaks, ratings.
 *   river — muted slate-teal. Informational, silence periods.
 *
 * The standard `gray`, `red`, `green` and `orange` names are overridden with
 * warm-tinted equivalents so any component that still uses them stays on
 * palette. Semantic entity/status mappings live in src/tokens.ts — pages
 * should reference those tokens, never palette names or hexes directly.
 */

const clay: MantineColorsTuple = [
  '#FAF0E9', '#F4DECF', '#EBC4AA', '#E1A681', '#D5885A',
  '#C56E3D', '#B0562E', '#944726', '#773A20', '#5C2E1A',
];

const sand: MantineColorsTuple = [
  '#FAF6EC', '#F0E9D9', '#E4D8BE', '#D3C3A0', '#BCAA83',
  '#A29069', '#877757', '#6B5F46', '#504736', '#383226',
];

const sage: MantineColorsTuple = [
  '#F1F4E9', '#E2E9D2', '#CBD7AF', '#B1C28C', '#99AF6F',
  '#859C5A', '#74884D', '#5F703F', '#4A5732', '#374125',
];

const ochre: MantineColorsTuple = [
  '#FBF3E2', '#F5E5C2', '#EDD198', '#E3B96B', '#D9A445',
  '#CB9130', '#B87F28', '#986921', '#79541C', '#5C4016',
];

const river: MantineColorsTuple = [
  '#EFF4F5', '#DDE8EA', '#C0D3D7', '#9FBBC2', '#82A5AE',
  '#6B929D', '#5A818C', '#4A6A74', '#3A545C', '#2C4046',
];

// Warm gray — replaces Mantine's cool default so dimmed text, borders and
// icons all sit in the same temperature.
const gray: MantineColorsTuple = [
  '#F8F5EF', '#EFEAE1', '#E2DBCE', '#CFC6B5', '#B4AA96',
  '#968C77', '#7A715E', '#5F5849', '#464135', '#302C24',
];

// Warm red for errors/destructive actions.
const red: MantineColorsTuple = [
  '#FBECEA', '#F5D6D2', '#ECB4AC', '#E18E81', '#D56A59',
  '#C74C38', '#B63A28', '#983022', '#7A281C', '#5D2016',
];

// Warm charcoal dark scheme (index 7 = body/surface background in dark mode).
const dark: MantineColorsTuple = [
  '#EFE8DC', '#D8D0C2', '#B5AC9C', '#8A8172', '#5F584A',
  '#453F34', '#332D24', '#262019', '#1C1712', '#12100C',
];

export const theme = createTheme({
  primaryColor: 'clay',
  primaryShade: { light: 6, dark: 4 },
  colors: {
    clay,
    sand,
    sage,
    ochre,
    river,
    gray,
    red,
    green: sage,
    orange: ochre,
    dark,
  },
  white: '#FDFAF3',
  black: '#2B2118',
  fontFamily:
    "'Karla Variable', Karla, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  headings: {
    fontFamily: "'Fraunces Variable', Fraunces, Georgia, serif",
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '2.125rem', lineHeight: '1.2' },
      h2: { fontSize: '1.75rem', lineHeight: '1.25' },
      h3: { fontSize: '1.375rem', lineHeight: '1.3' },
      h4: { fontSize: '1.125rem', lineHeight: '1.35' },
    },
  },
  defaultRadius: 'md',
  radius: { xs: '3px', sm: '6px', md: '10px', lg: '14px', xl: '20px' },
  shadows: {
    xs: '0 1px 2px rgba(56, 40, 28, 0.05), 0 1px 3px rgba(56, 40, 28, 0.07)',
    sm: '0 2px 4px rgba(56, 40, 28, 0.05), 0 2px 8px rgba(56, 40, 28, 0.08)',
    md: '0 2px 4px rgba(56, 40, 28, 0.05), 0 6px 16px rgba(56, 40, 28, 0.1)',
    lg: '0 4px 8px rgba(56, 40, 28, 0.06), 0 12px 28px rgba(56, 40, 28, 0.12)',
    xl: '0 8px 16px rgba(56, 40, 28, 0.07), 0 20px 44px rgba(56, 40, 28, 0.14)',
  },
  components: {
    Button: { defaultProps: { size: 'sm' } },
    TextInput: { defaultProps: { size: 'sm' } },
    Select: { defaultProps: { size: 'sm' } },
    Textarea: { defaultProps: { size: 'sm' } },
  },
});
