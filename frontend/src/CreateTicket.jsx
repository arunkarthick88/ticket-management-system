import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send } from 'lucide-react';
import api from './api';

export default function CreateTicket() {
    const [formData, setFormData] = useState({
        title: '',
        category: 'Hardware',
        priority: 'Medium',
        description: ''
    });
    const navigate = useNavigate();

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/tickets/', formData);
            alert("Ticket submitted successfully!");
            navigate('/dashboard'); // Go back to the list
        } catch (error) {
            alert("Error submitting ticket.");
        }
    };

    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-purple-100">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">Submit a New Support Ticket</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Issue Title</label>
                    <input required type="text" name="title" value={formData.title} onChange={handleInputChange} 
                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 outline-none transition" 
                        placeholder="Briefly summarize the issue..." />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Category</label>
                        <select name="category" value={formData.category} onChange={handleInputChange} 
                            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 outline-none bg-white transition">
                            <option value="Hardware">Hardware</option>
                            <option value="Software">Software</option>
                            <option value="Network">Network</option>
                            <option value="Access">Access/Permissions</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Priority</label>
                        <select name="priority" value={formData.priority} onChange={handleInputChange} 
                            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 outline-none bg-white transition">
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Urgent">Urgent</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Detailed Description</label>
                    <textarea required name="description" value={formData.description} onChange={handleInputChange} rows="5"
                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 outline-none resize-none transition" 
                        placeholder="Please describe exactly what is happening..."></textarea>
                </div>

                <button type="submit" className="w-full bg-purple-600 text-white font-bold py-3.5 rounded-xl hover:bg-purple-700 transition flex items-center justify-center space-x-2 shadow-lg shadow-purple-200">
                    <Send className="w-5 h-5" />
                    <span>Submit Ticket</span>
                </button>
            </form>
        </div>
    );
}