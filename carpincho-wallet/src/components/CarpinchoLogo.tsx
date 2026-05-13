import logoUrl from '../assets/carpincho-hero.svg'

export interface CarpinchoLogoProps {
  size?: number
  className?: string
}

export const CarpinchoLogo = ({ size = 120, className }: CarpinchoLogoProps): JSX.Element => (
  <img
    src={logoUrl}
    alt="Carpincho Wallet"
    width={size}
    height={size}
    className={className}
    draggable={false}
    style={{ userSelect: 'none' }}
  />
)
