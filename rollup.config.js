import serve from 'rollup-plugin-serve'
import livereload from 'rollup-plugin-livereload'

const isPro = process.env.NODE_ENV === 'production'

const config = {
  input: 'src/main.js',
  output: {
    file: 'dist/bundle.cjs.js',
    format: 'cjs'
  },
  plugins: []
}

// 开发环境
if (!isPro) {
  config.plugins.push(
    // 本地服务器
    serve({
      open: true,
      port: 8000,
      openPage: '/public/index.html',
      contentBase: ''
    }),
    // 热更新
    livereload()
  )
}

export default config
