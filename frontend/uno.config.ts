import { defineConfig, presetWind4, transformerVariantGroup } from 'unocss'

export default defineConfig({
  theme: { colors: { canvas: 'var(--mem-canvas)', surface: 'var(--mem-surface)', subtle: 'var(--mem-subtle)', hover: 'var(--mem-hover)', selected: 'var(--mem-selected)', soft: 'var(--mem-soft)', ink: 'var(--mem-ink)', muted: 'var(--mem-muted)', accent: 'var(--mem-accent)', icon: 'var(--mem-icon)', line: 'var(--mem-line)', strongline: 'var(--mem-strongline)', badge: 'var(--mem-badge)', badgeink: 'var(--mem-badgeink)', warning: 'var(--mem-warning)', warningline: 'var(--mem-warningline)', error: 'var(--mem-error)', errorink: 'var(--mem-errorink)', brand: 'var(--mem-brand)', brandhover: 'var(--mem-brandhover)' } },
  shortcuts: {
    'app-theme': '[--mem-canvas:#fafbf8] dark:[--mem-canvas:#101b18] [--mem-surface:#ffffff] dark:[--mem-surface:#192823] [--mem-subtle:#f0f4ee] dark:[--mem-subtle:#15221e] [--mem-hover:#f4f7f1] dark:[--mem-hover:#23372e] [--mem-selected:#dce9df] dark:[--mem-selected:#2b4537] [--mem-soft:#edf3ed] dark:[--mem-soft:#24372d] [--mem-ink:#26392f] dark:[--mem-ink:#e5eee7] [--mem-muted:#68786b] dark:[--mem-muted:#a8b9ad] [--mem-accent:#245b47] dark:[--mem-accent:#a7d5b5] [--mem-icon:#62846e] dark:[--mem-icon:#95b59f] [--mem-line:#dfe6dc] dark:[--mem-line:#35493c] [--mem-strongline:#ccd6cb] dark:[--mem-strongline:#536958] [--mem-badge:#e7efe3] dark:[--mem-badge:#293e30] [--mem-badgeink:#3c6447] dark:[--mem-badgeink:#b6dabe] [--mem-warning:#fff9ea] dark:[--mem-warning:#382f1d] [--mem-warningline:#d9bf81] dark:[--mem-warningline:#8d7340] [--mem-error:#fff0ed] dark:[--mem-error:#3c2324] [--mem-errorink:#963c30] dark:[--mem-errorink:#f4b6ad] [--mem-brand:#245b47] dark:[--mem-brand:#2c7257] [--mem-brandhover:#194431] dark:[--mem-brandhover:#245e49] [color-scheme:light] dark:[color-scheme:dark] min-w-80 bg-canvas text-ink font-sans antialiased [&_button]:cursor-pointer [&_button:disabled]:(cursor-wait opacity-60) [&_fieldset:disabled_button]:(cursor-wait opacity-60) [&_:focus-visible]:(outline-3 outline-solid outline-[#66957e] outline-offset-3)',
    'field-label': 'block text-sm font-semibold',
    'input-field': 'block w-full min-w-0 text-base sm:text-sm mt-2 mb-1 border border-strongline rounded-lg p-3 bg-surface text-ink font-normal disabled:(bg-subtle text-muted)',
    primary: 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand text-white px-4 py-2.5 font-medium hover:bg-brandhover transition-colors disabled:(opacity-60 cursor-wait)',
    secondary: 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 font-medium hover:bg-hover transition-colors disabled:(opacity-60 cursor-wait)',
    card: 'bg-surface border border-line rounded-xl p-4 sm:p-6',
    muted: 'text-muted',
    eyebrow: 'uppercase tracking-[.16em] text-xs font-semibold text-muted',
    badge: 'inline-block rounded-full bg-badge text-badgeink text-xs font-medium px-3 py-1',
    error: 'rounded-lg bg-error text-errorink p-3 text-sm',
  },
  presets: [
    presetWind4(),
  ],
  transformers: [
    transformerVariantGroup(),
  ],
})
