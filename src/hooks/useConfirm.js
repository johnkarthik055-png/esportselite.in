import { useCallback, useState } from 'react'

/* Promise-based replacement for window.confirm() that renders through
   <ConfirmModal/> instead of the browser's native dialog. Usage:

     const { confirm, confirmModalProps } = useConfirm()
     if (!await confirm('Delete this?')) return
     ...
     <ConfirmModal {...confirmModalProps} />
*/
export function useConfirm() {
  const [state, setState] = useState(null)

  const confirm = useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      setState({ message, ...opts, resolve })
    })
  }, [])

  const confirmModalProps = {
    open: !!state,
    title: state?.title,
    message: state?.message,
    confirmLabel: state?.confirmLabel,
    cancelLabel: state?.cancelLabel,
    destructive: state?.destructive ?? true,
    onConfirm: () => { state?.resolve(true); setState(null) },
    onClose: () => { state?.resolve(false); setState(null) },
  }

  return { confirm, confirmModalProps }
}
