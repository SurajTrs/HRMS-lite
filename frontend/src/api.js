import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Create axios instance with enhanced configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging and authentication
api.interceptors.request.use(
  (config) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${config.method?.toUpperCase()} ${config.url}`);
    
    // Add request timestamp
    config.metadata = { startTime: Date.now() };
    
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for logging and error handling
api.interceptors.response.use(
  (response) => {
    const duration = Date.now() - response.config.metadata.startTime;
    console.log(`[Response] ${response.status} in ${duration}ms`);
    return response;
  },
  (error) => {
    const duration = error.config?.metadata ? Date.now() - error.config.metadata.startTime : 0;
    console.error(`[Error] ${error.response?.status || 'Network Error'} in ${duration}ms:`, error.response?.data || error.message);
    
    // Enhanced error handling
    if (error.response?.status === 401) {
      // Handle unauthorized access
      console.warn('Unauthorized access detected');
    } else if (error.response?.status >= 500) {
      // Handle server errors
      console.error('Server error detected');
    } else if (error.code === 'ECONNABORTED') {
      // Handle timeout
      console.error('Request timeout');
    }
    
    return Promise.reject(error);
  }
);

// Employee API endpoints
export const employeeAPI = {
  // Get all employees with advanced filtering
  getAll: (params = {}) => {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    
    const queryString = queryParams.toString();
    const url = queryString ? `/api/employees?${queryString}` : '/api/employees';
    
    return api.get(url);
  },
  
  // Get employee by ID
  getById: (employeeId) => api.get(`/api/employees/${employeeId}`),
  
  // Create new employee
  create: (employee) => api.post('/api/employees', employee),
  
  // Update employee
  update: (employeeId, updateData) => api.put(`/api/employees/${employeeId}`, updateData),
  
  // Delete employee
  delete: (employeeId) => api.delete(`/api/employees/${employeeId}`),
  
  // Get employee statistics
  getStats: () => api.get('/api/employees/stats'),
};

// Attendance API endpoints
export const attendanceAPI = {
  // Get all attendance records with advanced filtering
  getAll: (params = {}) => {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    
    const queryString = queryParams.toString();
    const url = queryString ? `/api/attendance?${queryString}` : '/api/attendance';
    
    return api.get(url);
  },
  
  // Mark or update attendance
  mark: (attendance) => api.post('/api/attendance', attendance),
  
  // Get attendance by employee ID
  getByEmployee: (employeeId, params = {}) => {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    
    const queryString = queryParams.toString();
    const url = queryString ? `/api/attendance/${employeeId}?${queryString}` : `/api/attendance/${employeeId}`;
    
    return api.get(url);
  },
  
  // Bulk mark attendance
  markBulk: (attendanceList) => api.post('/api/attendance/bulk', { attendance_list: attendanceList }),
};

// Dashboard API endpoints
export const dashboardAPI = {
  // Get dashboard statistics
  getStats: () => api.get('/api/dashboard'),
  
  // Get real-time updates
  getRealTimeStats: () => api.get('/api/dashboard/realtime'),
};

// Reports API endpoints
export const reportsAPI = {
  // Get attendance summary report
  getAttendanceSummary: (dateFrom, dateTo, department = null) => {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
    });
    
    if (department) {
      params.append('department', department);
    }
    
    return api.get(`/api/reports/attendance-summary?${params.toString()}`);
  },
  
  // Get employee performance report
  getEmployeePerformance: (employeeId, dateFrom, dateTo) => {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
    });
    
    return api.get(`/api/reports/employee-performance/${employeeId}?${params.toString()}`);
  },
  
  // Get department wise report
  getDepartmentReport: (department, dateFrom, dateTo) => {
    const params = new URLSearchParams({
      department,
      date_from: dateFrom,
      date_to: dateTo,
    });
    
    return api.get(`/api/reports/department?${params.toString()}`);
  },
};

// System API endpoints
export const systemAPI = {
  // Health check
  healthCheck: () => api.get('/health'),
  
  // Get system info
  getSystemInfo: () => api.get('/'),
  
  // Get audit logs
  getAuditLogs: (params = {}) => {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    
    const queryString = queryParams.toString();
    const url = queryString ? `/api/audit-logs?${queryString}` : '/api/audit-logs';
    
    return api.get(url);
  },
};

// Utility functions
export const apiUtils = {
  // Format error message from API response
  formatErrorMessage: (error) => {
    if (error.response?.data?.message) {
      return error.response.data.message;
    } else if (error.response?.data?.detail) {
      return error.response.data.detail;
    } else if (error.message) {
      return error.message;
    } else {
      return 'An unexpected error occurred';
    }
  },
  
  // Check if API is available
  checkApiAvailability: async () => {
    try {
      await systemAPI.healthCheck();
      return true;
    } catch (error) {
      return false;
    }
  },
  
  // Get current date in YYYY-MM-DD format
  getCurrentDate: () => {
    return new Date().toISOString().split('T')[0];
  },
  
  // Get date range for reports
  getDateRange: (days) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    };
  },
  
  // Format working hours
  formatWorkingHours: (hours) => {
    if (!hours || hours === 0) return '0h 0m';
    
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    
    return `${wholeHours}h ${minutes}m`;
  },
  
  // Calculate attendance rate
  calculateAttendanceRate: (present, total) => {
    if (total === 0) return 0;
    return Math.round((present / total) * 100);
  },
  
  // Validate email format
  validateEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  // Validate employee ID format
  validateEmployeeId: (employeeId) => {
    const idRegex = /^[A-Za-z0-9_-]+$/;
    return idRegex.test(employeeId) && employeeId.length <= 20;
  },
  
  // Format date for display
  formatDisplayDate: (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  },
  
  // Format time for display
  formatDisplayTime: (timeString) => {
    if (!timeString) return '';
    
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    
    return `${displayHour}:${minutes} ${ampm}`;
  },
  
  // Get status color for UI
  getStatusColor: (status) => {
    const colors = {
      'Present': 'green',
      'Absent': 'red',
      'Late': 'yellow',
      'Half Day': 'blue',
      'Work From Home': 'purple',
      'Active': 'green',
      'Inactive': 'gray',
    };
    
    return colors[status] || 'gray';
  },
  
  // Debounce function for search
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
};

// Real-time updates using polling (can be replaced with WebSocket)
export class RealTimeUpdates {
  constructor() {
    this.intervals = new Map();
    this.callbacks = new Map();
  }
  
  // Start polling for updates
  startPolling(key, callback, interval = 30000) {
    this.stopPolling(key); // Stop existing polling
    
    this.callbacks.set(key, callback);
    
    const intervalId = setInterval(async () => {
      try {
        await callback();
      } catch (error) {
        console.error(`Polling error for ${key}:`, error);
      }
    }, interval);
    
    this.intervals.set(key, intervalId);
    
    // Initial call
    callback().catch(error => console.error(`Initial polling error for ${key}:`, error));
  }
  
  // Stop polling
  stopPolling(key) {
    const intervalId = this.intervals.get(key);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(key);
      this.callbacks.delete(key);
    }
  }
  
  // Stop all polling
  stopAllPolling() {
    this.intervals.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.intervals.clear();
    this.callbacks.clear();
  }
}

// Export singleton instance
export const realTimeUpdates = new RealTimeUpdates();

// Export default API instance
export default api;

// Legacy function exports for backward compatibility
export const getEmployees = () => employeeAPI.getAll().then(response => response.data);
export const generateAttendanceSummary = (dateFrom, dateTo, department) => 
  reportsAPI.getAttendanceSummary(dateFrom, dateTo, department).then(response => response.data);
export const generateEmployeePerformance = (employeeId, dateFrom, dateTo) => 
  reportsAPI.getEmployeePerformance(employeeId, dateFrom, dateTo).then(response => response.data);
export const generateDepartmentReport = (department, dateFrom, dateTo) => 
  reportsAPI.getDepartmentReport(department, dateFrom, dateTo).then(response => response.data);