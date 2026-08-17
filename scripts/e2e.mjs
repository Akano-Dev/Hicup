import puppeteer from 'puppeteer-core'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE ?? 'http://localhost:5199'
const OUT = process.env.OUT ?? 'C:/Users/rimso/AppData/Local/Temp/claude/c--Users-rimso-Desktop-Projects-Hicup/4778fc0a-7727-4da0-b769-fab6be85bc22/scratchpad'

const log = []
const check = (name, ok, detail = '') => {
  log.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  return ok
}

const report = () => {
  console.log(log.join('\n'))
  console.log(`\n${log.filter((l) => l.startsWith('PASS')).length}/${log.length} checks passed`)
}
process.on('uncaughtException', (e) => {
  report()
  console.log('\nABORTED:', e.stack)
  process.exit(1)
})

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--no-sandbox',
    '--window-size=1440,900',
  ],
  defaultViewport: { width: 1440, height: 900 },
})

const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})

await page.goto(BASE, { waitUntil: 'networkidle2' })
await page.waitForSelector('h1', { timeout: 15000 })

const heading = await page.$eval('h1', (el) => el.textContent)
check('empty state renders', /Your videos/.test(heading ?? ''), heading)

// --- Seed the library with real generated video files -----------------------
const seeded = await page.evaluate(async () => {
  const specs = [
    { title: 'Python Async Programming', color: '#1e3a8a', seconds: 2.2 },
    { title: 'Minecraft Hardcore', color: '#14532d', seconds: 2.2 },
    { title: 'Deep Ocean Documentary', color: '#0c4a6e', seconds: 2.2 },
    // Imported last, so it sorts first and is the clip the feed opens on.
    // Long enough to measure sustained playback against the wall clock.
    { title: 'Evening Piano', color: '#4c1d95', seconds: 9 },
  ]
  const files = []
  for (const spec of specs) {
    const canvas = document.createElement('canvas')
    canvas.width = 270
    canvas.height = 480
    const ctx = canvas.getContext('2d')
    const stream = canvas.captureStream(24)
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
    const chunks = []
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    const done = new Promise((r) => (recorder.onstop = r))
    recorder.start()
    const start = performance.now()
    await new Promise((resolve) => {
      const draw = () => {
        const t = (performance.now() - start) / 1000
        ctx.fillStyle = spec.color
        ctx.fillRect(0, 0, 270, 480)
        ctx.fillStyle = 'white'
        ctx.font = '20px sans-serif'
        ctx.fillText(t.toFixed(1), 20, 60)
        if (t > spec.seconds) return resolve()
        requestAnimationFrame(draw)
      }
      draw()
    })
    recorder.stop()
    await done
    for (const track of stream.getTracks()) track.stop()
    const blob = new Blob(chunks, { type: 'video/webm' })
    files.push(new File([blob], `${spec.title}.webm`, { type: 'video/webm' }))
  }
  // Use the app's own import path via the file input.
  window.__hicupFiles = files
  return files.length
})
check('generated test clips', seeded === 4, `${seeded} files`)

// Drop them onto the file input the ImportButton owns.
await page.evaluate(() => {
  const input = document.querySelector('input[type="file"][accept*="video"]')
  const dt = new DataTransfer()
  for (const f of window.__hicupFiles) dt.items.add(f)
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
})

const countStored = () =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open('hicup')
        req.onsuccess = () => {
          const tx = req.result.transaction('videos').objectStore('videos').getAll()
          tx.onsuccess = () => resolve(tx.result.length)
        }
      }),
  )

await page.waitForFunction(() => /recently added/i.test(document.body.innerText), { timeout: 60000 })
// Wait for every file to be committed before navigating away.
for (let i = 0; i < 60 && (await countStored()) < 4; i++) await new Promise((r) => setTimeout(r, 500))
check('import completes and home populates', (await countStored()) === 4, `${await countStored()} stored`)

// Persistence across reload
await page.reload({ waitUntil: 'networkidle2' })
await page.waitForFunction(() => /recently added/i.test(document.body.innerText), { timeout: 30000 })
check('library persists across reload', true)

// --- Library page: search + filter -----------------------------------------
await page.goto(`${BASE}/library`, { waitUntil: 'networkidle2' })
await page.waitForSelector('input[type="search"]')
const cardCount = async () => (await page.$$('article')).length
check('library lists all videos', (await cardCount()) === 4, `${await cardCount()} cards`)

await page.type('input[type="search"]', 'python')
await new Promise((r) => setTimeout(r, 400))
const searched = await cardCount()
check('search narrows results', searched === 1, `${searched} cards for "python"`)

await page.click('button[aria-label="Clear search"]')
await new Promise((r) => setTimeout(r, 300))

// --- Metadata editing: retitle + categorise + tag ---------------------------
await page.evaluate(() => {
  document.querySelector('button[aria-label^="Edit "]').click()
})
await page.waitForSelector('[role="dialog"]')
const setValue = async (selector, value, tag = 'HTMLInputElement') =>
  page.evaluate(
    ({ selector, value, tag }) => {
      const el = document.querySelector(selector)
      const setter = Object.getOwnPropertyDescriptor(window[tag].prototype, 'value').set
      setter.call(el, value)
      el.dispatchEvent(new Event(tag === 'HTMLSelectElement' ? 'change' : 'input', { bubbles: true }))
    },
    { selector, value, tag },
  )

await setValue('[role="dialog"] input[type="text"], [role="dialog"] input:not([type])', 'Minecraft Hardcore')
await setValue('[role="dialog"] select', 'Gaming', 'HTMLSelectElement')
await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('[role="dialog"] input')]
  const tagsInput = inputs[inputs.length - 1]
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(tagsInput, 'minecraft, hardcore')
  tagsInput.dispatchEvent(new Event('input', { bubbles: true }))
})
await page.evaluate(() => {
  ;[...document.querySelectorAll('[role="dialog"] button')]
    .find((b) => b.textContent?.includes('Save changes'))
    .click()
})
await new Promise((r) => setTimeout(r, 700))
const edited = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const req = indexedDB.open('hicup')
      req.onsuccess = () => {
        const tx = req.result.transaction('videos').objectStore('videos').getAll()
        tx.onsuccess = () =>
          resolve(tx.result.find((v) => v.category === 'Gaming') ?? null)
      }
    }),
)
check(
  'metadata edit persists (title, category, tags)',
  !!edited && edited.title === 'Minecraft Hardcore' && edited.tags.includes('minecraft'),
  edited ? `${edited.title} / ${edited.category} / ${edited.tags}` : 'not saved',
)

// Category filter chip
const chipInfo = await page.evaluate(() => {
  const chips = [...document.querySelectorAll('button')].filter((b) =>
    b.textContent?.trim().startsWith('Gaming'),
  )
  chips[0]?.click()
  return { matches: chips.length, text: chips[0]?.textContent }
})
await new Promise((r) => setTimeout(r, 500))
const pressed = await page.evaluate(
  () =>
    [...document.querySelectorAll('button')]
      .find((b) => b.textContent?.trim().startsWith('Gaming'))
      ?.getAttribute('aria-pressed'),
)
const gamingCount = await cardCount()
check(
  'category filter works',
  gamingCount === 1,
  `${gamingCount} cards · matches=${chipInfo.matches} text="${chipInfo.text}" pressed=${pressed}`,
)

// --- Feed: playback, only-active-plays, scroll, keyboard --------------------
await page.goto(`${BASE}/library`, { waitUntil: 'networkidle2' })
await page.waitForSelector('article')
await page.evaluate(() => {
  const play = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Play all'))
  play.click()
})
await page.waitForSelector('video', { timeout: 15000 })
await new Promise((r) => setTimeout(r, 2500))

const state1 = await page.evaluate(() => {
  const vids = [...document.querySelectorAll('video')]
  return {
    mounted: vids.length,
    playing: vids.filter((v) => !v.paused).length,
    time: vids.find((v) => !v.paused)?.currentTime ?? 0,
    title: document.querySelector('section h2')?.textContent,
  }
})
check('feed mounts a windowed set of videos', state1.mounted <= 3 && state1.mounted >= 1, `${state1.mounted} <video> elements`)
check('exactly one video plays', state1.playing === 1, `${state1.playing} playing`)
check('active video advances', state1.time > 0.2, `t=${state1.time.toFixed(2)}`)

// --- Sustained playback: no stutter, no drift, no spurious pauses ------------
// Regression guard: progress saves used to change the video object identity,
// tearing down and restarting playback every few seconds.
const smooth = await page.evaluate(async () => {
  const element = [...document.querySelectorAll('video')].find((v) => !v.paused)
  if (!element) return { error: 'nothing playing' }
  element.loop = false
  // Rewind first and let the seek settle, so our own seek isn't measured.
  if (element.currentTime > 0.1) {
    const seeked = new Promise((r) => element.addEventListener('seeked', r, { once: true }))
    element.currentTime = 0
    await Promise.race([seeked, new Promise((r) => setTimeout(r, 1500))])
  }
  await new Promise((r) => setTimeout(r, 300))

  const events = { pause: 0, play: 0, seeking: 0, waiting: 0 }
  const count = (name) => element.addEventListener(name, () => (events[name] += 1))
  for (const name of Object.keys(events)) count(name)

  const started = performance.now()
  const from = element.currentTime
  await new Promise((r) => setTimeout(r, 6000))
  const wall = (performance.now() - started) / 1000
  const advanced = element.currentTime - from
  return { events, wall, advanced, rate: element.playbackRate, ended: element.ended }
})

check(
  'playback runs without spurious pauses or seeks',
  // `waiting` is reported but not asserted — it reflects decode/buffering, not our logic.
  smooth.events && smooth.events.pause === 0 && smooth.events.seeking === 0,
  JSON.stringify(smooth.events),
)
check(
  'playback keeps pace with wall clock',
  // Allow decode jitter, but catch both stalling and racing ahead.
  smooth.advanced > smooth.wall * 0.85 && smooth.advanced < smooth.wall * 1.15,
  `advanced ${smooth.advanced?.toFixed(2)}s over ${smooth.wall?.toFixed(2)}s wall (rate ${smooth.rate})`,
)

// Restore looping for the remaining checks.
await page.evaluate(() => {
  for (const v of document.querySelectorAll('video')) v.loop = true
})

// 20s soak across several progress-save cycles (saves fire every 5s). The
// identity-churn bug surfaced as a pause/play pair on each save.
const soak = await page.evaluate(async () => {
  const element = [...document.querySelectorAll('video')].find((v) => !v.paused)
  if (!element) return { error: 'nothing playing' }
  const events = { pause: 0, seeking: 0, stalled: 0 }
  for (const name of Object.keys(events)) {
    element.addEventListener(name, () => (events[name] += 1))
  }
  // Accumulate forward progress, treating loop wraps as expected.
  let advanced = 0
  let wraps = 0
  let last = element.currentTime
  const started = performance.now()
  await new Promise((resolve) => {
    const id = setInterval(() => {
      const now = element.currentTime
      if (now >= last) {
        advanced += now - last
      } else {
        advanced += now + (element.duration - last)
        wraps += 1
      }
      last = now
      if (performance.now() - started > 20000) {
        clearInterval(id)
        resolve()
      }
    }, 100)
  })
  return { events, advanced, wraps, wall: (performance.now() - started) / 1000 }
})

check(
  'sustained playback stays smooth across save cycles',
  // Looping legitimately fires one `seeking` per wrap; anything beyond that is ours.
  soak.events &&
    soak.events.pause === 0 &&
    soak.events.stalled === 0 &&
    soak.events.seeking <= soak.wraps,
  `${JSON.stringify(soak.events)} with ${soak.wraps} loop wraps over ${soak.wall?.toFixed(1)}s`,
)
check(
  'no drift over a long run',
  soak.advanced > soak.wall * 0.9 && soak.advanced < soak.wall * 1.1,
  `advanced ${soak.advanced?.toFixed(1)}s over ${soak.wall?.toFixed(1)}s wall`,
)

// Keyboard: space pauses
await page.keyboard.press('Space')
await new Promise((r) => setTimeout(r, 400))
const paused = await page.evaluate(() => [...document.querySelectorAll('video')].every((v) => v.paused))
check('space pauses playback', paused)
await page.keyboard.press('Space')
await new Promise((r) => setTimeout(r, 400))

// Keyboard: ArrowDown advances
const before = await page.evaluate(() => document.querySelector('[data-slide][aria-hidden="false"]')?.dataset.index ?? document.body.innerText.match(/\d+\/\d+/)?.[0])
await page.keyboard.press('ArrowDown')
await new Promise((r) => setTimeout(r, 1400))
const after = await page.evaluate(() => document.body.innerText.match(/\d+\/\d+/)?.[0])
check('arrow down advances the feed', before !== after, `${before} -> ${after}`)

const state2 = await page.evaluate(() => {
  const vids = [...document.querySelectorAll('video')]
  return { playing: vids.filter((v) => !v.paused).length, mounted: vids.length }
})
check('still exactly one video playing after scroll', state2.playing === 1, `${state2.playing} playing of ${state2.mounted}`)

// Favorite via keyboard
await page.keyboard.press('l')
await new Promise((r) => setTimeout(r, 600))
const favCount = await page.evaluate(async () => {
  const db = await new Promise((res) => {
    const req = indexedDB.open('hicup')
    req.onsuccess = () => res(req.result)
  })
  return new Promise((res) => {
    const tx = db.transaction('videos').objectStore('videos').getAll()
    tx.onsuccess = () => res(tx.result.filter((v) => v.favorite).length)
  })
})
check('L favorites the active video', favCount === 1, `${favCount} favorites in IndexedDB`)

// Mute toggle
const mutedBefore = await page.evaluate(() => document.querySelector('video').muted)
await page.keyboard.press('m')
await new Promise((r) => setTimeout(r, 300))
const mutedAfter = await page.evaluate(() => document.querySelector('video').muted)
check('M toggles mute', mutedBefore !== mutedAfter, `${mutedBefore} -> ${mutedAfter}`)

// Wheel scroll
await page.mouse.move(700, 450)
await page.mouse.wheel({ deltaY: 300 })
await new Promise((r) => setTimeout(r, 1400))
const afterWheel = await page.evaluate(() => document.body.innerText.match(/\d+\/\d+/)?.[0])
check('wheel advances one slide', afterWheel !== after, `${after} -> ${afterWheel}`)

// Progress persisted
await new Promise((r) => setTimeout(r, 2000))
await page.keyboard.press('Escape')
await new Promise((r) => setTimeout(r, 1200))
const progressSaved = await page.evaluate(async () => {
  const db = await new Promise((res) => {
    const req = indexedDB.open('hicup')
    req.onsuccess = () => res(req.result)
  })
  const [videos, history] = await Promise.all(
    ['videos', 'history'].map(
      (store) =>
        new Promise((res) => {
          const tx = db.transaction(store).objectStore(store).getAll()
          tx.onsuccess = () => res(tx.result)
        }),
    ),
  )
  return {
    withProgress: videos.filter((v) => v.watchProgress > 0 || v.completed).length,
    lastWatched: videos.filter((v) => v.lastWatched).length,
    history: history.length,
  }
})
check('playback progress is persisted', progressSaved.lastWatched > 0, JSON.stringify(progressSaved))
check('watch history recorded', progressSaved.history > 0, `${progressSaved.history} entries`)

// --- Resume where you left off ---------------------------------------------
// Seed a known mid-video position directly in storage, so this measures the
// cold-start read path (storage -> shelf -> feed) rather than playback timing.
const saved = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const req = indexedDB.open('hicup')
      req.onsuccess = () => {
        const store = req.result.transaction('videos', 'readwrite').objectStore('videos')
        store.getAll().onsuccess = (event) => {
          const video = event.target.result[0]
          const at = Math.min(1.2, video.duration * 0.4)
          store.put({ ...video, watchProgress: at, completed: false, lastWatched: Date.now() })
          resolve({ id: video.id, title: video.title, at, duration: video.duration })
        }
      }
    }),
)

await page.goto(BASE, { waitUntil: 'networkidle2' })
await page.waitForFunction(() => /continue watching/i.test(document.body.innerText), {
  timeout: 20000,
})
check('continue watching shelf appears', true, `${saved.title} at ${saved.at.toFixed(2)}s`)

await page.evaluate((title) => {
  const card = [...document.querySelectorAll('button')].find((b) =>
    b.getAttribute('aria-label')?.startsWith(`Resume ${title}`),
  )
  card.click()
}, saved.title)
await page.waitForSelector('video', { timeout: 15000 })
// Measure quickly: these clips are ~2s and loop, so a long wait wraps past the seek.
await new Promise((r) => setTimeout(r, 250))

const resumedAt = await page.evaluate(() => {
  const active = [...document.querySelectorAll('video')].find((v) => !v.paused) ?? document.querySelector('video')
  return active.currentTime
})
check(
  'resumes from the saved position',
  resumedAt >= saved.at - 0.2,
  `saved ${saved.at.toFixed(2)}s, resumed at ${resumedAt.toFixed(2)}s`,
)

// And the opposite setting: start from the beginning.
await page.keyboard.press('Escape')
await new Promise((r) => setTimeout(r, 800))
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('hicup.settings'))
  raw.state.resumePlayback = false
  localStorage.setItem('hicup.settings', JSON.stringify(raw))
})
await page.goto(BASE, { waitUntil: 'networkidle2' })
await page.waitForFunction(() => /continue watching/i.test(document.body.innerText), { timeout: 20000 })
await page.evaluate((title) => {
  ;[...document.querySelectorAll('button')]
    .find((b) => b.getAttribute('aria-label')?.startsWith(`Resume ${title}`))
    .click()
}, saved.title)
await page.waitForSelector('video', { timeout: 15000 })
await new Promise((r) => setTimeout(r, 250))
const restarted = await page.evaluate(() => {
  const active = [...document.querySelectorAll('video')].find((v) => !v.paused) ?? document.querySelector('video')
  return active.currentTime
})
check(
  'respects "always start from beginning"',
  restarted < saved.at,
  `resumed at ${restarted.toFixed(2)}s with resume disabled`,
)
await page.keyboard.press('Escape')
await new Promise((r) => setTimeout(r, 600))
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('hicup.settings'))
  raw.state.resumePlayback = true
  localStorage.setItem('hicup.settings', JSON.stringify(raw))
})

// --- Auto-scroll -------------------------------------------------------------
const setSetting = (key, value) =>
  page.evaluate(
    ({ key, value }) => {
      const raw = JSON.parse(localStorage.getItem('hicup.settings'))
      raw.state[key] = value
      localStorage.setItem('hicup.settings', JSON.stringify(raw))
    },
    { key, value },
  )

const playShortClipAndWait = async (ms) => {
  await page.goto(`${BASE}/library`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('article')
  // Start on a ~2s clip so a finish happens quickly.
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('button')].find((b) =>
      b.getAttribute('aria-label')?.startsWith('Play Deep Ocean'),
    )
    card.click()
  })
  await page.waitForSelector('video', { timeout: 15000 })
  const before = await page.evaluate(() => document.body.innerText.match(/\d+\/\d+/)?.[0])
  await new Promise((r) => setTimeout(r, ms))
  const after = await page.evaluate(() => document.body.innerText.match(/\d+\/\d+/)?.[0])
  return { before, after }
}

await setSetting('autoAdvance', true)
const auto = await playShortClipAndWait(5000)
check(
  'auto-scroll advances when a video finishes',
  auto.before !== auto.after,
  `${auto.before} -> ${auto.after}`,
)
const loopedOff = await page.evaluate(
  () => [...document.querySelectorAll('video')].every((v) => !v.loop),
)
check('auto-scroll overrides looping', loopedOff)

await page.keyboard.press('Escape')
await new Promise((r) => setTimeout(r, 600))
await setSetting('autoAdvance', false)
const manual = await playShortClipAndWait(5000)
check(
  'feed stays put when auto-scroll is off',
  manual.before === manual.after,
  `${manual.before} -> ${manual.after}`,
)
await page.keyboard.press('Escape')
await new Promise((r) => setTimeout(r, 600))

// --- History + Continue watching pages -------------------------------------
await page.goto(`${BASE}/history`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 500))
const historyText = await page.evaluate(() => document.body.innerText)
check('history page lists entries', /% watched/.test(historyText))

await page.goto(`${BASE}/favorites`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 400))
check('favorites page shows the favorite', (await page.$$('article')).length === 1)

// --- Collections ------------------------------------------------------------
await page.goto(`${BASE}/collections`, { waitUntil: 'networkidle2' })
await page.waitForFunction(() => /new collection/i.test(document.body.innerText), { timeout: 15000 })
await page.evaluate(() => {
  ;[...document.querySelectorAll('button')].find((b) => b.textContent?.includes('New collection')).click()
})
await page.waitForSelector('[role="dialog"] input')
await page.type('[role="dialog"] input', 'Study Break')
const dialogButtons = await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('[role="dialog"] button')]
  const create = buttons.find((b) => b.textContent?.trim() === 'Create')
  create?.click()
  return buttons.map((b) => `"${b.textContent?.trim()}"${b.disabled ? '(disabled)' : ''}`)
})
await new Promise((r) => setTimeout(r, 600))
check(
  'collection created',
  (await page.evaluate(() => document.body.innerText)).includes('Study Break'),
  dialogButtons.join(', '),
)

// --- Queue ------------------------------------------------------------------
await page.goto(`${BASE}/library`, { waitUntil: 'networkidle2' })
await page.waitForSelector('button[aria-label*="to queue"]')
await page.evaluate(() => {
  document.querySelector('button[aria-label*="to queue"]').click()
})
await page.goto(`${BASE}/queue`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 400))
check('queue holds the added video', !(await page.evaluate(() => document.body.innerText)).includes('Queue is empty'))

// --- Watch session ----------------------------------------------------------
await page.goto(BASE, { waitUntil: 'networkidle2' })
await page.waitForFunction(() => /start watching/i.test(document.body.innerText), { timeout: 15000 })
await page.evaluate(() => {
  ;[...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Start watching')).click()
})
await page.waitForSelector('[role="dialog"]')
await page.evaluate(() => {
  const input = document.querySelector('[role="dialog"] input[type="number"]')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, '1')
  input.dispatchEvent(new Event('input', { bubbles: true }))
})
await new Promise((r) => setTimeout(r, 300))
await page.evaluate(() => {
  ;[...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent?.startsWith('Start ·')).click()
})
await page.waitForSelector('video', { timeout: 15000 })
await new Promise((r) => setTimeout(r, 3000))
const timerVisible = await page.evaluate(() => /left/.test(document.body.innerText))
check('session timer visible in feed', timerVisible)

const remaining = await page.evaluate(() => JSON.parse(localStorage.getItem('hicup.session')).state.active.elapsedSeconds)
check('session accrues elapsed time', remaining >= 2, `${remaining}s elapsed`)

// --- Settings: export + reset ----------------------------------------------
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 400))
const settingsText = await page.evaluate(() => document.body.innerText)
check('settings shows storage usage', /videos ·/.test(settingsText) || /videos stored/.test(settingsText))

// Theme switch
await page.evaluate(() => {
  const select = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'light'))
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
  setter.call(select, 'light')
  select.dispatchEvent(new Event('change', { bubbles: true }))
})
await new Promise((r) => setTimeout(r, 400))
const themed = await page.evaluate(() => document.documentElement.dataset.theme)
check('light theme applies', themed === 'light', themed)

// --- Mobile viewport --------------------------------------------------------
const mobile = await browser.newPage()
await mobile.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
await mobile.goto(BASE, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 800))
const mobileOk = await mobile.evaluate(() => ({
  bottomNav: !!document.querySelector('nav'),
  overflowX: document.documentElement.scrollWidth <= window.innerWidth + 1,
}))
check('mobile bottom nav renders', mobileOk.bottomNav)
check('no horizontal overflow on mobile', mobileOk.overflowX)
await mobile.screenshot({ path: `${OUT}/mobile-home.png` })

await page.goto(BASE, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 600))
await page.screenshot({ path: `${OUT}/desktop-home.png` })

console.log(log.join('\n'))
console.log('\nERRORS:', errors.length ? errors.slice(0, 12).join('\n  ') : 'none')
console.log(`\n${log.filter((l) => l.startsWith('PASS')).length}/${log.length} checks passed`)

await browser.close()
