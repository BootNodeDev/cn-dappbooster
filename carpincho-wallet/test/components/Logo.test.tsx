import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import { Logo } from '@/components/Logo.tsx'

describe('Logo', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the wallet logo image with an accessible name', () => {
    render(<Logo />)
    const img = screen.getByAltText('Carpincho Wallet')
    assert.equal(img.tagName, 'IMG')
  })

  it('applies the provided size to width and height', () => {
    render(<Logo size={28} />)
    const img = screen.getByAltText('Carpincho Wallet')
    assert.equal(img.getAttribute('width'), '28')
    assert.equal(img.getAttribute('height'), '28')
  })
})
