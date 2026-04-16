import Analytics from './Analytics';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Search, AlertOctagon, Clock, CheckCircle, Trash2, CheckSquare, Bookmark, RefreshCcw } from 'lucide-react';
import api from './api';

const tagColors = {
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    red: "bg-red-100 text-red-800 border-red-200",
    green: "bg-green-100 text-green-800 border-green-200",
    yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
    purple: "bg-purple-100 text-purple-800 border-purple-200",
};

const extractArray = (payload) => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.data)) return payload.data;
    return [];
};

export default function AdminDashboard() {
    const [tickets, setTickets] = useState([]);
    const [supportUsers, setSupportUsers] = useState([]);
    const [allTags, setAllTags] = useState([]);
    
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [tagFilter, setTagFilter] = useState('');

    const [slaSummary, setSlaSummary] = useState({ breached_count: 0, at_risk_count: 0, compliance_percentage: 0 });
    const [selectedTickets, setSelectedTickets] = useState([]);
    const [savedFilters, setSavedFilters] = useState([]);
    const [showSaveFilter, setShowSaveFilter] = useState(false);
    const [newFilterName, setNewFilterName] = useState('');
    
    const [isTrashView, setIsTrashView] = useState(false);
    const [trashedTickets, setTrashedTickets] = useState([]);

    useEffect(() => {
        if (isTrashView) { fetchTrash(); } else { fetchData(); }
        setSelectedTickets([]); 
    }, [isTrashView, page, statusFilter, priorityFilter, tagFilter]);

    const fetchData = async () => {
        try {
            api.get('/tags').then(res => setAllTags(extractArray(res.data))).catch(() => setAllTags([]));
            
            const [tRes, uRes, sRes, fRes] = await Promise.all([
                api.get('/admin/tickets/search', { 
                    params: { page, limit: 10, search: searchTerm, status: statusFilter || null, priority: priorityFilter || null, tag: tagFilter || null } 
                }),
                api.get('/admin/support-users'),
                api.get('/admin/sla-summary'),
                api.get('/admin/saved-filters')
            ]);
            
            setTickets(extractArray(tRes.data));
            setTotalPages(tRes.data?.meta?.total_pages || tRes.data?.data?.meta?.total_pages || 1);
            setSupportUsers(extractArray(uRes.data));
            setSlaSummary(sRes.data?.data || sRes.data || { breached_count: 0, at_risk_count: 0, compliance_percentage: 0 });
            setSavedFilters(extractArray(fRes.data));
        } catch (error) { console.error("Fetch error", error); }
    };

    const fetchTrash = async () => {
        try {
            const res = await api.get('/admin/tickets/trash');
            setTrashedTickets(extractArray(res.data));
        } catch (error) { console.error("Trash error", error); }
    };

    const handleRestore = async (id) => {
        try { await api.post(`/admin/tickets/${id}/restore`); fetchTrash(); } 
        catch (error) { alert("Restore failed"); }
    };

    const handleUpdate = async (ticketId, field, value) => {
        try {
            const endpoint = field === 'assign' ? `/tickets/${ticketId}/assign` : `/tickets/${ticketId}/${field}`;
            const payload = field === 'assign' ? { assigned_to: parseInt(value) } : { [field]: value };
            await api.patch(endpoint, payload); fetchData();
        } catch (error) { console.error("Update failed", error); }
    };

    const handleBulkAction = async (type, val = null) => {
        if (selectedTickets.length === 0) return;
        if (type === 'delete' && !window.confirm(`Move ${selectedTickets.length} tickets to trash?`)) return;
        
        try {
            const path = type === 'delete' ? 'bulk-delete' : `bulk-${type}`;
            const payload = { ticket_ids: selectedTickets };
            if (val) type === 'status' ? (payload.status = val) : (payload.assigned_to = parseInt(val));
            await api.post(`/admin/tickets/${path}`, payload);
            setSelectedTickets([]); fetchData();
        } catch (error) { alert("Bulk action failed."); }
    };

    const handleSaveFilter = async () => {
        if (!newFilterName.trim()) return;
        try {
            await api.post('/admin/saved-filters', { name: newFilterName, filter_criteria: { search: searchTerm, status: statusFilter, priority: priorityFilter } });
            setNewFilterName(''); setShowSaveFilter(false); fetchData(); 
        } catch (error) { alert("Save failed"); }
    };

    const handleApplySavedFilter = (e) => {
        const selected = savedFilters.find(f => f.id === parseInt(e.target.value));
        if (selected) {
            setSearchTerm(selected.filter_criteria.search || '');
            setStatusFilter(selected.filter_criteria.status || '');
            setPriorityFilter(selected.filter_criteria.priority || '');
            setTagFilter(''); setPage(1);
        }
    };

    // --- FIX: Manual Search Trigger ---
    const executeSearch = () => {
        setPage(1);
        fetchData();
    };

    return (
        <div className="space-y-6">
            <Analytics />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex justify-between items-center shadow-sm">
                    <div><p className="text-[10px] font-bold text-red-600 uppercase tracking-widest">SLA Breached</p><h3 className="text-2xl font-black text-red-900">{slaSummary.breached_count || 0}</h3></div>
                    <AlertOctagon size={28} className="text-red-300" />
                </div>
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex justify-between items-center shadow-sm">
                    <div><p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">At Risk</p><h3 className="text-2xl font-black text-orange-900">{slaSummary.at_risk_count || 0}</h3></div>
                    <Clock size={28} className="text-orange-300" />
                </div>
                <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex justify-between items-center shadow-sm">
                    <div><p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Compliance</p><h3 className="text-2xl font-black text-green-900">{slaSummary.compliance_percentage || 0}%</h3></div>
                    <CheckCircle size={28} className="text-green-300" />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className={`p-4 flex flex-col xl:flex-row justify-between items-center text-white gap-4 transition-colors ${isTrashView ? 'bg-red-600 border-red-700' : 'bg-purple-700 border-purple-800'}`}>
                    <h2 className="font-bold flex items-center gap-2">
                        {isTrashView ? <Trash2 size={20}/> : <ShieldAlert size={20}/>} 
                        {isTrashView ? 'Trash Can (Archived)' : 'Admin Dashboard'}
                    </h2>
                    
                    <div className="flex flex-wrap items-center gap-2 text-gray-900">
                        {!isTrashView && (
                            <>
                                {/* FIX: Re-added Search Button & Enter Key Trigger */}
                                <div className="flex items-center bg-white rounded ring-1 ring-black/10 focus-within:ring-purple-400 focus-within:ring-2">
                                    <input 
                                        type="text" placeholder="Search..." value={searchTerm} 
                                        onChange={(e) => setSearchTerm(e.target.value)} 
                                        onKeyDown={(e) => e.key === 'Enter' && executeSearch()}
                                        className="text-sm px-3 py-1.5 outline-none w-32 rounded-l border-none"
                                    />
                                    <button onClick={executeSearch} className="px-2 text-gray-400 hover:text-purple-600"><Search size={16}/></button>
                                </div>

                                <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="text-sm rounded px-2 py-1.5 outline-none border-none ring-1 ring-black/10"><option value="">Tags</option>{allTags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select>
                                
                                {savedFilters.length > 0 && (
                                    <select onChange={handleApplySavedFilter} className="text-sm rounded px-2 py-1.5 font-bold bg-purple-200 border-none outline-none"><option value="">Saved Views</option>{savedFilters.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
                                )}

                                {!showSaveFilter ? (
                                    <button onClick={() => setShowSaveFilter(true)} className="text-white bg-purple-900/50 p-2 rounded hover:bg-black transition border border-purple-400"><Bookmark size={16}/></button>
                                ) : (
                                    <div className="flex items-center space-x-1 bg-purple-900 p-1 rounded-lg">
                                        <input type="text" placeholder="Filter Name" value={newFilterName} onChange={(e) => setNewFilterName(e.target.value)} className="text-[10px] rounded px-2 py-1 outline-none w-20"/>
                                        <button onClick={handleSaveFilter} className="bg-green-500 text-white px-2 py-1 rounded text-[10px] font-bold">OK</button>
                                        <button onClick={() => setShowSaveFilter(false)} className="bg-gray-400 text-white px-2 py-1 rounded text-[10px] font-bold">X</button>
                                    </div>
                                )}
                            </>
                        )}
                        <button onClick={() => setIsTrashView(!isTrashView)} className={`px-4 py-1.5 rounded text-xs font-black border transition-all ${isTrashView ? 'bg-white text-red-700 shadow-md' : 'bg-red-500 text-white border-red-400 hover:bg-red-600'}`}>
                            {isTrashView ? '← ACTIVE QUEUE' : 'VIEW TRASH'}
                        </button>
                    </div>
                </div>

                {!isTrashView && selectedTickets.length > 0 && (
                    <div className="bg-purple-100/80 p-2 border-b flex justify-between items-center px-4 animate-in slide-in-from-top duration-300">
                        <span className="text-xs font-black text-purple-800 uppercase tracking-tighter">{selectedTickets.length} TICKETS SELECTED</span>
                        <div className="flex gap-2">
                            <select onChange={(e) => handleBulkAction('status', e.target.value)} className="text-[10px] border rounded p-1.5 font-bold uppercase"><option value="">Status</option><option value="Open">Open</option><option value="Closed">Closed</option></select>
                            <select onChange={(e) => handleBulkAction('assign', e.target.value)} className="text-[10px] border rounded p-1.5 font-bold uppercase"><option value="">Assign</option>{supportUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
                            <button onClick={() => handleBulkAction('delete')} className="bg-red-600 text-white p-1.5 rounded hover:bg-red-700 shadow-sm"><Trash2 size={14}/></button>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-black border-b tracking-widest">
                            <tr>
                                {!isTrashView && <th className="p-4 w-10 text-center"><input type="checkbox" onChange={(e) => setSelectedTickets(e.target.checked ? tickets.map(t => t.id) : [])} checked={tickets.length > 0 && selectedTickets.length === tickets.length} className="cursor-pointer" /></th>}
                                <th className="p-4">Ticket</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Priority</th>
                                <th className="p-4">{isTrashView ? 'Deleted At' : 'Assigned To'}</th>
                                <th className="p-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-100">
                            {!isTrashView && tickets.map((t) => (
                                <tr key={t.id} className={`${selectedTickets.includes(t.id) ? 'bg-purple-50' : 'hover:bg-gray-50'} transition-colors`}>
                                    <td className="p-4 text-center"><input type="checkbox" checked={selectedTickets.includes(t.id)} onChange={(e) => setSelectedTickets(e.target.checked ? [...selectedTickets, t.id] : selectedTickets.filter(id => id !== t.id))} className="cursor-pointer" /></td>
                                    <td className="p-4">
                                        <div className="font-bold text-gray-900">{t.title}</div>
                                        <div className="text-[10px] text-gray-400 uppercase font-medium">{t.category}</div>
                                        <div className="flex gap-1 mt-1.5">{t.tags?.map(tag => <span key={tag.id} className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-full border ${tagColors[tag.color] || tagColors.blue}`}>{tag.name}</span>)}</div>
                                    </td>
                                    <td className="p-4"><select value={t.status} onChange={(e) => handleUpdate(t.id, 'status', e.target.value)} className="border rounded p-1 text-xs font-medium focus:ring-1 focus:ring-purple-400">{['Open', 'In Progress', 'Resolved', 'Closed'].map(s => <option key={s} value={s}>{s}</option>)}</select></td>
                                    <td className="p-4"><select value={t.priority} onChange={(e) => handleUpdate(t.id, 'priority', e.target.value)} className="border rounded p-1 text-xs font-medium focus:ring-1 focus:ring-purple-400">{['Low', 'Medium', 'High', 'Urgent'].map(p => <option key={p} value={p}>{p}</option>)}</select></td>
                                    <td className="p-4"><select value={t.assigned_to || ""} onChange={(e) => handleUpdate(t.id, 'assign', e.target.value)} className="border rounded p-1 text-xs font-medium focus:ring-1 focus:ring-purple-400"><option value="">Unassigned</option>{supportUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></td>
                                    <td className="p-4 text-right"><Link to={`/dashboard/ticket/${t.id}`} className="text-purple-600 font-black hover:underline tracking-tight">DETAILS</Link></td>
                                </tr>
                            ))}

                            {isTrashView && trashedTickets.map((t) => (
                                <tr key={t.id} className="bg-red-50/20 hover:bg-red-50 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-gray-400 line-through opacity-60">{t.title}</div>
                                        <div className="text-[10px] text-gray-400 uppercase font-medium">{t.category}</div>
                                    </td>
                                    <td className="p-4"><span className="px-2 py-1 bg-gray-200 text-gray-500 rounded text-[10px] uppercase font-black">{t.status}</span></td>
                                    <td className="p-4"><span className="px-2 py-1 bg-gray-200 text-gray-500 rounded text-[10px] uppercase font-black">{t.priority}</span></td>
                                    <td className="p-4 text-xs font-mono text-gray-500">{t.deleted_at ? new Date(t.deleted_at).toLocaleString() : '---'}</td>
                                    <td className="p-4 text-right">
                                        <button onClick={() => handleRestore(t.id)} className="text-green-600 font-black text-[10px] flex items-center justify-end w-full uppercase hover:text-green-800 transition-colors">
                                            <RefreshCcw size={12} className="mr-1"/> Restore Ticket
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {((!isTrashView && tickets.length === 0) || (isTrashView && trashedTickets.length === 0)) && (
                                <tr><td colSpan="6" className="p-20 text-center text-gray-400 italic text-sm font-medium tracking-wide">No tickets found in this section.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {!isTrashView && totalPages > 1 && (
                    <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 bg-white border rounded text-xs font-black uppercase disabled:opacity-30">PREV</button>
                        <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Page {page} / {totalPages}</span>
                        <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 bg-white border rounded text-xs font-black uppercase disabled:opacity-30">NEXT</button>
                    </div>
                )}
            </div>
        </div>
    );
}