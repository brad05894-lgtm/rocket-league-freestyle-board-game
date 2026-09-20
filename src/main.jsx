import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initializeOnlineIdentity } from './onlineIdentity'

const root = createRoot(document.getElementById('root'))
function renderApp() {
  root.render(<StrictMode><App /></StrictMode>)
}
async function start() {
  root.render(<main style={{padding: 32, color: 'white'}}>Connecting to online play…</main>)
  try {
    await initializeOnlineIdentity()
    renderApp()
  } catch {
    root.render(<main style={{padding: 32, color: 'white'}}>
      <h1>Online connection unavailable</h1>
      <p>Check your connection. If you own this game, enable Anonymous sign-in in Firebase Authentication.</p>
      <button onClick={start}>Try again</button>
      <button onClick={renderApp}>Play locally</button>
    </main>)
  }
}
start()
