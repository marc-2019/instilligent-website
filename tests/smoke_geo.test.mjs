/**
 * Crawl / entity smoke for instilligent.com
 * Run: node --test tests/smoke_geo.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

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
