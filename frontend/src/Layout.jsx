import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Ticket, PlusCircle, User as UserIcon, LogOut, List, ShieldAlert, Briefcase } from 'lucide-react';
import api from './api';

export default function Layout() {
    const [user, setUser] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const response = await api.get('/auth/me');
                setUser(response.data);
            } catch (error) {
                localStorage.removeItem('token');
                navigate('/login');
            }
        };
        fetchUser();
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    if (!user) return <div className="p-8 text-center text-gray-500">Loading...</div>;

    // Helper to highlight active tabs
    const isActive = (path) => location.pathname === path ? 'bg-purple-100 text-purple-700 font-bold' : 'text-gray-600 hover:bg-purple-50 hover:text-purple-600';

    return (
        <div className="min-h-screen bg-purple-50 font-sans">
            {/* Top Navigation */}
            <nav className="bg-white shadow-sm border-b border-purple-100 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center space-x-8">
                    <div className="flex items-center space-x-2 text-purple-700">
                        <Ticket className="w-7 h-7" />
                        <span className="text-2xl font-extrabold tracking-tight">IT Helpdesk</span>
                    </div>
                    
                    {/* Navigation Buttons */}
                    <div className="hidden md:flex space-x-2">
                        <Link to="/dashboard" className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${isActive('/dashboard')}`}>
                            <List className="w-5 h-5" />
                            <span>My Tickets</span>
                        </Link>
                        
                        {/* Only show "Submit Ticket" if they are a standard user */}
                        {user.role === 'user' && (
                            <Link to="/dashboard/create" className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${isActive('/dashboard/create')}`}>
                                <PlusCircle className="w-5 h-5" />
                                <span>Submit Ticket</span>
                            </Link>
                        )}

                        {/* Only show "Admin Panel" if they are an admin */}
                        {user.role === 'admin' && (
                            <Link to="/dashboard/admin" className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${isActive('/dashboard/admin')}`}>
                                <ShieldAlert className="w-5 h-5" />
                                <span>Admin Panel</span>
                            </Link>
                        )}

                        {/* Only show "Support Dashboard" if they are support staff */}
                        {user.role === 'support' && (
                            <Link to="/dashboard/support" className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${isActive('/dashboard/support')}`}>
                                <Briefcase className="w-5 h-5" />
                                <span>Support Dashboard</span>
                            </Link>
                        )}
                    </div>
                </div>

                <div className="flex items-center space-x-6">
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

            {/* Main Content Area (Where the other pages render) */}
            <main className="max-w-6xl mx-auto p-8">
                <Outlet />
            </main>
        </div>
    );
}