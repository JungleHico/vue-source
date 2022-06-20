# Vue3 源码解析与实现

## 概述

Vue.js 由**响应系统**、**渲染器**、**组件化**和**编译器**等模块组成。

- Vue3 基于 ES6 Proxy 实现响应式数据；
- 渲染器的作用是将虚拟 DOM 渲染为真实 DOM；
- 组件就是一组 DOM 元素的封装；
- 编译器的作用是将模板编译成渲染函数，供渲染器使用。





Vue.js 既是**编译时**框架，同时也是**运行时**框架。

- 模板语法（**编译时**）

  Vue.js 为用户提供模板语法来声明式描述 UI，例如：文本插值、指令、`v-bind` 或 `:` 来动态绑定指令、`v-on` 或 `@` 来绑定事件等，框架内部通过编译器编译成虚拟 DOM，这种方式对用户来说更加直观。

- 渲染函数（**运行时**）

  Vue.js 还为用户提供另一种描述 UI 的方式：渲染函数。这种方式通过使用 JavaScript 对象来描述 DOM 结构，也就是虚拟 DOM。使用 JavaScript 对象会比模板语法更加灵活，而且也不需要经过编译。




## 响应系统

响应系统是 Vue.js 的重要组成部分，基于响应系统，Vue.js 实现了模型-视图分离，当我们修改响应式数据时，Vue.js 会自动更新视图。



### 响应式数据与副作用函数

**副作用函数**

副作用函数，指的是执行时会直接或间接影响其他函数的执行，例如一个函数修改了全局变量，那么这个函数就产生了副作用。

**响应式数据**

假设在一个副作用函数中读取了某个对象的属性，当我们修改这个这个属性时，如果副作用函数会重新执行，那么这个对象就是响应式数据。

```js
const obj = { text: 'hello world' }
function effect() {
  document.body.innerText = obj.text
}

effect()
obj.text = 'hello vue3'
```

当我们修改 `obj.text`，如果副作用函数 `effect()` 会重新执行，那么 `obj` 就是响应式数据，当然，现在我们修改 `obj.text` 是不会有变化的。



### 响应式数据的基本实现

Vue 2 中使用 `Object.defineProperty()` 来实现对对象属性的读取和设置，Vue 3 中采用 ES6 的 [Proxy](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy) 语法。**Proxy 是一个对象，它包装了另一个对象，并允许你拦截对该对象的任何交互。** 结合副作用函数和 Proxy 语法，我们能实现一个基本的响应系统：

```js
const bucket = new Set() // 存储副作用函数的集合

// 创建响应式数据
function reactive(target) {
  const proxy = new Proxy(target, {
    get(target, key) {
      bucket.add(effect) // 存储副作用函数
      return target[key]
    },
    set(target, key, newValue) {
      target[key] = newValue
      bucket.forEach(fn => fn()) // 取出副作用函数并执行
      return true
    }
  })
  return proxy
}

const obj = reactive({ text: 'Hello world' })
// 创建副作用函数并执行
const effect = () => {
  document.body.innerText = obj.text
}
effect()
setTimeout(() => {
  obj.text = 'Hello Vue3'
}, 2000)
```

首先，定义一个集合 `bucket` ，用于存储副作用函数，然后通过 Proxy 对数据的读取和设置进行拦截，当读对象的属性时，触发 `get` 函数，将副作用函数存入集合中；当设置对象的属性时，触发 `set` 函数，从集合中取出副作用函数并执行，这样就实现了简单的响应式数据。



### 设计一个完善的响应式系统

之前设计的响应式数据还不够完善，存在以下问题：

- 副作用函数的名字（`effect`）写死了；
- 没有区分不同的响应式对象，副作用函数和被操作字段之间也没有明确的联系。



**问题一**

为了解决副作用函数的名字硬编码的问题，我们可以定义一个函数，用于注册副作用函数：

```js
// 记录当前副作用函数的全局变量
let activeEffect
const bucket = new Set()

// 注册副作用函数的函数
function effect(fn) {
  activeEffect = fn
  // 执行副作用函数
  fn()
}
```

然后就可以注册并执行副作用函数：

```js
effect(() => {
  document.body.innerText = obj.text
})
```

这里我们注册了一个匿名的副作用函数，全局变量 `activeEffect` 会记录当前的副作用函数，接着副作用函数会执行，由于副作用函数读取响应式数据的属性，代理对象的 `get` 函数就会被触发：

```diff
  function reactive(target) {
    const proxy = new Proxy(target, {
      get(target, key) {
-       bucket.add(effect)
+       if (activeEffect) {
+         bucket.add(activeEffect)
+       }
        return target[key]
      },
      set(target, key, newValue) {
        target[key] = newValue
        bucket.forEach(fn => fn())
        return true
      }
    })
    return proxy
  }
```

这样，我们就解决了副作用函数名硬编码的问题。



**问题二**

之前的响应式数据还有个问题，**没有区分不同的响应式对象**，所有响应式对象的副作用函数都存放在同一个 `bucket` 中。除此之外， **副作用函数和被操作字段之间也没有明确的联系**，换言之，当我们修改响应式数据的某个属性时，`bucket` 中的所有副作用函数都会执行一遍，这是不符合我们预期的，我们希望修改某个属性值的时候，只执行该属性相关的副作用函数。

因此，我们需要修改存储副作用函数的数据结构：

```
{
  target1: {
    key1: { effect1, effect2 },
    key2: { effect3, effect4 }
  },
  target2: {
    key1,
    key2
  }
}
```

1. 首先，我们定义一个 [WeakMap](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/WeakMap)，存储**不同对象的依赖** ，这里的 key 是对象，所以我们定义 `WeakMap` 而不是普通的 `Map` ，由于 `WeakMap` 对 key 是弱引用，当对象不再被引用时，垃圾回收器会回收内存。
2. 然后，对于每个对象，我们定义一个 `Map` ，存储**不同属性的依赖** 。
3. 对于每个属性，我们定义一个 `Set` ，存储**属性的副作用函数**。

修改数据结构后的代码：

```js
let activeEffect
const targetMap = new WeakMap() // 存储依赖关系

function effect(fn) {
  activeEffect = fn
  fn()
}

function reactive(target) {
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

const obj = reactive({ text: 'Hello world' })
effect(() => {
  document.body.innerText = obj.text
})
setTimeout(() => {
  obj.text = 'Hello Vue3'
}, 2000)
```

这样，我们就实现了一个相对完善的响应系统。

> 实现响应系统还有很多边界情况需要处理，例如分支切换，嵌套 effect，无限递归循环等，这里不详细展开。



## 渲染器

### 虚拟 DOM

#### 虚拟 DOM 性能

浏览器解析页面时会将文档映射成一颗 DOM 树，操作 DOM 时需要遍历 DOM 树，比较**耗费性能**。

虚拟 DOM 就是通过使用 JavaScript 对象来描述 DOM 结构，当页面发生变化时，通过 Diff 算法**在 JavaScript 层面找出差异**，然后再根据差异渲染 DOM。

我们分别运行以下代码，比较纯 JavaScript 运算和 DOM 操作的性能差异：

```js
// 纯 JavaScript 计算
console.time()
const app = []
for (let i = 0; i < 10000; i++) {
  const div = { tag: 'div' }
  app.push(div)
}
console.timeEnd()
```

```js
// DOM 操作
console.time()
const app = document.body
for (let i = 0; i < 10000; i++) {
  const div = document.createElement('div')
  app.appendChild(div)
}
console.timeEnd()
```

可以看出，两段代码的执行时间不在一个数量级，DOM 操作是比较耗费性能的。



#### 虚拟 DOM 结构

虚拟 DOM 是通过 JavaScript 对象来描述 DOM 结构，因此我们可以规定以下虚拟 DOM 结构：

```js
const vnode = {
  type: 'div',
  props: {
    class: 'node',
    onClick: handler
  },
  children: [{ type: 'span', props: null, children: 'text' }]
}
```

```html
<div class="node" onclick="handler">
  <span>text</span>
</div>
```

- type 表示节点类型
- props 表示节点属性及事件，并且我们规定事件以 “on” 开头
- children 表示子节点，可以是字符串，也可以是节点数组，字符串表示节点文本，数组表示子节点列表

为了简化虚拟 DOM 的创建，Vue.js 提供了一个辅助函数 h：

```js
function h(type, props, children) {
  return {
    type,
    props,
    children
  }
}
```

通过 h 函数，我们可以更加便捷地创建虚拟 DOM：

```js
const vnode = h('div', { class: 'node', onClick: handler }, [
  h('span', null, 'text')
])
```

> Vue 3 中 h 函数做了参数个数的匹配，为了简便，我们这里规定 3 个 参数都必传。



### 挂载与更新

渲染器的作用是将虚拟 DOM 渲染为真实 DOM，我们可以将渲染分成两种情况：

- 挂载（mount）：节点首次渲染，将其挂载到 DOM 节点中；
- 更新（patch）：节点修改，通过 Diff 算法比较差异，根据差异更新 DOM。



#### 挂载

我们定义 `mountElement` 函数，用于挂载时将虚拟 DOM 渲染成真实 DOM：

```js
function mountElement(vnode, container) {
  const el = (vnode.el = document.createElement(vnode.type)) // 让vnode记录真实dom，用于更新

  // props
  const { props } = vnode
  if (props) {
    for (const key in props) {
      const value = props[key]
      if (key.startsWith('on')) {
        // 添加事件
        el.addEventListener(key.slice(2).toLowerCase(), value)
      } else {
        // 添加属性
        el.setAttribute(key, value)
      }
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
```

这样，我们就实现了一个简单的渲染器，用于挂载节点。

```html
<div id="app"></div>
```

```js
const vnode = h('div', { class: 'node' }, [
  h('span', { onClick: () => { console.log('clicked') } }, 'text')]
)

mountElement(vnode, document.querySelector('#app'))
```



#### 更新

渲染器的核心在于节点更新阶段，我们需要处理的两个问题是如何更新节点 props 以及如何更新子节点：

```js
function patchElement(n1, n2) {
  const el = (n2.el = n1.el)

  // 更新props

  // 更新子节点
}
```



##### 更新 props

一个节点可能有多个 prop，我们先定义一个方法 `patchProp` ，用于更新某个 prop，prop 包括属性和事件，更新事件时应当移除旧的事件监听器，更新属性时如果新节点没有当前属性也应当移除：

```js 
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
```

之前挂载节点时添加属性和事件也可以复用 `patchProp` 这个方法：

```diff
  function mountElement(vnode, container) {
    const el = (vnode.el = document.createElement(vnode.type)) // 让vnode记录真实dom，用于更新

    // props
    const { props } = vnode
    if (props) {
      for (const key in props) {
-       const value = props[key]
-       if (key.startsWith('on')) {
-         // 添加事件
-         el.addEventListener(key.slice(2).toLowerCase(), value)
-       } else {
-         // 添加属性
-         el.setAttribute(key, value)
-       }
+       patchProp(el, key, null, props[key])
      }
    }

    // ...

    container.appendChild(el)
  }
```

然后定义一个 `patchProps` 方法，对所有 `patchProp` 进行更新，新节点没有的 prop，应当移除：

```js
function patchProps(n1, n2, el) {
  const oldProps = n1.props
  const newProps = n2.props
  
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
      patchProp(le, key, oldProps[key], null)
    }
  }
}
```

```js
// 更新节点
function patchElement(n1, n2) {
  const el = (n2.el = n1.el)

  // 更新props
  patchProps(n1, n2, el)

  // 更新子节点
}
```

我们编写一个测试 Demo：

```html
<div id="app"></div>
```

```css
.green {
  color: green;
}
.red {
  color: red;
}
```

```js
const vnode1 = h('div', { class: 'green' }, 'text')
mountElement(vnode1, document.querySelector('#app'))
setTimeout(() => {
  const vnode2 = h(
    'div',
    {
      class: 'red',
      onClick: () => {
        console.log('red')
      }
    },
    'text'
  )
  patchElement(vnode1, vnode2)
}, 2000)
```

2 秒钟后，节点颜色改变，并且添加了点击事件。



##### 更新子节点

一个节点的子节点可能是文本，也可能是数组，我们更新子节点需要根据新旧子节点的类型来处理：

- 新旧子节点都是文本，直接修改；
- 新子节点是文本，旧子节点是数组，需要先将就子节点逐个销毁；
- 新子节点是数组，就子节点是文本，则将文本清空后逐个挂载子节点；
- 新旧子节点都是数组，则通过 Diff 算法进行比对。



首先，我们需要定义一个 `unmount` 方法，用于销毁某个节点：

```js
function unmount(vnode) {
  const parent = vnode.el.parentNode
  if (parent) {
    parent.removeChild(vnode.el)
  }
}
```

然后，我们定义 `patchChildren` 方法，用于更新子节点：

```js
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
```

上面的代码涵盖了我们之前说的 4 种情况，当新旧子节点都是数组时，为了简便，我们使用了删除所有旧子节点，然后添加所有新子节点的方式，Diff 算法我们后面再详解。 

最后，我们把 `patchChildren` 添加到 `pathElement` 中：

```js
// 更新节点
function patchElement(n1, n2) {
  const el = (n2.el = n1.el)

  // 更新props
  patchProps(n1, n2, el)

  // 更新子节点
  patchChildren(n1, n2, el)
}
```

编写测试 Demo：

```html
<div id="app"></div>
```

```js
const vnode1 = h('div', null, 'text')
mountElement(vnode1, document.querySelector('#app'))
setTimeout(() => {
  const vnode2 = h('div', null, [
    h('div', null, 'text1'),
    h('div', null, 'text2')
  ])
  patchElement(vnode1, vnode2)
}, 2000)
```

2 秒钟后，节点的结构发生了变化。



##### Diff 算法

待续。



#### 通用渲染器

之前的代码，我们通过 `mountElement` 挂载元素，通过 `patchElement` 更新元素，其实挂载元素我们可以看成是一次特殊的更新，这样，我们就可以定义一个通用的渲染器 `patch` ：

```js
export function patch(n1, n2, container) {
  if (n1 === n2) {
    return
  }

  // 如果节点类型不一致，卸载之前的节点
  if (n1.type !== n2.type) {
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
```





## 组件化

待续。



## 编译器

待续。