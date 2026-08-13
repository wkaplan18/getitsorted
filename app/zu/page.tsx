import type { Metadata } from 'next'
import Landing from '@/components/Landing'
import { siteCopy } from '@/lib/siteCopy'

// A named route rather than a [lang] segment: a catch-all at the root would
// also swallow /app, /q, /admin and /privacy. One file per language is a little
// more typing and a lot less to go wrong.
const t = siteCopy('zu')

export const metadata: Metadata = {
  title: t.meta.title,
  description: t.meta.description,
  alternates: {
    canonical: '/zu',
    languages: { en: '/', zu: '/zu' },
  },
}

export default function Page() {
  return <Landing lang="zu" />
}
