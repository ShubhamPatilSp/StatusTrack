"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface MetricDataPoint {
  timestamp: string;
  value: number;
}

interface MetricGraphProps {
  data: MetricDataPoint[];
  loading: boolean;
}

const MetricGraph: React.FC<MetricGraphProps> = ({ data, loading }) => {
  if (loading) {
    return <div className="text-center p-4">Loading...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="text-center p-4">No metric data available.</div>;
  }

  return (
    <div className="h-64 bg-gray-800 p-4 rounded-lg">
        <ResponsiveContainer width="100%" height="100%">
            <LineChart
                data={data}
                margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                <XAxis 
                    dataKey="timestamp" 
                    stroke="#cbd5e0" 
                    tickFormatter={(timeStr) => new Date(timeStr).toLocaleTimeString()}
                />
                <YAxis stroke="#cbd5e0" />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#2d3748', border: 'none' }} 
                    labelStyle={{ color: '#e2e8f0' }}
                />
                <Legend wrapperStyle={{ color: '#e2e8f0' }} />
                <Line type="monotone" dataKey="value" stroke="#8884d8" activeDot={{ r: 8 }} />
            </LineChart>
        </ResponsiveContainer>
    </div>
  );
};

export default MetricGraph;
