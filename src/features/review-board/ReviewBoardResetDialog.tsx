import { useEffect, useRef } from 'react'
import './ReviewBoardResetDialog.css'

export function ReviewBoardResetDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
      if (!dialog.open) dialog.showModal()
      return
    }
    if (dialog.open) dialog.close()
    returnFocusRef.current?.focus()
    returnFocusRef.current = null
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="reset-confirm-dialog dm-dialog"
      data-testid="reset-confirm-dialog"
      aria-labelledby="reset-confirm-title"
      aria-describedby="reset-confirm-description"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <form method="dialog">
        <h2 id="reset-confirm-title" className="dm-dialog-title">Reset board?</h2>
        <p id="reset-confirm-description" className="dm-dialog-body">Reset the board to the host copy? Unsaved changes will be lost.</p>
        <div className="reset-confirm-actions dm-dialog-actions">
          <button type="button" className="dm-btn dm-btn--quiet" onClick={onCancel} data-testid="reset-cancel">Cancel</button>
          <button type="button" className="dm-btn dm-btn--danger" onClick={onConfirm} data-testid="reset-confirm">Reset board</button>
        </div>
      </form>
    </dialog>
  )
}
