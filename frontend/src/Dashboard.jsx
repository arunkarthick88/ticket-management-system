import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Ticket, PlusCircle, User as UserIcon, Clock, AlertCircle } from 'lucide-react';
import api from './api';

export default function Dashboard() {
    const [user, setUser] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [formData, setFormData] = useState({
        title: '',
        category: 'Hardware',
        priority: 'Medium',
        description: ''
    });
    const navigate = useNavigate();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // Fetch both the user profile and their tickets at the same time
            const [userRes, ticketsRes] = await Promise.all([
                api.get('/auth/me'),
                api.get('/tickets/my')
            ]);
            setUser(userRes.data);
            setTickets(ticketsRes.data);
        } catch (error) {
            console.error("Error fetching data:", error);
            // If token is expired or invalid, kick them back to login
            localStorage.removeItem('token');
            navigate('/login');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/tickets/', formData);
            setFormData({ title: '', category: 'Hardware', priority: 'Medium', description: '' });
            fetchData(); // Refresh the ticket list
            alert("Ticket submitted successfully!");
        } catch (error) {
            alert("Error submitting ticket.");
        }
    };

    const getStatusColor = (status) => {
        switch(status) {
            case 'Open': return 'bg-blue-100 text-blue-800';
            case 'In Progress': return 'bg-yellow-100 text-yellow-800';
            case 'Resolved': return 'bg-green-100 text-green-800';
            case 'Closed': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getPriorityColor = (priority) => {
        switch(priority) {
            case 'Low': return 'text-gray-500';
            case 'Medium': return 'text-blue-500';
            case 'High': return 'text-orange-500';
            case 'Urgent': return 'text-red-600 font-bold';
            default: return 'text-gray-500';
        }
    };

    if (!user) return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            {/* Navbar */}
            <nav className="bg-white shadow-sm border-b px-8 py-4 flex justify-between items-center">
                <div className="flex items-center space-x-2 text-indigo-600">
                    <Ticket className="w-6 h-6" />
                    <span className="text-xl font-bold">IT Helpdesk</span>
                </div>
                <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2 text-gray-600">
                        <UserIcon className="w-5 h-5" />
                        <span className="font-medium">{user.name} ({user.role})</span>
                    </div>
                    <button onClick={handleLogout} className="flex items-center space-x-1 text-red-500 hover:text-red-700 transition">
                        <LogOut className="w-5 h-5" />
                        <span>Logout</span>
                    </button>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Column: Create Ticket Form */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                    <div className="flex items-center space-x-2 mb-6 border-b pb-4">
                        <PlusCircle className="text-indigo-600 w-6 h-6" />
                        <h2 className="text-lg font-bold text-gray-800">Submit New Ticket</h2>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Issue Title</label>
                            <input required type="text" name="title" value={formData.title} onChange={handleInputChange} 
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                                placeholder="e.g., Cannot connect to office Wi-Fi" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                <select name="category" value={formData.category} onChange={handleInputChange} 
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                                    <option value="Hardware">Hardware</option>
                                    <option value="Software">Software</option>
                                    <option value="Network">Network</option>
                                    <option value="Access">Access/Permissions</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                                <select name="priority" value={formData.priority} onChange={handleInputChange} 
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                    <option value="Urgent">Urgent</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea required name="description" value={formData.description} onChange={handleInputChange} rows="4"
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none" 
                                placeholder="Please describe the issue in detail..."></textarea>
                        </div>

                        <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-lg hover:bg-indigo-700 transition">
                            Submit Ticket
                        </button>
                    </form>
                </div>

                {/* Right Column: My Tickets List */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-800">My Tickets</h2>
                        <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1 rounded-full">
                            {tickets.length} Total
                        </span>
                    </div>
                    
                    <div className="divide-y divide-gray-100">
                        {tickets.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">You haven't submitted any tickets yet.</div>
                        ) : (
                            tickets.map((ticket) => (
                                <div key={ticket.id} className="p-6 hover:bg-gray-50 transition">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-lg font-bold text-gray-900">{ticket.title}</h3>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(ticket.status)}`}>
                                            {ticket.status}
                                        </span>
                                    </div>
                                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{ticket.description}</p>
                                    <div className="flex items-center space-x-6 text-sm">
                                        <span className="flex items-center text-gray-500">
                                            <AlertCircle className="w-4 h-4 mr-1" />
                                            <span className={getPriorityColor(ticket.priority)}>{ticket.priority} Priority</span>
                                        </span>
                                        <span className="flex items-center text-gray-500">
                                            <Ticket className="w-4 h-4 mr-1" />
                                            {ticket.category}
                                        </span>
                                        <span className="flex items-center text-gray-500">
                                            <Clock className="w-4 h-4 mr-1" />
                                            {new Date(ticket.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </main>
        </div>
    );
}