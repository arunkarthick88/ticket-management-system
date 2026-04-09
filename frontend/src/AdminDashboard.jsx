import Analytics from './Analytics'; // Or './components/Analytics' depending on your folder structure
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Search, AlertOctagon, Clock, CheckCircle } from 'lucide-react';
import api from './api';

export default function AdminDashboard() {
    const [tickets, setTickets] = useState([]);
    const [supportUsers, setSupportUsers] = useState([]);
    
    // Pagination and Filter States
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');

    // --- PHASE 6: SLA Summary State ---
    const [slaSummary, setSlaSummary] = useState({ breached_count: 0, at_risk_count: 0, compliance_percentage: 0 });

    useEffect(() => {
        fetchData();
    }, [page, statusFilter, priorityFilter]);

    const fetchData = async () => {
        try {
            // PHASE 6: Added the SLA Summary endpoint to our concurrent fetch request!
            const [ticketsRes, usersRes, slaRes] = await Promise.all([
                api.get('/admin/tickets/search', {
                    params: {
                        page: page,
                        limit: 10,
                        search: searchTerm,
                        status: statusFilter || null,
                        priority: priorityFilter || null
                    }
                }),
                api.get('/admin/support-users'),
                api.get('/admin/sla-summary') // Fetching our new SLA numbers!
            ]);
            
            setTickets(ticketsRes.data.data);
            setTotalPages(ticketsRes.data.meta.total_pages);
            setSupportUsers(usersRes.data);
            setSlaSummary(slaRes.data); // Save the SLA data
        } catch (error) {
            console.error("Error fetching admin data:", error);
        }
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setPage(1); 
        fetchData();
    };

    const handleUpdate = async (ticketId, field, value) => {
        try {
            let endpoint = '';
            let payload = {};

            if (field === 'assign') {
                endpoint = `/tickets/${ticketId}/assign`;
                payload = { assigned_to: parseInt(value) };
            } else if (field === 'status') {
                endpoint = `/tickets/${ticketId}/status`;
                payload = { status: value };
            } else if (field === 'priority') {
                endpoint = `/tickets/${ticketId}/priority`;
                payload = { priority: value };
            }

            await api.patch(endpoint, payload);
            fetchData(); // Refresh table AND SLA stats automatically!
        } catch (error) {
            alert(`Failed to update ${field}`);
        }
    };

    return (
        <div className="space-y-8">
            <Analytics />

            {/* --- PHASE 6: SLA SUMMARY CARDS --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Breached Card */}
                <div className="bg-red-50 border border-red-100 p-6 rounded-2xl flex items-center justify-between shadow-sm transition hover:shadow-md">
                    <div>
                        <p className="text-red-600 text-sm font-bold uppercase tracking-wider">SLA Breached</p>
                        <h3 className="text-3xl font-extrabold text-red-900 mt-1">{slaSummary.breached_count}</h3>
                    </div>
                    <div className="bg-red-200 p-3 rounded-xl">
                        <AlertOctagon className="w-8 h-8 text-red-600" />
                    </div>
                </div>

                {/* At Risk Card */}
                <div className="bg-orange-50 border border-orange-100 p-6 rounded-2xl flex items-center justify-between shadow-sm transition hover:shadow-md">
                    <div>
                        <p className="text-orange-600 text-sm font-bold uppercase tracking-wider">Tickets At Risk</p>
                        <h3 className="text-3xl font-extrabold text-orange-900 mt-1">{slaSummary.at_risk_count}</h3>
                    </div>
                    <div className="bg-orange-200 p-3 rounded-xl">
                        <Clock className="w-8 h-8 text-orange-600" />
                    </div>
                </div>

                {/* Compliance Card */}
                <div className="bg-green-50 border border-green-100 p-6 rounded-2xl flex items-center justify-between shadow-sm transition hover:shadow-md">
                    <div>
                        <p className="text-green-600 text-sm font-bold uppercase tracking-wider">SLA Compliance</p>
                        <h3 className="text-3xl font-extrabold text-green-900 mt-1">{slaSummary.compliance_percentage}%</h3>
                    </div>
                    <div className="bg-green-200 p-3 rounded-xl">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
                <div className="p-6 border-b border-purple-50 bg-gradient-to-r from-purple-800 to-purple-600 flex flex-col md:flex-row justify-between items-start md:items-center text-white gap-4">
                    <div className="flex items-center space-x-3">
                        <ShieldAlert className="w-6 h-6" />
                        <h2 className="text-2xl font-bold">Admin Command Center</h2>
                    </div>
                    
                    <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-3 w-full md:w-auto">
                        <div className="relative flex-grow md:flex-grow-0">
                            <input 
                                type="text" 
                                placeholder="Search tickets..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full text-gray-900 text-sm rounded-lg pl-3 pr-10 py-2 focus:ring-2 focus:ring-purple-300 outline-none"
                            />
                            <button type="submit" className="absolute right-2 top-2 text-gray-500 hover:text-purple-600">
                                <Search className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <select 
                            value={statusFilter} 
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                            className="text-gray-900 text-sm rounded-lg px-3 py-2 outline-none cursor-pointer"
                        >
                            <option value="">All Statuses</option>
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Resolved">Resolved</option>
                            <option value="Closed">Closed</option>
                        </select>

                        <select 
                            value={priorityFilter} 
                            onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
                            className="text-gray-900 text-sm rounded-lg px-3 py-2 outline-none cursor-pointer"
                        >
                            <option value="">All Priorities</option>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Urgent">Urgent</option>
                        </select>
                    </form>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider border-b">
                                <th className="p-4 font-bold">Ticket Info</th>
                                <th className="p-4 font-bold">Status</th>
                                <th className="p-4 font-bold">Priority</th>
                                <th className="p-4 font-bold">Assigned To</th>
                                <th className="p-4 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {tickets.map((ticket) => (
                                <tr key={ticket.id} className="hover:bg-purple-50/50 transition">
                                    <td className="p-4">
                                        <p className="font-bold text-gray-900">{ticket.title}</p>
                                        <p className="text-xs text-gray-500 mt-1">{ticket.category}</p>
                                    </td>
                                    <td className="p-4">
                                        <select 
                                            value={ticket.status} 
                                            onChange={(e) => handleUpdate(ticket.id, 'status', e.target.value)}
                                            className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2 outline-none"
                                        >
                                            <option value="Open">Open</option>
                                            <option value="In Progress">In Progress</option>
                                            <option value="Resolved">Resolved</option>
                                            <option value="Closed">Closed</option>
                                        </select>
                                    </td>
                                    <td className="p-4">
                                        <select 
                                            value={ticket.priority} 
                                            onChange={(e) => handleUpdate(ticket.id, 'priority', e.target.value)}
                                            className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2 outline-none"
                                        >
                                            <option value="Low">Low</option>
                                            <option value="Medium">Medium</option>
                                            <option value="High">High</option>
                                            <option value="Urgent">Urgent</option>
                                        </select>
                                    </td>
                                    <td className="p-4">
                                        <select 
                                            value={ticket.assigned_to || ""} 
                                            onChange={(e) => handleUpdate(ticket.id, 'assign', e.target.value)}
                                            className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2 outline-none"
                                        >
                                            <option value="">Unassigned</option>
                                            {supportUsers.map(user => (
                                                <option key={user.id} value={user.id}>{user.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-4 text-right">
                                        <Link to={`/dashboard/ticket/${ticket.id}`} className="text-purple-600 hover:text-purple-900 font-medium text-sm">
                                            View Details
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {tickets.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-500">
                                        No tickets found matching your search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
                        <button 
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-600 font-medium">
                            Page {page} of {totalPages}
                        </span>
                        <button 
                            disabled={page === totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}