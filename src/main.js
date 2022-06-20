import { reactive, effect } from './packages/reative'
import { h, patch } from './packages/renderer'

// reactive
// const obj = reactive({ text: 'Hello world' })
// effect(() => {
//   document.querySelector('#app').innerText = obj.text
// })
// setTimeout(() => {
//   obj.text = 'Hello Vue3'
// }, 2000)

// renderer
const container = document.querySelector('#app')
const vnode1 = h('div', { style: 'color: red;' }, 'text')
patch(null, vnode1, container)
setTimeout(() => {
  const vnode2 = h('div', { style: 'color: green;' }, [
    h('div', null, 'text1'),
    h('div', null, 'text2')
  ])
  patch(vnode1, vnode2, container)
}, 2000)
