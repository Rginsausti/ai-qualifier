'use client'

import { useEffect, useRef } from 'react'
import animeRaw from 'animejs/lib/anime.es.js'
type Anime = typeof import('animejs')
const anime = animeRaw as unknown as Anime

export default function AuthAnimator({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mql = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mql && mql.matches) return

    const el = rootRef.current
    if (!el) return

    const brand = document.querySelector<HTMLElement>('.auth__brand .auth__logo-wrap')
    const forms = Array.from(el.querySelectorAll<HTMLFormElement>('.auth__card'))
    const inputs = Array.from(el.querySelectorAll<HTMLElement>('.auth__input, .auth__title, .auth__btn'))

    anime.set(forms, { opacity: 0, translateY: 24, filter: 'blur(4px)' })
    anime.set(inputs, { opacity: 0, translateY: 10 })
    if (brand) anime.set(brand, { opacity: 0, scale: 0.9, filter: 'blur(2px)' })

    const tl = anime.timeline({ easing: 'easeOutQuad' })
    if (brand) tl.add({ targets: brand, opacity: 1, scale: 1, filter: 'blur(0px)', duration: 600 })
    tl.add({ targets: forms, opacity: 1, translateY: 0, filter: 'blur(0px)', duration: 600, delay: anime.stagger(120) })
      .add({ targets: inputs, opacity: 1, translateY: 0, duration: 400, delay: anime.stagger(40) }, '-=300')

    let pulse: anime.AnimeInstance | null = null
    if (brand) {
      pulse = anime({
        targets: brand,
        boxShadow: [
          '0 0 24px 6px rgba(120,180,255,.55), 0 0 80px 18px rgba(120,180,255,.22)',
          '0 0 36px 10px rgba(120,180,255,.75), 0 0 110px 26px rgba(120,180,255,.30)'
        ],
        translateY: [{ value: -3 }, { value: 0 }],
        duration: 3000,
        direction: 'alternate',
        easing: 'easeInOutSine',
        loop: true
      })
    }

    return () => {
      tl.pause()
      if (pulse) pulse.pause()
    }
  }, [])

  return <div ref={rootRef}>{children}</div>
}
