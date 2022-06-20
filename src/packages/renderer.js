export function h(type, props, children) {
  return {
    type,
    props,
    children
  }
}

// 挂载与更新节点
export function patch(n1, n2, container) {
  if (n1 === n2) {
    return
  }

  // 如果节点类型不一致，卸载之前的节点
  if (n1 && n1.type !== n2.type) {
    unmount(n1)
    n1 = null
  }

  if (n1 === null) {
    // 挂载节点
    mountElement(n2, container)
  } else {
    // 更新节点
    patchElement(n1, n2)
  }
}

function mountElement(vnode, container) {
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

  container.appendChild(el)
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
    container.textContent = c1
  } else {
    // 新子节点是数组
    if (Array.isArray(c1)) {
      // 新旧子节点都是数组，Diff
      c1.forEach(child => unmount(child))
      c2.forEach(child => mountElement(child, container))
    } else {
      // 新子节点是数组，旧子节点是文本，清空
      container.innerHTML = ''
      c2.forEach(child => mountElement(child, container))
    }
  }
}

function unmount(vnode) {
  const parent = vnode.el.parentNode
  if (parent) {
    parent.removeChild(vnode.el)
  }
}
