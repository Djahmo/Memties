import i18n from './index'

const isControl = (target: EventTarget | null): target is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
  target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement

document.addEventListener('invalid', event => {
  if (!isControl(event.target)) return
  const control = event.target
  const validity = control.validity
  const message = validity.valueMissing ? i18n.t('Please complete this field.')
    : validity.typeMismatch && control instanceof HTMLInputElement && control.type === 'email' ? i18n.t('Please enter a valid email address.')
    : validity.tooShort && (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) ? i18n.t('Use at least {{count}} characters.', { count: control.minLength })
    : i18n.t('Please check the form fields.')
  control.setCustomValidity(message)
}, true)
const clear = (event: Event) => { if (isControl(event.target)) event.target.setCustomValidity('') }
document.addEventListener('input', clear)
document.addEventListener('change', clear)
i18n.on('languageChanged', () => {
  document.querySelectorAll('input, select, textarea').forEach(control => { if (isControl(control)) control.setCustomValidity('') })
})
