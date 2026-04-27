import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import BugAdmin from './pages/BugAdmin'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename="/admin">
      <Routes>
        <Route path="*" element={<BugAdmin />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
