import { reactive, effect } from './packages/reative'
import { h, patch } from './packages/renderer'
import { onBeforeMount, onMounted } from './packages/apiLifecircle'

// reactive
// const obj = reactive({ text: 'Hello World' })
// effect(() => {
//   document.querySelector('#app').innerText = obj.text
// })
// setTimeout(() => {
//   obj.text = 'Hello Vue3'
// }, 2000)

// renderer
// const container = document.querySelector('#app')
// const vnode1 = h('div', { style: 'color: red;' }, 'text')
// patch(null, vnode1, container)
// setTimeout(() => {
//   const vnode2 = h('div', { style: 'color: green;' }, [
//     h('div', null, 'text1'),
//     h('div', null, 'text2')
//   ])
//   patch(vnode1, vnode2, container)
// }, 2000)

// diff
const oldVNode = {
  type: 'div',
  children: [
    { type: 'div', children: '1', key: 1 },
    { type: 'p', children: '2', key: 2 },
    { type: 'span', children: '3', key: 3 }
  ]
}

const newVNode = {
  type: 'div',
  children: [
    { type: 'span', children: '3', key: 3 },
    { type: 'div', children: '1', key: 1 },
    { type: 'p', children: '2', key: 2 }
  ]
}
const container = document.querySelector('#app')
patch(null, oldVNode, container)
setTimeout(() => {
  patch(oldVNode, newVNode, container)
}, 2000)

// component data & props
// const MyComponent = {
//   name: 'MyComponent',
//   props: {
//     msg: String
//   },
//   data() {
//     return {
//       title: 'Hello Component'
//     }
//   },
//   render() {
//     return h(
//       'div',
//       {
//         onClick: () => {
//           this.title = 'Component state updated'
//         }
//       },
//       [h('div', null, `${this.title}`), h('div', null, `${this.msg}`)]
//     )
//   }
// }
// const container = document.querySelector('#app')
// const vnode = h(MyComponent, { msg: 'Hello Props' }, null)
// patch(null, vnode, container)
// setTimeout(() => {
//   const vnode2 = h(MyComponent, { msg: 'Props updated' }, null)
//   patch(vnode, vnode2, container)
// }, 2000)

// component setup
// const MyComponent = {
//   setup(props, { emit }) {
//     onBeforeMount(() => {
//       console.log('onBeforeMount')
//     })
//     onMounted(() => {
//       console.log('onMounted')
//     })

//     emit('create', true)

//     const person = reactive({
//       name: 'Tom'
//     })

//     return {
//       person
//     }
//   },
//   render() {
//     return h('div', null, `${this.person.name}`)
//   }
// }
// const vnode = h(
//   MyComponent,
//   {
//     onCreate: value => {
//       console.log(value)
//     }
//   },
//   null
// )
// patch(null, vnode, document.querySelector('#app'))
