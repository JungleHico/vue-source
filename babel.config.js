module.exports = {
  presets: [
    // 基于当前 node 版本进行编译
    ['@babel/preset-env', { targets: { node: 'current' } }]
  ]
}
