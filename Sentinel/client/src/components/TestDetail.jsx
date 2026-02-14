import React from 'react';
import { Play, RotateCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import StressView from './StressView';


function TestDetail({ id, result, stressResult, onRun, onStress, config }) {
    // We need the scenario definition to show details properly, but let's rely on result for now or assume props passed
    // Ideally App.jsx should pass the scenario config object too.

    // Determine scenario type if config is provided
    const scenario = config?.scenarios?.find(s => s.id === id);
    const isStress = scenario?.type === 'stress';

    if (isStress) {
        return <StressView id={id} result={stressResult} onRun={onStress} />;
    }

    if (!result && !stressResult) {
        return (
            <div className="bg-card border border-border rounded-lg p-6 text-center">
                <h2 className="text-2xl font-bold mb-4">{id}</h2>
                <p className="text-secondary mb-6">No results available yet.</p>
                <button onClick={onRun} className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2 mx-auto">
                    <Play size={16} /> Run Test
                </button>
            </div>
        );
    }

    const status = result?.status || 'pending';
    const isSuccess = status === 'passed';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between bg-card border border-border rounded-lg p-6">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        {id}
                        {isSuccess ? <CheckCircle className="text-success" /> : <XCircle className="text-error" />}
                    </h2>
                    <p className="text-secondary text-sm mt-1">
                        Latency: {result?.latency ? `${result.latency}ms` : 'N/A'} • {new Date(result?.timestamp).toLocaleTimeString()}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button onClick={onRun} className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2">
                        <RotateCw size={16} /> Rerun
                    </button>
                    {/* Only show stress run if applicable, but we don't know type here without config. 
                  Assuming functional for now. */}
                </div>
            </div>

            {/* Failure Details */}
            {!isSuccess && result?.details?.failures && (
                <div className="bg-error/10 border border-error/50 rounded-lg p-6">
                    <h3 className="font-bold text-error flex items-center gap-2 mb-4">
                        <AlertTriangle size={18} /> Failures Detected
                    </h3>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        {result.details.failures.map((fail, i) => (
                            <li key={i}>{fail}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Request/Response Viewer */}
            <div className="grid grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-lg p-4 font-mono text-xs overflow-auto h-96">
                    <h3 className="font-bold text-secondary mb-2 uppercase tracking-wider">Expected / Request</h3>
                    <pre className="text-green-400">
                        {JSON.stringify(result?.details?.request || {}, null, 2)}
                    </pre>
                </div>
                <div className="bg-card border border-border rounded-lg p-4 font-mono text-xs overflow-auto h-96">
                    <h3 className="font-bold text-secondary mb-2 uppercase tracking-wider">Actual / Response</h3>
                    <pre className="text-blue-400">
                        {JSON.stringify(result?.details?.response || {}, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    );
}

export default TestDetail;
