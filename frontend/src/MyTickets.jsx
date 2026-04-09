import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, Plus, Clock, AlertOctagon, CheckCircle, AlertTriangle } from 'lucide-react';
import api from './api';

export default function MyTickets() {
    const [tickets, setTickets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchTickets();
    }, []);

    const fetchTickets = async () => {
        try {
            const response = await api.get('/tickets/my');
            setTickets(response.data);
        } catch (error) {
            console.error("Failed to fetch tickets", error);
        } finally {
            setIsLoading(false);
        }
    };

    // --- PHASE 6: Helper function for SLA UI styling ---
    const getSlaBadge = (status) => {
        switch(status) {
            case 'on_track': return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold flex items-center whitespace-nowrap"><CheckCircle className="w-3 h-3 mr-1" /> On Track</span>;
            case 'at_risk': return <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold flex items-center whitespace-nowrap"><Clock className="w-3 h-3 mr-1" /> At Risk</span>;
            case 'breached': return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold flex items-center whitespace-nowrap"><AlertOctagon className="w-3 h-3 mr-1" /> Breached</span>;
            case 'completed': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold flex items-center whitespace-nowrap"><CheckCircle className="w-3 h-3 mr-1" /> SLA Met</span>;
            default: return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">Unknown</span>;
        }
    };

    if (isLoading) return <div className="text-center p-8 text-gray-500">Loading your tickets...</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-6 mt-4">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                        <Ticket className="w-6 h-6 mr-2 text-purple-600" />
                        My Tickets
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">View and track the status of your support requests.</p>
                </div>
                <Link 
                    to="/dashboard/create" 
                    className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-bold transition shadow-sm flex items-center space-x-2"
                >
                    <Plus className="w-5 h-5" />
                    <span>Submit New Ticket</span>
                </Link>
            </div>

            {/* Tickets Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider border-b">
                                <th className="p-4 font-bold">Ticket Details</th>
                                <th className="p-4 font-bold">Category</th>
                                <th className="p-4 font-bold">Status</th>
                                <th className="p-4 font-bold">SLA Health</th>
                                <th className="p-4 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {tickets.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-500">
                                        You haven't submitted any tickets yet.
                                    </td>
                                </tr>
                            ) : (
                                tickets.map((ticket) => (
                                    <tr key={ticket.id} className="hover:bg-purple-50/50 transition">
                                        <td className="p-4">
                                            <p className="font-bold text-gray-900">{ticket.title}</p>
                                            <div className="flex items-center text-xs text-gray-500 mt-1 space-x-3">
                                                <span>#{ticket.id}</span>
                                                <span>•</span>
                                                <span>Created: {new Date(ticket.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-sm text-gray-700 bg-gray-100 px-3 py-1 rounded-lg">
                                                {ticket.category}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                                                ticket.status === 'Closed' ? 'bg-gray-200 text-gray-700' : 
                                                ticket.status === 'Resolved' ? 'bg-green-100 text-green-700' :
                                                'bg-purple-100 text-purple-700'
                                            }`}>
                                                {ticket.status}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {/* PHASE 6: Render the SLA Badge here! */}
                                            <div className="flex flex-col items-start gap-1">
                                                {getSlaBadge(ticket.sla_status)}
                                                {ticket.due_at && ticket.status !== 'Closed' && ticket.status !== 'Resolved' && (
                                                    <span className="text-[10px] text-gray-400 font-medium ml-1">
                                                        Due: {new Date(ticket.due_at).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <Link 
                                                to={`/dashboard/ticket/${ticket.id}`} 
                                                className="text-purple-600 hover:text-purple-900 font-medium text-sm bg-purple-50 hover:bg-purple-100 px-4 py-2 rounded-lg transition"
                                            >
                                                View
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}