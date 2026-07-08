/**
 * Design tokens for the TUI — the single home for every visual decision.
 *
 * Static by design: there is exactly one palette today, so a context/provider
 * would add a hook call per component for no benefit. If a user-configurable
 * theme is ever wanted, the shape below already supports it: add a
 * `theme: z.enum([...]).default('default')` field to `src/config/schema.ts`
 * (Zod defaults keep old config files valid), turn these exports into a lookup
 * keyed by that field, and swap this module for a small context.
 *
 * Values are Ink/chalk color names so they drop into `<Text color=…>` and
 * `borderColor=…` unchanged.
 */

export const color = {
  /** Logo, selection cursor, focused labels. */
  brand: 'cyan',
  /** Key hints, [y/N] prompts. */
  accent: 'cyan',
  /** Amounts in, verified marks, ok verdicts. */
  success: 'green',
  /** Errors, amounts out, fail verdicts, scam flags. */
  danger: 'red',
  /** Warnings, un-emulated transactions, testnet badge. */
  warning: 'yellow',
  info: 'blue',
  /** Addresses — an established convention throughout tonsole. */
  address: 'yellow',
  /** Use together with <Text dimColor> for secondary text. */
  muted: 'gray',
} as const;

export const border = {
  default: 'gray',
  focus: 'cyan',
  success: 'green',
  danger: 'red',
  warning: 'yellow',
  /** The one border style used across the app. */
  style: 'round',
} as const;

export const symbol = {
  pointer: '❯',
  bullet: '·',
  sep: ' · ',
  check: '✓',
  cross: '✗',
  warn: '⚠',
  link: '🔗',
  more: '…',
  dot: '●',
  scrollTrack: '│',
  scrollThumb: '█',
  spinnerFrames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
} as const;

export const space = {
  /** Label column width in key/value rows and form fields. */
  fieldLabelWidth: 14,
  panelPaddingX: 1,
  /** In-list block thumbnail size (cells). */
  thumbW: 8,
  thumbH: 3,
} as const;

/** Layout breakpoints (terminal columns). */
export const breakpoints = {
  /** Below this: compact addresses, thumbnails dropped. */
  narrow: 80,
  /** At or above this: screens may go two-column master-detail. */
  wide: 100,
} as const;
