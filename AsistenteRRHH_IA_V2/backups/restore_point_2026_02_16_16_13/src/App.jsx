import VoiceChat from './components/VoiceChat'
import AnalyticsDashboard from './components/AnalyticsDashboard'
import './index.css'

function App() {
  const isDashboard = window.location.search.includes('dashboard=true');

  if (isDashboard) {
    return <AnalyticsDashboard onClose={() => window.close()} />;
  }

  return (
    <div className="App">
      <VoiceChat />
    </div>
  )
}

export default App
