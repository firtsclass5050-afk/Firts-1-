import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  Enrollment, 
  Course, 
  Grade, 
  StudentStatus, 
  UserProfile, 
  ClassReport, 
  TeacherReplacement,
  Payment,
  Book,
  BookSale,
  Announcement,
  ReplacementRequest,
  ScheduleChange,
  Attendance,
  StatusHistory,
  BookStockLog
} from '../types';

export function useCollection<T>(collectionName: string, queryConstraints: any[] = []) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = queryConstraints.length > 0 
      ? query(collection(db, collectionName), ...queryConstraints)
      : collection(db, collectionName);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as T)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, collectionName);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [collectionName, JSON.stringify(queryConstraints)]);

  return { data, loading };
}

export const useEnrollments = () => useCollection<Enrollment>('enrollments');
export const useCourses = () => useCollection<Course>('courses');
export const useGrades = () => useCollection<Grade>('grades');
export const useStatuses = () => useCollection<StudentStatus>('statuses');
export const useTeachers = () => useCollection<UserProfile>('users', [where('role', 'in', ['teacher', 'master'])]);
export const useUsers = () => useCollection<UserProfile>('users');
export const usePayments = () => useCollection<Payment>('payments', [orderBy('createdAt', 'desc')]);
export const useBooks = () => useCollection<Book>('books');
export const useBookSales = () => useCollection<BookSale>('bookSales', [orderBy('createdAt', 'desc')]);
export const useAnnouncements = () => useCollection<Announcement>('announcements', [orderBy('createdAt', 'desc')]);
export const useClassReports = () => useCollection<ClassReport>('classReports', [orderBy('date', 'desc')]);
export const useTeacherReplacements = () => useCollection<TeacherReplacement>('teacherReplacements', [orderBy('date', 'desc')]);
export const useReplacementRequests = () => useCollection<ReplacementRequest>('replacementRequests', [orderBy('createdAt', 'desc')]);
export const useScheduleChanges = () => useCollection<ScheduleChange>('scheduleChanges', [orderBy('createdAt', 'desc')]);
export const useStatusHistory = () => useCollection<StatusHistory>('statusHistory', [orderBy('changedAt', 'desc')]);
export const useBookStockHistory = () => useCollection<BookStockLog>('bookStockHistory', [orderBy('createdAt', 'desc')]);
export const useAttendanceRecords = () => useCollection<Attendance>('attendance');
