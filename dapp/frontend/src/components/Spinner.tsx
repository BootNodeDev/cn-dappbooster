// Full-screen brand spinner shown while the session rehydrates.
export const FullScreenSpinner = (): React.JSX.Element => (
  <div className="grid min-h-screen place-items-center">
    <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
  </div>
)
