import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Folder } from 'lucide-react'
import { HexColorInput, HexColorPicker } from 'react-colorful'
import './GroupColorPicker.css'

export const GroupColorPicker = ({ color, onChange, disabled }: {
  color: string
  onChange: (color: string) => void
  disabled: boolean
}) => {
  const { t } = useTranslation()
  const heading = useId()
  const [custom, setCustom] = useState(false)
  const changeColor = (value: string) => {
    if (disabled) return
    if (/^#[0-9a-f]{6}$/i.test(value)) onChange(value.toLowerCase())
    else if (/^#[0-9a-f]{3}$/i.test(value)) onChange(`#${value.slice(1).split('').map(character => character.repeat(2)).join('')}`.toLowerCase())
  }

  return <section aria-labelledby={heading} className="space-y-3">
    <h3 id={heading} className="field-label">{t('Group color')}</h3>
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-line p-1" role="group" aria-label={t('Group color')}>
      <button type="button" disabled={disabled} aria-pressed={!custom} onClick={() => setCustom(false)} className={`rounded-lg px-2 py-3 text-sm font-medium ${!custom ? 'bg-selected text-accent' : 'text-muted hover:bg-hover'}`}>{t('Preset colors')}</button>
      <button type="button" disabled={disabled} aria-pressed={custom} onClick={() => setCustom(true)} className={`rounded-lg px-2 py-3 text-sm font-medium ${custom ? 'bg-selected text-accent' : 'text-muted hover:bg-hover'}`}>{t('Custom picker')}</button>
    </div>
    {custom ? <div className="rounded-xl border border-line p-4 space-y-4">
      <div inert={disabled} className={disabled ? 'opacity-60' : ''}>
        <HexColorPicker color={color} onChange={changeColor} className="group-color-picker" aria-label={t('Group color')} />
      </div>
      <div className="flex items-end gap-4">
        <span className="size-11 shrink-0 rounded-lg bg-surface border border-line flex items-center justify-center" aria-hidden="true"><Folder size={25} style={{ color }} /></span>
        <label className="field-label flex-1">{t('Hex color')}
          <HexColorInput prefixed color={color} onChange={changeColor} disabled={disabled} className="input-field font-mono" aria-label={t('Hex color')} autoComplete="off" spellCheck={false} />
        </label>
      </div>
    </div> : <div className="grid grid-cols-6 sm:grid-cols-9 gap-3 sm:gap-4 px-1 py-3" role="group" aria-label={t('Suggested colors')}>
        {['#62846e', '#245b47', '#3caaa0', '#4b6bea', '#9333ea', '#bf4692', '#e34f50', '#e87c47', '#efb447', '#9ba3ad', '#bc8585', '#ddb08d', '#e4d58f', '#97caac', '#7fc7d2', '#98b5eb', '#c39ae2', '#e6a4d2'].map(value => <button
          key={value}
          type="button"
          disabled={disabled}
          className={`aspect-square w-full rounded-xl border border-black/10 transition-transform hover:scale-105 ${color.toLowerCase() === value ? 'ring-2 ring-ink ring-offset-3 ring-offset-surface' : ''}`}
          style={{ backgroundColor: value }}
          aria-label={t('Choose color {{color}}', { color: value })}
          aria-pressed={color.toLowerCase() === value}
          onClick={() => changeColor(value)}
        />)}
      </div>}
  </section>
}
