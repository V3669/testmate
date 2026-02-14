import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

function StressView({ id, result, onRun }) {
    if (!result) {
        return (
            <div className="bg-card border border-border rounded-lg p-6 text-center">
                <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2"><Activity /> {id}</h2>
                <p className="text-secondary mb-6">No stress test results available yet.</p>
                <button onClick={onRun} className="bg-accent text-white px-6 py-2 rounded-lg hover:bg-accent/90 flex items-center gap-2 mx-auto">
                    <Activity size={16} /> Run Stress Simulation
                </button>
            </div>
        );
    }

    const { metrics, status, failures } = result;

    // Prepare data for simple bar chart
    const data = [
        { name: 'p50', value: metrics.p50 },
        { name: 'p95', value: metrics.p95 },
        { name: 'p99', value: metrics.p99 },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between bg-card border border-border rounded-lg p-6">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        {id}
                        {status === 'passed' ? <CheckCircle className="text-success" /> : <XCircle className="text-error" />}
                    </h2>
                    <p className="text-secondary text-sm mt-1">
                        RPS: {metrics.rps} • Errors: {metrics.errors}
                    </p>
                </div>
                <button onClick={onRun} className="bg-accent text-white px-4 py-2 rounded-md hover:bg-accent/90 flex items-center gap-2">
                    <Activity size={16} /> Rerun Simulation
                </button>
            </div>

            {/* Failures */}
            {failures && failures.length > 0 && (
                <div className="bg-error/10 border border-error/50 rounded-lg p-6">
                    <h3 className="font-bold text-error flex items-center gap-2 mb-4">
                        <AlertTriangle size={18} /> Thresholds Exceeded
                    </h3>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        {failures.map((fail, i) => (
                            <li key={i}>{fail}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'p50 Latency', value: `${metrics.p50}ms`, color: 'text-primary' },
                    { label: 'p95 Latency', value: `${metrics.p95}ms`, color: 'text-warning' },
                    { label: 'p99 Latency', value: `${metrics.p99}ms`, color: 'text-error' },
                ].map((item, i) => (
                    <div key={i} className="bg-card p-4 rounded-lg border border-border text-center">
                        <div className="text-secondary text-xs uppercase tracking-wider">{item.label}</div>
                        <div className={`text-3xl font-bold ${item.color} mt-2`}>{item.value}</div>
                    </div>
                ))}
            </div>

            {/* Chart */}
            <div className="bg-card border border-border rounded-lg p-6 h-80">
                <h3 className="text-lg font-bold mb-4">Latency Distribution</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical">
                        <XAxis type="number" stroke="#64748b" />
                        <YAxis dataKey="name" type="category" stroke="#64748b" width={50} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                            itemStyle={{ color: '#f8fafc' }}
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        />
                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 2 ? '#ef4444' : index === 1 ? '#eab308' : '#3b82f6'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export default StressView;
