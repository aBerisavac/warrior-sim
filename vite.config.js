import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { validateTownMap } from './src/map-validation.js'

const townMapPath = fileURLToPath(new URL('./src/data/town-map.json', import.meta.url))
function mapEditorSave() {
  return {
    name: 'local-map-editor-save',
    configureServer(server) {
      server.middlewares.use('/__map-editor/save', async (request, response, next) => {
        if (request.method !== 'POST') return next()
        if (request.headers.origin !== `http://${request.headers.host}` || !request.headers['content-type']?.startsWith('application/json')) {
          response.statusCode = 403
          response.end('Local map editor requests only.')
          return
        }
        const chunks = []
        let size = 0
        try {
          for await (const chunk of request) {
            size += chunk.length
            if (size > 1_000_000) throw new Error('Map data is too large.')
            chunks.push(chunk)
          }
          const map = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          const errors = validateTownMap(map)
          if (errors.length) {
            response.statusCode = 400
            response.setHeader('Content-Type', 'application/json')
            response.end(JSON.stringify({ error: errors[0], errors }))
            return
          }
          const current = JSON.parse(await readFile(townMapPath, 'utf8'))
          map.revision = (current.revision || 0) + 1
          await writeFile(townMapPath, JSON.stringify(map, null, 2) + '\n', 'utf8')
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ ok: true }))
        } catch (error) {
          response.statusCode = 400
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ error: error.message || 'Could not save map.' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), mapEditorSave()],
  build: { sourcemap: false, minify: 'esbuild', cssMinify: true },
})
