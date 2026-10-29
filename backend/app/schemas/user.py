from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, date
from typing import Any, Optional


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    registration_number: str
    faculty: str
    department: str
    level: int


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class AdminCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str


class AdminStudentUpdate(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    registration_number: Optional[str] = Field(default=None, max_length=100)
    faculty: Optional[str] = Field(default=None, max_length=200)
    department: Optional[str] = Field(default=None, max_length=200)
    level: Optional[int] = Field(default=None, ge=100, le=600, multiple_of=100)


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    registration_number: Optional[str] = None
    faculty: Optional[str] = None
    department: Optional[str] = None
    level: Optional[int] = None
    role: str = "student"
    is_approved: bool = False
    is_active: bool = True
    must_change_password: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True    # Important for SQLAlchemy


class StudyPlanCreate(BaseModel):
    title: str
    course_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class StudyPlanItemCreate(BaseModel):
    topic: str
    scheduled_date: date
    priority: int = 1
    notes: Optional[str] = None

class StudyPlanItemOut(BaseModel):
    id: int
    topic: Optional[str]
    scheduled_date: date
    status: str
    priority: int
    notes: Optional[str]

class StudyPlanOut(BaseModel):
    id: int
    title: Optional[str]
    course_id: Optional[int]
    start_date: Optional[date]
    end_date: Optional[date]
    created_at: datetime

    class Config:
        from_attributes = True

class StudyPlanDetail(StudyPlanOut):
    items: list[StudyPlanItemOut] = Field(default_factory=list)



# ---- Course & Document ----
class CourseCreate(BaseModel):
    code: str
    title: str
    semester: Optional[str] = None
    session: Optional[str] = None

class DocumentOut(BaseModel):
    id: int
    original_filename: str
    file_type: Optional[str]
    page_count: Optional[int]
    uploaded_at: datetime

    class Config:
        from_attributes = True

# ---- Quiz ----
class QuizQuestionOut(BaseModel):
    id: int
    question_text: str
    question_type: str
    options: Optional[Any]
    topic: Optional[str]
    difficulty: str

    class Config:
        from_attributes = True

class QuizOut(BaseModel):
    id: int
    title: Optional[str]
    questions: list[QuizQuestionOut] = Field(default_factory=list)

    class Config:
        from_attributes = True

# ---- Campus ----
class LocationOut(BaseModel):
    id: int
    name: str
    category: str
    description: Optional[str]
    latitude: float
    longitude: float
    building_code: Optional[str]
    is_emergency_point: bool

    class Config:
        from_attributes = True

class FAQOut(BaseModel):
    id: int
    question: str
    answer: str
    category: Optional[str]
    related_location_id: Optional[int]

    class Config:
        from_attributes = True

class EmergencyContactOut(BaseModel):
    id: int
    name: str
    phone: Optional[str]
    alternative_phone: Optional[str]
    email: Optional[str]
    priority: int

    class Config:
        from_attributes = True

# ---- Chat ----
class ChatMessageCreate(BaseModel):
    content: str
    session_id: Optional[int] = None
    session_type: str = "mixed"
    provider: str = "groq"
    model: Optional[str] = None

class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    sources: Optional[Any]
    created_at: datetime

    class Config:
        from_attributes = True
