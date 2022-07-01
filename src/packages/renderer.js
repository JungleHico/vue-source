import {
  createComponentInstance,
  setupComponent,
  hasPropsChanged,
  setupRenderEffect
} from './component'

export function h(type, props, children) {
  return {
    type,
    props,
    children
  }
}

// 挂载与更新节点
export function patch(n1, n2, container, anchor = null) {
  if (n1 === n2) {
    return
  }

  // 如果节点类型不一致，卸载之前的节点
  if (n1 && n1.type !== n2.type) {
    unmount(n1)
    n1 = null
  }

  const { type } = n2
  if (typeof type === 'string') {
    processElement(n1, n2, container, anchor)
  } else if (typeof type === 'object') {
    processComponent(n1, n2, container)
  }
}

function processElement(n1, n2, container, anchor = null) {
  if (n1 === null) {
    // 挂载节点
    mountElement(n2, container, anchor)
  } else {
    // 更新节点
    patchElement(n1, n2)
  }
}

function processComponent(n1, n2, container) {
  if (n1 === null) {
    // 挂载组件
    mountComponent(n2, container)
  } else {
    // 更新
    patchComponent(n1, n2)
  }
}

function mountElement(vnode, container, anchor = null) {
  const el = (vnode.el = document.createElement(vnode.type)) // 让vnode记录真实dom，用于更新

  // props
  const { props } = vnode
  if (props) {
    for (const key in props) {
      patchProp(el, key, null, props[key])
    }
  }

  // children
  if (typeof vnode.children === 'string') {
    // 文本节点
    el.textContent = vnode.children
  } else if (Array.isArray(vnode.children)) {
    // 递归挂载子节点
    vnode.children.forEach(child => {
      mountElement(child, el)
    })
  }

  // container.appendChild(el)
  container.insertBefore(el, anchor)
}

function patchElement(n1, n2) {
  const el = (n2.el = n1.el)

  // 更新props
  patchProps(n1, n2, el)

  // 更新子节点
  patchChildren(n1, n2, el)
}

function patchProps(n1, n2, el) {
  const oldProps = n1.props || {}
  const newProps = n2.props || {}

  for (const key in newProps) {
    const prev = oldProps[key]
    const next = newProps[key]
    if (prev !== next) {
      patchProp(el, key, prev, next)
    }
  }
  for (const key in oldProps) {
    if (!(key in newProps)) {
      // 移除旧prop
      patchProp(el, key, oldProps[key], null)
    }
  }
}

function patchProp(el, key, prevValue, nextValue) {
  if (key.startsWith('on')) {
    // 更新事件
    patchEvent(el, key, prevValue, nextValue)
  } else {
    // 更新属性
    patchAttr(el, key, nextValue)
  }
}

function patchEvent(el, key, prevValue, nextValue) {
  const eventName = key.slice(2).toLowerCase()
  if (prevValue) {
    // 移除旧事件
    el.removeEventListener(eventName, prevValue)
  }
  if (nextValue) {
    el.addEventListener(eventName, nextValue)
  }
}

function patchAttr(el, key, value) {
  if (value === null) {
    // 移除旧属性
    el.removeAttribute(key)
  } else {
    el.setAttribute(key, value)
  }
}

function patchChildren(n1, n2, container) {
  const c1 = n1.children
  const c2 = n2.children

  if (typeof c2 === 'string') {
    // 新子节点是文本
    // 旧子节点是数组，逐个销毁
    if (Array.isArray(c1)) {
      c1.forEach(child => unmount(child))
    }
    container.textContent = c2
  } else {
    // 新子节点是数组
    if (Array.isArray(c1)) {
      diff(c1, c2, container)
    } else {
      // 新子节点是数组，旧子节点是文本，清空
      container.innerHTML = ''
      c2.forEach(child => mountElement(child, container))
    }
  }
}

// Diff
function diff(c1, c2, container) {
  if (c1.every(vnode => 'key' in vnode)) {
    // 基于 key
    patchKeyedChildren(c1, c2, container)
  } else {
    // 没有 key
    patchUnkeyedChildren(c1, c2, container)
  }
}

function patchKeyedChildren(c1, c2, container) {
  let lastIndex = 0
  for (let i = 0; i < c2.length; i++) {
    const newVNode = c2[i]
    let find = false
    for (let j = 0; j < c1.length; j++) {
      const oldVNode = c1[j]
      if (newVNode.key === oldVNode.key) {
        find = true
        patch(oldVNode, newVNode, container)
        if (j < lastIndex) {
          // 索引值小于 lastIndex，需要移动
          const prevVNode = c2[i - 1]
          if (prevVNode) {
            // 移动到上一个子节点后面
            const anchor = prevVNode.el.nextSibling
            container.insertBefore(newVNode.el, anchor)
          }
        } else {
          lastIndex = j
        }
        break
      }
    }

    if (!find) {
      // 添加新节点
      let anchor = null
      const prevVNode = c2[i - 1]
      if (prevVNode) {
        anchor = prevVNode.el.nextSibling
      } else {
        anchor = container.firstChild
      }
      patch(null, newVNode, container, anchor)
    }
  }

  for (let i = 0; i < c1.length; i++) {
    const oldVNode = c1[i]
    const has = c2.find(newVNode => newVNode.key === oldVNode.key)
    if (!has) {
      unmount(oldVNode)
    }
  }
}

function patchUnkeyedChildren(c1, c2, container) {
  const oldLength = c1.length
  const newLength = c2.length
  const commonLength = Math.min(oldLength, newLength)
  for (let i = 0; i < commonLength; i++) {
    patch(c1[i], c2[i], container)
  }
  if (oldLength > newLength) {
    // 移除旧子节点
    for (let i = commonLength; i < oldLength; i++) {
      unmount(c1[i])
    }
  } else {
    // 添加新子节点
    for (let i = commonLength; i < newLength; i++) {
      patch(null, c2[i], container)
    }
  }
}

function unmount(vnode) {
  const parent = vnode.el.parentNode
  if (parent) {
    parent.removeChild(vnode.el)
  }
}

function mountComponent(vnode, container) {
  // 组件实例
  const instance = createComponentInstance(vnode)
  vnode.component = instance // 保存组件实例，便于更新

  // 初始化组件
  setupComponent(instance)

  // 设置组件副作用函数，状态修改时自更新
  setupRenderEffect(instance, vnode, container)
}

function patchComponent(n1, n2) {
  const instance = (n2.component = n1.component)
  // 判断 props 是否发生变化
  if (hasPropsChanged(n1.props, n2.props)) {
    // 更新 props
    for (const key in n2.props) {
      if (key in instance.propsOptions) {
        instance.props[key] = n2.props[key]
      }
    }
  }
}
