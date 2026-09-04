import { describe, expect, it } from 'vitest'

describe('the test runner', () => {
    it('runs in a plain node environment by default', () => {
        expect(typeof globalThis.document).toBe('undefined')
    })
})
