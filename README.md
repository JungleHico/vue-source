# Vue3 源码解析与实现

该文档参考《Vue.js 设计与实现》一书，对 Vue 3 的源码进行解析，并实现 Vue.js 框架的基本内容。



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
  const el = (vnode.el = document.createElement(vnode.type)) // 让 vnode 记录真实 dom，用于更新

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
    container.textContent = c2
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
function patch(n1, n2, container) {
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

组件就是一组 DOM 元素的封装，我们就可以将页面拆分成多个组件，方便我们维护，而且组件还可以被复用。



### 渲染组件（挂载）

之前我们的渲染器只支持渲染 HTML 节点，也就是 `vnode.type` 指定了一个标签类型：

```div
const vnode = {
  type: 'div'
}
```

Vue.js 中，将组件描述为一个对象：

```js
const MyComponent = {
  name: 'MyComponent',
  data() {
    return {
      title: 'Hello Component'
    }
  }
}
```

为了渲染组件，我们可以将组件对象传递给 `vnode.type` ，这样，我们就可以区分 HTML 节点和组件：

```js
export function patch(n1, n2, container) {
  if (n1 === n2) {
    return
  }

  if (n1 && n1.type !== n2.type) {
    unmount(n1)
    n1 = null
  }

  const { type } = n2
  if (typeof type === 'string') {
    // 渲染 HTML 元素
    processElement(n1, n2, container)
  } else if (typeof type === 'object') {
    // 渲染组件
    processComponent(n1, n2, container)
  }
}
```

为了方便维护，我们将渲染 HTML 元素和渲染组件的业务封装到 `processElement` 和 `processComponent` 函数中：

```js
function processElement(n1, n2, container) {
  if (n1 === null) {
    mountElement(n2, container)
  } else {
    patchElement(n1, n2)
  }
}
```

```js
function processComponent(n1, n2, container) {
  if (n1 === null) {
    // 挂载组件
  } else {
    // 更新组件
  }
}
```

组件本质上就是一组 DOM 元素，为了渲染组件，我们规定组件必须包含一个 `render` 函数，返回组件内容的虚拟 DOM：

 ```js
const MyComponent = {
  name: 'MyComponent',
  render() {
    return h('div', null, 'Hello Component')
  }
}
 ```

> 在 Vue.js 中，我们不必定义组件的 `render` 函数，这是因为 Vue.js 的编译器会编译模板，生成一个 `render` 渲染函数。

这样，我们就可以挂载组件的：

```diff
  function processComponent(n1, n2, container) {
    if (n1 === null) {
      // 挂载组件
+     mountComponent(n2, container)
    } else {
      // 更新组件
    }
  }
```

```js
function mountComponent(vnode, container) {
  const Component = vnode.type
  const { render } = Component
  const subTree = render()
  patch(null, subTree, container)
}
```

```html
<div id="app"></div>
```

```js
const vnode = h(MyComponent, null, null)
patch(null, vnode, document.querySelector('#app'))
```

我们定义了一个 vnode，并指定 `type` 为我们定义的组件。挂载组件时，通过 `vnode.type` ，我们可以获取到组件的选项对象，通过组件渲染函数 `render` ，我们可以获取到组件的虚拟 DOM，最后调用 `patch` 函数就可以挂载组件对应的内容。



###组件状态（data）与自更新

#### 组件状态

接下来，我们要定义组件的状态，也就是 `data` 选项。

首先，我们修改组件，指定 `data` 选项并在渲染函数中引用数据：

```js
const MyComponent = {
  name: 'MyComponent',
  data() {
    return {
      title: 'Hello Component'
    }
  },
  render() {
    return h('div', null, `${this.title}`)
  }
}
```

我们定义了一个 `data` 函数，然后返回一个数据对象，之所以定义成一个函数，而不是直接定义一个对象，是为了隔离作用域，当组件被多次复用时，如果是一个对象，就会使得状态被共用，造成数据污染。

为了能在 `render` 函数中通过 `this` 访问组件状态，我们需要通过 `call` 函数改变 `render` 函数 `this` 的指向：

```diff
  function mountComponent(vnode, container) {
    const componentOptions = vnode.type
-   const { render } = componentOptions
+   const { data: dataOptions, render } = componentOptions

+   const data = dataOptions()
-   const subTree = render()
+   const subTree = render.call(data)
    patch(null, subTree, container)
  }
```

这样，组件状态就生效了。



#### 组件自更新

组件的自更新指的是：当组件状态发生变化时，会触发组件更新，重新渲染组件，这里就需要用到我们之前的响应式数据和副作用函数。

```diff
  function mountComponent(vnode, container) {
    const Component = vnode.type
    const { data: dataOptions, render } = Component

-   const data = dataOptions()
+   const data = reactive(dataOptions())

+   // 设置副作用函数，状态修改时自更新
+   effect(() => {
      const subTree = render.call(data)
      patch(null, subTree, container)
+   })
  }
```

我们通过 `reactive` 方法将组件状态定义为响应式数据，然后将渲染业务设置为副作用函数，当组件状态更新时，就会自动执行副作用函数，重新渲染。

为了验证组件是否实现了自更新，我们修改一下组件：

```diff
  const MyComponent = {
    name: 'MyComponent',
    data() {
      return {
        title: 'Hello Component'
      }
    },
    render() {
      return h(
        'div',
-       null,
+       {
+         onClick: () => {
+           this.title = 'Component state updated'
+         }
+       },
        `${this.title}`
      )
    }
  }
```

我们添加了一个事件，点击组件时，修改状态，组件也重新渲染，只不过每次调用 `patch` 函数的第一个参数都是 `null` ，所以每次修改状态时都会挂载新组件而不是更新原有组件，这个问题我们下一节会解决。

> 为了避免副作用函数多次执行带来的性能开销，Vue.js 实现了一个调度器，当副作用函数需要重新执行时，将其存到一个去重的微任务队列中，当执行栈清空后，再从微任务队列中取出副作用函数并执行。



### 组件实例

之前组件更新时没有区分组件是否已经挂载，为了解决这个问题，我们引入组件实例，用来维护组件相关的状态信息。

首先，我们创建组件实例 `instance` ：

```js
function mountComponent(vnode, container) {
  // 组件实例
  const instance = createComponentInstance(vnode)
  vnode.component = instance // 保存组件实例，便于更新
}
```

```js
// 创建组件实例
function createComponentInstance(vnode) {
  const instance = {
    subTree: null, // 组件渲染内容
    isMounted: false // 组件是否已被挂载
  }
  return instance
}
```

然后，我们把之前设置副作用函数的业务封装到 `setupRenderEffect` 函数中：

```js
function mountComponent(vnode, container) {
  // 组件实例
  const instance = createComponentInstance(vnode)
  vnode.component = instance

  // 设置副作用函数，状态修改时自更新
  setupRenderEffect(instance, vnode, container)
}
```

```js
export function setupRenderEffect(instance, vnode, container) {
  const Component = vnode.type
  const { data: dataOptions, render } = Component
  const data = reactive(dataOptions())

  // 组件更新函数
  const componentUpdateFn = () => {
    const subTree = render.call(data)

    if (!instance.isMounted) {
      // 挂载
      patch(null, subTree, container)
      instance.isMounted = true
    } else {
      // 更新
      patch(instance.subTree, subTree, container)
    }
    instance.subTree = subTree
  }

  // 设置副作用函数
  effect(componentUpdateFn)
}
```

组件首次渲染时，`isMounted` 为 `false` ，旧子树为 `null` ，挂载后 `isMounted` 变为 `true` ，且 `subTree` 保存当前子树，作为下次更新的旧子树。



### props 与组件被动更新

#### props 基本实现

Vue.js 中，父组件通过 props 向子组件传递数据。

```html
<MyComponent title="props data"></MyComponent>
```

模板对应的虚拟 DOM：

```js
const vnode = {
  type: MyComponent,
  props: {
    msg: 'Hello Props
  }
}
patch(null, vnode, document.querySelector('#app'))
```

组件的 props 和 HTML 标签的属性差别不大，都是通过虚拟 DOM 的 `props` 进行传递，所以我们需要在组件中显式的声明 `props` 选项：

```js
const MyComponent = {
  name: 'MyComponent',
  props: {
    title: String
  },
  data() {
    return {}
  },
  render() {
    return h('div', null, `${this.msg}`)
  }
}
```

为了从父组件中获取到 props 数据，我们需要在渲染组件时区分 attrs 和 props。

首先，我们需要为 `instance` 添加更多的状态属性：

```diff
  function createComponentInstance(vnode) {
    const instance = {
+     vnode, // 组件虚拟 DOM
+     propsOptions: vnode.type.props || {}, // 组件 props 选项
+     data: {}, // 组件状态
+     props: {}, // 父组件传递数据
      subTree: null,
      isMounted: false,
    }
    return instance
  }
```

然后，我们定义一个 `setupComponent` 方法，用于组件初始化，该方法目前主要包含一个 `initProps` 方法，用于对 `vnode.props` 和 组件的 `props` 选项进行比对，只有在组件的 `props` 声明的数据，才视为父组件传递的 `props` 数据，否则视为普通 HTML 标签的属性。

```diff
  function mountComponent(vnode, container) {
    const instance = createComponentInstance(vnode)
    vnode.component = instance

+   // 初始化组件
+   setupComponent(instance)

    setupRenderEffect(instance, vnode, container)
  }
```

```js
function setupComponent(instance) {
  const { props, type: Component } = instance.vnode

  initProps(instance, props) // 初始化 props
}
```

```js
function initProps(instance, rawProps) {
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
```

> Vue 3 中，对于父组件传递的 props 数据，通过 `shallowReactive` 包装为浅响应数据，由于我们之前的 `reactive` 并没有实现深响应，所以可以直接使用。

接着，我们把之前 `setupRenderEffect` 方法中创建响应式数据通过 `instance.data`  进行保存，并且为了方便维护，我们把定义响应式数据的代码也放到 `setupComponent` 方法中：

```diff
  function setupComponent(instance) {
    const { props, type: Component } = instance.vnode
+   const { data: dataOptions } = Component

    initProps(instance, props)

+   instance.data = reactive(dataOptions())
  }
```

```diff
  function setupRenderEffect(instance, vnode, container) {
    const Component = vnode.type
+   const { render } = Component
-   const { data: dataOptions, render } = Component
-   const data = reactive(dataOptions())

    const componentUpdateFn = () => {
-     const subTree = render.call(data)
+     const subTree = render.call(instance.data)
      
      if (!instance.isMounted) {
        patch(null, subTree, container)
        instance.isMounted = true
      } else {
        patch(instance.subTree, subTree, container)
      }
      instance.subTree = subTree
    }

    effect(componentUpdateFn)
  }
```

与通过 `this` 访问 `data` 类似，我们需要封装一个渲染上下文对象，使得渲染函数内部可以通过 `this` 访问 `data` 和 `props` 等组件选项：

```js
function createInstanceProxy(instance) {
  instance.proxy = new Proxy(instance, {
    get(target, key) {
      const { data, props } = instance
      if (data && key in data) {
        return data[key]
      }
      // 如果组件 data 没有当前 key，尝试从 props 中获取
      if (key in props) {
        return props[key]
      }
      console.error(`组件不存在 ${key} 属性`)
    },
    set(target, key, value) {
      const { data, props } = instance
      if (data && key in data) {
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
```

```diff
  function setupComponent(instance) {
    const { props, type: Component } = instance.vnode
    const { data: dataOptions } = Component

    initProps(instance, props)

+   createInstanceProxy(instance)

    instance.data = reactive(dataOptions())
  }
```

```diff
  function setupRenderEffect(instance, vnode, container) {
    const Component = vnode.type
    const { render } = Component

    const componentUpdateFn = () => {
-     const subTree = render.call(instance.data)
+     const subTree = render.call(instance.proxy)
      
      if (!instance.isMounted) {
        patch(null, subTree, container)
        instance.isMounted = true
      } else {
        patch(instance.subTree, subTree, container)
      }
      instance.subTree = subTree
    }

    effect(componentUpdateFn)
  }
```

我们把渲染上下文对象定义为 `instance.proxy` ，然后通过 Proxy 对 `instance` 进行劫持，按需返回 `instance.data` 或者 `instance.props` 的数据。

> Vue.js 中 props 还包含默认值和类型校验等内容，这里不详细展开。

至此，我们就实现了组件 props 传递数据，我们修改测试 Demo ，进行验证：

```js
const MyComponent = {
  name: 'MyComponent',
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

const container = document.querySelector('#app')
const vnode = {
  type: MyComponent,
  props: {
    title: 'props data'
  }
}
patch(null, vnode, container)
```



#### 子组件被动更新

当父组件自更新时，如果由此引起子组件更新，我们称之为子组件被动更新，当子组件被动更新时，我们需要检测子组件是否需要更新，例如 `props` 是否发生变化，然后执行相应的更新。

```diff
  function processComponent(n1, n2, container) {
    if (n1 === null) {
      // 挂载组件
      mountComponent(n2, container)
    } else {
      // 更新
+     patchComponent(n1, n2)
    }
  }
```

```js
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
```

```js
function hasPropsChanged(prevProps, nextProps) {
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
```

修改之前的测试 Demo，修改父组件的 props：

```diff
  const MyComponent = {
    name: 'MyComponent',
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

  const container = document.querySelector('#app')
  const vnode = h(MyComponent, { msg: 'Hello Props' }, null)
  patch(null, vnode, container)
+ setTimeout(() => {
+   const vnode2 = h(MyComponent, { msg: 'Props updated' }, null)
+   patch(vnode, vnode2, container)
+ }, 2000)
```



### setup 函数

Vue 3 新增了组合式 API 和与之对应的 `setup` 函数，在 `setup` 函数中，我们可以创建响应式数据、创建方法、注册生命周期钩子等。



#### setup 创建数据

`setup` 函数暴露一个数据对象，这个对象可以在渲染函数中通过 `this` 访问。

```js
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
```

`setup` 函数在组件创建之前执行，我们可以在组件初始化函数 `setupComponent` 中调用：

```diff
  function setupComponent(instance) {
+ 	const { props } = instance.vnode
-   const { props, type: Component } = instance.vnode
-   const { data: dataOptions } = Component

    initProps(instance, props)

-   createInstanceProxy(instance)

-   instance.data = reactive(dataOptions())

+   setupStatefulComponent(instance)
  }
```

```js
function setupStatefulComponent(instance) {
  const Component = instance.type

  createInstanceProxy(instance)

  const { setup, data: dataOptions } = Component
  if (setup) {
    setup()
  }
  if (dataOptions) {
    instance.data = reactive(dataOptions())
  }
}
```

我们创建了一个 `setupStatefulComponent` 函数，用于管理组件状态，在这个函数中，我们调用组件选项 `setup` 函数。为了方便维护，我们把之前创建组件实例代理以及创建组件状态的业务也放到 `setupStatefulComponent`  函数中。

我们还需要能够在渲染函数中通过 `this` 访问 `setup` 中创建的数据，因此我们需要保存 `setup` 的返回值，并且修改组件实例代理：

```diff
  function setupStatefulComponent(instance) {
    const Component = instance.type

    createInstanceProxy(instance)

    const { setup, data: dataOptions } = Component
    if (setup) {
-     setup()
+     const setupResult = setup()
+     instance.setupState = setupResult
    }
    if (dataOptions) {
      instance.data = reactive(dataOptions())
    }
  }
```

```diff
  function createComponentInstance(vnode) {
    const instance = {
      vnode,
      propsOptions: vnode.type.props || {},
      data: {},
      props: {},
+     setupState: {}, // setup 暴露的数据
      subTree: null,
      isMounted: false,
    }
    return instance
  }
```

```diff
  function createInstanceProxy(instance) {
    instance.proxy = new Proxy(instance, {
      get(target, key) {
-       const { data, props } = target
+       const { setupState, data, props } = target
+       if (key in setupState) {
+         return setupState[key]
+       }
        if (key in data) {
          return data[key]
        }
        if (key in props) {
          return props[key]
        }
        console.error(`组件不存在 ${key} 属性`)
      },
      set(target, key, value) {
-       const { data, props } = target
+       const { setupState, data, props } = target
+       if (key in setupState) {
+         setupState[key] = value
+         return true
+       }
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
```



#### setup 参数

Vue 3 中 `setup` 函数包含两个参数：

- `props` ：组件 `props` 数据；
- `context` ：一个保存与组件接口相关的数据和方法的对象，包括 `attrs` 、`emit`、`slots` 和 `expose` 。 

对于第一个参数 `props` ，我们直接传递组件的 `props` 传入即可。对于第二个参数，我们先传入之前 `initProps` 函数中获取到的 `attrs`：

```diff
  function setupStatefulComponent(instance) {
    const Component = instance.type

    createInstanceProxy(instance)

    const { setup, data: dataOptions } = Component
    if (setup) {
+     const setupContext = {
+       attrs: instance.attrs
+     }
-     const setupResult = setup()
+     const setupResult = setup(instance.props, setupContext)
      instance.setupState = setupResult
    }
    if (dataOptions) {
      instance.data = reactive(dataOptions())
    }
  }
```



#### emit 自定义事件

Vue.js 中通过 `emit` 自定义事件，向父组件传递数据。

```js
const MyComponent = {
  setup(props, { emit }) {
    emit('create', true)
  },
  render() {
    return h('div', null, 'emit')
  }
}
```

父组件通过监听对应的事件来获取数据：

```html
<MyComponent @create="handler"></MyComponent>
```

对应的虚拟 DOM：

```js
const vnode = {
  type: MyComponent,
  props: {
    onCreate: value => {
      console.log(value)
    }
  }
}
```

我们约定，`emit` 触发的事件，父组件通过 `props` 中 `'on'` + 事件名（首字母大写）来监听。

首先，我们定义一个 `emit` 函数，用于自定义事件：

```js
function emit(instance, event, ...args) {
  const handlerName = `on${event[0].toUpperCase()}${event.slice(1)}`
  const handler = instance.vnode.props[handlerName]
  if (handler) {
    handler(...args)
  }
}
```

然后，在创建组件实例时，我们定义 `instance.emit` ，用于保存 `emit` 方法：

```diff
  function createComponentInstance(vnode) {
    const instance = {
      vnode,
      propsOptions: vnode.type.props || {},
+     emit: null,
      data: {},
      props: {},
      setupState: {},
      subTree: null,
      isMounted: false,
    }
    
+   instance.emit = emit.bind(null, instance)
    
    return instance
  }
```

`emit` 函数需要第一个参数 `instance` 来指定组件实例，但是我们最终调用 `emit` 函数自定义事件时不需要这个参数，为此，我们可以通过 `bind` 函数来指定 `instance` 参数。

最后，`setup` 函数的第二个参数追加 `instance.emit` ：

```diff
  function setupStatefulComponent(instance) {
    const Component = instance.type

    createInstanceProxy(instance)

    const { setup, data: dataOptions } = Component
    if (setup) {
      const setupContext = {
        attrs: instance.attrs,
+       emit: instance.emit
      }
      const setupResult = setup(instance.props, setupContext)
      instance.setupState = setupResult
    }
    if (dataOptions) {
      instance.data = reactive(dataOptions())
    }
  }
```



#### 注册生命周期

Vue 3 中，`setup` 函数中可以注册生命周期钩子函数，以 `onBeforeMount` 和 `onMounted` 为例，我们将实现这一功能。

首先，为了区分不同组件，也就是在当前组件中注册生命周期钩子，我们需要定义一个变量 `currentInstance`，用于记录当前组件实例，在组件 `setup` 函数调用前，用 `currentInstance` 记录当前组件实例。

```js
let currentInstance = null

const setCurrentInstance = instance => {
  currentInstance = instance
}

const unsetCurrentInstance = () => {
  currentInstance = null
}
```

```diff
  function setupStatefulComponent(instance) {
    const Component = instance.type

    createInstanceProxy(instance)

    const { setup, data: dataOptions } = Component
    if (setup) {
      const setupContext = {
        attrs: instance.attrs,
        emit: instance.emit
      }
+     setCurrentInstance(instance)
      const setupResult = setup(instance.props, setupContext)
+     unsetCurrentInstance()
      instance.setupState = setupResult
    }
    if (dataOptions) {
      instance.data = reactive(dataOptions())
    }
  }
```

接着，我们在组件实例中定义和维护对应的声明周期钩子：

```diff
  function createComponentInstance(vnode) {
    const instance = {
      vnode,
      propsOptions: vnode.type.props || {},
      emit: null,
      data: {},
      props: {},
      setupState: {},
      subTree: null,
      isMounted: false,
+     beforeMount: null,
+     mounted: null,
    }
    
    instance.emit = emit.bind(null, instance)
    
    return instance
  }
```

然后，我们定义生命周期钩子函数，这部分的逻辑是可复用的，我们通过 `createHook` 可以创建生命周期钩子函数： 

```js
// 定义注册声明周期钩子的方法
function createHook(lifecycle, hook, target = currentInstance) {
  if (target) {
    target[lifecycle] = hook
  }
}

const onBeforeMount = hook => createHook('beforeMount', hook)
const onMounted = hook => createHook('mounted', hook)
```

最后，我们在组件挂载的前后，调用对应的钩子函数：

```diff
  function setupRenderEffect(instance, vnode, container) {
    const Component = vnode.type
    const { render } = Component

    const componentUpdateFn = () => {
      const subTree = render.call(instance.proxy)
      
      if (!instance.isMounted) {
+       const { beforeMount, mounted } = instance
+       invokeHook(beforeMount)
        patch(null, subTree, container)
+       invokeHook(mounted)
        instance.isMounted = true
      } else {
        patch(instance.subTree, subTree, container)
      }
      instance.subTree = subTree
    }

    effect(componentUpdateFn)
  }
```

```js
export const invokeHook = hook => {
  if (hook) {
    hook()
  }
}
```

编写测试 Demo，验证生命周期钩子是否生效：

```js
const MyComponent = {
  setup() {
    onBeforeMount(() => {
      console.log('onBeforeMount')
    })
    onMounted(() => {
      console.log('onMounted')
    })
  },
  render() {
    return h('div', null, 'Lifecircle')
  }
}
const vnode = h(MyComponent, null, null)
patch(null, vnode, document.querySelector('#app'))
```



## 编译器

略。