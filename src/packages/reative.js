let activeEffect
const targetMap = new WeakMap() // 存储依赖关系

export function effect(fn) {
  activeEffect = fn
  fn()
}

export function reactive(target) {
  const proxy = new Proxy(target, {
    get(target, key) {
      // 存储副作用函数
      track(target, key)
      return target[key]
    },
    set(target, key, newValue) {
      target[key] = newValue
      // 取出副作用函数并执行
      trigger(target, key)
      return true
    }
  })
  return proxy
}

function track(target, key) {
  if (activeEffect) {
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = new Set()))
    }
    dep.add(activeEffect)
  }
}

function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    return
  }
  const dep = depsMap.get(key)
  dep.forEach(fn => fn())
}
