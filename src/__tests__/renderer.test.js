import { h, patch } from '../packages/renderer'

describe('renderer', () => {
  it('mountElement', () => {
    const container = document.createElement('div')
    const vnode = h('div', { class: 'node' }, 'text')

    patch(null, vnode, container)
    expect(container.innerHTML).toBe('<div class="node">text</div>')
  })

  it('patchElement: patchProps', () => {
    const container = document.createElement('div')
    let eventMsg = ''
    const vnode1 = h(
      'div',
      {
        class: 'node1',
        onClick: () => {
          eventMsg = 'node1 clicked'
        }
      },
      'text'
    )
    const vnode2 = h(
      'div',
      {
        class: 'node2',
        onClick: () => {
          eventMsg = 'node2 clicked'
        }
      },
      'text'
    )

    patch(null, vnode1, container)
    const child = container.children[0]
    expect(child.className).toBe('node1')
    child.click()
    expect(eventMsg).toBe('node1 clicked')

    patch(vnode1, vnode2)
    expect(child.className).toBe('node2')
    child.click()
    expect(eventMsg).toBe('node2 clicked')
  })

  it('text children -> array children', () => {
    const container = document.createElement('div')
    const vnode1 = h('div', null, 'text children')
    const vnode2 = h('div', null, [h('div', null, 'array children')])

    patch(null, vnode1, container)
    expect(container.innerHTML).toBe('<div>text children</div>')

    patch(vnode1, vnode2)
    expect(container.innerHTML).toBe('<div><div>array children</div></div>')
  })

  it('array children -> text children', () => {
    const container = document.createElement('div')
    const vnode1 = h('div', null, [h('div', null, 'array children')])
    const vnode2 = h('div', null, 'text children')

    patch(null, vnode1, container)
    expect(container.innerHTML).toBe('<div><div>array children</div></div>')

    patch(vnode1, vnode2)
    expect(container.innerHTML).toBe('<div>text children</div>')
  })

  it('patchUnkeyedChildren', () => {
    const container = document.createElement('div')
    const vnode1 = {
      type: 'div',
      children: [
        { type: 'span', children: '1' },
        { type: 'span', children: '2' }
      ]
    }
    const vnode2 = {
      type: 'div',
      children: [{ type: 'span', children: '3' }]
    }
    const vnode3 = {
      type: 'div',
      children: [
        { type: 'span', children: '4' },
        { type: 'span', children: '5' }
      ]
    }

    patch(null, vnode1, container)
    expect(container.innerHTML).toBe('<div><span>1</span><span>2</span></div>')

    patch(vnode1, vnode2)
    expect(container.innerHTML).toBe('<div><span>3</span></div>')

    patch(vnode2, vnode3)
    expect(container.innerHTML).toBe('<div><span>4</span><span>5</span></div>')
  })

  it('patchKeyedChildren', () => {
    const container = document.createElement('div')
    const vnode1 = {
      type: 'div',
      children: [
        { type: 'div', children: '1', key: 1 },
        { type: 'p', children: '2', key: 2 },
        { type: 'span', children: '3', key: 3 }
      ]
    }
    const vnode2 = {
      type: 'div',
      children: [
        { type: 'span', children: '3', key: 3 },
        { type: 'div', children: '1', key: 1 },
        { type: 'p', children: '2', key: 2 },
        { type: 'div', children: '4', key: 4 }
      ]
    }

    patch(null, vnode1, container)
    expect(container.innerHTML).toBe(
      '<div><div>1</div><p>2</p><span>3</span></div>'
    )

    patch(vnode1, vnode2, container)
    expect(container.innerHTML).toBe(
      '<div><span>3</span><div>1</div><p>2</p><div>4</div></div>'
    )
  })
})
