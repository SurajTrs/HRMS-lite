import { useState, useEffect } from 'react';
import { attendanceAPI, employeeAPI } from '../api';

const ProfessionalAttendance = ({ onNotification }) => {
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutNotes, setCheckoutNotes] = useState('');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, []);

  const fetchData = async () => {
    try {
      const [attendanceRes, employeesRes] = await Promise.all([
        fetch('/api/attendance/today'),
        employeeAPI.getAll()
      ]);
      
      const attendanceData = await attendanceRes.json();
      setTodayAttendance(attendanceData);
      setEmployees(employeesRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      onNotification?.('Failed to fetch attendance data', 'error');
      setLoading(false);
    }
  };

  const handleCheckIn = async (employeeId) => {
    try {
      const response = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId, notes: '' })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail);
      }
      
      onNotification?.('Check-in successful', 'success');
      fetchData();
    } catch (error) {
      onNotification?.(error.message, 'error');
    }
  };

  const handleCheckOut = async () => {
    if (!selectedEmployee) return;
    
    try {
      const response = await fetch('/api/attendance/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          employee_id: selectedEmployee.employee_id, 
          notes: checkoutNotes 
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail);
      }
      
      onNotification?.('Check-out successful', 'success');
      setShowCheckoutModal(false);
      setSelectedEmployee(null);
      setCheckoutNotes('');
      fetchData();
    } catch (error) {
      onNotification?.(error.message, 'error');
    }
  };

  const openCheckoutModal = (employee) => {
    setSelectedEmployee(employee);
    setShowCheckoutModal(true);
  };

  const formatTime = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDuration = (minutes) => {
    if (!minutes || minutes <= 0) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getStatusBadge = (employee) => {
    if (employee.is_checked_in) {
      const timeLeft = employee.time_until_auto_checkout;
      if (timeLeft <= 60) {
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Auto-checkout in {timeLeft}m
          </span>
        );
      }
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Checked In
        </span>
      );
    }
    
    if (employee.check_out_time) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {employee.is_auto_checkout ? 'Auto Checked Out' : 'Checked Out'}
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        Not Checked In
      </span>
    );
  };

  const stats = {
    checkedIn: todayAttendance.filter(emp => emp.is_checked_in).length,
    checkedOut: todayAttendance.filter(emp => emp.check_out_time && !emp.is_checked_in).length,
    notCheckedIn: employees.filter(emp => 
      emp.status === 'Active' && 
      !todayAttendance.find(att => att.employee_id === emp.employee_id)
    ).length
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading attendance data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Professional Attendance System</h1>
          <p className="mt-2 text-sm text-gray-700">
            Real-time check-in/check-out with automatic checkout after 10 hours
          </p>
        </div>
        <div className="mt-4 sm:mt-0 text-right">
          <div className="text-2xl font-mono font-bold text-gray-900">
            {currentTime.toLocaleTimeString()}
          </div>
          <div className="text-sm text-gray-500">
            {currentTime.toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Currently Checked In</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.checkedIn}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Checked Out Today</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.checkedOut}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Not Checked In</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.notCheckedIn}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Today's Attendance</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Click on employee names to checkout after check-in
          </p>
        </div>
        <ul className="divide-y divide-gray-200">
          {todayAttendance.map((employee) => (
            <li key={employee.employee_id} className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-700">
                        {employee.employee_name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center">
                      <button
                        onClick={() => employee.can_checkout && openCheckoutModal(employee)}
                        className={`text-sm font-medium ${
                          employee.can_checkout 
                            ? 'text-blue-600 hover:text-blue-500 cursor-pointer' 
                            : 'text-gray-900 cursor-default'
                        }`}
                        disabled={!employee.can_checkout}
                      >
                        {employee.employee_name}
                      </button>
                      <span className="ml-2 text-xs text-gray-500">
                        ({employee.employee_id})
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      Check-in: {formatTime(employee.check_in_time)} | 
                      Check-out: {formatTime(employee.check_out_time)} | 
                      Hours: {employee.working_hours}h
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(employee)}
                  {!employee.is_checked_in && !employee.check_in_time && (
                    <button
                      onClick={() => handleCheckIn(employee.employee_id)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Check In
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
          
          {/* Show employees who haven't checked in */}
          {employees
            .filter(emp => 
              emp.status === 'Active' && 
              !todayAttendance.find(att => att.employee_id === emp.employee_id)
            )
            .map((employee) => (
              <li key={employee.employee_id} className="px-4 py-4 sm:px-6 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700">
                          {employee.full_name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {employee.full_name}
                        <span className="ml-2 text-xs text-gray-500">
                          ({employee.employee_id})
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {employee.department}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Not Checked In
                    </span>
                    <button
                      onClick={() => handleCheckIn(employee.employee_id)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Check In
                    </button>
                  </div>
                </div>
              </li>
            ))}
        </ul>
      </div>

      {/* Checkout Modal */}
      {showCheckoutModal && selectedEmployee && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Check Out: {selectedEmployee.employee_name}
              </h3>
              <div className="mb-4 text-sm text-gray-600">
                <p>Check-in time: {formatTime(selectedEmployee.check_in_time)}</p>
                <p>Working hours: {selectedEmployee.working_hours}h</p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Add any notes about the checkout..."
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowCheckoutModal(false);
                    setSelectedEmployee(null);
                    setCheckoutNotes('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCheckOut}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Check Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessionalAttendance;