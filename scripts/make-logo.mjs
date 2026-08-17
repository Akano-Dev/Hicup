// One-off: centre-crop the source artwork to square PNGs for the app icon.
import puppeteer from 'puppeteer-core'
import { readFileSync, writeFileSync } from 'node:fs'

const SOURCE = process.argv[2] ?? 'C:/Users/rimso/Desktop/chibidoki.jpg'
const dataUrl = `data:image/jpeg;base64,${readFileSync(SOURCE).toString('base64')}`

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox'],
})
const page = await browser.newPage()

const out = await page.evaluate(async (src) => {
  const img = new Image()
  img.src = src
  await img.decode()
  const side = Math.min(img.width, img.height)
  // Bias the crop upward: the face sits above centre in the source.
  const sx = (img.width - side) / 2
  const sy = Math.max(0, (img.height - side) / 2 - img.height * 0.04)

  const render = (size) => {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
    return canvas.toDataURL('image/png').split(',')[1]
  }
  return { large: render(512), small: render(64), source: `${img.width}x${img.height}` }
}, dataUrl)

writeFileSync('public/logo.png', Buffer.from(out.large, 'base64'))
writeFileSync('public/favicon.png', Buffer.from(out.small, 'base64'))
console.log(`source ${out.source} -> public/logo.png (512), public/favicon.png (64)`)
await browser.close()
