import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AppShell } from './components/layout/AppShell'
import { FeedbackProvider } from './components/ui/Feedback'
import { AuthProvider } from './hooks/useAuth'
import { ThemeProvider } from './hooks/useTheme'
import { NavPrefsProvider } from './hooks/useNavPrefs'
import { HomePage } from './pages/HomePage'
import { TreinoPage } from './pages/TreinoPage'
import { FinancasPage } from './pages/FinancasPage'
import { HabitosPage } from './pages/HabitosPage'
import { RotinaPage } from './pages/RotinaPage'
import { ConfigPage } from './pages/ConfigPage'
import { RelatorioPage } from './pages/RelatorioPage'

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="treino" element={<TreinoPage />} />
          <Route path="financas" element={<FinancasPage />} />
          <Route path="habitos" element={<HabitosPage />} />
          <Route path="rotina" element={<RotinaPage />} />
          <Route path="relatorio" element={<RelatorioPage />} />
          <Route path="config" element={<ConfigPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <FeedbackProvider>
          <AuthProvider>
            <NavPrefsProvider>
              <AnimatedRoutes />
            </NavPrefsProvider>
          </AuthProvider>
        </FeedbackProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
