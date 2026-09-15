import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/chats': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/todos': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/mcp-servers': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/model-configurations': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ai-employees': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/groups': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/skills': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/knowledge-bases': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/object-type-analysis': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '^/ontology(?:/|$)': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ontology-definitions': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '^/contract-review-rules/(?:groups|rules)(?:/.*|$)': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/workflow-runs': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/workspace/files': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '^/agent(?:/|$)': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/tasks': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '^/watermark(?:/|$)': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/images': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/simple-chat': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '^/mcp(?:/|$)': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mcp/, '/mcp')
      },
      '/volc-kb': {
        target: 'https://api-knowledgebase.mlp.cn-beijing.volces.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/volc-kb/, '')
      }
    }
  }
})
