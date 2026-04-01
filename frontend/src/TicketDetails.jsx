import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Tag, AlertTriangle, MessageSquare, Send, Activity, RefreshCw } from 'lucide-react';
import api from './api';

export default function TicketDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [ticket, setTicket] = useState(null);
    const [updates, setUpdates] = useState([]);
    const [activities, setActivities] = useState([]); // Phase 4: Audit Trail State
    const [newUpdate, setNewUpdate] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    
    // Phase 4: Reopen Ticket States
    const [isReopening, setIsReopening] = useState(false);
    const [reopenReason, setReopenReason] = useState('');

    useEffect(() => {
        api.get('/auth/me').then(res => setCurrentUser(res.data));
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            const ticketRes = await api.get(`/tickets/${id}`);
            setTicket(ticketRes.data);
            
            try {
                const updatesRes = await api.get(`/tickets/${id}/updates`);
                setUpdates(updatesRes.data);
            } catch (err) { console.log("No updates access"); }
            
            // PHASE 4: Fetch Audit Trail
            try {
                const activityRes = await api.get(`/tickets/${id}/activity`);
                setActivities(activityRes.data);
            } catch (err) { console.log("No activity access"); }

        } catch (error) {
            console.error("Error fetching ticket:", error);
        }
    };

    const handleAddUpdate = async (e) => {
        e.preventDefault();
        if (!newUpdate.trim()) return;
        try {
            await api.post(`/tickets/${id}/updates`, { message: newUpdate });
            setNewUpdate('');
            fetchData();
        } catch (error) { alert("Failed to add update."); }
    };

    // PHASE 4: Reopen Ticket Logic
    const handleReopen = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/tickets/${id}/reopen`, { reason: reopenReason });
            setIsReopening(false);
            setReopenReason('');
            fetchData(); // Refresh everything to show it's Open again!
        } catch (error) {
            alert(error.response?.data?.detail || "Failed to reopen ticket.");
        }
    };

    if (!ticket || !currentUser) return <div className="text-center p-8">Loading ticket...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <button onClick={() => navigate(-1)} className="inline-flex items-center space-x-2 text-purple-600 hover:text-purple-800 font-medium transition">
                <ArrowLeft className="w-5 h-5" />
                <span>Go Back</span>
            </button>

            {/* Top Ticket Info Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
                <div className="p-8 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white">
                    <div className="flex justify-between items-start mb-4">
                        <h1 className="text-3xl font-extrabold text-gray-900">{ticket.title}</h1>
                        <span className={`text-sm font-bold px-4 py-1.5 rounded-full shadow-sm ${ticket.status === 'Closed' ? 'bg-gray-600 text-white' : 'bg-purple-600 text-white'}`}>
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
                    </div>
                </div>

                <div className="p-8">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Original Description</h3>
                    <div className="bg-gray-50 p-6 rounded-xl text-gray-700 leading-relaxed whitespace-pre-wrap border border-gray-100">
                        {ticket.description}
                    </div>

                    {/* PHASE 4: REOPEN TICKET UI */}
                    {ticket.status === 'Closed' && currentUser.role === 'user' && currentUser.id === ticket.created_by && (
                        <div className="mt-8 pt-6 border-t border-gray-100">
                            {!isReopening ? (
                                <button onClick={() => setIsReopening(true)} className="flex items-center space-x-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-xl font-bold transition">
                                    <RefreshCw className="w-5 h-5" />
                                    <span>Reopen this Ticket</span>
                                </button>
                            ) : (
                                <form onSubmit={handleReopen} className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Why are you reopening this ticket?</label>
                                    <textarea required value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} rows="2" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-4 outline-none mb-3" placeholder="State your reason..."></textarea>
                                    <div className="flex space-x-3">
                                        <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold">Submit</button>
                                        <button type="button" onClick={() => setIsReopening(false)} className="text-gray-500 hover:text-gray-700 font-bold px-4 py-2">Cancel</button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Grid Layout for Timeline and Updates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* PHASE 4: AUDIT TRAIL TIMELINE */}
                <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex items-center space-x-2 text-gray-800 bg-gray-50">
                        <Activity className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-bold">Activity Timeline</h2>
                    </div>
                    <div className="p-6 max-h-[500px] overflow-y-auto">
                        <div className="relative border-l-2 border-gray-200 ml-3 space-y-6">
                            {activities.map(act => (
                                <div key={act.id} className="relative pl-6">
                                    <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-blue-100 border-2 border-blue-500"></span>
                                    <p className="text-sm font-bold text-gray-800">{act.action}</p>
                                    <span className="text-xs text-gray-400">{new Date(act.created_at).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Updates Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex items-center space-x-2 text-gray-800 bg-gray-50">
                        <MessageSquare className="w-5 h-5 text-purple-600" />
                        <h2 className="text-lg font-bold">Staff Updates</h2>
                    </div>
                    <div className="p-6 space-y-6 max-h-[500px] overflow-y-auto">
                        {updates.length === 0 ? (
                            <p className="text-gray-500 text-center text-sm">No updates posted yet.</p>
                        ) : (
                            <div className="space-y-4">
                                {updates.map(update => (
                                    <div key={update.id} className="bg-purple-50/50 border border-purple-100 p-4 rounded-xl">
                                        <span className="text-xs text-gray-500 block mb-1">{new Date(update.created_at).toLocaleString()}</span>
                                        <p className="text-gray-700 text-sm whitespace-pre-wrap">{update.message}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {(currentUser.role === 'admin' || currentUser.role === 'support') && ticket.status !== 'Closed' && (
                            <form onSubmit={handleAddUpdate} className="mt-4 pt-4 border-t border-gray-100">
                                <textarea required value={newUpdate} onChange={(e) => setNewUpdate(e.target.value)} rows="2" className="w-full p-3 border border-gray-300 rounded-lg outline-none mb-3 text-sm" placeholder="Add troubleshooting note..."></textarea>
                                <button type="submit" className="w-full bg-purple-600 text-white font-bold py-2 rounded-lg hover:bg-purple-700 transition flex justify-center items-center space-x-2 text-sm">
                                    <Send className="w-4 h-4" />
                                    <span>Post</span>
                                </button>
                            </form>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}