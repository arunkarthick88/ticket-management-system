import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Chart as ChartJS, ArcElement, Tooltip, Legend, 
  CategoryScale, LinearScale, BarElement, Title 
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

// Register Chart.js elements
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const Analytics = () => {
    const [analytics, setAnalytics] = useState(null);

    // Make sure this matches how you normally configure Axios with your JWT token!
    const fetchAnalytics = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('http://localhost:8000/admin/analytics', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAnalytics(response.data);
        } catch (error) {
            console.error("Failed to fetch analytics", error);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const handleExportCSV = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('http://localhost:8000/admin/export-csv', {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob', // Important for file downloads!
            });
            
            // Create a temporary link to trigger the browser download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'tickets_export.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error("Failed to export CSV", error);
        }
    };

    if (!analytics) return <div className="p-4 text-gray-500">Loading analytics...</div>;

    // Prepare data for the Status Doughnut Chart
    const statusData = {
        labels: Object.keys(analytics.status_distribution),
        datasets: [{
            data: Object.values(analytics.status_distribution),
            backgroundColor: ['#8b5cf6', '#3b82f6', '#10b981', '#ef4444', '#f59e0b'],
            borderWidth: 1,
        }],
    };

    // Prepare data for the Priority Bar Chart
    const priorityData = {
        labels: Object.keys(analytics.priority_distribution),
        datasets: [{
            label: 'Number of Tickets',
            data: Object.values(analytics.priority_distribution),
            backgroundColor: '#8b5cf6',
        }],
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">System Analytics</h2>
                <button 
                    onClick={handleExportCSV}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded shadow transition text-sm font-medium"
                >
                    Export to CSV
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Status Chart */}
                <div className="bg-gray-50 p-4 rounded-lg flex flex-col items-center">
                    <h3 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wider">Tickets by Status</h3>
                    <div className="w-64 h-64">
                        <Doughnut data={statusData} options={{ maintainAspectRatio: false }} />
                    </div>
                </div>

                {/* Priority Chart */}
                <div className="bg-gray-50 p-4 rounded-lg flex flex-col items-center">
                    <h3 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wider">Tickets by Priority</h3>
                    <div className="w-full h-64">
                        <Bar data={priorityData} options={{ maintainAspectRatio: false }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;