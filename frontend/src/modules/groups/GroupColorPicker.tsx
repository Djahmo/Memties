import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Folder, Palette } from 'lucide-react'
import { HexColorInput, HexColorPicker } from 'react-colorful'
import './GroupColorPicker.css'

export const GroupColorPicker = ({ color, onChange, disabled }: {
  color: string
  onChange: (color: string) => void
  disabled: boolean
}) => {
  const { t } = useTranslation()
  const heading = useId()
  const changeColor = (value: string) => {
    if (disabled) return
    if (/^#[0-9a-f]{6}$/i.test(value)) onChange(value.toLowerCase())
    else if (/^#[0-9a-f]{3}$/i.test(value)) onChange(`#${value.slice(1).split('').map(character => character.repeat(2)).join('')}`.toLowerCase())
  }

  return <section aria-labelledby={heading} className="space-y-3">
    <h3 id={heading} className="field-label flex items-center gap-2"><Palette size={16} aria-hidden="true" />{t('Group color')}</h3>
    <div className="rounded-xl border border-line bg-subtle p-4 space-y-4">
      <div inert={disabled} className={disabled ? 'opacity-60' : ''}>
        <HexColorPicker color={color} onChange={changeColor} className="group-color-picker" aria-label={t('Group color')} />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('Suggested colors')}>
        {['#62846e', '#245b47', '#0d9488', '#0284c7', '#4f46e5', '#9333ea', '#db2777', '#dc2626', '#d97706', '#64748b'].map(value => <button
          key={value}
          type="button"
          disabled={disabled}
          className="size-8 shrink-0 rounded-full border border-strongline flex items-center justify-center transition-transform hover:scale-110"
          style={{ backgroundColor: value }}
          aria-label={t('Choose color {{color}}', { color: value })}
          aria-pressed={color.toLowerCase() === value}
          onClick={() => changeColor(value)}
        >{color.toLowerCase() === value && <Check size={16} className="text-white" aria-hidden="true" />}</button>)}
      </div>
      <div className="flex items-end gap-4">
        <span className="size-11 shrink-0 rounded-lg bg-surface border border-line flex items-center justify-center" aria-hidden="true"><Folder size={25} style={{ color }} /></span>
        <label className="field-label flex-1">{t('Hex color')}
          <HexColorInput prefixed color={color} onChange={changeColor} disabled={disabled} className="input-field font-mono" aria-label={t('Hex color')} autoComplete="off" spellCheck={false} />
        </label>
      </div>
    </div>
  </section>
}
