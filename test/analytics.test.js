import { test } from 'node:test'
import assert from 'node:assert/strict'

import { analyticsTag } from '../src/analytics.js'

test('juniq.im 의 다른 사이트와 같은 GA4 측정 ID 로 센다', () => {
  assert.match(analyticsTag, /gtag\/js\?id=G-T12BGYGXSG/)
  assert.match(analyticsTag, /gtag\('config','G-T12BGYGXSG'\)/)
})
