import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import generouted from '@generouted/react-router/plugin'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.BACKEND_URL || 'http://localhost:8787'
  // The API issues Secure cookies, which iOS Safari (unlike desktop browsers
  // and localhost) refuses to store on plain-HTTP LAN origins. HTTPS=true runs
  // the dev server with a self-signed certificate so devices can log in.
  // loadEnv covers .env files while process.env covers shell-injected flags.
  const useHttps = [env.HTTPS, process.env.HTTPS].includes('true')

  // The app version is read from the workspace package.json at config time, so
  // a release-please bump flows through without touching source code; the
  // suffix names the environment the identifier came from (prod build vs dev
  // server) and it gets inlined as a constant into the bundle.
  const { version } = JSON.parse(
    readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
  ) as { version: string }
  const appVersion = `${version}${mode === 'production' ? 'prod' : 'dev'}`

  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    build: {
      rolldownOptions: {
        output: {
          // The lazy-loaded Scalar docs page bundles a ~1.5 MB markdown
          // stack. Grouping the @scalar package modules and splitting them
          // below the 500 kB reporting limit keeps every chunk small (Vite's
          // chunk-size warning stays silent) while the docs route keeps
          // loading everything on demand.
          codeSplitting: {
            maxSize: 480,
            groups: [
              {
                name: 'scalar',
                test: /[\\/]@scalar[\\/]/,
              },
            ],
          },
        },
      },
    },
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      ...(useHttps ? [basicSsl()] : []),
      generouted(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
  }
})
