import logoUrl from '@/assets/carpincho-logo.svg'

export interface CarpinchoLogoProps {
  size?: number
  className?: string
}

export const CarpinchoLogo = ({ size = 120, className }: CarpinchoLogoProps): JSX.Element => (
  <img
    alt="Carpincho Wallet"
    className={className}
    draggable={false}
    height={size}
    src={logoUrl}
    style={{ userSelect: 'none' }}
    width={size}
  />
)
