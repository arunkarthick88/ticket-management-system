import axios from 'axios';

// 1. Point to the new API Version 1 prefix!
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

// 2. Automatically unwrap the standard response wrapper!
api.interceptors.response.use(
    (response) => {
        // If the backend sends { status: "success", data: [...] }, 
        // we automatically pull out the inner "data" so React doesn't break!
        if (response.data && response.data.status === 'success') {
            response.data = response.data.data; 
        }
        return response;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;