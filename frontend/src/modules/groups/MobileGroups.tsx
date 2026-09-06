import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderTree, Plus, X } from 'lucide-react'
import type { Group } from '../../types/api'
import { GroupTree } from './GroupTree'

export const MobileGroups = ({ groups, selectedId, loading, onSelect, onCreate }: {
  groups: Group[]; selectedId: string | null; loading: boolean; onSelect: (id: string) => void; onCreate: () => void
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!open) return
    dialog.current?.showModal()
    const wasLocked = document.body.classList.contains('overflow-hidden')
    document.body.classList.add('overflow-hidden')
    const wide = window.matchMedia('(min-width: 1024px)')
    const close = () => { if (wide.matches) dialog.current?.close() }
    wide.addEventListener('change', close)
    return () => { if (!wasLocked) document.body.classList.remove('overflow-hidden'); wide.removeEventListener('change', close) }
  }, [open])
  const close = () => dialog.current?.close()
  return <div className="lg:hidden">
    <button className="secondary w-full justify-start min-h-12" aria-haspopup="dialog" aria-label={t('Choose a group')} onClick={() => setOpen(true)}><FolderTree size={20} className="shrink-0" /><span className="truncate">{groups.find(group => group.id === selectedId)?.name ?? t('Your groups')}</span><span className="ml-auto text-xs muted shrink-0">{t('Change')}</span></button>
    <dialog ref={dialog} onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) close() }} aria-labelledby="mobile-groups-title" className="fixed inset-y-0 left-0 right-auto m-0 w-[min(90vw,24rem)] h-dvh max-h-dvh max-w-none p-0 bg-surface text-ink border-0 backdrop:bg-black/50">
      <div className="flex flex-col h-full p-4" onClick={event => event.stopPropagation()}>
        <div className="flex justify-between items-center gap-3 pb-4 border-b border-line"><h2 id="mobile-groups-title" className="font-semibold text-lg">{t('Your groups')}</h2><button className="secondary size-11 p-2" aria-label={t('Close')} onClick={close}><X size={20} /></button></div>
        <div className="flex-1 min-h-0 overflow-y-auto py-3">{loading ? <p role="status" className="muted">{t('Loading your groups…')}</p> : <GroupTree groups={groups} selectedId={selectedId} onSelect={id => { onSelect(id); close() }} />}</div>
        <button className="primary min-h-12 mb-[env(safe-area-inset-bottom)]" disabled={loading} onClick={() => { onCreate(); close() }}><Plus size={18} />{t('New group')}</button>
      </div>
    </dialog>
  </div>
}
