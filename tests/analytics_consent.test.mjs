/**
 * Consent gate for the GA4 tag.
 * Run: node --test tests/analytics_consent.test.mjs
 *
 * The site is static HTML, so these files are the pages that get deployed.
 * The Google tag must not appear in any page, and js/analytics.js must not
 * inject googletagmanager.com/gtag/js unless stored consent is exactly "granted".
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')
const analyticsSrc = read('js/analytics.js')

const PAGES = [
  'index.html',
  'pages/about.html',
  'pages/privacy.html',
  'pages/services.html',
]

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
      focus() {},
    }
    return el
  }

  const document = {
    readyState: 'complete',
    head: makeEl('head'),
    body: makeEl('body'),
    documentElement: makeEl('html'),
    createElement: makeEl,
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || []
      listeners[type].push(fn)
    },
    dispatch(type, event) {
      for (const fn of listeners[type] || []) fn(event)
    },
  }
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
  const sandbox = {
    document,
    localStorage: storage,
    console,
  }
  sandbox.window = sandbox
  vm.createContext(sandbox)
  vm.runInContext(analyticsSrc, sandbox, { filename: 'js/analytics.js' })
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

function click(el) {
  for (const fn of el._listeners.click || []) fn({ preventDefault() {} })
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

test('every visitor page loads the gated analytics script once', () => {
  for (const file of PAGES) {
    const html = read(file)
    const tags = html.match(/<script[^>]+src=["']\/js\/analytics\.js["'][^>]*>/g) || []
    assert.equal(tags.length, 1, file)
    assert.match(tags[0], /\sdefer\s/, file + ' must defer the gate so it cannot block as a sync head tag')
  }
  const verify = read('google9896ae5a7c94f3f5.html')
  assert.doesNotMatch(verify, /analytics\.js/)
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
  assert.doesNotMatch(analyticsSrc, /klaro/i)
  assert.doesNotMatch(analyticsSrc, /analytics_storage:\s*"denied"[\s\S]{0,80}googletagmanager/)
})

test('fresh visit does not inject gtag or create a dataLayer', () => {
  const { sandbox, document } = boot({})
  assert.equal(gaScripts(document).length, 0)
  assert.equal(sandbox.dataLayer, undefined)
  assert.equal(sandbox.gtag, undefined)
  assert.equal(button(document, 'granted').textContent, 'Accept')
  assert.equal(button(document, 'denied').textContent, 'Decline')
  const banner = document.body.children.find((el) => el.id === 'analytics-consent')
  const launcher = document.body.children.find((el) => el.id === 'analytics-consent-launcher')
  assert.equal(banner.hidden, false)
  assert.equal(launcher.hidden, true)
})

test('decline stores denied and does not inject gtag', () => {
  const { sandbox, document, storage } = boot({})
  click(button(document, 'denied'))
  assert.equal(storage.snapshot()['instilligent.analytics_consent'], 'denied')
  assert.equal(gaScripts(document).length, 0)
  assert.equal(sandbox.dataLayer, undefined)
  assert.equal(sandbox.gtag, undefined)
})

test('values other than the exact grant do not load gtag', () => {
  for (const value of ['denied', 'true', '1', 'yes', 'GRANTED', 'granted ', 'allow', '']) {
    const { sandbox, document } = boot({ 'instilligent.analytics_consent': value })
    assert.equal(gaScripts(document).length, 0, JSON.stringify(value))
    assert.equal(sandbox.gtag, undefined, JSON.stringify(value))
  }
})

test('accept injects gtag once and persists the grant', () => {
  const { sandbox, document, storage } = boot({})
  click(button(document, 'granted'))
  click(button(document, 'granted'))
  const scripts = gaScripts(document)
  assert.equal(scripts.length, 1)
  assert.equal(scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-JCNLL09KHW')
  assert.equal(scripts[0].async, true)
  assert.equal(storage.snapshot()['instilligent.analytics_consent'], 'granted')
  const commands = Array.prototype.map.call(sandbox.dataLayer, (args) => args[0])
  assert.deepEqual(commands, ['consent', 'js', 'config'])
  assert.equal(sandbox.dataLayer[0][1], 'default')
  assert.equal(sandbox.dataLayer[0][2].analytics_storage, 'granted')
  assert.equal(sandbox.dataLayer[0][2].ad_storage, 'denied')
  assert.equal(sandbox.dataLayer[2][1], 'G-JCNLL09KHW')
})

test('a stored grant loads gtag on the next page view; a stored decline does not', () => {
  const accepted = boot({ 'instilligent.analytics_consent': 'granted' })
  assert.equal(gaScripts(accepted.document).length, 1)
  assert.equal(accepted.document.body.children.find((el) => el.id === 'analytics-consent').hidden, true)

  const declined = boot({ 'instilligent.analytics_consent': 'denied' })
  assert.equal(gaScripts(declined.document).length, 0)
  assert.equal(declined.sandbox.dataLayer, undefined)
  const launcher = declined.document.body.children.find((el) => el.id === 'analytics-consent-launcher')
  assert.equal(launcher.hidden, false)
  assert.equal(launcher.textContent, 'Analytics choices')
})

test('withdrawal keeps gtag off on the next page view', () => {
  const first = boot({})
  click(button(first.document, 'granted'))
  assert.equal(gaScripts(first.document).length, 1)

  click(button(first.document, 'denied'))
  assert.equal(first.storage.snapshot()['instilligent.analytics_consent'], 'denied')
  const update = first.sandbox.dataLayer.find((args) => args[0] === 'consent' && args[1] === 'update')
  assert.ok(update)
  assert.equal(update[2].analytics_storage, 'denied')

  const next = boot(first.storage.snapshot())
  assert.equal(gaScripts(next.document).length, 0)
  assert.equal(next.sandbox.gtag, undefined)
})

test('re-accept after withdrawal on the same page resumes consent without a second script', () => {
  const { sandbox, document } = boot({})
  click(button(document, 'granted'))
  click(button(document, 'denied'))
  click(button(document, 'granted'))
  assert.equal(gaScripts(document).length, 1)
  const updates = sandbox.dataLayer.filter((args) => args[0] === 'consent' && args[1] === 'update')
  assert.equal(updates.length, 2)
  assert.equal(updates[1][2].analytics_storage, 'granted')
})

test('custom events are sent only while consent is granted', () => {
  const declined = boot({})
  click(button(declined.document, 'denied'))
  const anchor = {
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

test('a storage failure does not load gtag', () => {
  const storage = createStorage({})
  storage.setItem = () => {
    throw new Error('blocked')
  }
  const document = createDocument()
  const sandbox = { document, localStorage: storage, console }
  sandbox.window = sandbox
  vm.createContext(sandbox)
  vm.runInContext(analyticsSrc, sandbox, { filename: 'js/analytics.js' })
  click(button(document, 'granted'))
  assert.equal(gaScripts(document).length, 0)
  assert.equal(sandbox.gtag, undefined)
})
