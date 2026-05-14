interface StatusMessageProps {
  kind: 'info' | 'error'
  message: string | undefined
  onDismiss: () => void
}

export const StatusMessage = ({ kind, message, onDismiss }: StatusMessageProps): JSX.Element | null => {
  if (message === undefined) {
    return null
  }

  return (
    <div className={`${kind} dismissible`}>
      <span>{message}</span>
      <button type="button" onClick={onDismiss}>Close</button>
    </div>
  )
}
