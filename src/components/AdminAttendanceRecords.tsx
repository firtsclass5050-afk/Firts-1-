import React, { useState, useEffect } from 'react';
import { Search, Calendar, BookOpen, User as UserIcon, Table, FileText, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Course, UserProfile } from '../types';
import { cn } from '../utils/cn';
import { handleFirestoreError, OperationType } from '../firebase';
import { MonthlyAttendanceList } from './AttendanceManagement';

const AdminAttendanceRecords = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonitoringCourse, setSelectedMonitoringCourse] = useState<Course | null>(null);
  const [courseSearch, setCourseSearch] = useState('');

  useEffect(() => {
    const unsubCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'courses'));

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setTeachers(allUsers.filter(u => u.role === 'teacher' || u.role === 'master' || u.role === 'admin' || u.role === 'dir_acad' || u.role === 'secretary'));
      setStudents(allUsers.filter(u => u.role === 'student'));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    return () => {
      unsubCourses();
      unsubUsers();
    };
  }, []);

  const filteredMonitoringCourses = courses.filter(course => {
    const searchLower = courseSearch.toLowerCase();
    return course.name.toLowerCase().includes(searchLower) || 
           course.level.toLowerCase().includes(searchLower) ||
           (course.teacherName?.toLowerCase() || '').includes(searchLower);
  });

  if (selectedMonitoringCourse) {
    return <MonthlyAttendanceList course={selectedMonitoringCourse} onBack={() => setSelectedMonitoringCourse(null)} />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-stone-900 tracking-tighter uppercase italic">Registro de listas</h2>
          <p className="text-stone-500 mt-1 font-bold">Monitoreo y supervisión de asistencia por curso.</p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="w-12 h-12 border-4 border-stone-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-stone-500 font-bold">Cargando cursos...</p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-stone-300" />
            <input 
              type="text" 
              placeholder="Buscar curso, nivel o profesor para monitoreo..."
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
              className="w-full pl-16 pr-8 py-5 bg-white border-2 border-stone-100 rounded-[2rem] outline-none focus:border-stone-900 focus:ring-8 focus:ring-stone-900/5 transition-all text-lg font-bold shadow-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredMonitoringCourses.map(course => (
              <button
                key={course.id}
                onClick={() => setSelectedMonitoringCourse(course)}
                className="group bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 hover:shadow-xl hover:scale-[1.02] transition-all text-left relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-stone-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500" />
                <div className="relative">
                  <div className="w-14 h-14 bg-bordeaux text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:rotate-6 transition-transform">
                    <BookOpen className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-stone-900 mb-2 truncate">{course.name}</h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-stone-100 text-stone-600 rounded-lg text-xs font-bold uppercase tracking-wider">{course.level}</span>
                    <span className="px-3 py-1 bg-stone-50 text-stone-400 rounded-lg text-xs font-bold uppercase tracking-wider">{course.teacherName}</span>
                  </div>
                  <div className="mt-10 flex items-center justify-between">
                    <span className="text-stone-400 text-sm font-bold">Monitorear Asistencias</span>
                    <div className="w-10 h-10 rounded-full bg-stone-50 flex items-center justify-center group-hover:bg-bordeaux group-hover:text-white transition-all">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {filteredMonitoringCourses.length === 0 && (
              <div className="col-span-full py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-stone-200 text-center">
                <Search className="w-16 h-16 text-stone-200 mx-auto mb-4" />
                <p className="text-stone-400 font-bold text-lg italic tracking-tight">No se encontraron cursos con los filtros aplicados.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAttendanceRecords;
