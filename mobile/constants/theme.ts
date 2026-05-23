/**
 * KOLANA design tokens — HackHCC navy + cyan accent.
 *
 * Sourced from the Larpus v2 design handoff (Variant A — soft glass).
 * - bg: deep navy `#0B1B2F` with cooler raised surfaces.
 * - accent: cyan `#5BD9E5` (primary CTA, active tab, positive/confirmed).
 * - alert: magenta `#FF4FB7` (errors, "you owe", destructive).
 * - support / yellow: `#F2EB1F` available for HackHCC promo accents.
 * - radii: big (cards 22-24, pills 999) to match Robinhood-minimal vibe.
 * - fonts: Onest for UI/display, Geist Mono for telemetry.
 *
 * Keys kept for backwards-compat with screens that still reference the
 * old Material-style names (primary, surfaceContainer, etc.) — they now
 * point at the corresponding navy/cyan tokens.
 */

const NAVY = {
  base: '#0B1B2F',
  surface: '#102239',
  raised: '#16314D',
  deep: '#061327',
};

const ACCENT_CYAN = '#5BD9E5';
const ACCENT_CYAN_DIM = '#3a9fab';
const ACCENT_CYAN_SOFT = 'rgba(91,217,229,0.12)';
const ACCENT_CYAN_GLOW = 'rgba(91,217,229,0.35)';

const ALERT_MAGENTA = '#FF4FB7';
const SUPPORT_YELLOW = '#F2EB1F';

const TEXT = '#E6F0FF';
const TEXT_DIM = '#7E8EA3';
const TEXT_FAINT = '#4A586E';

const BORDER_SOFT = 'rgba(120,180,220,0.14)';
const BORDER_HARD = 'rgba(180,210,240,0.18)';

export const theme = {
  colors: {
    // ── New semantic tokens (preferred going forward) ───────────────
    bg: NAVY.base,
    bgSurface: NAVY.surface,
    bgRaised: NAVY.raised,
    bgDeep: NAVY.deep,

    text: TEXT,
    textDim: TEXT_DIM,
    textFaint: TEXT_FAINT,

    accent: ACCENT_CYAN,
    accentDim: ACCENT_CYAN_DIM,
    accentSoft: ACCENT_CYAN_SOFT,
    accentGlow: ACCENT_CYAN_GLOW,

    success: ACCENT_CYAN,        // cyan = positive / confirmed / up
    alert: ALERT_MAGENTA,        // magenta = error / owe / destructive
    support: SUPPORT_YELLOW,     // yellow = HackHCC promo highlight
    warning: '#FFB454',

    border: BORDER_SOFT,
    borderHard: BORDER_HARD,

    cardBg: 'rgba(14,22,36,0.55)',          // translucent over BlurView
    cardSolid: NAVY.surface,                // fallback when BlurView absent
    rowBg: 'rgba(255,255,255,0.02)',
    fieldBg: 'rgba(255,255,255,0.04)',
    fieldBgSolid: NAVY.deep,

    onAccent: '#06080F',                    // text on cyan buttons
    onAlert: '#06080F',

    // ── Legacy Material-style aliases (back-compat) ─────────────────
    background: NAVY.base,
    surface: NAVY.surface,
    surfaceContainer: NAVY.raised,
    surfaceContainerLow: NAVY.surface,
    surfaceContainerLowest: NAVY.deep,
    surfaceContainerHigh: NAVY.raised,
    surfaceVariant: NAVY.raised,
    primary: TEXT,
    primaryContainer: NAVY.deep,
    onPrimaryContainer: TEXT_FAINT,
    onBackground: TEXT,
    onSurface: TEXT,
    onSurfaceVariant: TEXT_DIM,
    secondary: TEXT,
    onSecondaryContainer: TEXT_DIM,
    tertiary: ACCENT_CYAN,
    tertiaryFixed: ACCENT_CYAN,
    onTertiary: '#06080F',
    onTertiaryContainer: ACCENT_CYAN,
    error: ALERT_MAGENTA,
    outline: TEXT_DIM,
    outlineVariant: BORDER_SOFT,
    hardBorder: BORDER_HARD,
    panelBg: NAVY.surface,
    black: NAVY.deep,
  },
  spacing: {
    marginMobile: 24,
    marginDesktop: 40,
    gutter: 16,
    unit: 4,
  },
  radius: {
    default: 14,
    lg: 18,
    xl: 22,
    card: 24,
    full: 999,
  },
  fonts: {
    body: 'Onest_400Regular',
    bodyMedium: 'Onest_500Medium',
    bodySemibold: 'Onest_600SemiBold',
    bodyBold: 'Onest_700Bold',
    headline: 'Onest_600SemiBold',
    display: 'Onest_600SemiBold',
    mono: 'GeistMono_400Regular',
    monoMedium: 'GeistMono_500Medium',
    monoSemibold: 'GeistMono_600SemiBold',
  },
} as const;

export type Theme = typeof theme;
