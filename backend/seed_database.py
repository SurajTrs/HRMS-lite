#!/usr/bin/env python3
"""
Database seeding script for HRMS Lite
Creates sample employees and attendance records
"""

from pymongo import MongoClient
from datetime import datetime, timedelta
import random
import os
from dotenv import load_dotenv

load_dotenv()

# MongoDB connection
client = MongoClient(os.getenv("MONGODB_URI", "mongodb://localhost:27017/hrms_lite"))
db = client.hrms_lite

def clear_database():
    """Clear existing data"""
    db.employees.delete_many({})
    db.attendance.delete_many({})
    print("✅ Database cleared")

def create_sample_employees():
    """Create sample employees"""
    employees = [
        {
            "employee_id": "EMP001",
            "full_name": "Arjun Sharma",
            "email": "arjun.sharma@company.com",
            "department": "Engineering",
            "phone": "+91-98765-43201",
            "position": "Senior Developer",
            "hire_date": "2023-01-15",
            "salary": 85000.0,
            "status": "Active",
            "created_at": datetime.utcnow()
        },
        {
            "employee_id": "EMP002",
            "full_name": "Kavya Reddy",
            "email": "kavya.reddy@company.com",
            "department": "Marketing",
            "phone": "+91-98765-43202",
            "position": "Marketing Manager",
            "hire_date": "2023-02-20",
            "salary": 75000.0,
            "status": "Active",
            "created_at": datetime.utcnow()
        },
        {
            "employee_id": "EMP003",
            "full_name": "Vikram Singh",
            "email": "vikram.singh@company.com",
            "department": "Engineering",
            "phone": "+91-98765-43203",
            "position": "Frontend Developer",
            "hire_date": "2023-03-10",
            "salary": 70000.0,
            "status": "Active",
            "created_at": datetime.utcnow()
        },
        {
            "employee_id": "EMP004",
            "full_name": "Ananya Iyer",
            "email": "ananya.iyer@company.com",
            "department": "HR",
            "phone": "+91-98765-43204",
            "position": "HR Specialist",
            "hire_date": "2023-04-05",
            "salary": 60000.0,
            "status": "Active",
            "created_at": datetime.utcnow()
        },
        {
            "employee_id": "EMP005",
            "full_name": "Rajesh Kumar",
            "email": "rajesh.kumar@company.com",
            "department": "Sales",
            "phone": "+91-98765-43205",
            "position": "Sales Representative",
            "hire_date": "2023-05-12",
            "salary": 55000.0,
            "status": "Active",
            "created_at": datetime.utcnow()
        },
        {
            "employee_id": "EMP006",
            "full_name": "Priya Sharma",
            "email": "priya.sharma@company.com",
            "department": "Finance",
            "phone": "+91-98765-43206",
            "position": "Financial Analyst",
            "hire_date": "2023-06-18",
            "salary": 65000.0,
            "status": "Active",
            "created_at": datetime.utcnow()
        },
        {
            "employee_id": "EMP007",
            "full_name": "Amit Patel",
            "email": "amit.patel@company.com",
            "department": "Engineering",
            "phone": "+91-98765-43207",
            "position": "DevOps Engineer",
            "hire_date": "2023-07-22",
            "salary": 80000.0,
            "status": "Active",
            "created_at": datetime.utcnow()
        },
        {
            "employee_id": "EMP008",
            "full_name": "Sneha Gupta",
            "email": "sneha.gupta@company.com",
            "department": "Marketing",
            "phone": "+91-98765-43208",
            "position": "Content Specialist",
            "hire_date": "2023-08-14",
            "salary": 50000.0,
            "status": "Active",
            "created_at": datetime.utcnow()
        }
    ]
    
    result = db.employees.insert_many(employees)
    print(f"✅ Created {len(result.inserted_ids)} employees")
    return employees

def create_attendance_records(employees):
    """Create sample attendance records for the last 30 days"""
    attendance_records = []
    
    # Generate records for last 30 days
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=30)
    
    current_date = start_date
    while current_date <= end_date:
        # Skip weekends
        if current_date.weekday() < 5:  # Monday = 0, Sunday = 6
            for employee in employees:
                # 90% chance of being present
                if random.random() < 0.9:
                    status = "Present"
                    # Random check-in time between 8:00-9:30 AM
                    check_in_hour = random.randint(8, 9)
                    check_in_minute = random.randint(0, 59) if check_in_hour == 8 else random.randint(0, 30)
                    check_in_time = f"{check_in_hour:02d}:{check_in_minute:02d}"
                    
                    # Random check-out time between 5:00-7:00 PM
                    check_out_hour = random.randint(17, 19)
                    check_out_minute = random.randint(0, 59)
                    check_out_time = f"{check_out_hour:02d}:{check_out_minute:02d}"
                    
                    # 5% chance of being late (after 9:00 AM)
                    if check_in_hour > 9 or (check_in_hour == 9 and check_in_minute > 0):
                        status = "Late"
                else:
                    status = "Absent"
                    check_in_time = None
                    check_out_time = None
                
                record = {
                    "employee_id": employee["employee_id"],
                    "date": current_date.strftime("%Y-%m-%d"),
                    "status": status,
                    "check_in_time": check_in_time,
                    "check_out_time": check_out_time,
                    "notes": None,
                    "created_at": datetime.utcnow()
                }
                attendance_records.append(record)
        
        current_date += timedelta(days=1)
    
    if attendance_records:
        result = db.attendance.insert_many(attendance_records)
        print(f"✅ Created {len(result.inserted_ids)} attendance records")

def create_indexes():
    """Create database indexes for performance"""
    # Employee indexes
    db.employees.create_index("employee_id", unique=True)
    db.employees.create_index("email", unique=True)
    db.employees.create_index("department")
    
    # Attendance indexes
    db.attendance.create_index([("employee_id", 1), ("date", 1)], unique=True)
    db.attendance.create_index("date")
    db.attendance.create_index("status")
    
    print("✅ Database indexes created")

def main():
    """Main seeding function"""
    print("🌱 Starting database seeding...")
    
    try:
        # Test connection
        client.admin.command('ping')
        print("✅ Connected to MongoDB")
        
        # Clear existing data
        clear_database()
        
        # Create sample data
        employees = create_sample_employees()
        create_attendance_records(employees)
        
        # Create indexes
        create_indexes()
        
        # Print summary
        total_employees = db.employees.count_documents({})
        total_attendance = db.attendance.count_documents({})
        departments = db.employees.distinct("department")
        
        print("\n📊 Database Summary:")
        print(f"   Employees: {total_employees}")
        print(f"   Attendance Records: {total_attendance}")
        print(f"   Departments: {len(departments)} ({', '.join(departments)})")
        print("\n🎉 Database seeding completed successfully!")
        
    except Exception as e:
        print(f"❌ Error seeding database: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    main()