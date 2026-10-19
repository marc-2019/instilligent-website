/**
 * Consent gate for the GA4 tag.
 * Run: node --test tests/analytics_consent.test.mjs
 *
 * The site is static HTML, so these files are the pages that get deployed.
 * Pages must load /js/analytics.v2.js. The unversioned script URL must not
 * appear anywhere in the tree, because browsers may still have it cached.
 * The Google tag must not be injected unless stored consent is exactly "granted".
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')
const analyticsSrc = read('js/analytics.v2.js')

const PAGES = [
  'index.html',
  'pages/about.html',
  'pages/privacy.html',
  'pages/services.html',
]

const DISABLE_KEY = 'ga-disable-G-JCNLL09KHW'
const LEGACY_SCRIPT_URL = '/js/' + 'analytics.js'

const CSP = "Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com; connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://www.googletagmanager.com; frame-ancestors 'none'"

function htmlFiles() {
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (name.name === '.git' || name.name === 'node_modules') continue
      const p = join(dir, name.name)
      if (name.isDirectory()) walk(p)
      else if (name.name.endsWith('.html')) out.push(p.slice(root.length + 1))
    }
  }
  walk(root)
  return out.sort()
}

function createStorage(seed) {
  const data = Object.assign({}, seed)
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null
    },
    setItem(key, value) {
      data[key] = String(value)
    },
    snapshot() {
      return Object.assign({}, data)
    },
  }
}

function createDocument() {
  const listeners = {}
  const document = {
    readyState: 'complete',
    activeElement: null,
    head: null,
    body: null,
    documentElement: null,
    createElement: null,
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || []
      listeners[type].push(fn)
    },
    dispatch(type, event) {
      for (const fn of listeners[type] || []) fn(event)
    },
  }

  function makeEl(tag) {
    const el = {
      tagName: String(tag).toUpperCase(),
      id: '',
      className: '',
      hidden: false,
      textContent: '',
      type: '',
      src: '',
      async: false,
      href: '',
      children: [],
      attrs: {},
      style: {},
      _listeners: {},
      setAttribute(name, value) {
        this.attrs[name] = String(value)
        if (name === 'src') this.src = String(value)
        if (name === 'id') this.id = String(value)
        if (name === 'href') this.href = String(value)
      },
      getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null
      },
      appendChild(child) {
        this.children.push(child)
        child.parentNode = this
        return child
      },
      addEventListener(type, fn) {
        this._listeners[type] = this._listeners[type] || []
        this._listeners[type].push(fn)
      },
      focus() {
        document.activeElement = this
      },
    }
    return el
  }

  document.createElement = makeEl
  document.head = makeEl('head')
  document.body = makeEl('body')
  document.documentElement = makeEl('html')
  document.documentElement.appendChild(document.head)
  document.documentElement.appendChild(document.body)
  return document
}

function gaScripts(doc) {
  const found = []
  const walk = (el) => {
    if (!el || !el.children) return
    for (const child of el.children) {
      if (child.tagName === 'SCRIPT' && String(child.src).includes('googletagmanager.com/gtag/js')) {
        found.push(child)
      }
      walk(child)
    }
  }
  walk(doc.documentElement)
  return found
}

function boot(seed) {
  const storage = createStorage(seed)
  const document = createDocument()
  const windowListeners = {}
  const sandbox = {
    document,
    localStorage: storage,
    console,
    location: {
      reload() {
        sandbox._reloaded = (sandbox._reloaded || 0) + 1
      },
    },
    addEventListener(type, fn) {
      windowListeners[type] = windowListeners[type] || []
      windowListeners[type].push(fn)
    },
    dispatchWindow(type, event) {
      for (const fn of windowListeners[type] || []) fn(event)
    },
  }
  sandbox.window = sandbox
  vm.createContext(sandbox)
  vm.runInContext(analyticsSrc, sandbox, { filename: 'js/analytics.v2.js' })
  return { sandbox, document, storage }
}

function button(doc, choice) {
  let found = null
  const walk = (el) => {
    if (!el || !el.children) return
    for (const child of el.children) {
      if (child.getAttribute && child.getAttribute('data-analytics-choice') === choice) found = child
      walk(child)
    }
  }
  walk(doc.body)
  assert.ok(found, 'missing ' + choice + ' button')
  return found
}

function launcherOf(doc) {
  const el = doc.body.children.find((node) => node.id === 'analytics-consent-launcher')
  assert.ok(el, 'missing Analytics choices launcher')
  return el
}

function bannerOf(doc) {
  const el = doc.body.children.find((node) => node.id === 'analytics-consent')
  assert.ok(el, 'missing consent banner')
  return el
}

function statusText(doc) {
  let found = null
  const walk = (el) => {
    if (!el || !el.children) return
    for (const child of el.children) {
      if (child.id === 'analytics-consent-status') found = child
      walk(child)
    }
  }
  walk(doc.body)
  assert.ok(found, 'missing status')
  return found.textContent
}

function click(el) {
  for (const fn of el._listeners.click || []) fn({ preventDefault() {} })
}

function portfolioAnchor() {
  return {
    tagName: 'A',
    href: 'https://bossboard.instilligent.com',
    textContent: 'BossBoard',
    attributes: [
      { name: 'data-cf-event', value: 'portfolio_click' },
      { name: 'data-cf-product', value: 'bossboard' },
    ],
    getAttribute(name) {
      const attr = this.attributes.find((item) => item.name === name)
      return attr ? attr.value : null
    },
    closest(sel) {
      return sel === '[data-cf-event]' ? this : null
    },
  }
}

test('no HTML page contains a gtag script, inline gtag, or the old unconditional loaders', () => {
  const files = htmlFiles()
  assert.ok(files.includes('index.html'))
  assert.ok(files.includes('google9896ae5a7c94f3f5.html'))
  for (const file of files) {
    const html = read(file)
    assert.doesNotMatch(html, /googletagmanager\.com/i, file)
    assert.doesNotMatch(html, /google-analytics\.com/i, file)
    assert.doesNotMatch(html, /gtag\s*\(/i, file)
    assert.doesNotMatch(html, /G-JCNLL09KHW/, file)
    assert.doesNotMatch(html, /klaro/i, file)
    assert.doesNotMatch(html, /cookie-consent\.js/, file)
    assert.doesNotMatch(
      html,
      /<(?:link|script)[^>]*(?:googletagmanager|google-analytics)\.com/i,
      file
    )
  }
})

test('no file references the unversioned analytics script URL', () => {
  assert.equal(existsSync(join(root, 'js', 'analytics.js')), false)
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (name.name === '.git' || name.name === 'node_modules') continue
      const p = join(dir, name.name)
      if (name.isDirectory()) walk(p)
      else files.push(p)
    }
  }
  walk(root)
  for (const file of files) {
    if (/\.(png|jpg|jpeg|gif|webp|ico)$/i.test(file)) continue
    assert.equal(read(file.slice(root.length + 1)).includes(LEGACY_SCRIPT_URL), false, file)
  }
  for (const file of htmlFiles()) {
    assert.equal(read(file).includes(LEGACY_SCRIPT_URL), false, file)
  }
  for (const file of PAGES) {
    const html = read(file)
    const tags = html.match(/<script[^>]+src=["']\/js\/analytics\.v2\.js["'][^>]*>/g) || []
    assert.equal(tags.length, 1, file)
    assert.match(tags[0], /\sdefer\s/, file)
  }
  const verify = read('google9896ae5a7c94f3f5.html')
  assert.doesNotMatch(verify, /analytics/)
})

test('CSP is unchanged and still not loosened', () => {
  const headers = read('_headers')
  const lines = headers.split('\n').filter((line) => line.includes('Content-Security-Policy'))
  assert.deepEqual(lines, ['  ' + CSP])
})

test('gtag.js URL is assigned only after the grant check', () => {
  assert.equal((analyticsSrc.match(/googletagmanager\.com\/gtag\/js/g) || []).length, 1)
  assert.match(
    analyticsSrc,
    /function loadGa\(\) \{[\s\S]*?if \(storageGet\(\) !== "granted"\) return;[\s\S]*?script\.src = GA_SRC/
  )
  assert.match(analyticsSrc, /ga-disable-/)
  assert.match(analyticsSrc, /addEventListener\("storage", onStorage\)/)
  assert.doesNotMatch(analyticsSrc, /klaro/i)
  assert.doesNotMatch(analyticsSrc, /analytics_storage:\s*"denied"[\s\S]{0,80}googletagmanager/)
})

test('fresh visit does not inject gtag or create a dataLayer', () => {
  const { sandbox, document } = boot({})
  assert.equal(gaScripts(document).length, 0)
  assert.equal(sandbox.dataLayer, undefined)
  assert.equal(sandbox.gtag, undefined)
  assert.equal(sandbox[DISABLE_KEY], true)
  assert.equal(button(document, 'granted').textContent, 'Accept')
  assert.equal(button(document, 'denied').textContent, 'Decline')
  const banner = bannerOf(document)
  const launcher = launcherOf(document)
  assert.equal(banner.hidden, false)
  assert.equal(launcher.hidden, true)
})

test('decline stores denied, does not inject gtag, and focuses the launcher', () => {
  const { sandbox, document, storage } = boot({})
  click(button(document, 'denied'))
  assert.equal(storage.snapshot()['instilligent.analytics_consent'], 'denied')
  assert.equal(gaScripts(document).length, 0)
  assert.equal(sandbox.dataLayer, undefined)
  assert.equal(sandbox.gtag, undefined)
  assert.equal(sandbox[DISABLE_KEY], true)
  assert.equal(sandbox._reloaded, undefined)
  assert.equal(document.activeElement, launcherOf(document))
  assert.equal(launcherOf(document).hidden, false)
  assert.equal(statusText(document), 'Analytics is off. Accept to turn it on.')
})

test('values other than the exact grant do not load gtag or create a dataLayer', () => {
  for (const value of ['denied', 'true', '1', 'yes', 'GRANTED', 'granted ', 'allow', '']) {
    const { sandbox, document } = boot({ 'instilligent.analytics_consent': value })
    assert.equal(gaScripts(document).length, 0, JSON.stringify(value))
    assert.equal(sandbox.gtag, undefined, JSON.stringify(value))
    assert.equal(sandbox.dataLayer, undefined, JSON.stringify(value))
  }
})

test('accept injects gtag once, persists the grant, and focuses the launcher', () => {
  const { sandbox, document, storage } = boot({})
  click(button(document, 'granted'))
  assert.equal(document.activeElement, launcherOf(document))
  click(launcherOf(document))
  assert.equal(bannerOf(document).hidden, false)
  click(button(document, 'granted'))
  const scripts = gaScripts(document)
  assert.equal(scripts.length, 1)
  assert.equal(scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-JCNLL09KHW')
  assert.equal(scripts[0].async, true)
  assert.equal(storage.snapshot()['instilligent.analytics_consent'], 'granted')
  assert.equal(sandbox[DISABLE_KEY], false)
  const commands = Array.prototype.map.call(sandbox.dataLayer, (args) => args[0])
  assert.deepEqual(commands, ['consent', 'js', 'config'])
  assert.equal(sandbox.dataLayer[0][1], 'default')
  assert.equal(sandbox.dataLayer[0][2].analytics_storage, 'granted')
  assert.equal(sandbox.dataLayer[0][2].ad_storage, 'denied')
  assert.equal(sandbox.dataLayer[2][1], 'G-JCNLL09KHW')
  assert.equal(document.activeElement, launcherOf(document))
})

test('a stored grant loads gtag on the next page view; a stored decline does not', () => {
  const accepted = boot({ 'instilligent.analytics_consent': 'granted' })
  assert.equal(gaScripts(accepted.document).length, 1)
  assert.equal(bannerOf(accepted.document).hidden, true)
  assert.equal(accepted.sandbox[DISABLE_KEY], undefined)

  const declined = boot({ 'instilligent.analytics_consent': 'denied' })
  assert.equal(gaScripts(declined.document).length, 0)
  assert.equal(declined.sandbox.dataLayer, undefined)
  assert.equal(declined.sandbox[DISABLE_KEY], true)
  const launcher = launcherOf(declined.document)
  assert.equal(launcher.hidden, false)
  assert.equal(launcher.textContent, 'Analytics choices')
})

test('withdrawal through Analytics choices disables GA and reloads', () => {
  const first = boot({})
  click(button(first.document, 'granted'))
  assert.equal(gaScripts(first.document).length, 1)
  assert.equal(bannerOf(first.document).hidden, true)

  click(launcherOf(first.document))
  assert.equal(bannerOf(first.document).hidden, false)
  assert.equal(statusText(first.document), 'Analytics is on. Decline to turn it off.')
  click(button(first.document, 'denied'))

  assert.equal(first.storage.snapshot()['instilligent.analytics_consent'], 'denied')
  assert.equal(first.sandbox[DISABLE_KEY], true)
  assert.equal(first.sandbox._reloaded, 1)
  assert.equal(first.document.activeElement, launcherOf(first.document))
  const update = first.sandbox.dataLayer.find((args) => args[0] === 'consent' && args[1] === 'update')
  assert.ok(update)
  assert.equal(update[2].analytics_storage, 'denied')

  const before = first.sandbox.dataLayer.length
  first.document.dispatch('click', { target: portfolioAnchor() })
  assert.equal(first.sandbox.dataLayer.length, before)

  const next = boot(first.storage.snapshot())
  assert.equal(gaScripts(next.document).length, 0)
  assert.equal(next.sandbox.gtag, undefined)
  assert.equal(next.sandbox.dataLayer, undefined)
  assert.equal(next.sandbox[DISABLE_KEY], true)
})

test('a failed save on withdrawal still disables GA and does not claim it is off', () => {
  const env = boot({ 'instilligent.analytics_consent': 'granted' })
  assert.equal(gaScripts(env.document).length, 1)
  env.storage.setItem = () => {
    throw new Error('blocked')
  }
  click(launcherOf(env.document))
  click(button(env.document, 'denied'))

  assert.equal(env.storage.snapshot()['instilligent.analytics_consent'], 'granted')
  assert.equal(env.sandbox[DISABLE_KEY], true)
  assert.equal(env.sandbox._reloaded, undefined)
  const update = env.sandbox.dataLayer.find((args) => args[0] === 'consent' && args[1] === 'update')
  assert.ok(update)
  assert.equal(update[2].analytics_storage, 'denied')
  const status = statusText(env.document)
  assert.match(status, /did not save/)
  assert.match(status, /stopped in this tab/)
  assert.doesNotMatch(status, /Analytics is off/)
  assert.equal(bannerOf(env.document).hidden, false)

  const before = env.sandbox.dataLayer.length
  env.document.dispatch('click', { target: portfolioAnchor() })
  assert.equal(env.sandbox.dataLayer.length, before)
})

test('retrying decline after a failed save reloads once the save succeeds', () => {
  const env = boot({ 'instilligent.analytics_consent': 'granted' })
  const originalSet = env.storage.setItem
  env.storage.setItem = () => {
    throw new Error('blocked')
  }
  click(launcherOf(env.document))
  click(button(env.document, 'denied'))
  assert.equal(env.sandbox._reloaded, undefined)
  assert.equal(env.sandbox[DISABLE_KEY], true)
  assert.equal(env.storage.snapshot()['instilligent.analytics_consent'], 'granted')

  env.storage.setItem = originalSet
  click(button(env.document, 'denied'))
  assert.equal(env.storage.snapshot()['instilligent.analytics_consent'], 'denied')
  assert.equal(env.sandbox._reloaded, 1)
  assert.equal(env.sandbox[DISABLE_KEY], true)
})

test('a failed accept while GA is active does not say analytics stays off', () => {
  const env = boot({ 'instilligent.analytics_consent': 'granted' })
  assert.equal(gaScripts(env.document).length, 1)
  env.storage.setItem = () => {
    throw new Error('blocked')
  }
  click(launcherOf(env.document))
  click(button(env.document, 'granted'))
  const status = statusText(env.document)
  assert.match(status, /still on/)
  assert.doesNotMatch(status, /stays off/)
  assert.equal(env.sandbox[DISABLE_KEY] === true, false)
  assert.equal(gaScripts(env.document).length, 1)
  assert.equal(env.storage.snapshot()['instilligent.analytics_consent'], 'granted')
})

test('localStorage.clear() in another tab disables GA in this tab', () => {
  const env = boot({ 'instilligent.analytics_consent': 'granted' })
  assert.equal(gaScripts(env.document).length, 1)
  env.storage.getItem = () => null
  env.sandbox.dispatchWindow('storage', { key: null, newValue: null })
  assert.equal(env.sandbox[DISABLE_KEY], true)
  assert.equal(env.sandbox._reloaded, 1)
  const update = env.sandbox.dataLayer.find((args) => args[0] === 'consent' && args[1] === 'update')
  assert.ok(update)
  assert.equal(update[2].analytics_storage, 'denied')
})

test('a withdrawal in another tab disables GA in this tab', () => {
  const env = boot({ 'instilligent.analytics_consent': 'granted' })
  assert.equal(gaScripts(env.document).length, 1)
  env.storage.setItem('instilligent.analytics_consent', 'denied')
  env.sandbox.dispatchWindow('storage', {
    key: 'instilligent.analytics_consent',
    newValue: 'denied',
  })
  assert.equal(env.sandbox[DISABLE_KEY], true)
  assert.equal(env.sandbox._reloaded, 1)
  const update = env.sandbox.dataLayer.find((args) => args[0] === 'consent' && args[1] === 'update')
  assert.ok(update)
  assert.equal(update[2].analytics_storage, 'denied')

  env.sandbox.dispatchWindow('storage', {
    key: 'other',
    newValue: 'granted',
  })
  assert.equal(env.sandbox._reloaded, 1)
})

test('decline then accept on a page that never loaded GA still loads it', () => {
  const { sandbox, document, storage } = boot({})
  click(button(document, 'denied'))
  assert.equal(gaScripts(document).length, 0)
  click(launcherOf(document))
  click(button(document, 'granted'))
  assert.equal(storage.snapshot()['instilligent.analytics_consent'], 'granted')
  assert.equal(gaScripts(document).length, 1)
  assert.equal(sandbox[DISABLE_KEY], false)
  assert.equal(document.activeElement, launcherOf(document))
})

test('custom events are sent only while consent is granted', () => {
  const declined = boot({})
  click(button(declined.document, 'denied'))
  const anchor = portfolioAnchor()
  declined.document.dispatch('click', { target: anchor })
  assert.equal(declined.sandbox.dataLayer, undefined)

  const accepted = boot({ 'instilligent.analytics_consent': 'granted' })
  accepted.document.dispatch('click', { target: anchor })
  const events = accepted.sandbox.dataLayer.filter((args) => args[0] === 'event')
  assert.equal(events.length, 1)
  assert.equal(events[0][1], 'portfolio_click')
  assert.equal(events[0][2].product, 'bossboard')
  assert.equal(events[0][2].link_url, 'https://bossboard.instilligent.com')
})

test('a storage failure on accept does not load gtag', () => {
  const env = boot({})
  env.storage.setItem = () => {
    throw new Error('blocked')
  }
  click(button(env.document, 'granted'))
  assert.equal(gaScripts(env.document).length, 0)
  assert.equal(env.sandbox.gtag, undefined)
  assert.equal(env.sandbox.dataLayer, undefined)
  assert.match(statusText(env.document), /stays off/)
})
