import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Tag, AlertTriangle, MessageSquare, Send, Activity, RefreshCw, Paperclip, Download, Clock, AlertOctagon, CheckCircle, GitCommit } from 'lucide-react';
import api from './api';

export default function TicketDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [ticket, setTicket] = useState(null);
    const [updates, setUpdates] = useState([]);
    const [activities, setActivities] = useState([]); 
    const [newUpdate, setNewUpdate] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    
    // --- PHASE 5: Workflow Engine States ---
    const [allowedStatuses, setAllowedStatuses] = useState([]);
    const [statusHistory, setStatusHistory] = useState([]);
    const [isReopening, setIsReopening] = useState(false);
    const [reopenReason, setReopenReason] = useState('');

    const [attachments, setAttachments] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        api.get('/auth/me').then(res => setCurrentUser(res.data));
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            const ticketRes = await api.get(`/tickets/${id}`);
            setTicket(ticketRes.data);
            
            // --- PHASE 5: Fetch Workflow Data ---
            try {
                const allowedRes = await api.get(`/tickets/${id}/allowed-statuses`);
                setAllowedStatuses(allowedRes.data?.allowed_next_statuses || []);
                
                const historyRes = await api.get(`/tickets/${id}/status-history`);
                setStatusHistory(historyRes.data || []);
            } catch (err) { console.log("Workflow access restricted"); }

            try {
                const updatesRes = await api.get(`/tickets/${id}/updates`);
                setUpdates(updatesRes.data);
            } catch (err) { console.log("No updates access"); }
            
            try {
                const activityRes = await api.get(`/tickets/${id}/activity`);
                setActivities(activityRes.data);
            } catch (err) { console.log("No activity access"); }

            try {
                const attachRes = await api.get(`/tickets/${id}/attachments`);
                setAttachments(attachRes.data);
            } catch (err) { console.log("No attachments access"); }

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

    // --- PHASE 5: Handle Strict Reopen ---
    const handleReopen = async (e) => {
        e.preventDefault();
        if (!reopenReason.trim()) return alert("Reason is required!");
        try {
            await api.patch(`/tickets/${id}/reopen`, { reason: reopenReason });
            setIsReopening(false);
            setReopenReason('');
            fetchData(); 
        } catch (error) {
            alert(error.response?.data?.detail || "Failed to reopen ticket.");
        }
    };

    // --- PHASE 5: Handle Standard Workflow Transitions ---
    const handleWorkflowChange = async (newStatus) => {
        if (newStatus === 'Reopened') {
            setIsReopening(true);
            return;
        }
        try {
            await api.patch(`/tickets/${id}/status`, { status: newStatus, reason: "Updated via UI" });
            fetchData();
        } catch (error) { 
            alert(error.response?.data?.detail || "Failed to change status."); 
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) {
                alert("File is too large. Maximum size is 5MB.");
                e.target.value = ""; 
                return;
            }
            setSelectedFile(file);
        }
    };

    const handleFileUpload = async (e) => {
        e.preventDefault();
        if (!selectedFile) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", selectedFile);

        try {
            await api.post(`/tickets/${id}/attachments`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            setSelectedFile(null); 
            document.getElementById('file-upload-input').value = ""; 
            fetchData(); 
        } catch (error) {
            alert(error.response?.data?.detail || "Failed to upload file");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDownload = async (attachmentId, fileName) => {
        try {
            const response = await api.get(`/tickets/attachments/${attachmentId}/download`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            alert("Failed to download file.");
        }
    };

    const getSlaBadge = (status) => {
        switch(status) {
            case 'on_track': return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> On Track</span>;
            case 'at_risk': return <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold flex items-center"><Clock className="w-3 h-3 mr-1" /> At Risk</span>;
            case 'breached': return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold flex items-center"><AlertOctagon className="w-3 h-3 mr-1" /> SLA Breached</span>;
            case 'completed': return <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> SLA Met</span>;
            default: return null;
        }
    };

    if (!ticket || !currentUser) return <div className="text-center p-8">Loading ticket...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 mb-12">
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
                    
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 items-center">
                        <span className="flex items-center bg-white px-3 py-1 rounded-lg border border-gray-200 shadow-sm">
                            <Tag className="w-4 h-4 mr-2 text-purple-500" /> {ticket.category}
                        </span>
                        <span className="flex items-center bg-white px-3 py-1 rounded-lg border border-gray-200 shadow-sm">
                            <AlertTriangle className="w-4 h-4 mr-2 text-orange-500" /> {ticket.priority} Priority
                        </span>
                        {getSlaBadge(ticket.sla_status)}
                    </div>

                    {/* PHASE 5: WORKFLOW ACTION BUTTONS */}
                    {allowedStatuses.length > 0 && !isReopening && (
                        <div className="mt-6 pt-6 border-t border-purple-100/50">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Available Workflow Actions</h3>
                            <div className="flex flex-wrap gap-2">
                                {allowedStatuses.map(status => (
                                    <button
                                        key={status}
                                        onClick={() => handleWorkflowChange(status)}
                                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition flex items-center"
                                    >
                                        {status === 'Reopened' ? <RefreshCw className="w-4 h-4 mr-2" /> : <GitCommit className="w-4 h-4 mr-2" />}
                                        Mark as {status}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-gray-50 border-b border-gray-100 px-8 py-4 flex flex-wrap justify-between items-center text-sm">
                    <div className="flex items-center text-gray-700">
                        <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                        <strong>Created:</strong> <span className="ml-2">{new Date(ticket.created_at).toLocaleString()}</span>
                    </div>
                    {ticket.due_at && (
                        <div className={`flex items-center ${ticket.sla_status === 'breached' ? 'text-red-600 font-bold' : 'text-gray-700'}`}>
                            <Clock className="w-4 h-4 mr-2" />
                            <strong>Resolution Due By:</strong> <span className="ml-2">{new Date(ticket.due_at).toLocaleString()}</span>
                        </div>
                    )}
                </div>

                <div className="p-8">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Original Description</h3>
                    <div className="bg-white p-6 rounded-xl text-gray-700 leading-relaxed whitespace-pre-wrap border border-gray-100 shadow-inner">
                        {ticket.description}
                    </div>

                    {/* FILE UPLOADS SECTION */}
                    <div className="mt-8">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                            <Paperclip className="w-4 h-4 mr-2" /> Attachments
                        </h3>
                        
                        <form onSubmit={handleFileUpload} className="flex flex-col sm:flex-row items-center gap-4 mb-4">
                            <input 
                                id="file-upload-input"
                                type="file" 
                                accept=".jpg,.jpeg,.png,.pdf"
                                onChange={handleFileChange}
                                className="w-full sm:w-auto text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
                            />
                            <button 
                                type="submit" 
                                disabled={!selectedFile || isUploading}
                                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-full shadow transition text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUploading ? "Uploading..." : "Upload File"}
                            </button>
                        </form>

                        {attachments.length === 0 ? (
                            <p className="text-gray-500 text-sm italic">No files attached to this ticket.</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                                {attachments.map((file) => (
                                    <div key={file.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold uppercase shrink-0">
                                                {file.content_type.split('/')[1] === 'pdf' ? 'PDF' : 'IMG'}
                                            </span>
                                            <span className="text-sm font-medium text-gray-700 truncate" title={file.file_name}>
                                                {file.file_name}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={() => handleDownload(file.id, file.file_name)}
                                            className="text-purple-600 hover:text-purple-800 p-1 bg-purple-50 rounded shrink-0"
                                            title="Download"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* PHASE 5: REOPEN TICKET UI */}
                    {isReopening && (
                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <form onSubmit={handleReopen} className="bg-orange-50 p-6 rounded-xl border border-orange-200">
                                <div className="flex items-center text-orange-800 mb-3">
                                    <AlertTriangle className="w-5 h-5 mr-2" />
                                    <label className="block text-sm font-bold">Why are you reopening this ticket?</label>
                                </div>
                                <textarea required value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} rows="2" className="w-full p-3 border border-orange-300 rounded-lg focus:ring-4 focus:ring-orange-100 outline-none mb-3" placeholder="State your reason clearly..."></textarea>
                                <div className="flex space-x-3">
                                    <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-bold">Submit Reason & Reopen</button>
                                    <button type="button" onClick={() => setIsReopening(false)} className="text-gray-600 hover:text-gray-800 font-bold px-4 py-2">Cancel</button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* PHASE 5: WORKFLOW STATUS HISTORY */}
                <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden flex flex-col h-[500px]">
                    <div className="p-6 border-b border-gray-100 flex items-center space-x-2 text-gray-800 bg-gray-50 shrink-0">
                        <Activity className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-bold">Status History</h2>
                    </div>
                    <div className="p-6 overflow-y-auto flex-1">
                        {statusHistory.length === 0 ? (
                            <p className="text-gray-500 text-sm text-center mt-10">No status changes recorded.</p>
                        ) : (
                            <div className="relative border-l-2 border-gray-200 ml-3 space-y-6">
                                {statusHistory.map(hist => (
                                    <div key={hist.id} className="relative pl-6">
                                        <span className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 ${hist.new_status === 'Closed' ? 'bg-gray-100 border-gray-500' : 'bg-blue-100 border-blue-500'}`}></span>
                                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            <p className="text-sm font-bold text-gray-800">
                                                Changed to <span className="text-blue-600">{hist.new_status}</span>
                                            </p>
                                            {hist.reason && <p className="text-sm text-gray-600 italic mt-1 bg-white p-2 border border-gray-100 rounded">"{hist.reason}"</p>}
                                            <span className="text-xs text-gray-400 mt-2 block">{new Date(hist.created_at).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* UPDATES SECTION */}
                <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden flex flex-col h-[500px]">
                    <div className="p-6 border-b border-gray-100 flex items-center space-x-2 text-gray-800 bg-gray-50 shrink-0">
                        <MessageSquare className="w-5 h-5 text-purple-600" />
                        <h2 className="text-lg font-bold">Staff Updates</h2>
                    </div>
                    <div className="p-6 overflow-y-auto flex-1 flex flex-col justify-between">
                        <div>
                            {updates.length === 0 ? (
                                <p className="text-gray-500 text-center text-sm mt-10">No updates posted yet.</p>
                            ) : (
                                <div className="space-y-4 mb-4">
                                    {updates.map(update => (
                                        <div key={update.id} className="bg-purple-50/50 border border-purple-100 p-4 rounded-xl">
                                            <span className="text-xs text-gray-500 block mb-1">{new Date(update.created_at).toLocaleString()}</span>
                                            <p className="text-gray-700 text-sm whitespace-pre-wrap">{update.message}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {(currentUser.role === 'admin' || currentUser.role === 'support') && ticket.status !== 'Closed' && (
                            <form onSubmit={handleAddUpdate} className="mt-auto pt-4 border-t border-gray-100 shrink-0">
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