# HRMS Lite - Human Resource Management System

A lightweight, production-ready Human Resource Management System built with modern web technologies.

## 🚀 Live Demo

- **Frontend**: [https://your-app.vercel.app](https://your-app.vercel.app)
- **Backend API**: [https://your-backend.onrender.com](https://your-backend.onrender.com)
- **API Documentation**: [https://your-backend.onrender.com/docs](https://your-backend.onrender.com/docs)

## 📋 Features

### Employee Management
- ✅ Add new employees with validation
- ✅ View all employees in a responsive table
- ✅ Delete employees with confirmation
- ✅ Unique employee ID and email validation
- ✅ Department categorization

### Attendance Management
- ✅ Mark daily attendance (Present/Absent)
- ✅ View all attendance records
- ✅ Filter attendance by date
- ✅ Update existing attendance records
- ✅ Employee-specific attendance history

### Dashboard & Analytics
- ✅ Real-time statistics overview
- ✅ Today's attendance summary
- ✅ Department breakdown
- ✅ Attendance rate calculation
- ✅ Recent activity feed

## 🛠 Tech Stack

### Frontend
- **React 18** - Modern UI library
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client for API calls

### Backend
- **Python 3.8+** - Programming language
- **FastAPI** - Modern, fast web framework
- **Pydantic** - Data validation using Python type hints
- **Uvicorn** - ASGI server

### Database
- **MongoDB** - NoSQL document database
- **PyMongo** - MongoDB driver for Python

### Deployment
- **Vercel** - Frontend hosting
- **Render** - Backend hosting
- **MongoDB Atlas** - Cloud database

## 🏗 Architecture

```
Frontend (React/Vite)
    ↓ HTTP/REST API
Backend (FastAPI)
    ↓ PyMongo
Database (MongoDB)
```

## 📁 Project Structure

```
HRMS lite/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   ├── .env.example        # Environment variables template
│   └── render.sh           # Deployment script
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── api.js         # API service layer
│   │   ├── App.jsx        # Main application
│   │   └── main.jsx       # Entry point
│   ├── package.json       # Node.js dependencies
│   ├── tailwind.config.js # Tailwind configuration
│   └── vercel.json        # Vercel deployment config
├── README.md              # Project documentation
└── DEPLOYMENT.md          # Deployment guide
```

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 18+
- MongoDB (local or Atlas)

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Update .env with your MongoDB URI
uvicorn main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## 🔧 Environment Variables

### Backend (.env)
```env
MONGODB_URI=mongodb://localhost:27017/hrms_lite
PORT=8000
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:8000
```

## 📚 API Endpoints

### Employees
- `GET /api/employees` - Get all employees
- `POST /api/employees` - Create new employee
- `GET /api/employees/{id}` - Get employee by ID
- `DELETE /api/employees/{id}` - Delete employee

### Attendance
- `GET /api/attendance` - Get all attendance records
- `POST /api/attendance` - Mark attendance
- `GET /api/attendance/{employee_id}` - Get employee attendance

### Dashboard
- `GET /api/dashboard` - Get dashboard statistics
- `GET /health` - Health check endpoint

## ✨ Key Features

### Production-Ready
- ✅ Comprehensive error handling
- ✅ Input validation and sanitization
- ✅ Database indexing for performance
- ✅ CORS configuration
- ✅ Health check endpoints
- ✅ Logging and monitoring

### User Experience
- ✅ Responsive design for all devices
- ✅ Loading states and error messages
- ✅ Form validation with user feedback
- ✅ Confirmation dialogs for destructive actions
- ✅ Real-time data updates

### Data Integrity
- ✅ Unique constraints on employee ID and email
- ✅ Date validation for attendance
- ✅ Referential integrity between employees and attendance
- ✅ Automatic cleanup of related records

## 🔒 Validation & Security

### Backend Validation
- Employee ID: Alphanumeric, unique, max 20 chars
- Email: Valid email format, unique
- Full Name: Required, max 100 chars
- Department: Required, max 50 chars
- Attendance Date: Valid YYYY-MM-DD format
- Attendance Status: Must be 'Present' or 'Absent'

### Security Features
- CORS protection
- Input sanitization
- SQL injection prevention (NoSQL)
- Error message sanitization

## 📊 Database Schema

### Employees Collection
```javascript
{
  _id: ObjectId,
  employee_id: String (unique),
  full_name: String,
  email: String (unique),
  department: String
}
```

### Attendance Collection
```javascript
{
  _id: ObjectId,
  employee_id: String,
  date: String (YYYY-MM-DD),
  status: String ('Present' | 'Absent')
}
```

## 🚀 Deployment

### Automated Deployment
1. **Backend**: Deploy to Render with automatic builds
2. **Frontend**: Deploy to Vercel with automatic builds
3. **Database**: MongoDB Atlas cloud database

### Manual Deployment
See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## 🧪 Testing

### API Testing
- Use the interactive API documentation at `/docs`
- Test all endpoints with various inputs
- Verify error handling and validation

### Frontend Testing
- Test responsive design on different screen sizes
- Verify form validation and error states
- Test CRUD operations end-to-end

## 📈 Performance Optimizations

- Database indexing on frequently queried fields
- Efficient API response structure
- Optimized bundle size with Vite
- Lazy loading and code splitting
- Responsive images and assets

## 🔮 Future Enhancements

- User authentication and authorization
- Employee profile pictures
- Attendance reports and analytics
- Email notifications
- Mobile app
- Advanced filtering and search
- Data export functionality

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 👥 Team

Built with ❤️ for the HRMS Lite coding assignment.

---

**Note**: This is a lightweight HRMS system designed for the coding assignment. For production use, consider adding authentication, advanced security measures, and comprehensive testing.