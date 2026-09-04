// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'

describe('happy-dom', () => {
    it('supplies the DOM the painter needs', () => {
        const element = document.createElement('div')
        element.style.backgroundColor = 'rgb(255, 255, 255)'
        document.body.appendChild(element)

        expect(getComputedStyle(element).backgroundColor).toBe('rgb(255, 255, 255)')
        expect(typeof MutationObserver).toBe('function')
        expect(typeof requestAnimationFrame).toBe('function')
    })
})
