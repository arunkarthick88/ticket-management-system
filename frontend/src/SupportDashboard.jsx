import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Clock, AlertCircle } from 'lucide-react';
import api from './api';

export default function SupportDashboard() {
    const [assignedTickets, setAssignedTickets] = useState([]);

    useEffect(() => {
        const fetchAssignedTickets = async () => {
            try {
                // Notice this calls the specific /support/ endpoint!
                const response = await api.get('/support/tickets');
                setAssignedTickets(response.data);
            } catch (error) {
                console.error("Error fetching assigned tickets:", error);
            }
        };
        fetchAssignedTickets();
    }, []);

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
            <div className="p-6 border-b border-purple-50 bg-gradient-to-r from-indigo-700 to-purple-600 flex justify-between items-center text-white">
                <div className="flex items-center space-x-3">
                    <Briefcase className="w-6 h-6" />
                    <h2 className="text-2xl font-bold">My Assigned Work</h2>
                </div>
                <span className="bg-white/20 px-4 py-1.5 rounded-full text-sm font-bold backdrop-blur-sm">
                    {assignedTickets.length} Active Tasks
                </span>
            </div>
            
            <div className="divide-y divide-gray-50">
                {assignedTickets.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center">
                        <Briefcase className="w-12 h-12 text-gray-300 mb-4" />
                        <p className="text-gray-500 text-lg">You have no tickets assigned to you right now.</p>
                        <p className="text-sm text-gray-400 mt-2">Time for a coffee break! ☕</p>
                    </div>
                ) : (
                    assignedTickets.map((ticket) => (
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
                                        Created: {new Date(ticket.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                            
                            <Link to={`/dashboard/ticket/${ticket.id}`} 
                                  className="shrink-0 bg-indigo-100 text-indigo-700 font-bold px-6 py-2.5 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors duration-200 text-center">
                                Work on Ticket
                            </Link>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}