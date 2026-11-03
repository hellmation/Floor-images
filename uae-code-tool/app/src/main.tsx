import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppProvider } from './store/state'
import App from './App'
import { ToastProvider } from './components/ui'

createRoot(document.getElementById('root')!).render(<StrictMode><AppProvider><ToastProvider><App /></ToastProvider></AppProvider></StrictMode>)
