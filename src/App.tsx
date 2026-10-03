import { lazy, Suspense } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AppShell } from './components/layout/AppShell'
import { FeedbackProvider } from './components/ui/Feedback'
import { AuthProvider } from './hooks/useAuth'
import { ThemeProvider } from './hooks/useTheme'
import { NavPrefsProvider } from './hooks/useNavPrefs'
import { HomePage } from './pages/HomePage'

const TreinoPage = lazy(() =>
  import('./pages/TreinoPage').then((m) => ({ default: m.TreinoPage })),
)
const FinancasPage = lazy(() =>
  import('./pages/FinancasPage').then((m) => ({ default: m.FinancasPage })),
)
const HabitosPage = lazy(() =>
  import('./pages/HabitosPage').then((m) => ({ default: m.HabitosPage })),
)
const RotinaPage = lazy(() =>
  import('./pages/RotinaPage').then((m) => ({ default: m.RotinaPage })),
)
const NutricaoPage = lazy(() =>
  import('./pages/NutricaoPage').then((m) => ({ default: m.NutricaoPage })),
)
const SaudePage = lazy(() =>
  import('./pages/SaudePage').then((m) => ({ default: m.SaudePage })),
)
const JogosPage = lazy(() =>
  import('./pages/JogosPage').then((m) => ({ default: m.JogosPage })),
)
const RelatorioPage = lazy(() =>
  import('./pages/RelatorioPage').then((m) => ({ default: m.RelatorioPage })),
)
const ConfigPage = lazy(() =>
  import('./pages/ConfigPage').then((m) => ({ default: m.ConfigPage })),
)

function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <span className="route-fallback__dot" />
      A carregar…
    </div>
  )
}

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route
            path="treino"
            element={
              <Suspense fallback={<RouteFallback />}>
                <TreinoPage />
              </Suspense>
            }
          />
          <Route
            path="financas"
            element={
              <Suspense fallback={<RouteFallback />}>
                <FinancasPage />
              </Suspense>
            }
          />
          <Route
            path="habitos"
            element={
              <Suspense fallback={<RouteFallback />}>
                <HabitosPage />
              </Suspense>
            }
          />
          <Route
            path="rotina"
            element={
              <Suspense fallback={<RouteFallback />}>
                <RotinaPage />
              </Suspense>
            }
          />
          <Route
            path="nutricao"
            element={
              <Suspense fallback={<RouteFallback />}>
                <NutricaoPage />
              </Suspense>
            }
          />
          <Route
            path="saude"
            element={
              <Suspense fallback={<RouteFallback />}>
                <SaudePage />
              </Suspense>
            }
          />
          <Route
            path="jogos"
            element={
              <Suspense fallback={<RouteFallback />}>
                <JogosPage />
              </Suspense>
            }
          />
          <Route
            path="relatorio"
            element={
              <Suspense fallback={<RouteFallback />}>
                <RelatorioPage />
              </Suspense>
            }
          />
          <Route
            path="config"
            element={
              <Suspense fallback={<RouteFallback />}>
                <ConfigPage />
              </Suspense>
            }
          />
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
