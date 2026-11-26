import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// In dev, serve /api/* from the same handler the Vercel function uses.
function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        try {
          const mod = await server.ssrLoadModule('/server/node.ts')
          await mod.nodeHandler(req, res)
        } catch (e) {
          next(e)
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Make .env / .env.local (DATABASE_URL, ANTHROPIC_API_KEY, HOST_KEY) visible to the API in dev.
  Object.assign(process.env, { ...loadEnv(mode, process.cwd(), ''), ...process.env })
  return {
    plugins: [react(), devApi()],
    server: { host: true }, // reachable from phones on the same Wi-Fi
  }
})
