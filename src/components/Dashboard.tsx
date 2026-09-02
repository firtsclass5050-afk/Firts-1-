import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { 
  Users, 
  BookOpen, 
  Bell, 
  TrendingUp, 
  UserPlus, 
  ShieldCheck, 
  ArrowRight,
  Plus,
  Search,
  X,
  Calendar,
  Clock as ClockIcon,
  Book,
  GraduationCap
} from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { Course, Announcement, UserProfile, UserRole, Enrollment, Grade, Attendance, Payment } from '../types';
import { LOGO_URL, MOTIVATIONAL_QUOTES } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils/cn';

export const Dashboard = () => {
  const { profile, viewMode } = useAuth();
  const [stats, setStats] = useState({
    users: 0,
    courses: 0,
    announcements: 0,
    pendingUsers: 0
  });
  const [recentAnnouncements, setRecentAnnouncements] = useState<Announcement[]>([]);
  const [quote, setQuote] = useState(MOTIVATIONAL_QUOTES[0]);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Enrollment[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<(Enrollment & { 
    grades?: Grade[], 
    attendances?: any[],
    payments?: Payment[],
    isOverdue?: boolean,
    attendanceRate?: number
  }) | null>(null);

  const [searchHasRun, setSearchHasRun] = useState(false);

  useEffect(() => {
    setQuote(MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);

    let unsubUsers = () => {};
    let unsubCourses = () => {};

    const isAdmin = profile?.role === 'admin' || profile?.role === 'master';

    if (isAdmin) {
      unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
        setStats(prev => ({ ...prev, users: snap.size, pendingUsers: snap.docs.filter(d => d.data().role === 'pending').length }));
      }, (error) => {
        console.warn("User list permission or connectivity denied for dashboard stats:", error);
      });

      unsubCourses = onSnapshot(collection(db, 'courses'), (snap) => {
        setStats(prev => ({ ...prev, courses: snap.size }));
      }, (error) => {
        console.warn("Course list permission or connectivity denied for dashboard stats:", error);
      });
    }

    const unsubAnn = onSnapshot(
      query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(3)), 
      (snap) => {
        setStats(prev => ({ ...prev, announcements: snap.size }));
        setRecentAnnouncements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
      },
      (error) => {
        console.warn("Announcement list permission or connectivity denied for dashboard:", error);
      }
    );

    return () => {
      unsubUsers();
      unsubCourses();
      unsubAnn();
    };
  }, [profile]);

  // Real-time search debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchHasRun(false);
      return;
    }

    const timer = setTimeout(() => {
      performSearch();
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const performSearch = async () => {
    setIsSearching(true);
    setSearchHasRun(true);
    try {
      const q = searchQuery.trim().toUpperCase();
      
      // Search by Student Code
      const qCode = query(
        collection(db, 'enrollments'),
        where('studentCode', '==', q)
      );
      const snapCode = await getDocs(qCode);
      
      if (!snapCode.empty) {
        setSearchResults(snapCode.docs.map(doc => ({ id: doc.id, ...doc.data() } as Enrollment)));
        setIsSearching(false);
        return;
      }

      // Search by First Name or Last Name
      const searchVal = searchQuery.trim().charAt(0).toUpperCase() + searchQuery.trim().slice(1).toLowerCase();
      
      // We'll search by firstName and lastName separately and combine
      const qFirst = query(
        collection(db, 'enrollments'),
        where('firstName', '>=', searchVal),
        where('firstName', '<=', searchVal + '\uf8ff'),
        limit(5)
      );
      
      const qLast = query(
        collection(db, 'enrollments'),
        where('lastName', '>=', searchVal),
        where('lastName', '<=', searchVal + '\uf8ff'),
        limit(5)
      );

      const [snapFirst, snapLast] = await Promise.all([getDocs(qFirst), getDocs(qLast)]);
      
      const combined = [
        ...snapFirst.docs.map(doc => ({ id: doc.id, ...doc.data() } as Enrollment)),
        ...snapLast.docs.map(doc => ({ id: doc.id, ...doc.data() } as Enrollment))
      ];

      // Remove duplicates
      const unique = combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      setSearchResults(unique);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  const fetchStudentDetails = async (student: Enrollment) => {
    setIsSearching(true);
    try {
      // 1. Get grades
      const gradesQ = query(collection(db, 'grades'), where('studentCode', '==', student.studentCode));
      const gradesSnap = await getDocs(gradesQ);
      const grades = gradesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Grade));

      // 2. Get payments to check overdue status
      const paymentsQ = query(collection(db, 'payments'), where('studentCode', '==', student.studentCode));
      const paymentsSnap = await getDocs(paymentsQ);
      const payments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Payment));

      // Check if student is active and potentially overdue
      // A simple logic: if common months of the year are not in the payments list
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      
      // Get all payments for this year
      const thisYearPayments = payments.filter(p => p.year === currentYear.toString());
      const paidMonths = thisYearPayments.map(p => p.monthToPay);
      
      // Calculate missing months since enrollment
      const enrollmentDate = student.createdAt?.toDate() || new Date();
      const enrollmentMonth = enrollmentDate.getMonth();
      const enrollmentYear = enrollmentDate.getFullYear();
      
      let isOverdue = false;
      if (currentYear === enrollmentYear) {
        for (let m = enrollmentMonth; m < currentMonth; m++) {
          if (!paidMonths.includes(months[m])) {
            isOverdue = true;
            break;
          }
        }
      }

      // 3. Get detailed attendance summary
      // Fetch all attendance records for the courses the student is in
      const attQ = query(collection(db, 'attendances'), limit(100)); // Larger fetch for analysis
      const attSnap = await getDocs(attQ);
      const allAtts = attSnap.docs.map(d => ({ id: d.id, ...d.data() } as Attendance));
      
      // Filter for this student across all their courses (usually one)
      const studentCode = student.studentCode;
      const relevantAtts = allAtts.filter(att => 
        att.records.some(r => r.studentId === studentCode)
      );

      const attendances = relevantAtts.map(att => ({
        date: att.date,
        status: att.records.find(r => r.studentId === studentCode)?.status
      })).sort((a, b) => b.date.seconds - a.date.seconds);

      const recentAttendances = attendances.slice(0, 5);
      
      // Calculate attendance rate (Present / (Present + Absent))
      const totalCount = attendances.filter(a => ['present', 'absent', 'late'].includes(a.status || '')).length;
      const presentCount = attendances.filter(a => ['present', 'late'].includes(a.status || '')).length;
      const attendanceRate = totalCount > 0 ? (presentCount / totalCount) * 100 : 100;

      setSelectedStudent({ 
        ...student, 
        grades, 
        attendances: recentAttendances, 
        payments, 
        isOverdue,
        attendanceRate 
      });
      setSearchHasRun(false); // Close search result panel after choosing
    } catch (error) {
      console.error("Details fetch error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const isDirection = viewMode === 'admin';

  return (
    <div className="min-h-screen -mt-8 -mx-8 md:-mt-10 md:-mx-10 overflow-hidden">
      {/* Immersive Home Section (Matching user image) */}
      <section className="relative min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-bordeaux-dark to-orange-primary p-6 text-center">
        {/* Abstract background elements for depth */}
        <div className="absolute inset-0 bg-black/10 pointer-events-none" />
        
        {/* Top Control Bar removed */}

        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center px-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="w-48 h-48 md:w-72 md:h-72 mb-16 drop-shadow-2xl"
          >
            <img 
              src={LOGO_URL} 
              alt="First Classe Institute" 
              className="w-full h-full object-contain filter drop-shadow-[0_20px_50px_rgba(0,0,0,0.4)]" 
            />
          </motion.div>

          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="space-y-6"
          >
            <h2 className="text-4xl md:text-7xl font-black text-white leading-[1.1] tracking-tight drop-shadow-2xl">
              {quote.text}
            </h2>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              transition={{ delay: 1, duration: 1 }}
              className="pt-10"
            >
              <div className="h-px w-24 bg-white/30 mx-auto mb-6" />
              <p className="text-xl md:text-3xl font-bold text-white italic tracking-wide">
                {quote.author}
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Search Results Modal */}
      <AnimatePresence>
        {(searchHasRun || isSearching) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                <h3 className="font-bold text-stone-900 uppercase tracking-widest text-xs">Resultados de búsqueda</h3>
                <button 
                  onClick={() => { setSearchResults([]); setSearchQuery(''); setSearchHasRun(false); }}
                  className="p-2 hover:bg-stone-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">
                {isSearching ? (
                  <div className="p-12 text-center text-stone-400 font-bold uppercase tracking-widest text-xs animate-pulse">
                    Buscando...
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map(student => (
                    <button 
                      key={student.id}
                      onClick={() => fetchStudentDetails(student)}
                      className="w-full text-left p-4 rounded-2xl hover:bg-stone-50 border border-transparent hover:border-stone-200 transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-bordeaux/10 text-bordeaux rounded-xl flex items-center justify-center font-bold">
                          {student.firstName[0]}{student.lastName[0]}
                        </div>
                        <div>
                          <p className="font-bold text-stone-900">{student.firstName} {student.lastName}</p>
                          <p className="text-xs text-stone-500 font-bold">{student.studentCode} • {student.course}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-stone-300 group-hover:text-stone-900 transition-all group-hover:translate-x-1" />
                    </button>
                  ))
                ) : (
                  <div className="p-12 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
                    No se encontraron alumnos para "{searchQuery}"
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {selectedStudent && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl overflow-hidden border border-stone-100"
            >
              <div className="relative h-32 bg-gradient-to-r from-bordeaux to-red-700">
                <button 
                  onClick={() => setSelectedStudent(null)}
                  className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-all backdrop-blur-md"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="absolute -bottom-12 left-10 p-2 bg-white rounded-[2rem] shadow-xl">
                  <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-orange-600 rounded-[1.8rem] flex items-center justify-center text-white text-3xl font-black shadow-inner">
                    {selectedStudent.firstName[0]}
                  </div>
                </div>
              </div>

              <div className="pt-16 pb-10 px-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                  <div>
                    <h2 className="text-4xl font-black text-stone-900 tracking-tight uppercase">
                      {selectedStudent.firstName} {selectedStudent.lastName}
                    </h2>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-[10px] font-black tracking-widest uppercase">
                        {selectedStudent.studentCode}
                      </span>
                      <span className={cn(
                        "flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full",
                        selectedStudent.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"
                      )}>
                        <GraduationCap className="w-4 h-4" />
                        {selectedStudent.status}
                      </span>
                      {selectedStudent.isOverdue && (
                        <span className="flex items-center gap-2 text-xs font-black bg-rose-50 text-rose-600 px-3 py-1 rounded-full animate-pulse uppercase tracking-widest">
                          <Bell className="w-4 h-4" />
                          Cuotas Atrasadas
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
                  <div className="p-5 bg-stone-50 rounded-3xl border border-stone-100">
                    <div className="flex items-center gap-3 mb-3 text-stone-400">
                      <Book className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Curso</span>
                    </div>
                    <p className="text-lg font-bold text-stone-800 truncate">{selectedStudent.course}</p>
                    <p className="text-[10px] text-stone-500 font-bold mt-1 uppercase tracking-widest">{selectedStudent.level}</p>
                  </div>
                  <div className="p-5 bg-stone-50 rounded-3xl border border-stone-100">
                    <div className="flex items-center gap-3 mb-3 text-stone-400">
                      <Calendar className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Horario</span>
                    </div>
                    <p className="text-lg font-bold text-stone-800">{selectedStudent.shift}</p>
                    <p className="text-[10px] text-stone-500 font-bold mt-1 flex items-center gap-1">
                       <ClockIcon className="w-3 h-3" />
                       {selectedStudent.schedule || 'N/A'}
                    </p>
                  </div>
                  <div className="p-5 bg-orange-primary/5 rounded-3xl border border-orange-primary/10">
                    <div className="flex items-center gap-3 mb-3 text-orange-400">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Asistencia</span>
                    </div>
                    <p className="text-2xl font-black text-orange-600">
                      {Math.round(selectedStudent.attendanceRate || 0)}%
                    </p>
                  </div>
                  <div className="p-5 bg-blue-50 rounded-3xl border border-blue-100">
                    <div className="flex items-center gap-3 mb-3 text-blue-400">
                      <Users className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Promedio</span>
                    </div>
                    <p className="text-2xl font-black text-blue-600">
                      {selectedStudent.grades && selectedStudent.grades.length > 0 
                        ? (selectedStudent.grades.reduce((acc, curr) => acc + (curr.average || 0), 0) / selectedStudent.grades.length).toFixed(1)
                        : '0.0'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h4 className="flex items-center gap-3 text-sm font-black text-stone-900 uppercase tracking-widest">
                      <div className="w-2 h-2 bg-bordeaux rounded-full" />
                      Notas Recientes
                    </h4>
                    <div className="space-y-3">
                      {selectedStudent.grades?.map((grade, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100">
                          <div>
                            <p className="text-sm font-bold text-stone-800">{grade.courseName}</p>
                            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Final Total</p>
                          </div>
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-lg",
                            (grade.finalTotal || 0) >= 70 ? "bg-green-500" : "bg-red-500"
                          )}>
                            {Math.round(grade.finalTotal || 0)}
                          </div>
                        </div>
                      ))}
                      {!selectedStudent.grades?.length && (
                        <p className="text-xs text-stone-400 font-bold italic text-center py-4">No hay notas registradas</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="flex items-center gap-3 text-sm font-black text-stone-900 uppercase tracking-widest">
                      <div className="w-2 h-2 bg-orange-primary rounded-full" />
                      Últimas Asistencias
                    </h4>
                    <div className="grid grid-cols-5 gap-2">
                      {selectedStudent.attendances?.map((att, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-2">
                          <div className={cn(
                            "w-full aspect-square rounded-2xl flex items-center justify-center shadow-sm border",
                            att.status === 'present' ? "bg-green-50 border-green-200 text-green-600" : 
                            att.status === 'late' ? "bg-yellow-50 border-yellow-200 text-yellow-600" :
                            "bg-red-50 border-red-200 text-red-600"
                          )}>
                            {att.status === 'present' ? 'P' : att.status === 'late' ? 'L' : 'A'}
                          </div>
                          <p className="text-[8px] font-black text-stone-400 uppercase">
                            {new Date(att.date?.seconds * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                      ))}
                      {!selectedStudent.attendances?.length && (
                        <p className="col-span-12 text-xs text-stone-400 font-bold italic text-center py-4">No hay registros</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
