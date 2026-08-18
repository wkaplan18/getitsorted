'use client'

// Sorted — the isiZulu offer.
//
// Shown only on the English page. A visitor who reads isiZulu more comfortably
// than English cannot be expected to hunt for a switch, so the switch comes to
// him — and it speaks to him in the language it is offering, because a prompt
// written in English asking "do you want isiZulu?" tests the very skill the
// person may not have.
//
// It asks once. The answer — either answer — is remembered, so the site never
// interrupts the same person twice.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'sorted_lang_prompt_v1'

// Deliberately not routed through lib/siteCopy: this card is always isiZulu no
// matter which page it sits on, so a per-language copy table would only invite
// someone to "translate" it into English and quietly break the whole idea.
const ZU = {
  eyebrow: 'isiZulu',
  title: 'Ufuna ukufunda leli khasi ngesiZulu?',
  body: 'Konke okuseleli khasi kukhona nangesiZulu — imibuzo, izibonelo, konke.',
  yes: 'Yebo, ngesiZulu',
}
const KEEP_ENGLISH = 'Keep in English'

export default function LanguagePrompt() {
  // Two flags, not one: `mounted` puts the card in the DOM, `shown` starts the
  // transition a frame later. Rendering it already-open would flash it into
  // place with no animation on the first paint.
  const [mounted, setMounted] = useState(false)
  const [shown, setShown] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const yesRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    // localStorage throws in a locked-down browser or private-mode Safari.
    // A prompt is not worth a broken landing page, so a failure here just means
    // no prompt.
    let seen = false
    try {
      seen = window.localStorage.getItem(STORAGE_KEY) !== null
    } catch {
      return
    }
    if (seen) return

    // Late enough that the hero has painted and the visitor has seen what the
    // page is, early enough that he hasn't started reading past it.
    const timer = window.setTimeout(() => {
      setMounted(true)
      requestAnimationFrame(() => setShown(true))
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!mounted) return
    yesRef.current?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        remember('en')
        close()
        return
      }
      // Minimal focus trap: the card has exactly two controls, so Tab and
      // Shift+Tab just bounce between them rather than wandering off into a
      // page the visitor can no longer see properly.
      if (e.key !== 'Tab') return
      const focusables = cardRef.current?.querySelectorAll<HTMLElement>('a[href], button')
      if (!focusables || focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mounted])

  function remember(choice: 'en' | 'zu') {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice)
    } catch {
      /* nothing to do — worst case he is asked once more next visit */
    }
  }

  function close() {
    setShown(false)
    // Matches the transition below, so the card finishes fading before it is
    // pulled out of the DOM.
    window.setTimeout(() => setMounted(false), 220)
  }

  if (!mounted) return null

  return (
    <>
      <style>{`
        .lp-backdrop {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(2px);
          display: flex; align-items: flex-end; justify-content: center;
          opacity: 0;
          transition: opacity 200ms ease;
        }
        .lp-backdrop[data-shown='true'] { opacity: 1; }

        .lp-card {
          width: 100%;
          max-width: 440px;
          background: #FFFDF8;
          border-radius: 24px 24px 0 0;
          padding: 26px 22px calc(22px + env(safe-area-inset-bottom));
          /* Layered and amber-tinted rather than a flat drop shadow, so the
             card reads as lifted off the sand background, not stuck on it. */
          box-shadow: 0 -1px 0 rgba(180, 83, 10, 0.10),
                      0 -12px 32px rgba(120, 53, 15, 0.16),
                      0 -32px 64px rgba(15, 23, 42, 0.18);
          transform: translateY(16px);
          opacity: 0;
          transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease;
        }
        .lp-backdrop[data-shown='true'] .lp-card { transform: translateY(0); opacity: 1; }

        /* Above handset width it stops being a sheet and becomes a card. */
        @media (min-width: 641px) {
          .lp-backdrop { align-items: center; padding: 24px; }
          .lp-card { border-radius: 24px; padding: 30px 28px; transform: translateY(10px) scale(0.98); }
          .lp-backdrop[data-shown='true'] .lp-card { transform: translateY(0) scale(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          .lp-backdrop, .lp-card { transition: opacity 120ms ease; }
          .lp-card, .lp-backdrop[data-shown='true'] .lp-card { transform: none; }
        }

        .lp-btn {
          display: block; width: 100%;
          text-align: center; text-decoration: none;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 700; font-size: 16px;
          padding: 15px 20px;
          border-radius: 14px;
          border: none;
          cursor: pointer;
          transition: transform 140ms cubic-bezier(0.22, 1, 0.36, 1), opacity 140ms ease;
        }
        .lp-yes {
          background: #B4530A; color: #fff;
          box-shadow: 0 1px 2px rgba(120, 53, 15, 0.24), 0 6px 16px rgba(180, 83, 10, 0.28);
        }
        .lp-yes:hover { transform: translateY(-1px); }
        .lp-yes:active { transform: translateY(0); }
        .lp-keep {
          background: transparent; color: #6B6B60;
          font-weight: 600; font-size: 15px; padding: 13px 20px;
        }
        .lp-keep:hover { opacity: 0.72; }
        .lp-keep:active { transform: translateY(1px); }
        .lp-btn:focus-visible { outline: 2px solid #B4530A; outline-offset: 3px; }
      `}</style>

      <div
        className="lp-backdrop"
        data-shown={shown}
        onClick={() => { remember('en'); close() }}
      >
        <div
          ref={cardRef}
          className="lp-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lp-title"
          aria-describedby="lp-body"
          onClick={e => e.stopPropagation()}
        >
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: '#FDF6EC', border: '1px solid #F0DCC2', color: '#8A4B12',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 999,
              marginBottom: 14,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#B4530A', display: 'inline-block' }} />
            {ZU.eyebrow}
          </div>

          {/* lang="zu" so a screen reader pronounces the isiZulu as isiZulu. */}
          <h2
            id="lp-title"
            lang="zu"
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em',
              lineHeight: 1.25, color: '#0f172a', margin: '0 0 10px',
            }}
          >
            {ZU.title}
          </h2>
          <p
            id="lp-body"
            lang="zu"
            style={{ fontSize: 15, lineHeight: 1.7, color: '#64748b', margin: '0 0 22px' }}
          >
            {ZU.body}
          </p>

          <Link
            ref={yesRef}
            href="/zu"
            lang="zu"
            hrefLang="zu"
            className="lp-btn lp-yes"
            onClick={() => remember('zu')}
          >
            {ZU.yes}
          </Link>
          <button
            type="button"
            className="lp-btn lp-keep"
            style={{ marginTop: 8 }}
            onClick={() => { remember('en'); close() }}
          >
            {KEEP_ENGLISH}
          </button>
        </div>
      </div>
    </>
  )
}
