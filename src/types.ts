export type UserRole = 'admin' | 'teacher' | 'student' | 'master' | 'pending' | 'secretary' | 'dir_acad' | 'accounting';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoURL?: string;
  phone?: string;
  specialty?: string;
  studentCode?: string;
  lastReadAnnouncementsAt?: any; // Firestore Timestamp
  ci?: string;
  birthDate?: string;
  phoneNumber?: string;
  requestedRole?: 'teacher' | 'admin';
  status?: 'pending' | 'active' | 'rejected';
  statusId?: string;
  createdAt?: any;
}

export interface Course {
  id: string;
  name: string;
  level: string;
  teacherId: string;
  teacherName?: string;
  schedule: string;
  studentIds?: string[];
  maxCapacity?: number;
  startDate?: string;
  endDate?: string;
  midtermExamDate?: string;
  finalExamDate?: string;
  kardexFillingDate?: string;
  type?: 'Regular' | 'Acelerado' | 'Sábados' | 'Personalizadas';
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: any; // Firestore Timestamp
  targetRole: 'all' | 'teacher' | 'admin';
  type: string;
  date: any;
}

export interface StudentStatus {
  id: string;
  name: string;
  fee: number;
  createdAt: any;
}

export interface Level {
  id: string;
  name: string;
  description?: string;
  createdAt: any;
}

export interface Enrollment {
  id?: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  isAdult: boolean;
  idCard: string;
  issuedIn: string;
  occupation: string;
  educationLevel: string;
  cellphone: string;
  parentCellphone?: string;
  referencePhone?: string;
  address: string;
  studentEmail: string;
  parentEmail?: string;
  parentName?: string;
  shift: string;
  schedule?: string;
  modality: string;
  level: string;
  course: string;
  isPromotion: boolean;
  promotionType?: string;
  age?: number | string;
  amount: number;
  advancePayment?: string;
  branch: string;
  referralSource: string;
  comments?: string;
  status: 'active' | 'frozen';
  statusId?: string; // Reference to StudentStatus
  freezeReason?: string;
  startDate?: string;
  endDate?: string;
  enrollmentDate?: string;
  createdAt: any;
  createdBy: string;
}

export interface Payment {
  id?: string;
  studentId: string;
  studentName: string;
  studentCode?: string;
  courseName?: string;
  year: string;
  monthToPay: string;
  monthlyAmount: number;
  monthsInAdvance: number;
  plannedPaymentDate: string;
  paymentDate: string;
  taxId: string;
  authorizationNumber: string;
  taxName: string;
  invoiceNumber?: string;
  receiptNumber: string;
  totalToPay: number;
  amountReceived: number;
  change: number;
  paymentMethod?: string;
  status?: string;
  observations?: string;
  createdAt: any;
  createdBy: string;
}

export interface Book {
  id?: string;
  title: string;
  price: number;
  stock: number;
  createdAt: any;
}

export interface BookSale {
  id?: string;
  bookId: string;
  bookTitle: string;
  customerName: string;
  studentId?: string;
  studentCode?: string;
  receiptNumber: string;
  price: number;
  quantity: number;
  discount: number;
  total: number;
  observations?: string;
  createdAt: any;
  createdBy: string;
}

export interface BookStockPurchase {
  id?: string;
  bookId: string;
  bookTitle: string;
  supplier: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  date: string;
  createdAt: any;
  createdBy: string;
}

export interface BookStockLog {
  id?: string;
  bookId: string;
  bookTitle: string;
  quantityAdded: number;
  previousStock: number;
  newStock: number;
  notes?: string;
  createdBy: string;
  creatorName?: string;
  createdAt: any;
}

export interface AttendanceRecord {
  studentId: string;
  status: 'present' | 'absent' | 'permission' | 'late' | 'withdrawn' | 'change' | 'holiday' | 'blocked';
  observations?: string;
}

export interface Attendance {
  id?: string;
  courseId: string;
  teacherId: string;
  date: any;
  shift: string;
  records: AttendanceRecord[];
}

export interface Grade {
  id?: string;
  courseId: string;
  courseName: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  midtermAttendance: number;
  midtermParticipation: number;
  midtermOral: number;
  midtermWritten: number;
  midtermPractices: number;
  midtermTotal: number;
  finalAttendance: number;
  finalParticipation: number;
  finalOral: number;
  finalWritten: number;
  finalPractices: number;
  finalTotal: number;
  average: number;
  comments?: string;
  createdAt: any;
  updatedAt?: any;
  quiz?: number;
  participation?: number;
  workbooks?: number;
  oralExam?: number;
  writtenExam?: number;
  subject?: string;
  score?: number;
}

export interface ClassReport {
  id?: string;
  teacherId: string;
  teacherName?: string;
  courseId?: string;
  courseName?: string;
  type: 'weekday' | 'saturday' | 'custom';
  date: any;
  startTime?: string;
  endTime?: string;
  totalHours?: number;
  progress: string;
  status: 'pending' | 'approved' | 'rejected' | 'submitted';
  isRegular?: boolean;
  isAccelerated?: boolean;
  isReplacement?: boolean;
  level?: string;
  month?: string;
  startDate?: string;
  endDate?: string;
  schedule?: string;
  grid?: any[];
  hours?: any;
  comments?: string;
  createdAt?: any;
}

export interface TeacherReplacement {
  id?: string;
  replacingTeacherId: string;
  replacingTeacherName: string;
  replacedTeacherId: string;
  replacedTeacherName: string;
  classLevel: string;
  classType: string;
  schedule: string;
  date: any;
  progressReport?: string;
  createdAt: any;
  createdBy: string;
}

export interface StatusHistory {
  id?: string;
  studentId: string;
  oldStatusId: string;
  newStatusId: string;
  changedBy: string;
  changedAt: any; // Firestore Timestamp
}

export interface TeacherReportsProps {
  type: 'weekday' | 'saturday' | 'custom';
}
export interface ReplacementRequest {
  id?: string;
  teacherId: string;
  teacherName: string;
  courseId: string;
  courseName: string;
  reason: string;
  requestedDate: string;
  date?: string;
  status: 'pending' | 'resolved';
  createdAt: any;
}

export interface ScheduleChange {
  id?: string;
  studentId: string;
  studentName: string;
  oldShift: string;
  newShift: string;
  oldSchedule?: string;
  newSchedule?: string;
  oldLevel: string;
  newLevel: string;
  oldCourseId?: string;
  newCourseId?: string;
  paidForChange: boolean;
  paymentAmount: number;
  receiptNumber?: string;
  createdAt: any;
  createdBy: string;
}
