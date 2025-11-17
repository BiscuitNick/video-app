import './App.css'
import { AppRoutes } from './routes/AppRoutes'
import { ErrorBoundary } from './components/ErrorBoundary'
import { StoreProvider } from './contexts/StoreContext'

function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <AppRoutes />
      </StoreProvider>
    </ErrorBoundary>
  )
}

export default App
