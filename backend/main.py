from fastapi import FastAPI, HTTPException, status, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo import MongoClient, errors, ASCENDING, DESCENDING
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
import os
import re
import logging
from dotenv import load_dotenv
from bson import ObjectId
import asyncio
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('hrms.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

load_dotenv()

# Database connection with connection pooling
class Database:
    client: MongoClient = None
    db = None

database = Database()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        database.client = MongoClient(
            os.getenv("MONGODB_URI", "mongodb://localhost:27017/hrms_lite"),
            maxPoolSize=50,
            minPoolSize=10,
            maxIdleTimeMS=30000,
            serverSelectionTimeoutMS=5000,
            socketTimeoutMS=20000,
            connectTimeoutMS=20000,
            heartbeatFrequencyMS=10000
        )
        
        # Test connection
        database.client.admin.command('ping')
        database.db = database.client.hrms_lite
        
        # Create collections and indexes
        await setup_database()
        
        logger.info("✅ Connected to MongoDB successfully")
        logger.info("✅ Database indexes created successfully")
        
    except Exception as e:
        logger.error(f"❌ Failed to connect to MongoDB: {e}")
        raise
    
    yield
    
    # Shutdown
    if database.client:
        database.client.close()
        logger.info("🔌 Database connection closed")

async def setup_database():
    """Setup database collections and indexes"""
    try:
        # Employee collection indexes
        database.db.employees.create_index("employee_id", unique=True)
        database.db.employees.create_index("email", unique=True)
        database.db.employees.create_index("department")
        database.db.employees.create_index("created_at")
        
        # Attendance collection indexes
        database.db.attendance.create_index([("employee_id", ASCENDING), ("date", ASCENDING)], unique=True)
        database.db.attendance.create_index("date")
        database.db.attendance.create_index("status")
        database.db.attendance.create_index("created_at")
        
        # Audit log collection indexes
        database.db.audit_logs.create_index("timestamp")
        database.db.audit_logs.create_index("action")
        database.db.audit_logs.create_index("entity_type")
        
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")

app = FastAPI(
    title="HRMS Lite API",
    description="A comprehensive Human Resource Management System API",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Enhanced CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-Page-Count"]
)

# Custom exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "message": exc.detail,
            "status_code": exc.status_code,
            "timestamp": datetime.utcnow().isoformat()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "message": "Internal server error",
            "status_code": 500,
            "timestamp": datetime.utcnow().isoformat()
        }
    )

# Enhanced Pydantic models with comprehensive validation
class Employee(BaseModel):
    employee_id: str = Field(..., min_length=1, max_length=20, description="Unique employee identifier")
    full_name: str = Field(..., min_length=1, max_length=100, description="Employee full name")
    email: EmailStr = Field(..., description="Employee email address")
    department: str = Field(..., min_length=1, max_length=50, description="Employee department")
    phone: Optional[str] = Field(None, max_length=20, description="Employee phone number")
    position: Optional[str] = Field(None, max_length=100, description="Employee position/title")
    hire_date: Optional[str] = Field(None, description="Employee hire date (YYYY-MM-DD)")
    salary: Optional[float] = Field(None, ge=0, description="Employee salary")
    status: str = Field(default="Active", description="Employee status")

    @field_validator('employee_id')
    @classmethod
    def validate_employee_id(cls, v):
        if not re.match(r'^[A-Za-z0-9_-]+$', v):
            raise ValueError('Employee ID can only contain letters, numbers, hyphens, and underscores')
        return v.strip().upper()

    @field_validator('full_name')
    @classmethod
    def validate_full_name(cls, v):
        if not re.match(r'^[A-Za-z\s.]+$', v):
            raise ValueError('Full name can only contain letters, spaces, and periods')
        return v.strip().title()

    @field_validator('department')
    @classmethod
    def validate_department(cls, v):
        return v.strip().title()

    @field_validator('hire_date')
    @classmethod
    def validate_hire_date(cls, v):
        if v:
            try:
                datetime.strptime(v, '%Y-%m-%d')
            except ValueError:
                raise ValueError('Hire date must be in YYYY-MM-DD format')
        return v

class EmployeeResponse(BaseModel):
    id: str
    employee_id: str
    full_name: str
    email: str
    department: str
    phone: Optional[str] = None
    position: Optional[str] = None
    hire_date: Optional[str] = None
    salary: Optional[float] = None
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    department: Optional[str] = Field(None, min_length=1, max_length=50)
    phone: Optional[str] = Field(None, max_length=20)
    position: Optional[str] = Field(None, max_length=100)
    salary: Optional[float] = Field(None, ge=0)
    status: Optional[str] = None

class Attendance(BaseModel):
    employee_id: str = Field(..., description="Employee ID")
    date: str = Field(..., description="Attendance date (YYYY-MM-DD)")
    status: str = Field(..., description="Attendance status")
    check_in_time: Optional[str] = Field(None, description="Check-in time (HH:MM)")
    check_out_time: Optional[str] = Field(None, description="Check-out time (HH:MM)")
    notes: Optional[str] = Field(None, max_length=500, description="Additional notes")

    @field_validator('date')
    @classmethod
    def validate_date(cls, v):
        try:
            datetime.strptime(v, '%Y-%m-%d')
            return v
        except ValueError:
            raise ValueError('Date must be in YYYY-MM-DD format')

    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        valid_statuses = ['Present', 'Absent', 'Late', 'Half Day', 'Work From Home']
        if v not in valid_statuses:
            raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v

    @field_validator('check_in_time', 'check_out_time')
    @classmethod
    def validate_time(cls, v):
        if v:
            try:
                datetime.strptime(v, '%H:%M')
            except ValueError:
                raise ValueError('Time must be in HH:MM format')
        return v

class AttendanceResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    date: str
    status: str
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    notes: Optional[str] = None
    working_hours: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

class DashboardStats(BaseModel):
    total_employees: int
    active_employees: int
    present_today: int
    absent_today: int
    late_today: int
    departments: List[str]
    total_departments: int
    attendance_rate: float
    recent_hires: int
    avg_working_hours: Optional[float] = None
    recent_attendance: Optional[List[Dict[str, Any]]] = None
    last_updated: datetime = Field(default_factory=datetime.utcnow)

class AuditLog(BaseModel):
    action: str
    entity_type: str
    entity_id: str
    details: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ReportResponse(BaseModel):
    report_type: str
    generated_at: datetime
    data: Dict[str, Any]
    summary: Dict[str, Any]

# Utility functions
async def log_audit(action: str, entity_type: str, entity_id: str, details: Dict[str, Any]):
    """Log audit trail for important actions"""
    try:
        audit_log = AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details
        )
        database.db.audit_logs.insert_one(audit_log.dict())
    except Exception as e:
        logger.error(f"Failed to log audit: {e}")

def calculate_working_hours(check_in: str, check_out: str) -> float:
    """Calculate working hours between check-in and check-out"""
    try:
        if not check_in or not check_out:
            return 0.0
        
        check_in_time = datetime.strptime(check_in, '%H:%M')
        check_out_time = datetime.strptime(check_out, '%H:%M')
        
        # Handle next day checkout
        if check_out_time < check_in_time:
            check_out_time += timedelta(days=1)
        
        duration = check_out_time - check_in_time
        return round(duration.total_seconds() / 3600, 2)
    except:
        return 0.0

# Health check endpoint
@app.get("/health", tags=["System"])
async def health_check():
    """Comprehensive health check endpoint"""
    try:
        # Test database connection
        database.client.admin.command('ping')
        
        # Get database stats
        db_stats = database.db.command("dbStats")
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database": {
                "status": "connected",
                "collections": db_stats.get("collections", 0),
                "data_size": db_stats.get("dataSize", 0),
                "storage_size": db_stats.get("storageSize", 0)
            },
            "version": "2.0.0"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service unavailable"
        )

# Employee Management Endpoints
@app.get("/api/employees", response_model=List[EmployeeResponse], tags=["Employees"])
async def get_employees(
    skip: int = 0,
    limit: int = 100,
    department: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None
):
    """Get all employees with filtering and pagination"""
    try:
        query = {}
        
        # Apply filters
        if department:
            query["department"] = {"$regex": department, "$options": "i"}
        if status:
            query["status"] = status
        if search:
            query["$or"] = [
                {"full_name": {"$regex": search, "$options": "i"}},
                {"employee_id": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}}
            ]
        
        # Get total count for pagination
        total_count = database.db.employees.count_documents(query)
        
        # Get employees with pagination
        employees = list(
            database.db.employees
            .find(query)
            .sort("created_at", DESCENDING)
            .skip(skip)
            .limit(limit)
        )
        
        result = []
        for emp in employees:
            result.append(EmployeeResponse(
                id=str(emp["_id"]),
                employee_id=emp["employee_id"],
                full_name=emp["full_name"],
                email=emp["email"],
                department=emp["department"],
                phone=emp.get("phone"),
                position=emp.get("position"),
                hire_date=emp.get("hire_date"),
                salary=emp.get("salary"),
                status=emp.get("status", "Active"),
                created_at=emp.get("created_at", datetime.utcnow()),
                updated_at=emp.get("updated_at")
            ))
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching employees: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch employees"
        )

@app.post("/api/employees", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED, tags=["Employees"])
async def create_employee(employee: Employee, background_tasks: BackgroundTasks):
    """Create a new employee with comprehensive validation"""
    try:
        # Check for duplicate employee ID
        if database.db.employees.find_one({"employee_id": employee.employee_id}):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Employee ID '{employee.employee_id}' already exists"
            )
        
        # Check for duplicate email
        if database.db.employees.find_one({"email": employee.email}):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{employee.email}' already exists"
            )
        
        # Prepare employee data
        employee_data = employee.dict()
        employee_data["created_at"] = datetime.utcnow()
        employee_data["updated_at"] = None
        
        # Insert employee
        result = database.db.employees.insert_one(employee_data)
        created_employee = database.db.employees.find_one({"_id": result.inserted_id})
        
        # Log audit trail
        background_tasks.add_task(
            log_audit,
            "CREATE",
            "employee",
            employee.employee_id,
            {"employee_data": employee_data}
        )
        
        logger.info(f"✅ Employee created: {employee.employee_id}")
        
        return EmployeeResponse(
            id=str(created_employee["_id"]),
            employee_id=created_employee["employee_id"],
            full_name=created_employee["full_name"],
            email=created_employee["email"],
            department=created_employee["department"],
            phone=created_employee.get("phone"),
            position=created_employee.get("position"),
            hire_date=created_employee.get("hire_date"),
            salary=created_employee.get("salary"),
            status=created_employee.get("status", "Active"),
            created_at=created_employee["created_at"],
            updated_at=created_employee.get("updated_at")
        )
        
    except HTTPException:
        raise
    except errors.DuplicateKeyError as e:
        if "employee_id" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Employee ID '{employee.employee_id}' already exists"
            )
        elif "email" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{employee.email}' already exists"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Duplicate entry detected"
            )
    except Exception as e:
        logger.error(f"Error creating employee: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create employee"
        )

@app.get("/api/employees/{employee_id}", response_model=EmployeeResponse, tags=["Employees"])
async def get_employee(employee_id: str):
    """Get employee by ID"""
    try:
        employee = database.db.employees.find_one({"employee_id": employee_id})
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID '{employee_id}' not found"
            )
        
        return EmployeeResponse(
            id=str(employee["_id"]),
            employee_id=employee["employee_id"],
            full_name=employee["full_name"],
            email=employee["email"],
            department=employee["department"],
            phone=employee.get("phone"),
            position=employee.get("position"),
            hire_date=employee.get("hire_date"),
            salary=employee.get("salary"),
            status=employee.get("status", "Active"),
            created_at=employee.get("created_at", datetime.utcnow()),
            updated_at=employee.get("updated_at")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching employee {employee_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch employee"
        )

@app.put("/api/employees/{employee_id}", response_model=EmployeeResponse, tags=["Employees"])
async def update_employee(employee_id: str, employee_update: EmployeeUpdate, background_tasks: BackgroundTasks):
    """Update employee information"""
    try:
        # Check if employee exists
        existing_employee = database.db.employees.find_one({"employee_id": employee_id})
        if not existing_employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID '{employee_id}' not found"
            )
        
        # Prepare update data
        update_data = {k: v for k, v in employee_update.dict().items() if v is not None}
        if update_data:
            update_data["updated_at"] = datetime.utcnow()
            
            # Check for duplicate email if email is being updated
            if "email" in update_data:
                existing_email = database.db.employees.find_one({
                    "email": update_data["email"],
                    "employee_id": {"$ne": employee_id}
                })
                if existing_email:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Email '{update_data['email']}' already exists"
                    )
            
            # Update employee
            database.db.employees.update_one(
                {"employee_id": employee_id},
                {"$set": update_data}
            )
            
            # Log audit trail
            background_tasks.add_task(
                log_audit,
                "UPDATE",
                "employee",
                employee_id,
                {"updated_fields": update_data}
            )
        
        # Get updated employee
        updated_employee = database.db.employees.find_one({"employee_id": employee_id})
        
        return EmployeeResponse(
            id=str(updated_employee["_id"]),
            employee_id=updated_employee["employee_id"],
            full_name=updated_employee["full_name"],
            email=updated_employee["email"],
            department=updated_employee["department"],
            phone=updated_employee.get("phone"),
            position=updated_employee.get("position"),
            hire_date=updated_employee.get("hire_date"),
            salary=updated_employee.get("salary"),
            status=updated_employee.get("status", "Active"),
            created_at=updated_employee.get("created_at", datetime.utcnow()),
            updated_at=updated_employee.get("updated_at")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating employee {employee_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update employee"
        )

@app.delete("/api/employees/{employee_id}", tags=["Employees"])
async def delete_employee(employee_id: str, background_tasks: BackgroundTasks):
    """Delete employee and related records"""
    try:
        # Check if employee exists
        employee = database.db.employees.find_one({"employee_id": employee_id})
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID '{employee_id}' not found"
            )
        
        # Delete employee
        result = database.db.employees.delete_one({"employee_id": employee_id})
        
        # Delete related attendance records
        attendance_result = database.db.attendance.delete_many({"employee_id": employee_id})
        
        # Log audit trail
        background_tasks.add_task(
            log_audit,
            "DELETE",
            "employee",
            employee_id,
            {
                "employee_data": employee,
                "attendance_records_deleted": attendance_result.deleted_count
            }
        )
        
        logger.info(f"🗑️ Employee deleted: {employee_id}, Attendance records deleted: {attendance_result.deleted_count}")
        
        return {
            "message": "Employee deleted successfully",
            "employee_id": employee_id,
            "attendance_records_deleted": attendance_result.deleted_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting employee {employee_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete employee"
        )

# Attendance Management Endpoints
@app.get("/api/attendance", response_model=List[AttendanceResponse], tags=["Attendance"])
async def get_attendance(
    skip: int = 0,
    limit: int = 100,
    date_filter: Optional[str] = None,
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Get attendance records with advanced filtering"""
    try:
        query = {}
        
        # Apply filters
        if date_filter:
            query["date"] = date_filter
        if employee_id:
            query["employee_id"] = employee_id
        if status:
            query["status"] = status
        if date_from and date_to:
            query["date"] = {"$gte": date_from, "$lte": date_to}
        elif date_from:
            query["date"] = {"$gte": date_from}
        elif date_to:
            query["date"] = {"$lte": date_to}
        
        # Get attendance records
        attendance_records = list(
            database.db.attendance
            .find(query)
            .sort([("date", DESCENDING), ("employee_id", ASCENDING)])
            .skip(skip)
            .limit(limit)
        )
        
        result = []
        for record in attendance_records:
            # Get employee info
            employee = database.db.employees.find_one({"employee_id": record["employee_id"]})
            employee_name = employee["full_name"] if employee else "Unknown Employee"
            
            # Calculate working hours
            working_hours = None
            if record.get("check_in_time") and record.get("check_out_time"):
                working_hours = calculate_working_hours(
                    record["check_in_time"],
                    record["check_out_time"]
                )
            
            result.append(AttendanceResponse(
                id=str(record["_id"]),
                employee_id=record["employee_id"],
                employee_name=employee_name,
                date=record["date"],
                status=record["status"],
                check_in_time=record.get("check_in_time"),
                check_out_time=record.get("check_out_time"),
                notes=record.get("notes"),
                working_hours=working_hours,
                created_at=record.get("created_at", datetime.utcnow()),
                updated_at=record.get("updated_at")
            ))
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching attendance: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch attendance records"
        )

@app.post("/api/attendance", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED, tags=["Attendance"])
async def mark_attendance(attendance: Attendance, background_tasks: BackgroundTasks):
    """Mark or update attendance with enhanced features"""
    try:
        # Validate employee exists
        employee = database.db.employees.find_one({"employee_id": attendance.employee_id})
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID '{attendance.employee_id}' not found"
            )
        
        # Check if attendance already exists for this date
        existing = database.db.attendance.find_one({
            "employee_id": attendance.employee_id,
            "date": attendance.date
        })
        
        # Prepare attendance data
        attendance_data = attendance.dict()
        
        if existing:
            # Update existing record
            attendance_data["updated_at"] = datetime.utcnow()
            database.db.attendance.update_one(
                {"_id": existing["_id"]},
                {"$set": attendance_data}
            )
            updated_record = database.db.attendance.find_one({"_id": existing["_id"]})
            
            # Log audit trail
            background_tasks.add_task(
                log_audit,
                "UPDATE",
                "attendance",
                f"{attendance.employee_id}_{attendance.date}",
                {"attendance_data": attendance_data}
            )
            
            logger.info(f"📝 Attendance updated: {attendance.employee_id} - {attendance.date} - {attendance.status}")
            record = updated_record
        else:
            # Create new record
            attendance_data["created_at"] = datetime.utcnow()
            attendance_data["updated_at"] = None
            
            result = database.db.attendance.insert_one(attendance_data)
            record = database.db.attendance.find_one({"_id": result.inserted_id})
            
            # Log audit trail
            background_tasks.add_task(
                log_audit,
                "CREATE",
                "attendance",
                f"{attendance.employee_id}_{attendance.date}",
                {"attendance_data": attendance_data}
            )
            
            logger.info(f"✅ Attendance marked: {attendance.employee_id} - {attendance.date} - {attendance.status}")
        
        # Calculate working hours
        working_hours = None
        if record.get("check_in_time") and record.get("check_out_time"):
            working_hours = calculate_working_hours(
                record["check_in_time"],
                record["check_out_time"]
            )
        
        return AttendanceResponse(
            id=str(record["_id"]),
            employee_id=record["employee_id"],
            employee_name=employee["full_name"],
            date=record["date"],
            status=record["status"],
            check_in_time=record.get("check_in_time"),
            check_out_time=record.get("check_out_time"),
            notes=record.get("notes"),
            working_hours=working_hours,
            created_at=record.get("created_at", datetime.utcnow()),
            updated_at=record.get("updated_at")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking attendance: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark attendance"
        )

@app.get("/api/attendance/{employee_id}", response_model=List[AttendanceResponse], tags=["Attendance"])
async def get_employee_attendance(
    employee_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 100
):
    """Get attendance records for a specific employee"""
    try:
        # Validate employee exists
        employee = database.db.employees.find_one({"employee_id": employee_id})
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID '{employee_id}' not found"
            )
        
        # Build query
        query = {"employee_id": employee_id}
        if date_from and date_to:
            query["date"] = {"$gte": date_from, "$lte": date_to}
        elif date_from:
            query["date"] = {"$gte": date_from}
        elif date_to:
            query["date"] = {"$lte": date_to}
        
        # Get attendance records
        attendance_records = list(
            database.db.attendance
            .find(query)
            .sort("date", DESCENDING)
            .limit(limit)
        )
        
        result = []
        for record in attendance_records:
            # Calculate working hours
            working_hours = None
            if record.get("check_in_time") and record.get("check_out_time"):
                working_hours = calculate_working_hours(
                    record["check_in_time"],
                    record["check_out_time"]
                )
            
            result.append(AttendanceResponse(
                id=str(record["_id"]),
                employee_id=record["employee_id"],
                employee_name=employee["full_name"],
                date=record["date"],
                status=record["status"],
                check_in_time=record.get("check_in_time"),
                check_out_time=record.get("check_out_time"),
                notes=record.get("notes"),
                working_hours=working_hours,
                created_at=record.get("created_at", datetime.utcnow()),
                updated_at=record.get("updated_at")
            ))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching employee attendance {employee_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch employee attendance"
        )

# Dashboard and Analytics
@app.get("/api/dashboard", response_model=DashboardStats, tags=["Dashboard"])
async def get_dashboard_stats():
    """Get comprehensive dashboard statistics with real-time data"""
    try:
        # Employee statistics
        total_employees = database.db.employees.count_documents({})
        active_employees = database.db.employees.count_documents({"status": "Active"})
        
        # Today's attendance statistics
        today = datetime.now().strftime('%Y-%m-%d')
        today_attendance = list(database.db.attendance.find({"date": today}))
        
        present_today = len([a for a in today_attendance if a["status"] == "Present"])
        absent_today = len([a for a in today_attendance if a["status"] == "Absent"])
        late_today = len([a for a in today_attendance if a["status"] == "Late"])
        
        # Department statistics
        departments = database.db.employees.distinct("department")
        
        # Attendance rate calculation (Present + Late as attended)
        total_today = len(today_attendance)
        attended_today = present_today + late_today
        attendance_rate = (attended_today / active_employees * 100) if active_employees > 0 else 0
        
        # Recent hires (last 30 days)
        thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        recent_hires = database.db.employees.count_documents({
            "hire_date": {"$gte": thirty_days_ago}
        })
        
        # Average working hours (last 7 days)
        seven_days_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        recent_attendance_records = list(database.db.attendance.find({
            "date": {"$gte": seven_days_ago},
            "check_in_time": {"$exists": True},
            "check_out_time": {"$exists": True}
        }))
        
        total_hours = 0
        hours_count = 0
        for record in recent_attendance_records:
            if record.get("check_in_time") and record.get("check_out_time"):
                hours = calculate_working_hours(record["check_in_time"], record["check_out_time"])
                if hours > 0:
                    total_hours += hours
                    hours_count += 1
        
        avg_working_hours = round(total_hours / hours_count, 2) if hours_count > 0 else None
        
        # Get recent attendance with employee details
        recent_attendance = []
        for attendance in today_attendance[:10]:  # Limit to 10 recent records
            employee = database.db.employees.find_one({"employee_id": attendance["employee_id"]})
            if employee:
                recent_attendance.append({
                    "employee_id": attendance["employee_id"],
                    "employee_name": employee["full_name"],
                    "date": attendance["date"],
                    "status": attendance["status"],
                    "check_in_time": attendance.get("check_in_time"),
                    "check_out_time": attendance.get("check_out_time"),
                    "department": employee["department"]
                })
        
        return DashboardStats(
            total_employees=total_employees,
            active_employees=active_employees,
            present_today=present_today,
            absent_today=absent_today,
            late_today=late_today,
            departments=departments,
            total_departments=len(departments),
            attendance_rate=round(attendance_rate, 2),
            recent_hires=recent_hires,
            avg_working_hours=avg_working_hours,
            recent_attendance=recent_attendance
        )
        
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch dashboard statistics"
        )

# Reports and Analytics
@app.get("/api/reports/attendance-summary", tags=["Reports"])
async def get_attendance_summary(
    date_from: str,
    date_to: str,
    department: Optional[str] = None
):
    """Get attendance summary report for a date range"""
    try:
        # Build query
        query = {"date": {"$gte": date_from, "$lte": date_to}}
        
        # Get attendance data
        attendance_data = list(database.db.attendance.find(query))
        
        # Get employee data for filtering
        employee_query = {}
        if department:
            employee_query["department"] = department
        employees = list(database.db.employees.find(employee_query))
        employee_ids = [emp["employee_id"] for emp in employees]
        
        # Filter attendance by department if specified
        if department:
            attendance_data = [a for a in attendance_data if a["employee_id"] in employee_ids]
        
        # Calculate summary statistics
        total_records = len(attendance_data)
        present_count = len([a for a in attendance_data if a["status"] == "Present"])
        absent_count = len([a for a in attendance_data if a["status"] == "Absent"])
        late_count = len([a for a in attendance_data if a["status"] == "Late"])
        
        # Employee-wise summary
        employee_summary = {}
        for record in attendance_data:
            emp_id = record["employee_id"]
            if emp_id not in employee_summary:
                employee_summary[emp_id] = {
                    "employee_id": emp_id,
                    "present": 0,
                    "absent": 0,
                    "late": 0,
                    "total_hours": 0
                }
            
            status_key = record["status"].lower().replace(" ", "_")
            if status_key in employee_summary[emp_id]:
                employee_summary[emp_id][status_key] += 1
            
            # Add working hours
            if record.get("check_in_time") and record.get("check_out_time"):
                hours = calculate_working_hours(record["check_in_time"], record["check_out_time"])
                employee_summary[emp_id]["total_hours"] += hours
        
        return {
            "date_range": {"from": date_from, "to": date_to},
            "department": department,
            "summary": {
                "total_records": total_records,
                "present_count": present_count,
                "absent_count": absent_count,
                "late_count": late_count,
                "attendance_rate": round((present_count / total_records * 100), 2) if total_records > 0 else 0
            },
            "employee_summary": list(employee_summary.values())
        }
        
    except Exception as e:
        logger.error(f"Error generating attendance summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate attendance summary"
        )

@app.get("/api/reports/employee-performance/{employee_id}", tags=["Reports"])
async def get_employee_performance(
    employee_id: str,
    date_from: str,
    date_to: str
):
    """Get employee performance report"""
    try:
        # Validate employee exists
        employee = database.db.employees.find_one({"employee_id": employee_id})
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID '{employee_id}' not found"
            )
        
        # Get attendance data
        query = {
            "employee_id": employee_id,
            "date": {"$gte": date_from, "$lte": date_to}
        }
        attendance_data = list(database.db.attendance.find(query).sort("date", 1))
        
        # Calculate statistics
        total_days = len(attendance_data)
        present_days = len([a for a in attendance_data if a["status"] == "Present"])
        absent_days = len([a for a in attendance_data if a["status"] == "Absent"])
        late_days = len([a for a in attendance_data if a["status"] == "Late"])
        
        total_hours = 0
        for record in attendance_data:
            if record.get("check_in_time") and record.get("check_out_time"):
                hours = calculate_working_hours(record["check_in_time"], record["check_out_time"])
                total_hours += hours
        
        return {
            "employee": {
                "employee_id": employee["employee_id"],
                "full_name": employee["full_name"],
                "department": employee["department"]
            },
            "date_range": {"from": date_from, "to": date_to},
            "summary": {
                "total_days": total_days,
                "present_days": present_days,
                "absent_days": absent_days,
                "late_days": late_days,
                "attendance_rate": round((present_days / total_days * 100), 2) if total_days > 0 else 0,
                "total_hours": round(total_hours, 2),
                "avg_hours_per_day": round(total_hours / present_days, 2) if present_days > 0 else 0
            },
            "attendance_records": [
                {
                    "date": record["date"],
                    "status": record["status"],
                    "check_in_time": record.get("check_in_time"),
                    "check_out_time": record.get("check_out_time"),
                    "working_hours": calculate_working_hours(
                        record.get("check_in_time", ""),
                        record.get("check_out_time", "")
                    ) if record.get("check_in_time") and record.get("check_out_time") else 0
                } for record in attendance_data
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating employee performance report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate employee performance report"
        )

@app.get("/api/reports/department", tags=["Reports"])
async def get_department_report(
    department: str,
    date_from: str,
    date_to: str
):
    """Get department-wise report"""
    try:
        # Get employees in department
        employees = list(database.db.employees.find({"department": department}))
        if not employees:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No employees found in department '{department}'"
            )
        
        employee_ids = [emp["employee_id"] for emp in employees]
        
        # Get attendance data for department
        query = {
            "employee_id": {"$in": employee_ids},
            "date": {"$gte": date_from, "$lte": date_to}
        }
        attendance_data = list(database.db.attendance.find(query))
        
        # Calculate department statistics
        total_records = len(attendance_data)
        present_count = len([a for a in attendance_data if a["status"] == "Present"])
        absent_count = len([a for a in attendance_data if a["status"] == "Absent"])
        late_count = len([a for a in attendance_data if a["status"] == "Late"])
        
        # Employee-wise breakdown
        employee_breakdown = {}
        for emp in employees:
            emp_id = emp["employee_id"]
            emp_attendance = [a for a in attendance_data if a["employee_id"] == emp_id]
            
            present = len([a for a in emp_attendance if a["status"] == "Present"])
            absent = len([a for a in emp_attendance if a["status"] == "Absent"])
            late = len([a for a in emp_attendance if a["status"] == "Late"])
            total = len(emp_attendance)
            
            employee_breakdown[emp_id] = {
                "employee_id": emp_id,
                "full_name": emp["full_name"],
                "present": present,
                "absent": absent,
                "late": late,
                "total": total,
                "attendance_rate": round((present / total * 100), 2) if total > 0 else 0
            }
        
        return {
            "department": department,
            "date_range": {"from": date_from, "to": date_to},
            "summary": {
                "total_employees": len(employees),
                "total_records": total_records,
                "present_count": present_count,
                "absent_count": absent_count,
                "late_count": late_count,
                "department_attendance_rate": round((present_count / total_records * 100), 2) if total_records > 0 else 0
            },
            "employee_breakdown": list(employee_breakdown.values())
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating department report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate department report"
        )

# Root endpoint
@app.get("/", tags=["System"])
async def root():
    """API root endpoint with system information"""
    return {
        "message": "HRMS Lite API v2.0 - Production Ready",
        "version": "2.0.0",
        "status": "operational",
        "timestamp": datetime.utcnow().isoformat(),
        "documentation": "/docs",
        "health_check": "/health",
        "year": 2026
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        workers=1,
        log_level="info"
    )