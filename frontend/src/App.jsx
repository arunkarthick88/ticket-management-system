import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';
import SupportDashboard from './SupportDashboard';
import Notifications from './Notifications';
import Login from './Login';
import Register from './Register';
import Layout from './Layout';
import MyTickets from './MyTickets';
import CreateTicket from './CreateTicket';
import TicketDetails from './TicketDetails';

const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    if (!token) return <Navigate to="/login" replace />;
    return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Everything inside the Layout wrapper gets the Navbar and Purple background */}
        <Route path="/dashboard" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<MyTickets />} /> 
            <Route path="create" element={<CreateTicket />} />
            <Route path="ticket/:id" element={<TicketDetails />} />
            
            {/* NEW ADMIN ROUTE */}
            <Route path="admin" element={<AdminDashboard />} />
            
            {/* NEW SUPPORT ROUTE */}
            <Route path="support" element={<SupportDashboard />} />

            {/* NEW NOTIFICATION ROUTE */}
            <Route path="notifications" element={<Notifications />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;