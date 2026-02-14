import React from 'react';
import { Play, Zap, CheckCircle, XCircle, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function TestList({ config, results, stressResults, selectedId, onSelect }) {
    if (!config || !config.scenarios) {
        // Fallback if no config loaded yet
        const resultKeys = Object.keys(results);
        if (resultKeys.length === 0) return <div className="text-secondary text-sm p-4">Waiting for config...</div>;

        return (
            <div className="space-y-2">
                {resultKeys.map(id => (
                    <div key={id} onClick={() => onSelect(id)} className="p-3 bg-card border border-border rounded opacity-50 cursor-pointer">
                        {id}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {config.scenarios.map(scenario => {
                const isSelected = selectedId === scenario.id;
                const result = results[scenario.id]; // Functional result
                const stress = stressResults[scenario.id]; // Stress result

                let status = 'pending';
                let latency = null;

                if (scenario.type === 'stress') {
                    status = stress?.status || 'pending';
                    // Stress latency is complex, maybe show p95
                    latency = stress?.metrics?.p95;
                } else {
                    status = result?.status || 'pending';
                    latency = result?.latency;
                }

                return (
                    <div
                        key={scenario.id}
                        onClick={() => onSelect(scenario.id)}
                        className={twMerge(
                            "p-3 rounded-lg border border-transparent cursor-pointer transition-all hover:bg-white/5",
                            isSelected && "bg-primary/10 border-primary/50 shadow-sm"
                        )}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm truncate">{scenario.id}</span>
                            {status === 'passed' && <CheckCircle size={14} className="text-success" />}
                            {status === 'failed' && <XCircle size={14} className="text-error" />}
                            {status === 'pending' && <Clock size={14} className="text-warning" />}
                            {status === 'processing' || status === 'running' && <RotateCw size={14} className="text-primary animate-spin" />}
                        </div>

                        <div className="flex items-center justify-between text-xs text-secondary">
                            <span className="flex items-center gap-1">
                                {scenario.type === 'functional' ? <Play size={10} /> : <Zap size={10} />}
                                {scenario.type}
                            </span>
                            {latency != null && <span>{latency}ms</span>}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default TestList;
