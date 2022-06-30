let currentInstance = null

function createHook(lifecycle, hook, target = currentInstance) {
  if (target) {
    target[lifecycle] = hook
  }
}

export const invokeHook = hook => {
  if (hook) {
    hook()
  }
}

export const onBeforeMount = hook => createHook('beforeMount', hook)
export const onMounted = hook => createHook('mounted', hook)
export const onBeforeUpdate = hook => createHook('beforeUpdate', hook)
export const onUpdated = hook => createHook('updated', hook)

export const setCurrentInstance = instance => {
  currentInstance = instance
}

export const unsetCurrentInstance = () => {
  currentInstance = null
}
