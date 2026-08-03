import React from 'react'
import ReactDOM from 'react-dom/client'
import { applyDocumentTheme, readStoredTheme } from '@/features/review-board/use-theme-state'
import { MWebApp } from '@/features/m-web/MWebApp'
import '../../design/components/components.css'
import '@/features/m-web/m-web.css'

applyDocumentTheme(readStoredTheme())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MWebApp />
  </React.StrictMode>,
)
