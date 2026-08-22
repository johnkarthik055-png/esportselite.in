import { useEffect, useState } from 'react'
import { X, Bell, Trash2, CheckCheck } from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications.js'
import { formatRelative } from '../utils/helpers.js'
import { useConfirm } from '../hooks/useConfirm.js'
import ConfirmModal from './ConfirmModal.jsx'

/**
 * Right-side slide-in notification panel.
 *
 * Props:
 *  - open
 *  - onClose()
 */
export default function NotificationPanel({ open, onClose }) {
  const { confirm, confirmModalProps } = useConfirm()
  const { notifications, unreadCount, markRead, markAllRead, clearAll, removeNotification } =
    useNotifications()

  /* Keep the panel mounted for a moment while it animates out. */
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
    } else if (mounted) {
      setClosing(true)
      const t = setTimeout(() => setMounted(false), 250)
      return () => clearTimeout(t)
    }
  }, [open, mounted])

  /* When the panel opens, mark every notification as read immediately.
     The badge in TopBar updates instantly via the same-tab event bus
     in useNotifications, and the new state persists to localStorage. */
  useEffect(() => {
    if (open && unreadCount > 0) {
      markAllRead()
    }
  }, [open, unreadCount, markAllRead])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className={`fixed top-0 right-0 h-screen w-full sm:max-w-[380px] z-50 glass-strong border-l-2 border-accent-primary shadow-2xl flex flex-col ${
          closing ? 'panel-slide-out' : 'panel-slide-in'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-bg-elevated/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-red-gradient flex items-center justify-center shadow-red-glow">
              <Bell size={16} className="text-white" />
            </div>
            <div>
              <h3 className="heading text-base text-white tracking-wide uppercase">
                Notifications
              </h3>
              <p className="text-[10px] text-text-secondary uppercase tracking-widest mt-0.5">
                {unreadCount > 0
                  ? `${unreadCount} new`
                  : notifications.length === 0
                  ? 'all clear'
                  : 'all read'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-text-secondary hover:text-white hover:bg-white/5 transition-all"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action row */}
        {notifications.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-primary/30">
            <span className="text-xs text-text-secondary heading uppercase tracking-widest">
              {unreadCount > 0 ? `${unreadCount} new` : 'All read'}
            </span>
            <button
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="flex items-center gap-1.5 text-xs text-accent-secondary hover:text-white disabled:opacity-40 disabled:cursor-not-allowed heading uppercase tracking-widest transition-all"
            >
              <CheckCheck size={13} /> Mark all read
            </button>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="text-5xl mb-3 opacity-70">🔔</div>
              <p className="text-text-secondary text-sm">No notifications yet.</p>
              <p className="text-text-muted text-xs mt-1">
                Streak milestones and personal bests will land here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map(n => (
                <li
                  key={n.id}
                  className={`group px-5 py-4 hover:bg-white/[0.03] transition-all cursor-pointer ${
                    !n.read ? 'bg-[rgba(232,0,28,0.04)]' : ''
                  }`}
                  onClick={() => !n.read && markRead(n.id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Read/unread dot */}
                    <span
                      className={`mt-1 flex-shrink-0 w-2.5 h-2.5 rounded-full ${
                        n.read
                          ? 'border border-text-muted'
                          : 'bg-accent-primary shadow-red-glow'
                      }`}
                    />
                    {/* Icon */}
                    <span className="text-xl flex-shrink-0 leading-none">{n.icon}</span>
                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${n.read ? 'text-text-secondary' : 'text-white'}`}>
                        {n.title}
                      </div>
                      <div className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                        {n.message}{' '}
                        <span className="text-text-muted">{formatRelative(new Date(n.timestamp).getTime())}</span>
                      </div>
                    </div>
                    {/* Hover delete */}
                    <button
                      onClick={e => { e.stopPropagation(); removeNotification(n.id) }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-text-muted hover:text-accent-secondary hover:bg-[rgba(232,0,28,0.08)] rounded transition-all"
                      title="Dismiss"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t border-border bg-bg-primary/30 p-4">
            <button
              onClick={async () => {
                if (await confirm('Clear all notifications? This cannot be undone.')) {
                  clearAll()
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-xs uppercase tracking-[0.15em] heading font-semibold text-text-secondary hover:text-accent-secondary hover:bg-[rgba(232,0,28,0.06)] border border-border hover:border-[rgba(232,0,28,0.3)] transition-all"
            >
              <Trash2 size={13} /> Clear all notifications
            </button>
          </div>
        )}
      </aside>
      <ConfirmModal {...confirmModalProps} />
    </>
  )
}
