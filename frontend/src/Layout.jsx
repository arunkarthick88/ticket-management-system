import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Ticket, PlusCircle, User as UserIcon, LogOut, List, ShieldAlert, Briefcase, Bell, X } from 'lucide-react';
import api from './api';

export default function Layout() {
    const [user, setUser] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [toastMessage, setToastMessage] = useState(''); // State for real-time popups
    const navigate = useNavigate();
    const location = useLocation();
    const ws = useRef(null); // Keeps track of the WebSocket connection

    useEffect(() => {
        const fetchUserAndNotifications = async () => {
            try {
                const userRes = await api.get('/auth/me');
                setUser(userRes.data);
                
                const countRes = await api.get('/notifications/unread-count');
                setUnreadCount(countRes.data.unread_count);
            } catch (error) {
                localStorage.removeItem('token');
                navigate('/login');
            }
        };
        fetchUserAndNotifications();
    }, [navigate, location.pathname]);

    // --- PHASE 4: WEBSOCKET CONNECTION ---
    useEffect(() => {
        if (user) {
            // Connect to the FastAPI WebSocket endpoint
            ws.current = new WebSocket(`ws://localhost:8000/ws/${user.id}`);
            
            // Listen for real-time messages
            ws.current.onmessage = (event) => {
                const message = event.data;
                setUnreadCount(prev => prev + 1); // Instantly update the red badge
                setToastMessage(message); // Show the popup
                
                // Hide popup after 5 seconds
                setTimeout(() => {
                    setToastMessage('');
                }, 5000);
            };

            // Cleanup connection when the user logs out or closes the browser
            return () => {
                if (ws.current) ws.current.close();
            };
        }
    }, [user]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    if (!user) return <div className="p-8 text-center text-gray-500">Loading...</div>;

    const isActive = (path) => location.pathname === path ? 'bg-purple-100 text-purple-700 font-bold' : 'text-gray-600 hover:bg-purple-50 hover:text-purple-600';

    return (
        <div className="min-h-screen bg-purple-50 font-sans relative">
            
            {/* PHASE 4: REAL-TIME TOAST NOTIFICATION */}
            {toastMessage && (
                <div className="fixed bottom-8 right-8 bg-purple-900 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center space-x-4 z-50 animate-bounce">
                    <Bell className="w-5 h-5 text-purple-300" />
                    <span className="font-bold">{toastMessage}</span>
                    <button onClick={() => setToastMessage('')} className="text-purple-300 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            <nav className="bg-white shadow-sm border-b border-purple-100 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center space-x-8">
                    <div className="flex items-center space-x-2 text-purple-700">
                        <Ticket className="w-7 h-7" />
                        <span className="text-2xl font-extrabold tracking-tight">IT Helpdesk</span>
                    </div>
                    
                    <div className="hidden md:flex space-x-2">
                        {user.role === 'user' && (
                            <>
                                <Link to="/dashboard" className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${isActive('/dashboard')}`}>
                                    <List className="w-5 h-5" />
                                    <span>My Tickets</span>
                                </Link>
                                <Link to="/dashboard/create" className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${isActive('/dashboard/create')}`}>
                                    <PlusCircle className="w-5 h-5" />
                                    <span>Submit Ticket</span>
                                </Link>
                            </>
                        )}
                        {user.role === 'admin' && (
                            <Link to="/dashboard/admin" className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${isActive('/dashboard/admin')}`}>
                                <ShieldAlert className="w-5 h-5" />
                                <span>Admin Panel</span>
                            </Link>
                        )}
                        {user.role === 'support' && (
                            <Link to="/dashboard/support" className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${isActive('/dashboard/support')}`}>
                                <Briefcase className="w-5 h-5" />
                                <span>Support Dashboard</span>
                            </Link>
                        )}
                    </div>
                </div>

                <div className="flex items-center space-x-6">
                    <Link to="/dashboard/notifications" className="relative p-2 text-gray-500 hover:text-purple-600 transition-colors rounded-full hover:bg-purple-50">
                        <Bell className="w-6 h-6" />
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 border-2 border-white rounded-full transition-all duration-300">
                                {unreadCount}
                            </span>
                        )}
                    </Link>

                    <div className="flex items-center space-x-2 text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full">
                        <UserIcon className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium">{user.name} ({user.role})</span>
                    </div>
                    
                    <button onClick={handleLogout} className="flex items-center space-x-1 text-red-500 hover:text-red-700 transition font-medium">
                        <LogOut className="w-5 h-5" />
                        <span>Logout</span>
                    </button>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto p-8">
                <Outlet />
            </main>
        </div>
    );
}