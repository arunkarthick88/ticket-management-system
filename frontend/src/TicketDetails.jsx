import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Tag, AlertTriangle, MessageSquare, Send } from 'lucide-react';
import api from './api';

export default function TicketDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [ticket, setTicket] = useState(null);
    const [updates, setUpdates] = useState([]);
    const [newUpdate, setNewUpdate] = useState('');
    const [currentUserRole, setCurrentUserRole] = useState('');

    useEffect(() => {
        fetchData();
        // Get current user role so we know if we should show the comment form
        api.get('/auth/me').then(res => setCurrentUserRole(res.data.role));
    }, [id]);

    const fetchData = async () => {
        try {
            const ticketRes = await api.get(`/tickets/${id}`);
            setTicket(ticketRes.data);
            
            // Fetch updates (This might fail for standard users due to RBAC, which is fine)
            try {
                const updatesRes = await api.get(`/tickets/${id}/updates`);
                setUpdates(updatesRes.data);
            } catch (err) {
                console.log("No access to updates or none exist");
            }
        } catch (error) {
            console.error("Error fetching ticket:", error);
        }
    };

    const handleAddUpdate = async (e) => {
        e.preventDefault();
        if (!newUpdate.trim()) return;
        
        try {
            await api.post(`/tickets/${id}/updates`, { message: newUpdate });
            setNewUpdate(''); // Clear input
            fetchData(); // Refresh list
        } catch (error) {
            alert("Failed to add update. Ensure you have permission.");
        }
    };

    const handleBack = () => {
        navigate(-1); // Goes back to whatever dashboard they came from
    };

    if (!ticket) return <div className="text-center p-8">Loading ticket...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <button onClick={handleBack} className="inline-flex items-center space-x-2 text-purple-600 hover:text-purple-800 font-medium transition">
                <ArrowLeft className="w-5 h-5" />
                <span>Go Back</span>
            </button>

            {/* Top Ticket Info Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
                <div className="p-8 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white">
                    <div className="flex justify-between items-start mb-4">
                        <h1 className="text-3xl font-extrabold text-gray-900">{ticket.title}</h1>
                        <span className="bg-purple-600 text-white text-sm font-bold px-4 py-1.5 rounded-full shadow-sm">
                            {ticket.status}
                        </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <span className="flex items-center bg-white px-3 py-1 rounded-lg border border-gray-200 shadow-sm">
                            <Tag className="w-4 h-4 mr-2 text-purple-500" /> {ticket.category}
                        </span>
                        <span className="flex items-center bg-white px-3 py-1 rounded-lg border border-gray-200 shadow-sm">
                            <AlertTriangle className="w-4 h-4 mr-2 text-orange-500" /> {ticket.priority} Priority
                        </span>
                        <span className="flex items-center bg-white px-3 py-1 rounded-lg border border-gray-200 shadow-sm">
                            <Calendar className="w-4 h-4 mr-2 text-blue-500" /> {new Date(ticket.created_at).toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="p-8">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Original Description</h3>
                    <div className="bg-gray-50 p-6 rounded-xl text-gray-700 leading-relaxed whitespace-pre-wrap border border-gray-100">
                        {ticket.description}
                    </div>
                </div>
            </div>

            {/* Updates Section (Visible to everyone involved) */}
            <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center space-x-2 text-gray-800">
                    <MessageSquare className="w-5 h-5 text-purple-600" />
                    <h2 className="text-xl font-bold">Ticket Updates & Activity</h2>
                </div>
                
                <div className="p-6 space-y-6">
                    {updates.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No updates have been posted yet.</p>
                    ) : (
                        <div className="space-y-4">
                            {updates.map(update => (
                                <div key={update.id} className="bg-purple-50/50 border border-purple-100 p-5 rounded-xl">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-purple-800 text-sm">Support Update</span>
                                        <span className="text-xs text-gray-500">{new Date(update.created_at).toLocaleString()}</span>
                                    </div>
                                    <p className="text-gray-700 whitespace-pre-wrap">{update.message}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ONLY Admin and Support can post new updates */}
                    {(currentUserRole === 'admin' || currentUserRole === 'support') && (
                        <form onSubmit={handleAddUpdate} className="mt-8 pt-6 border-t border-gray-100">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Add New Update</label>
                            <textarea 
                                required 
                                value={newUpdate} 
                                onChange={(e) => setNewUpdate(e.target.value)} 
                                rows="3"
                                className="w-full p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 outline-none resize-none transition mb-3" 
                                placeholder="Type your troubleshooting notes or feedback here..."
                            ></textarea>
                            <div className="flex justify-end">
                                <button type="submit" className="bg-purple-600 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-purple-700 transition flex items-center space-x-2">
                                    <Send className="w-4 h-4" />
                                    <span>Post Update</span>
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}