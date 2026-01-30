import React, { useState, useEffect, useCallback } from 'react';
import { generateAttendanceSummary, generateEmployeePerformance, generateDepartmentReport, getEmployees } from '../api';

const Reports = ({ onNotification }) => {
  const [reportType, setReportType] = useState('');
  const [filters, setFilters] = useState({
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    department: '',
    employeeId: ''
  });
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [lastGenerated, setLastGenerated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [refreshCountdown, setRefreshCountdown] = useState(0);
  const [countdownInterval, setCountdownInterval] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSettings, setRefreshSettings] = useState({
    interval: 60, // seconds
    enabled: false,
    pauseOnError: true,
    maxRetries: 3
  });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (refreshSettings.enabled && reportData && reportType) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
    return () => stopAutoRefresh();
  }, [refreshSettings.enabled, reportData, reportType, refreshSettings.interval]);

  const startAutoRefresh = () => {
    stopAutoRefresh(); // Clear any existing intervals
    
    const intervalMs = refreshSettings.interval * 1000;
    setRefreshCountdown(refreshSettings.interval);
    
    // Countdown timer
    const countdown = setInterval(() => {
      setRefreshCountdown(prev => {
        if (prev <= 1) {
          return refreshSettings.interval;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Refresh timer
    const refresh = setInterval(async () => {
      if (!isRefreshing) {
        await performAutoRefresh();
      }
    }, intervalMs);
    
    setCountdownInterval(countdown);
    setRefreshInterval(refresh);
  };
  
  const stopAutoRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      setCountdownInterval(null);
    }
    setRefreshCountdown(0);
  };
  
  const performAutoRefresh = async () => {
    setIsRefreshing(true);
    try {
      await generateReport(true);
      setRetryCount(0); // Reset retry count on success
    } catch (error) {
      console.error('Auto-refresh failed:', error);
      setRetryCount(prev => prev + 1);
      
      if (refreshSettings.pauseOnError && retryCount >= refreshSettings.maxRetries) {
        setRefreshSettings(prev => ({ ...prev, enabled: false }));
        if (onNotification) {
          onNotification(`Auto-refresh paused after ${refreshSettings.maxRetries} failed attempts`, 'warning');
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const toggleAutoRefresh = () => {
    setRefreshSettings(prev => ({ ...prev, enabled: !prev.enabled }));
    if (onNotification) {
      onNotification(
        refreshSettings.enabled ? 'Auto-refresh disabled' : 'Auto-refresh enabled',
        'info'
      );
    }
  };

  const loadEmployees = async () => {
    try {
      const data = await getEmployees();
      setEmployees(data);
      const uniqueDepts = [...new Set(data.map(emp => emp.department))];
      setDepartments(uniqueDepts);
    } catch (error) {
      console.error('Failed to load employees:', error);
      if (onNotification) {
        onNotification('Failed to load employee data', 'error');
      }
    }
  };

  const generateReport = useCallback(async (silent = false) => {
    if (!reportType) {
      setError('Please select a report type');
      if (onNotification) {
        onNotification('Please select a report type', 'warning');
      }
      return;
    }

    if (!filters.dateFrom || !filters.dateTo) {
      setError('Please select date range');
      if (onNotification) {
        onNotification('Please select date range', 'warning');
      }
      return;
    }

    if (reportType === 'employee-performance' && !filters.employeeId) {
      setError('Please select an employee for performance report');
      if (onNotification) {
        onNotification('Please select an employee', 'warning');
      }
      return;
    }

    if (reportType === 'department' && !filters.department) {
      setError('Please select a department for department report');
      if (onNotification) {
        onNotification('Please select a department', 'warning');
      }
      return;
    }

    if (!silent) setLoading(true);
    setError('');

    try {
      let data;
      switch (reportType) {
        case 'attendance-summary':
          data = await generateAttendanceSummary(filters.dateFrom, filters.dateTo, filters.department);
          break;
        case 'employee-performance':
          data = await generateEmployeePerformance(filters.employeeId, filters.dateFrom, filters.dateTo);
          break;
        case 'department':
          data = await generateDepartmentReport(filters.department, filters.dateFrom, filters.dateTo);
          break;
        default:
          throw new Error('Invalid report type');
      }
      setReportData(data);
      setLastGenerated(new Date());
      if (onNotification && !silent) {
        onNotification('Report generated successfully', 'success');
      }
    } catch (error) {
      console.error('Report generation failed:', error);
      const errorMsg = error.message || 'Failed to generate report';
      setError(errorMsg);
      if (onNotification) {
        onNotification(errorMsg, 'error');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [reportType, filters, onNotification]);

  const exportReport = () => {
    if (!reportData) {
      if (onNotification) {
        onNotification('No report data to export', 'warning');
      }
      return;
    }
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${reportType}-report-${timestamp}.json`;
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    if (onNotification) {
      onNotification(`Report exported as ${filename}`, 'success');
    }
  };

  const renderReportContent = () => {
    if (!reportData) {
      return (
        <div className="text-center py-12 text-gray-500">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-lg">No report data</p>
          <p className="text-sm">Configure your filters and generate a report to see data here.</p>
        </div>
      );
    }

    switch (reportType) {
      case 'attendance-summary':
        return renderAttendanceSummary();
      case 'employee-performance':
        return renderEmployeePerformance();
      case 'department':
        return renderDepartmentReport();
      default:
        return null;
    }
  };

  const renderAttendanceSummary = () => {
    if (!reportData) return null;

    const { summary, employee_summary } = reportData;
    
    // Add null checks
    if (!summary) {
      return (
        <div className="text-center py-8 text-gray-500">
          <p>Invalid attendance summary data</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="text-2xl font-bold text-green-600">{summary.present_count || 0}</div>
            <div className="text-sm text-green-700">Present Days</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="text-2xl font-bold text-red-600">{summary.absent_count || 0}</div>
            <div className="text-sm text-red-700">Absent Days</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-600">{summary.late_count || 0}</div>
            <div className="text-sm text-yellow-700">Late Days</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{summary.attendance_rate || 0}%</div>
            <div className="text-sm text-blue-700">Attendance Rate</div>
          </div>
        </div>
        
        {employee_summary && employee_summary.length > 0 && (
          <div className="bg-white rounded-lg border">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Employee Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Present</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Absent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Late</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {employee_summary.map((emp) => (
                    <tr key={emp.employee_id || Math.random()} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{emp.employee_id || 'Unknown'}</td>
                      <td className="px-6 py-4 text-sm text-green-600">{emp.present || 0}</td>
                      <td className="px-6 py-4 text-sm text-red-600">{emp.absent || 0}</td>
                      <td className="px-6 py-4 text-sm text-yellow-600">{emp.late || 0}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{(emp.total_hours || 0).toFixed(1)}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderEmployeePerformance = () => {
    if (!reportData) return null;

    const { employee, summary, attendance_records } = reportData;
    
    // Add null checks
    if (!employee || !summary) {
      return (
        <div className="text-center py-8 text-gray-500">
          <p>Invalid employee performance data</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">{employee.full_name || 'Unknown Employee'} - {employee.department || 'Unknown Department'}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.total_days || 0}</div>
              <div className="text-sm text-gray-600">Total Days</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.present_days || 0}</div>
              <div className="text-sm text-gray-600">Present</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.attendance_rate || 0}%</div>
              <div className="text-sm text-gray-600">Attendance Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{summary.total_hours || 0}h</div>
              <div className="text-sm text-gray-600">Total Hours</div>
            </div>
          </div>
        </div>
        
        {attendance_records && attendance_records.length > 0 && (
          <div className="bg-white rounded-lg border">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Daily Attendance</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check In</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check Out</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {attendance_records.map((record, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{record.date || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          record.status === 'Present' ? 'bg-green-100 text-green-800' :
                          record.status === 'Absent' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {record.status || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{record.check_in_time || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{record.check_out_time || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{record.working_hours ? `${record.working_hours}h` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDepartmentReport = () => {
    if (!reportData) return null;

    const { summary, employee_breakdown } = reportData;
    
    // Add null checks
    if (!summary) {
      return (
        <div className="text-center py-8 text-gray-500">
          <p>Invalid department report data</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Department: {reportData.department || 'Unknown'}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.total_employees || 0}</div>
              <div className="text-sm text-gray-600">Total Employees</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.present_count || 0}</div>
              <div className="text-sm text-gray-600">Present Records</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{summary.absent_count || 0}</div>
              <div className="text-sm text-gray-600">Absent Records</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{summary.department_attendance_rate || 0}%</div>
              <div className="text-sm text-gray-600">Attendance Rate</div>
            </div>
          </div>
        </div>
        
        {employee_breakdown && employee_breakdown.length > 0 && (
          <div className="bg-white rounded-lg border">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Employee Performance</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Present</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Absent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Late</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {employee_breakdown.map((emp) => (
                    <tr key={emp.employee_id || Math.random()} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{emp.full_name || 'Unknown Employee'}</div>
                        <div className="text-sm text-gray-500">{emp.employee_id || 'Unknown ID'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-green-600">{emp.present || 0}</td>
                      <td className="px-6 py-4 text-sm text-red-600">{emp.absent || 0}</td>
                      <td className="px-6 py-4 text-sm text-yellow-600">{emp.late || 0}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          (emp.attendance_rate || 0) >= 90 ? 'bg-green-100 text-green-800' :
                          (emp.attendance_rate || 0) >= 75 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {emp.attendance_rate || 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Reports & Analytics</h2>
            <p className="text-gray-600 mt-1">Generate comprehensive reports and analyze attendance data</p>
            {lastGenerated && (
              <p className="text-sm text-gray-500 mt-2">
                Last generated: {lastGenerated.toLocaleDateString()}, {lastGenerated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {reportData && (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <label className="flex items-center space-x-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={refreshSettings.enabled}
                      onChange={toggleAutoRefresh}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Auto-refresh</span>
                  </label>
                  
                  {refreshSettings.enabled && (
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center text-xs text-green-600">
                        <div className={`w-2 h-2 rounded-full mr-1 ${
                          isRefreshing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500 animate-pulse'
                        }`}></div>
                        <span>{isRefreshing ? 'Refreshing...' : `Next: ${refreshCountdown}s`}</span>
                      </div>
                      
                      <select
                        value={refreshSettings.interval}
                        onChange={(e) => setRefreshSettings(prev => ({ ...prev, interval: parseInt(e.target.value) }))}
                        className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
                      >
                        <option value={30}>30s</option>
                        <option value={60}>1m</option>
                        <option value={120}>2m</option>
                        <option value={300}>5m</option>
                      </select>
                    </div>
                  )}
                </div>
                
                {retryCount > 0 && (
                  <div className="text-xs text-orange-600 flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {retryCount}/{refreshSettings.maxRetries} retries
                  </div>
                )}
              </div>
            )}
            
            {reportData && (
              <button
                onClick={exportReport}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 transition-colors"
              >
                📥 Export
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => setReportType('attendance-summary')}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              reportType === 'attendance-summary'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-2">📊</div>
            <div className="font-semibold">Attendance Summary</div>
            <div className="text-sm text-gray-600">Overall attendance statistics and trends</div>
          </button>

          <button
            onClick={() => setReportType('employee-performance')}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              reportType === 'employee-performance'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-2">👤</div>
            <div className="font-semibold">Employee Performance</div>
            <div className="text-sm text-gray-600">Individual employee attendance performance</div>
          </button>

          <button
            onClick={() => setReportType('department')}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              reportType === 'department'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-2">🏢</div>
            <div className="font-semibold">Department Report</div>
            <div className="text-sm text-gray-600">Department-wise attendance analysis</div>
          </button>
        </div>

        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {reportType === 'employee-performance' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                <select
                  value={filters.employeeId}
                  onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.employee_id} value={emp.employee_id}>
                      {emp.full_name} ({emp.employee_id})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {(reportType === 'attendance-summary' || reportType === 'department') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  value={filters.department}
                  onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{reportType === 'department' ? 'Select Department' : 'All Departments'}</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => generateReport(false)}
              disabled={loading || !reportType}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Generate Report
                </>
              )}
            </button>
            
            {reportData && (
              <button
                onClick={() => generateReport(false)}
                disabled={loading}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                title="Refresh report"
              >
                <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            )}
          </div>
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">
            {reportType ? `${reportType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Report` : 'Report Results'}
          </h3>
        </div>
        <div className="p-6">
          {renderReportContent()}
        </div>
      </div>
    </div>
  );
};

export default Reports;