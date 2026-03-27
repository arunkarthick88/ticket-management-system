import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCircle, Clock } from 'lucide-react';
import api from './api';

export default function Notifications() {
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const response = await api.get('/notifications/');
            setNotifications(response.data);
        } catch (error) {
            console.error("Error fetching notifications:", error);
        }
    };

    const markAsRead = async (id) => {
        try {
            await api.patch(`/notifications/${id}/read`);
            // Update local state to instantly change the UI without refreshing the page
            setNotifications(notifications.map(n => 
                n.id === id ? { ...n, is_read: true } : n
            ));
        } catch (error) {
            console.error("Error marking as read:", error);
        }
    };

    return (
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
            <div className="p-6 border-b border-purple-50 bg-gradient-to-r from-purple-700 to-purple-500 flex justify-between items-center text-white">
                <div className="flex items-center space-x-3">
                    <Bell className="w-6 h-6" />
                    <h2 className="text-2xl font-bold">My Notifications</h2>
                </div>
            </div>
            
            <div className="divide-y divide-gray-50">
                {notifications.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center">
                        <Bell className="w-12 h-12 text-gray-300 mb-4" />
                        <p className="text-gray-500 text-lg">You're all caught up!</p>
                        <p className="text-sm text-gray-400 mt-2">No new updates on your tickets.</p>
                    </div>
                ) : (
                    notifications.map((notif) => (
                        <div key={notif.id} className={`p-6 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${notif.is_read ? 'bg-white' : 'bg-purple-50/50'}`}>
                            <div className="flex-1">
                                <p className={`text-lg ${notif.is_read ? 'text-gray-600' : 'text-gray-900 font-bold'}`}>
                                    {notif.message}
                                </p>
                                <div className="flex items-center mt-2 text-sm text-gray-500">
                                    <Clock className="w-4 h-4 mr-1.5" />
                                    {new Date(notif.created_at).toLocaleString()}
                                </div>
                            </div>
                            
                            {!notif.is_read ? (
                                <button 
                                    onClick={() => markAsRead(notif.id)}
                                    className="shrink-0 flex items-center space-x-1 bg-white border border-purple-200 text-purple-700 px-4 py-2.5 rounded-lg hover:bg-purple-50 transition-colors text-sm font-bold shadow-sm"
                                >
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                    <span>Mark as Read</span>
                                </button>
                            ) : (
                                <Link to={`/dashboard/ticket/${notif.ticket_id}`} className="shrink-0 text-purple-600 hover:text-purple-800 text-sm font-bold bg-purple-50 px-4 py-2.5 rounded-lg text-center">
                                    View Ticket
                                </Link>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}