import React from 'react'
import ReactDOM from 'react-dom/client'
import { applyDocumentTheme, readStoredTheme } from '@/features/review-board/use-theme-state'
import App from './App'
import './app.css'
import '../../design/components/components.css'

applyDocumentTheme(readStoredTheme())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
