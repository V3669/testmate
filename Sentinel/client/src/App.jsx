import { useState, useEffect, useRef } from 'react'
import { Activity, Zap, Server, Play, CheckCircle, XCircle, FolderOpen, Clock, Gauge, Flame } from 'lucide-react'
import TestList from './components/TestList'
import TestDetail from './components/TestDetail'

const WS_URL = 'ws://localhost:3000'

function App() {
  const [status, setStatus] = useState('disconnected')
  const [config, setConfig] = useState(null)
  const [configPath, setConfigPath] = useState(null)
  const [testResults, setTestResults] = useState({})
  const [stressResults, setStressResults] = useState({})
  const [testHistory, setTestHistory] = useState([])
  const [selectedScenarioId, setSelectedScenarioId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isRunning, setIsRunning] = useState(false)

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
        setConfig(data.config || null)
        setConfigPath(data.configPath || null)
        setTestHistory(data.history || [])
        break
      case 'test_result':
        setTestResults(prev => ({ ...prev, [data.payload.id]: data.payload }))
        ws.current.send(JSON.stringify({ type: 'refresh_history' }))
        break
      case 'stress_result':
        setStressResults(prev => ({ ...prev, [data.payload.id]: data.payload }))
        ws.current.send(JSON.stringify({ type: 'refresh_history' }))
        break
      case 'history_update':
        setTestHistory(data.history || [])
        break
      case 'status':
        setIsRunning(data.payload?.isRunning || false)
        break
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

  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getProjectName = (path) => {
    if (!path) return 'unknown'
    return path.split('/').filter(Boolean).pop()
  }

  // Calculate stats
  const passedCount = Object.values(testResults).filter(r => r.status === 'passed').length
  const failedCount = Object.values(testResults).filter(r => r.status === 'failed').length

  return (
    <div className="flex h-screen bg-[#0a0a0b] text-white">
      {/* Sidebar */}
      <aside className={`w-72 bg-[#111113] border-r border-[#1f1f22] flex flex-col transition-all ${sidebarOpen ? '' : '-ml-72'}`}>
        {/* Header */}
        <div className="p-4 border-b border-[#1f1f22]">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Activity size={14} className="text-white" />
              </div>
              Testmate
            </h1>
            <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
          </div>
        </div>

        {/* Current Project Stats */}
        {config && (
          <div className="p-4 border-b border-[#1f1f22]">
            <div className="text-xs text-gray-500 mb-2">Current Project</div>
            <div className="flex items-center gap-2 mb-3">
              <FolderOpen size={14} className="text-gray-400" />
              <span className="text-sm font-medium truncate">{getProjectName(configPath)}</span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <CheckCircle size={12} className="text-green-500" />
                <span className="text-green-500">{passedCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <XCircle size={12} className="text-red-500" />
                <span className="text-red-500">{failedCount}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-400">
                <Gauge size={12} />
                <span>{config?.config?.baseUrl || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Running indicator */}
        {isRunning && (
          <div className="px-4 py-2 bg-blue-500/10 border-b border-blue-500/20">
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <Activity size={12} className="animate-spin" />
              <span>Running tests...</span>
            </div>
          </div>
        )}

        {/* History */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 border-b border-[#1f1f22]">
            <div className="text-xs text-gray-500 font-medium mb-2 flex items-center gap-1">
              <Clock size={12} /> Recent Runs
            </div>
          </div>
          <div className="p-2">
            {testHistory.length > 0 ? (
              testHistory.slice(0, 15).map((test, i) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between p-2 rounded hover:bg-[#1a1a1d] cursor-pointer"
                  onClick={() => setSelectedScenarioId(test.id)}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm truncate">{test.id}</span>
                    <span className="text-[10px] text-gray-500 truncate">
                      {getProjectName(test.configPath)} • {formatTime(test.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {test.type === 'stress' && <Flame size={10} className="text-orange-400" />}
                    {test.status === 'passed' ? (
                      <CheckCircle size={14} className="text-green-500" />
                    ) : (
                      <XCircle size={14} className="text-red-500" />
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-gray-600 text-center py-8">
                No tests run yet
              </div>
            )}
          </div>
        </div>

        {/* Test List */}
        <div className="border-t border-[#1f1f22]">
          <div className="p-3">
            <div className="text-xs text-gray-500 font-medium mb-2">Test Cases</div>
          </div>
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
      <main className="flex-1 flex flex-col bg-[#0a0a0b]">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-4 left-4 z-10 p-2 bg-[#111113] border border-[#1f1f22] rounded-lg hover:bg-[#1a1a1d]"
        >
          <Server size={16} />
        </button>

        <div className="flex-1 p-8 overflow-y-auto">
          {selectedScenarioId ? (
            <div className="max-w-4xl mx-auto">
              <TestDetail
                id={selectedScenarioId}
                result={testResults[selectedScenarioId]}
                stressResult={stressResults[selectedScenarioId]}
                config={config}
                onRun={() => handleRunTest(selectedScenarioId)}
                onStress={() => handleRunStress(selectedScenarioId)}
              />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-600">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mb-4">
                <Activity size={40} className="opacity-30" />
              </div>
              <p className="text-lg">Select a test to view details</p>
              <p className="text-sm text-gray-600 mt-2">
                {config ? `${config.scenarios?.length || 0} tests loaded` : 'No configuration loaded'}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
