'use client'

import { useEffect, useRef } from 'react'
import animeRaw from 'animejs/lib/anime.es.js'
type Anime = typeof import('animejs')
const anime = animeRaw as unknown as Anime

export default function AuthBackdrop() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mounted = true
    const el = ref.current
    if (!mounted || !el) return
    const blobs = el.querySelectorAll<HTMLElement>('.auth-bg__blob')
    const anim = anime({
      targets: blobs,
      translateX: () => anime.random(-40, 40),
      translateY: () => anime.random(-30, 30),
      scale: () => anime.random(90, 110) / 100,
      direction: 'alternate',
      easing: 'easeInOutSine',
      duration: 4000,
      delay: anime.stagger(200),
      loop: true
    })
    return () => { mounted = false; anim.pause() }
  }, [])

  return (
    <div className="auth-bg" aria-hidden ref={ref}>
      <div className="auth-bg__glow"></div>
      <div className="auth-bg__blob auth-bg__blob--a"></div>
      <div className="auth-bg__blob auth-bg__blob--b"></div>
      <div className="auth-bg__blob auth-bg__blob--c"></div>
      <div className="auth-bg__twinkles"></div>
      <div className="auth-bg__grid"></div>
    </div>
  )
}
