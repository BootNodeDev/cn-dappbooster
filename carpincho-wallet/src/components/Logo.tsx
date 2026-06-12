import logoUrl from '@/assets/carpincho-logo.svg'

export interface LogoProps {
  size?: number
  className?: string
}

export const Logo = ({ size = 120, className }: LogoProps): React.JSX.Element => (
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
