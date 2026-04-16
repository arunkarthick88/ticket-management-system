import { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Download } from 'lucide-react';
import api from './api';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

export default function Analytics() {
    const [analytics, setAnalytics] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            const response = await api.get('/admin/analytics');
            // Thanks to our api.js interceptor, response.data is already the pure data object!
            setAnalytics(response.data);
        } catch (error) {
            console.error("Failed to fetch analytics", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div className="text-purple-500 animate-pulse p-6 font-medium">Loading analytics...</div>;
    if (!analytics) return <div className="text-red-500 p-6">Failed to load analytics data.</div>;

    // Provide fallback data in case the database is completely empty
    const statuses = analytics.status_distribution || {};
    const priorities = analytics.priority_distribution || {};

    const statusData = {
        labels: Object.keys(statuses).length > 0 ? Object.keys(statuses) : ['No Data'],
        datasets: [{
            data: Object.keys(statuses).length > 0 ? Object.values(statuses) : [1],
            backgroundColor: ['#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#E5E7EB'],
            borderWidth: 0,
        }]
    };

    const priorityData = {
        labels: Object.keys(priorities).length > 0 ? Object.keys(priorities) : ['No Data'],
        datasets: [{
            label: 'Number of Tickets',
            data: Object.keys(priorities).length > 0 ? Object.values(priorities) : [0],
            backgroundColor: '#8B5CF6',
            borderRadius: 4,
        }]
    };

    const handleExport = async () => {
        try {
            const response = await api.get('/admin/export-csv', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'it_helpdesk_tickets.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            alert("Failed to export CSV");
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-6 mb-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">System Analytics</h2>
                <button onClick={handleExport} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center">
                    <Download className="w-4 h-4 mr-2" />
                    Export to CSV
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 flex flex-col items-center shadow-inner">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Tickets by Status</h3>
                    <div className="w-48 h-48">
                        <Doughnut data={statusData} options={{ maintainAspectRatio: false, cutout: '70%' }} />
                    </div>
                </div>
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 flex flex-col items-center shadow-inner">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Tickets by Priority</h3>
                    <div className="w-full h-48">
                        <Bar data={priorityData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                    </div>
                </div>
            </div>
        </div>
    );
}