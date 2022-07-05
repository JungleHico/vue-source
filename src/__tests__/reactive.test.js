import { reactive, effect } from '../packages/reative'

describe('reactivity', () => {
  it('reactive', () => {
    const app = document.createElement('div')

    const obj = reactive({ text: 'Hello World' })
    expect(obj).toEqual({ text: 'Hello World' })

    effect(() => {
      app.innerText = obj.text
    })
    expect(app.innerText).toBe('Hello World')

    obj.text = 'Hello Vue3'
    expect(app.innerText).toBe('Hello Vue3')
  })
})
