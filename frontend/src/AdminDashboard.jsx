import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Users, Activity } from 'lucide-react';
import api from './api';

export default function AdminDashboard() {
    const [tickets, setTickets] = useState([]);
    const [supportUsers, setSupportUsers] = useState([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [ticketsRes, usersRes] = await Promise.all([
                api.get('/admin/tickets'),
                api.get('/admin/support-users')
            ]);
            setTickets(ticketsRes.data);
            setSupportUsers(usersRes.data);
        } catch (error) {
            console.error("Error fetching admin data:", error);
        }
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
            fetchData(); // Refresh the table to show the new data
        } catch (error) {
            alert(`Failed to update ${field}`);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
            <div className="p-6 border-b border-purple-50 bg-gradient-to-r from-purple-800 to-purple-600 flex justify-between items-center text-white">
                <div className="flex items-center space-x-3">
                    <ShieldAlert className="w-6 h-6" />
                    <h2 className="text-2xl font-bold">Admin Command Center</h2>
                </div>
                <span className="bg-white/20 px-4 py-1.5 rounded-full text-sm font-bold backdrop-blur-sm">
                    {tickets.length} Total Tickets
                </span>
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
                    </tbody>
                </table>
            </div>
        </div>
    );
}