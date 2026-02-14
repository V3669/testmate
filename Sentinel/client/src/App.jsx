import { useState, useEffect, useRef } from 'react'
import { Activity, Zap, Server, ChevronRight, Play, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import TestList from './components/TestList'
import TestDetail from './components/TestDetail'
import StressView from './components/StressView'

const WS_URL = 'ws://localhost:3000'

function App() {
  const [status, setStatus] = useState('disconnected')
  const [config, setConfig] = useState(null)
  const [testResults, setTestResults] = useState({})
  const [stressResults, setStressResults] = useState({})
  const [selectedScenarioId, setSelectedScenarioId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const ws = useRef(null)

  useEffect(() => {
    connect()
    return () => {
      if (ws.current) ws.current.close()
    }
  }, [])

  const connect = () => {
    ws.current = new WebSocket(WS_URL)

    ws.current.onopen = () => {
      setStatus('connected')
      console.log('Connected to Sentinel Server')
    }

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data)
      handleMessage(data)
    }

    ws.current.onclose = () => {
      setStatus('disconnected')
      setTimeout(connect, 3000)
    }
  }

  const handleMessage = (data) => {
    switch (data.type) {
      case 'init':
        setTestResults(data.testResults || {})
        setStressResults(data.stressResults || {})
        break
      case 'config': // If server pushes config
        setConfig(data.payload)
        break
      case 'test_result':
        setTestResults(prev => ({ ...prev, [data.payload.id]: data.payload }))
        break
      case 'stress_result':
        setStressResults(prev => ({ ...prev, [data.payload.id]: data.payload }))
        break
      case 'status':
        // status update
        break
      default:
        console.log('Unknown message', data)
    }
  }

  const handleRunTest = (id) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'run_test', id }))
    }
  }

  const handleRunStress = (id) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'run_stress', id }))
    }
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className={`w-80 border-r border-border bg-card/50 flex flex-col transition-all duration-300 ${sidebarOpen ? '' : '-ml-80'}`}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Activity className="text-primary" /> Sentinel
          </h1>
          <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-success shadow-[0_0_10px_var(--success)]' : 'bg-error'}`} />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <TestList
            config={config}
            results={testResults}
            stressResults={stressResults}
            selectedId={selectedScenarioId}
            onSelect={setSelectedScenarioId}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-4 left-4 z-10 p-2 bg-card border border-border rounded-lg hover:bg-white/5"
        >
          <Server size={16} />
        </button>

        <div className="flex-1 p-8 overflow-y-auto">
          {selectedScenarioId ? (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Determine type of scenario from results or just show generic detail */}
              {/* In a real app we'd need the config to know the type, but let's infer or pass it */}
              <TestDetail
                id={selectedScenarioId}
                result={testResults[selectedScenarioId]}
                stressResult={stressResults[selectedScenarioId]} // If applicable
                config={config}
                onRun={() => handleRunTest(selectedScenarioId)}
                onStress={() => handleRunStress(selectedScenarioId)} // Assuming we can link them
              />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-secondary">
              <Activity size={64} className="mb-4 opacity-20" />
              <p className="text-xl">Select a scenario to view details</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
