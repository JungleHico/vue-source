import { effect, reactive } from './reative'
import { patch } from './renderer'
import {
  setCurrentInstance,
  unsetCurrentInstance,
  invokeHook
} from './apiLifecircle'

// 创建组件实例
export function createComponentInstance(vnode) {
  const Component = vnode.type

  const instance = {
    vnode,
    type: Component,
    subTree: null, // 组件渲染内容

    propsOptions: Component.props || {},

    // emit
    emit: null,

    // state
    data: {},
    props: {},
    attrs: {},
    setupState: {},

    // lifecircle
    isMounted: false, // 组件是否已被挂载
    beforeMount: null,
    mounted: null,
    beforeUpdate: null,
    updated: null
  }

  instance.emit = emit.bind(null, instance)

  return instance
}

function emit(instance, event, ...args) {
  const handlerName = `on${event[0].toUpperCase()}${event.slice(1)}`
  const handler = instance.vnode.props[handlerName]
  if (handler) {
    handler(...args)
  }
}

// 组件初始化
export function setupComponent(instance) {
  const { props } = instance.vnode

  initProps(instance, props)

  setupStatefulComponent(instance)
}

function setupStatefulComponent(instance) {
  const Component = instance.type

  createInstanceProxy(instance)

  const { setup } = Component
  if (setup) {
    const setupContext = createSetupContext(instance)
    setCurrentInstance(instance)
    const setupResult = setup(instance.props, setupContext)
    unsetCurrentInstance()
    instance.setupState = setupResult
  }
  finishComponentSetup(instance)
}

function createSetupContext(instance) {
  return {
    attrs: instance.attrs,
    emit: instance.emit
  }
}

function finishComponentSetup(instance) {
  // Vue 2 组件选项
  applyOptions(instance)
}

function applyOptions(instance) {
  const { data: dataOptions } = instance.type
  if (dataOptions) {
    instance.data = reactive(dataOptions())
  }
}

// 设置渲染副作用函数
export function setupRenderEffect(instance, vnode, container) {
  const Component = vnode.type
  const { render } = Component
  const { proxy: ctx } = instance

  // 组件更新函数
  const componentUpdateFn = () => {
    const subTree = render.call(ctx)

    if (!instance.isMounted) {
      // 挂载
      const { beforeMount, mounted } = instance
      invokeHook(beforeMount)
      patch(null, subTree, container)
      invokeHook(mounted)
      instance.isMounted = true
    } else {
      // 更新
      const { beforeUpdate, updated } = instance
      invokeHook(beforeUpdate)
      patch(instance.subTree, subTree, container)
      invokeHook(updated)
    }
    instance.subTree = subTree
  }

  // 设置副作用函数
  effect(componentUpdateFn)
}

// 初始化props
export function initProps(instance, rawProps) {
  const props = {}
  const attrs = {}
  const { propsOptions } = instance

  for (const key in rawProps) {
    const value = rawProps[key]
    if (key in propsOptions) {
      // vnode 传递的 props 在组件的 props 选项中已定义，视为父组件传递的 props，否则视为普通 HTML 元素属性
      props[key] = value
    } else {
      attrs[key] = value
    }
  }

  // 将 props 包装为响应式对象（浅响应 shallowReactive）
  instance.props = reactive(props)
  instance.attrs = attrs
}

// 组件实例的代理，作为组件实例的上下文
function createInstanceProxy(instance) {
  instance.proxy = new Proxy(instance, {
    get(target, key) {
      const { setupState, data, props } = target
      if (key in setupState) {
        return setupState[key]
      }
      if (key in data) {
        return data[key]
      }
      // 如果组件 data 没有当前 key，尝试从 props 中获取
      if (key in props) {
        return props[key]
      }
      console.error(`组件不存在 ${key} 属性`)
    },
    set(target, key, value) {
      const { setupState, data, props } = target
      if (key in setupState) {
        setupState[key] = value
        return true
      }
      if (key in data) {
        data[key] = value
        return true
      }
      if (key in props) {
        props[key] = value
        return true
      }
      console.error(`组件不存在 ${key} 属性`)
      return false
    }
  })
}

// 判断子组件的 props 是否变化
export function hasPropsChanged(prevProps, nextProps) {
  // props 数量不等，说明有变化
  if (Object.keys(nextProps).length !== Object.keys(prevProps).length) {
    return true
  }
  for (const key in nextProps) {
    // 有 props 不相等，说明有变化
    if (nextProps[key] !== prevProps[key]) {
      return true
    }
  }
  return false
}
