// Screenshot helper for the landing page at real device widths.
// Uses the shared puppeteer install — a plain `import puppeteer` won't resolve
// it from here, so go through createRequire.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

const require = createRequire('/Users/warrenkaplan/.puppeteer-shared/')
const puppeteer = require('puppeteer')

const url = process.argv[2] ?? 'http://localhost:3000'
const label = process.argv[3] ?? 'shot'
// Pass a CSS selector as the 4th arg to shoot just that element.
const selector = process.argv[4] ?? null

// Chrome's --window-size lies about the viewport, so set it explicitly per page.
const VIEWPORTS = [
  { name: 'android-sm', width: 360, height: 800 },
  { name: 'iphone-14', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
]

mkdirSync('temporary screenshots', { recursive: true })

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })

for (const vp of VIEWPORTS) {
  const page = await browser.newPage()
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1, isMobile: true })
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 })
  await new Promise(r => setTimeout(r, 600)) // let webfonts settle

  // Horizontal overflow is the thing that silently ruins a mobile page.
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  console.log(`${vp.name} (${vp.width}px): horizontal overflow = ${overflow}px`)

  const path = `temporary screenshots/${label}-${vp.name}.png`
  if (selector) {
    const el = await page.$(selector)
    if (el) await el.screenshot({ path })
    else console.log(`  (selector ${selector} not found)`)
  } else {
    await page.screenshot({ path, fullPage: true })
  }
  await page.close()
}

await browser.close()
console.log('done')
