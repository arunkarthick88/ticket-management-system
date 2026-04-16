import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8000/api/v1' 
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => {
        // SMART UNWRAP:
        // Only unwrap if 'status' is success AND the 'data' property actually exists.
        // This allows flat objects (like our new login response) to pass through safely.
        if (response.data && response.data.status === 'success' && response.data.data !== undefined) {
            response.data = response.data.data; 
        }
        return response;
    },
    (error) => {
        // Optional: Global error handling (like redirecting on 401) can go here
        return Promise.reject(error);
    }
);

export default api;