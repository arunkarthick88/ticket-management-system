import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, AlertCircle, Search } from 'lucide-react';
import api from './api';

export default function MyTickets() {
    const [tickets, setTickets] = useState([]);

    useEffect(() => {
        fetchTickets();
    }, []);

    const fetchTickets = async () => {
        try {
            const response = await api.get('/tickets/my');
            setTickets(response.data);
        } catch (error) {
            console.error("Error fetching tickets:", error);
        }
    };

    const getStatusColor = (status) => {
        switch(status) {
            case 'Open': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'In Progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'Resolved': return 'bg-green-100 text-green-800 border-green-200';
            case 'Closed': return 'bg-gray-100 text-gray-800 border-gray-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
            <div className="p-6 border-b border-purple-50 bg-white flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">My Tickets</h2>
                <span className="bg-purple-100 text-purple-800 text-sm font-bold px-4 py-1.5 rounded-full">
                    {tickets.length} Total
                </span>
            </div>
            
            <div className="divide-y divide-gray-50">
                {tickets.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center">
                        <Search className="w-12 h-12 text-gray-300 mb-4" />
                        <p className="text-gray-500 text-lg">You haven't submitted any tickets yet.</p>
                        <Link to="/dashboard/create" className="mt-4 text-purple-600 font-bold hover:underline">Submit one now</Link>
                    </div>
                ) : (
                    tickets.map((ticket) => (
                        <div key={ticket.id} className="p-6 hover:bg-purple-50/50 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                    <h3 className="text-lg font-bold text-gray-900">{ticket.title}</h3>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(ticket.status)}`}>
                                        {ticket.status}
                                    </span>
                                </div>
                                <div className="flex items-center space-x-6 text-sm text-gray-500">
                                    <span className="flex items-center">
                                        <AlertCircle className="w-4 h-4 mr-1.5 text-gray-400" />
                                        {ticket.priority} Priority
                                    </span>
                                    <span className="flex items-center">
                                        <Clock className="w-4 h-4 mr-1.5 text-gray-400" />
                                        {new Date(ticket.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                            
                            <Link to={`/dashboard/ticket/${ticket.id}`} 
                                  className="shrink-0 bg-purple-100 text-purple-700 font-bold px-6 py-2.5 rounded-lg hover:bg-purple-600 hover:text-white transition-colors duration-200 text-center">
                                View Details
                            </Link>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}