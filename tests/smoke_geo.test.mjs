/**
 * Crawl / entity smoke for instilligent.com
 * Run: node --test tests/smoke_geo.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isBlocked, PUBLIC_EXCLUDES } from '../functions/blocked-paths.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')

const SURFACES = [
  'index.html',
  'llms.txt',
  'pages/privacy.html',
  'pages/about.html',
  'pages/services.html',
]

test('NZBN 9429041896853 on every legal surface; old number gone', () => {
  for (const f of SURFACES) {
    const t = read(f)
    assert.match(t, /9429041896853/, f)
    assert.doesNotMatch(t, /9429051796284/, f)
  }
})

test('no banned compliant-with phrase on HTML/llms surfaces', () => {
  for (const f of SURFACES) {
    const t = read(f)
    assert.equal(/compliant with/i.test(t), false, f)
  }
})

test('robots.txt allows citation crawlers and blocks training ClaudeBot', () => {
  const r = read('robots.txt')
  assert.match(r, /User-agent: Claude-SearchBot\nAllow: \//)
  assert.match(r, /User-agent: Claude-User\nAllow: \//)
  assert.match(r, /User-agent: OAI-SearchBot\nAllow: \//)
  assert.match(r, /User-agent: ClaudeBot\nDisallow: \//)
  assert.doesNotMatch(r, /User-agent: ClaudeBot\nAllow: \//)
})

test('Open Graph set is complete', () => {
  const html = read('index.html')
  assert.match(html, /property="og:site_name"/)
  assert.match(html, /property="og:image:width" content="1200"/)
  assert.match(html, /property="og:image:height" content="630"/)
  assert.match(html, /property="og:url" content="https:\/\/instilligent.com\/"/)
})

test('og-image.png exists and is 1200x630', () => {
  const p = join(root, 'images/og-image.png')
  assert.equal(existsSync(p), true)
  const b = readFileSync(p)
  assert.equal(b[0], 0x89)
  const w = b.readUInt32BE(16)
  const h = b.readUInt32BE(20)
  assert.equal(w, 1200)
  assert.equal(h, 630)
})

test('marketing-truths.json still parses and records the NZBN claim', () => {
  const d = JSON.parse(read('marketing-truths.json'))
  assert.ok(Array.isArray(d.product_claims))
  const nzbn = d.product_claims.find((c) => c.id === 'instilligent.legal.nzbn')
  assert.ok(nzbn)
  assert.match(nzbn.claim, /9429041896853/)
})

const BANNED = [
  [/Southeast Asia/i, 'Southeast Asia'],
  [/\bAPAC\b/i, 'APAC'],
  [/Proven Track Record/i, 'Proven Track Record'],
  [/15\+\s*years/i, '15+ years'],
  [/enterprise-grade/i, 'enterprise-grade'],
  [/\bcertified\b/i, 'certified'],
  [/\bguaranteed\b/i, 'guaranteed'],
  [/\bISO\b/g, 'ISO'],
  [/SOC\s*2/i, 'SOC 2'],
  [/\bAML\b/g, 'AML'],
  [/\btrial\b/i, 'trial'],
]

// CodeHumanist and ProofOnce may still say AI-powered. That is a later
// surface and is noted, not removed, in this change.
function aiPoweredViolations(text) {
  const lines = text.split('\n')
  const hits = []
  for (let i = 0; i < lines.length; i++) {
    if (!/AI-powered/i.test(lines[i])) continue
    const window = lines.slice(Math.max(0, i - 6), i + 1).join('\n')
    if (!/CodeHumanist|ProofOnce/.test(window)) hits.push(`${i + 1}:${lines[i].trim()}`)
  }
  return hits
}

test('customer-facing copy has no banned phrases', () => {
  const files = [...SURFACES, '404.html']
  for (const f of files) {
    const text = read(f)
    for (const [re, label] of BANNED) {
      re.lastIndex = 0
      assert.equal(re.test(text), false, `${f} contains ${label}`)
    }
    const ai = aiPoweredViolations(text)
    assert.deepEqual(ai, [], `${f} AI-powered outside CodeHumanist/ProofOnce: ${ai.join(' | ')}`)
  }
})

test('BossBoard JSON-LD matches the invoicing description and has no price offer', () => {
  const html = read('index.html')
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))
  const list = blocks.find((b) => b['@type'] === 'ItemList')
  const bb = list.itemListElement.find((el) => el.item.name === 'BossBoard').item
  assert.equal(
    bb.description,
    'Invoicing, quotes and job records for NZ tradies, with 15% GST built in. Works on mobile and desktop.',
  )
  assert.equal(Object.hasOwn(bb, 'offers'), false)
  assert.doesNotMatch(bb.description, /AI-powered|SWMS|Mobile-first/i)
  assert.doesNotMatch(html, /Free during beta/i)
  assert.match(html, /From NZ\$29\/month/)
  assert.doesNotMatch(html, /Maritime Rules/)
  assert.doesNotMatch(html, /Why Work With Us|Our Technology Stack/)
})

function parseRedirects(text) {
  return text.split('\n').flatMap((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return []
    const parts = trimmed.split(/\s+/)
    return [{ source: parts[0], dest: parts[1], code: parts[2] || '302' }]
  })
}

function sourceMatches(source, pathname) {
  const body = source.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')
  return new RegExp(`^${body}$`).test(pathname)
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (name === '.git') continue
    const abs = join(dir, name)
    const st = statSync(abs)
    if (st.isDirectory()) out.push(...walk(abs))
    else out.push(relative(root, abs))
  }
  return out
}

const PUBLIC_PREFIXES = ['css/', 'js/', 'images/', 'pages/']
const PUBLIC_FILES = new Set([
  'index.html',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  'google9896ae5a7c94f3f5.html',
  '404.html',
])

function isPublicRepoFile(rel) {
  if (PUBLIC_FILES.has(rel)) return true
  return PUBLIC_PREFIXES.some((prefix) => rel.startsWith(prefix))
}

test('middleware blocks encoded internal paths and leaves site paths alone', () => {
  const blocked = [
    '/%2egitignore',
    '/%2Egitignore',
    '/%64ocs/marketing-audit.md',
    '/docs%2Fmarketing-audit.md',
    '/docs%2fmarketing-audit.md',
    '/%6Darketing-truths.json',
    '/DEPLOYMENT.md',
    '/%2564ocs/nested.md',
    '/marketing-truths.json',
    '/.secrets-baseline.json',
    '/.github/workflows/secret-scan.yml',
    '/tools/secret-scan-gate.py',
    '/e2e/production-smoke.sh',
    '/docs/marketing-audit-2026-08-30-moss-live-url.md',
  ]
  for (const url of blocked) assert.equal(isBlocked(url), true, url)
  for (const url of ['/', '/index.html', '/css/style.css', '/js/main.js', '/images/og-image.png', '/pages/about.html', '/pages/services.html', '/llms.txt', '/robots.txt', '/about', '/services', '/privacy', '/api/contact', '/404.html']) {
    assert.equal(isBlocked(url), false, url)
  }
})

test('_routes.json includes every path and excludes only the real site', () => {
  const routes = JSON.parse(read('_routes.json'))
  assert.deepEqual(routes.include, ['/*'])
  assert.deepEqual(routes.exclude, PUBLIC_EXCLUDES)
  const mw = read('functions/_middleware.ts')
  assert.match(mw, /decodeURIComponent|isBlocked/)
  assert.match(mw, /status:\s*404/)
  assert.match(read('functions/blocked-paths.js'), /decodeURIComponent/)
  assert.match(read('functions/blocked-paths.js'), /toLowerCase/)
})

test('_redirects still covers non-site files as interim', () => {
  const rules = parseRedirects(read('_redirects'))
  const blockRules = rules.filter((rule) => rule.dest === '/404.html')
  const VALID = new Set(['200', '301', '302', '303', '307', '308'])
  for (const rel of walk(root)) {
    const url = `/${rel.split('\\').join('/')}`
    if (isPublicRepoFile(rel)) {
      assert.equal(isBlocked(url), false, `public file blocked: ${url}`)
      assert.equal(blockRules.some((rule) => sourceMatches(rule.source, url)), false, `public file redirected: ${url}`)
      continue
    }
    assert.equal(isBlocked(url), true, url)
    const matched = blockRules.filter((rule) => sourceMatches(rule.source, url))
    assert.ok(matched.some((rule) => rule.code === '404'), `no 404 rule for ${url}`)
    assert.ok(matched.some((rule) => VALID.has(rule.code)), `no Pages-valid redirect for ${url}`)
  }
})
