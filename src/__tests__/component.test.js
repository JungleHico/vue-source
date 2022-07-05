import { onBeforeMount, onMounted } from '../packages/apiLifecircle'
import { reactive } from '../packages/reative'
import { h, patch } from '../packages/renderer'

describe('component', () => {
  it('component data', () => {
    const container = document.createElement('div')
    const MyComponent = {
      data() {
        return {
          title: 'Hello Component'
        }
      },
      render() {
        return h(
          'div',
          {
            onClick: () => {
              this.title = 'Component state updated'
            }
          },
          `${this.title}`
        )
      }
    }
    const vnode = { type: MyComponent }

    patch(null, vnode, container)
    expect(container.innerHTML).toBe('<div>Hello Component</div>')

    container.children[0].click()
    expect(container.innerHTML).toBe('<div>Component state updated</div>')
  })

  it('component props', () => {
    const container = document.createElement('div')
    const MyComponent = {
      props: {
        msg: String
      },
      data() {
        return {}
      },
      render() {
        return h('div', null, `${this.msg}`)
      }
    }
    const vnode1 = { type: MyComponent, props: { msg: 'Hello Props' } }
    const vnode2 = { type: MyComponent, props: { msg: 'Props updated' } }

    patch(null, vnode1, container)
    expect(container.innerHTML).toBe('<div>Hello Props</div>')

    patch(vnode1, vnode2)
    expect(container.innerHTML).toBe('<div>Props updated</div>')
  })

  it('setup', () => {
    const container = document.createElement('div')
    const MyComponent = {
      setup() {
        const person = reactive({
          name: 'Tom'
        })

        return {
          person
        }
      },
      render() {
        return h('div', null, `${this.person.name}`)
      }
    }
    const vnode = { type: MyComponent }

    patch(null, vnode, container)
    expect(container.innerHTML).toBe('<div>Tom</div>')
  })

  it('setup emit', () => {
    const container = document.createElement('div')
    let msg = ''
    const MyComponent = {
      setup(props, { emit }) {
        emit('create', true)
      },
      render() {
        return h('div', null, '')
      }
    }
    const vnode = {
      type: MyComponent,
      props: {
        onCreate: value => {
          msg = value
        }
      }
    }

    patch(null, vnode, container)
    expect(msg).toBe(true)
  })

  it('setup lifecircle', () => {
    const container = document.createElement('div')
    let beforeMountMsg = ''
    let mountedMsg = ''
    const MyComponent = {
      setup() {
        onBeforeMount(() => {
          beforeMountMsg = 'onBeforeMount'
        })
        onMounted(() => {
          mountedMsg = 'onMounted'
        })
      },
      render() {
        return h('div', null, null)
      }
    }
    const vnode = { type: MyComponent }

    patch(null, vnode, container)
    expect(beforeMountMsg).toBe('onBeforeMount')
    expect(mountedMsg).toBe('onMounted')
  })
})
