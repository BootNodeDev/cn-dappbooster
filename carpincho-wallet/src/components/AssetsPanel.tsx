// Mocked Assets tab. Token balances are not wired yet, so it only states the empty condition.
export const AssetsPanel = (): JSX.Element => (
  <div className="flex h-full flex-col items-center justify-center px-4 py-10 text-center">
    <p className="m-0 text-[0.95rem] font-medium text-muted-foreground">No assets to show yet</p>
  </div>
)
