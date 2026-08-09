import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
/* Boots Firebase + Analytics. Import for side effect — singleton inside. */
import './utils/firebase.js'
import { AuthProvider } from './context/AuthContext.jsx'
import { initializeModulesIfNeeded } from './hooks/useModules.js'
import { initializeTournamentStagesIfNeeded } from './hooks/useTournamentStages.js'
import {
  initializeSuggestionsIfNeeded,
  migrateMatchesToSuggestionIds,
} from './hooks/useSuggestions.js'

/* Order matters — suggestions must be seeded before migration runs. */
initializeModulesIfNeeded()
initializeTournamentStagesIfNeeded()
initializeSuggestionsIfNeeded()
migrateMatchesToSuggestionIds()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* HashRouter must wrap AuthProvider so AuthContext's useNavigate
        (used for the Google redirect-result handler) has Router context. */}
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
)
