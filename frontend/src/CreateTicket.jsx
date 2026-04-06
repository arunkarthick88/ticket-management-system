import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Paperclip } from 'lucide-react';
import api from './api';

export default function CreateTicket() {
    const navigate = useNavigate();
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('Hardware');
    const [priority, setPriority] = useState('Medium');
    const [description, setDescription] = useState('');
    
    // --- PHASE 5: NEW FILE STATE ---
    const [selectedFile, setSelectedFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // STEP 1: Create the ticket first
            const ticketRes = await api.post('/tickets/', {
                title,
                category,
                priority,
                description
            });

            // STEP 2: If a file is selected, upload it to the NEW ticket's ID
            if (selectedFile) {
                const formData = new FormData();
                formData.append("file", selectedFile);
                
                await api.post(`/tickets/${ticketRes.data.id}/attachments`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            // Successfully created and uploaded! Go back to dashboard.
            navigate('/dashboard'); 
        } catch (error) {
            alert(error.response?.data?.detail || "Failed to submit ticket.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-purple-100 mt-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Submit a New Support Ticket</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Issue Title</label>
                    <input 
                        required 
                        type="text" 
                        value={title} 
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-300"
                        placeholder="Briefly summarize the issue..."
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Category</label>
                        <select 
                            value={category} 
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-300 bg-white"
                        >
                            <option value="Hardware">Hardware</option>
                            <option value="Software">Software</option>
                            <option value="Network">Network</option>
                            <option value="Access">Access</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Priority</label>
                        <select 
                            value={priority} 
                            onChange={(e) => setPriority(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-300 bg-white"
                        >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Urgent">Urgent</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Detailed Description</label>
                    <textarea 
                        required 
                        value={description} 
                        onChange={(e) => setDescription(e.target.value)}
                        rows="5"
                        className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-300"
                        placeholder="Please describe exactly what is happening..."
                    ></textarea>
                </div>

                {/* --- PHASE 5: FILE UPLOAD FIELD --- */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="flex items-center text-sm font-bold text-gray-700 mb-2">
                        <Paperclip className="w-4 h-4 mr-2 text-purple-600" />
                        Attach a File (Optional)
                    </label>
                    <input 
                        type="file" 
                        accept=".jpg,.jpeg,.png,.pdf"
                        onChange={handleFileChange}
                        className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200 cursor-pointer"
                    />
                    <p className="text-xs text-gray-400 mt-2">Max size: 5MB. Supported: JPG, PNG, PDF.</p>
                </div>

                <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition flex justify-center items-center space-x-2 disabled:opacity-50"
                >
                    <Send className="w-5 h-5" />
                    <span>{isSubmitting ? "Submitting..." : "Submit Ticket"}</span>
                </button>
            </form>
        </div>
    );
}