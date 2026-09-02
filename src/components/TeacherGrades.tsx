import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp, addDoc, orderBy, Timestamp } from 'firebase/firestore';
import { Course, UserProfile, Grade } from '../types';
import { BookOpen, User as UserIcon, Save, RefreshCw, ClipboardList, Plus, X, GraduationCap, CheckCircle, ArrowLeft } from 'lucide-react';
import { cn } from '../utils/cn';
import { motion, AnimatePresence } from 'motion/react';

export const TeacherGrades = () => {
  const { user, profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCourseForGrade, setSelectedCourseForGrade] = useState<string>('');
  const [selectedStudentForGrade, setSelectedStudentForGrade] = useState<string>('');
  const [editingGradeId, setEditingGradeId] = useState<string | null>(null);

  const [gradeForm, setGradeForm] = useState({
    midtermAttendance: 0,
    midtermParticipation: 0,
    midtermOral: 0,
    midtermWritten: 0,
    midtermPractices: 0,
    midtermTotal: 0,
    finalAttendance: 0,
    finalParticipation: 0,
    finalOral: 0,
    finalWritten: 0,
    finalPractices: 0,
    finalTotal: 0,
    average: 0,
    comments: ''
  });

  useEffect(() => {
    if (!user || !profile) return;
    
    const isSpecialRole = ['master', 'admin', 'dir_acad', 'secretary'].includes(profile.role || '');

    // Get courses taught by this teacher, or all courses if admin/master/secretary
    const qCourses = isSpecialRole
      ? query(collection(db, 'courses'))
      : query(collection(db, 'courses'), where('teacherId', '==', user.uid));
      
    const unsubscribeCourses = onSnapshot(qCourses, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    });

    // Get grades submitted by this teacher, or all grades if admin/master/secretary
    const qGrades = isSpecialRole
      ? query(collection(db, 'grades'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'grades'), where('teacherId', '==', user.uid), orderBy('createdAt', 'desc'));
      
    const unsubscribeGrades = onSnapshot(qGrades, (snapshot) => {
      setGrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
    });

    // Fetch all users to identify student profiles
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    });

    // Fetch all enrollments to dynamically cross-reference students
    const unsubscribeEnrollments = onSnapshot(collection(db, 'enrollments'), (snapshot) => {
      setEnrollments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeCourses();
      unsubscribeGrades();
      unsubscribeUsers();
      unsubscribeEnrollments();
    };
  }, [user, profile]);

  const getCourseStudents = (course: Course) => {
    const courseStudentIds = course.studentIds || [];
    
    // Get from enrollments matching this course
    const enrolledStudentCodes = enrollments
      .filter(e => (e.course === course.id || e.course === course.name) && e.status === 'active')
      .map(e => e.studentCode)
      .filter(Boolean);

    return allUsers.filter(s => {
      if (s.role !== 'student') return false;
      
      const isInStudentIds = courseStudentIds.includes(s.uid) || (s.studentCode && courseStudentIds.includes(s.studentCode));
      const isInEnrollments = s.studentCode && enrolledStudentCodes.includes(s.studentCode);
      
      return isInStudentIds || isInEnrollments;
    });
  };

  const handleCalculateTotals = () => {
    const midtermTotal = 
      Number(gradeForm.midtermAttendance) + 
      Number(gradeForm.midtermParticipation) + 
      Number(gradeForm.midtermOral) + 
      Number(gradeForm.midtermWritten) + 
      Number(gradeForm.midtermPractices);
    
    const finalTotal = 
      Number(gradeForm.finalAttendance) + 
      Number(gradeForm.finalParticipation) + 
      Number(gradeForm.finalOral) + 
      Number(gradeForm.finalWritten) + 
      Number(gradeForm.finalPractices);

    const average = (midtermTotal + finalTotal) / 2;
    
    setGradeForm(prev => ({
      ...prev,
      midtermTotal: Number(midtermTotal.toFixed(2)),
      finalTotal: Number(finalTotal.toFixed(2)),
      average: Number(average.toFixed(2))
    }));
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseForGrade || !selectedStudentForGrade || !user) return;
    
    setIsSubmitting(true);
    try {
      const course = courses.find(c => c.id === selectedCourseForGrade);
      const student = allUsers.find(s => s.uid === selectedStudentForGrade);

      if (!course || !student) throw new Error('Course or Student not found');

      const gradeData: Omit<Grade, 'id'> = {
        courseId: course.id,
        courseName: course.name,
        studentId: student.uid,
        studentName: student.displayName,
        teacherId: user.uid,
        ...gradeForm,
        createdAt: Timestamp.now()
      };

      if (editingGradeId) {
        await setDoc(doc(db, 'grades', editingGradeId), gradeData, { merge: true });
        alert('Calificaciones actualizadas correctamente');
      } else {
        await addDoc(collection(db, 'grades'), gradeData);
        alert('Calificaciones guardadas correctamente');
      }
      
      setIsGradeModalOpen(false);
      setEditingGradeId(null);
      // Reset form
      setGradeForm({
        midtermAttendance: 0,
        midtermParticipation: 0,
        midtermOral: 0,
        midtermWritten: 0,
        midtermPractices: 0,
        midtermTotal: 0,
        finalAttendance: 0,
        finalParticipation: 0,
        finalOral: 0,
        finalWritten: 0,
        finalPractices: 0,
        finalTotal: 0,
        average: 0,
        comments: ''
      });
      setSelectedCourseForGrade('');
      setSelectedStudentForGrade('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'grades');
    } finally {
      setIsSubmitting(false);
    }
  };

  const gradesByCourse = grades.reduce((acc, g) => {
    if (!acc[g.courseName]) acc[g.courseName] = [];
    acc[g.courseName].push(g);
    return acc;
  }, {} as Record<string, Grade[]>);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Course List View */}
      {!activeCourseId ? (
        <div className="space-y-8">
          <div className="font-serif">
            <h2 className="text-4xl font-bold text-stone-900 tracking-tighter uppercase italic px-1">Cursos & Calificaciones</h2>
            <p className="text-stone-500 font-bold uppercase tracking-widest text-[10px] mt-1 pl-1">
              Selecciona un curso para ver la lista de alumnos e ingresar o editar sus notas de Kardex.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => {
              const enrolledStudents = getCourseStudents(course);
              return (
                <div 
                  key={course.id} 
                  onClick={() => setActiveCourseId(course.id)}
                  className="bg-white border-2 border-stone-900 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="w-12 h-12 bg-bordeaux/10 rounded-2xl flex items-center justify-center text-bordeaux group-hover:bg-bordeaux group-hover:text-white transition-all">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-stone-100 rounded-full text-stone-600">
                        {course.type}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl font-serif font-black text-stone-900 tracking-tight leading-tight group-hover:text-bordeaux transition-colors">
                        {course.name}
                      </h3>
                      <p className="text-stone-400 font-bold text-xs uppercase tracking-wider mt-1">
                        Nivel: {course.level || 'Sin nivel'}
                      </p>
                    </div>

                    <div className="space-y-2 border-t border-dashed border-stone-100 pt-4 text-xs font-bold uppercase text-stone-500">
                      <div className="flex justify-between">
                        <span>Horario:</span>
                        <span className="text-stone-800">{course.schedule || 'Sin horario'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Estudiantes:</span>
                        <span className="text-stone-800">{enrolledStudents.length} Alumnos</span>
                      </div>
                      {course.teacherName && (
                        <div className="flex justify-between">
                          <span>Profesor:</span>
                          <span className="text-stone-800 truncate max-w-[150px]">{course.teacherName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between text-xs font-black text-bordeaux uppercase tracking-wider">
                    <span>Ingresar al curso</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              );
            })}

            {courses.length === 0 && (
              <div className="col-span-full bg-white border-2 border-dashed border-stone-200 p-20 text-center rounded-[3rem]">
                <BookOpen className="w-20 h-20 text-stone-200 mx-auto mb-6" />
                <p className="text-stone-400 font-black uppercase tracking-widest text-xs italic">
                  No hay cursos asignados o disponibles para calificar.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Course Detail & Enrolled Students List View
        (() => {
          const activeCourse = courses.find(c => c.id === activeCourseId);
          if (!activeCourse) return null;
          const enrolledStudents = getCourseStudents(activeCourse);

          return (
            <div className="space-y-8">
              {/* Navigation Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                  <button 
                    onClick={() => setActiveCourseId(null)}
                    className="flex items-center gap-2 text-stone-500 hover:text-stone-900 font-black uppercase tracking-wider text-xs transition-colors mb-2"
                  >
                    <ArrowLeft className="w-4 h-4" /> Volver a Cursos
                  </button>
                  <h2 className="text-3xl font-serif font-black text-stone-900 uppercase italic">
                    {activeCourse.name}
                  </h2>
                  <p className="text-stone-500 font-bold uppercase tracking-widest text-[10px]">
                    Nivel: {activeCourse.level} • Horario: {activeCourse.schedule}
                  </p>
                </div>
              </div>

              {/* Student list */}
              <div className="bg-white border-2 border-stone-900 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-6 border-b-2 border-stone-900 bg-stone-50/50 flex items-center justify-between">
                  <h3 className="font-serif italic font-black text-stone-900 text-lg uppercase">
                    Alumnos Designados al Curso
                  </h3>
                  <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest bg-white px-4 py-1.5 border border-stone-200 rounded-full">
                    {enrolledStudents.length} Alumnos
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-100">
                        <th className="px-8 py-5 text-[10px] font-black text-stone-400 uppercase tracking-widest border-r border-stone-100">Código</th>
                        <th className="px-8 py-5 text-[10px] font-black text-stone-400 uppercase tracking-widest border-r border-stone-100">Nombre</th>
                        <th className="px-8 py-5 text-[10px] font-black text-stone-400 uppercase tracking-widest border-r border-stone-100 text-center">Estado de Notas</th>
                        <th className="px-8 py-5 text-[10px] font-black text-stone-400 uppercase tracking-widest border-r border-stone-100 text-center">Calificaciones</th>
                        <th className="px-8 py-5 text-[10px] font-black text-stone-400 uppercase tracking-widest text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {enrolledStudents.map((student) => {
                        const studentGrade = grades.find(g => g.courseId === activeCourse.id && g.studentId === student.uid);
                        return (
                          <tr key={student.uid} className="hover:bg-stone-50/30 transition-colors">
                            <td className="px-8 py-6 border-r border-stone-50 text-stone-400 font-bold text-xs uppercase tracking-wider">
                              {student.studentCode || 'S/C'}
                            </td>
                            <td className="px-8 py-6 border-r border-stone-50">
                              <p className="font-black text-stone-900 uppercase italic tracking-tight">{student.displayName}</p>
                              <p className="text-[10px] text-stone-400 font-medium lowercase mt-0.5">{student.email}</p>
                            </td>
                            <td className="px-8 py-6 border-r border-stone-50 text-center">
                              {studentGrade ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter bg-emerald-50 text-emerald-600 border border-emerald-100">
                                  <CheckCircle className="w-3 h-3" />
                                  Notas Completadas
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter bg-stone-50 text-stone-400 border border-stone-200">
                                  Sin Calificaciones
                                </span>
                              )}
                            </td>
                            <td className="px-8 py-6 border-r border-stone-50 text-center text-xs font-bold uppercase text-stone-600">
                              {studentGrade ? (
                                <div className="space-y-0.5">
                                  <div>Midterm: <span className="font-black text-stone-900">{studentGrade.midtermTotal}</span></div>
                                  <div>Final: <span className="font-black text-stone-900">{studentGrade.finalTotal}</span></div>
                                  <div className="text-bordeaux">Promedio: <span className="font-black">{studentGrade.average}</span></div>
                                </div>
                              ) : (
                                <span className="text-stone-300">—</span>
                              )}
                            </td>
                            <td className="px-8 py-6 text-right">
                              <button
                                onClick={() => {
                                  setSelectedCourseForGrade(activeCourse.id);
                                  setSelectedStudentForGrade(student.uid);
                                  if (studentGrade) {
                                    setEditingGradeId(studentGrade.id);
                                    setGradeForm({
                                      midtermAttendance: studentGrade.midtermAttendance,
                                      midtermParticipation: studentGrade.midtermParticipation,
                                      midtermOral: studentGrade.midtermOral,
                                      midtermWritten: studentGrade.midtermWritten,
                                      midtermPractices: studentGrade.midtermPractices,
                                      midtermTotal: studentGrade.midtermTotal,
                                      finalAttendance: studentGrade.finalAttendance,
                                      finalParticipation: studentGrade.finalParticipation,
                                      finalOral: studentGrade.finalOral,
                                      finalWritten: studentGrade.finalWritten,
                                      finalPractices: studentGrade.finalPractices,
                                      finalTotal: studentGrade.finalTotal,
                                      average: studentGrade.average,
                                      comments: studentGrade.comments || ''
                                    });
                                  } else {
                                    setEditingGradeId(null);
                                    setGradeForm({
                                      midtermAttendance: 0,
                                      midtermParticipation: 0,
                                      midtermOral: 0,
                                      midtermWritten: 0,
                                      midtermPractices: 0,
                                      midtermTotal: 0,
                                      finalAttendance: 0,
                                      finalParticipation: 0,
                                      finalOral: 0,
                                      finalWritten: 0,
                                      finalPractices: 0,
                                      finalTotal: 0,
                                      average: 0,
                                      comments: ''
                                    });
                                  }
                                  setIsGradeModalOpen(true);
                                }}
                                className={cn(
                                  "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm",
                                  studentGrade 
                                    ? "bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200" 
                                    : "bg-bordeaux hover:bg-black text-white"
                                )}
                              >
                                {studentGrade ? 'Editar Notas' : 'Registrar Notas'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {enrolledStudents.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-20 text-center">
                            <UserIcon className="w-12 h-12 text-stone-200 mx-auto mb-4" />
                            <p className="text-stone-400 font-black uppercase tracking-widest text-xs italic">
                              No hay estudiantes designados o inscritos a este curso todavía.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* Modal Registrar/Editar Calificaciones */}
      <AnimatePresence>
        {isGradeModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-md" 
              onClick={() => setIsGradeModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 40 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="relative bg-white w-full max-w-2xl shadow-[0_50px_100px_rgba(0,0,0,0.15)] max-h-[90vh] overflow-y-auto no-scrollbar border-2 border-black"
            >
              <div className="bg-stone-900 p-10 text-white font-serif">
                <button 
                  onClick={() => setIsGradeModalOpen(false)}
                  className="absolute top-10 right-10 p-2 hover:bg-white/10 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <h3 className="text-4xl font-bold mb-2 uppercase italic tracking-tighter">
                  {editingGradeId ? 'Editar Calificaciones' : 'Registrar Calificaciones'}
                </h3>
                <p className="text-stone-400 text-xs font-bold uppercase tracking-[0.2em] opacity-80">
                  Ingresa las notas de Kardex correspondientes para el alumno.
                </p>
              </div>

              <div className="p-10 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest pl-1">Curso</label>
                    <select 
                      className="w-full px-6 py-4 bg-stone-100 border-2 border-stone-200 outline-none font-bold uppercase text-xs tracking-widest text-stone-600 appearance-none rounded-xl"
                      required
                      disabled={true}
                      value={selectedCourseForGrade}
                      onChange={e => setSelectedCourseForGrade(e.target.value)}
                    >
                      <option value="">Selecciona un curso...</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest pl-1">Estudiante</label>
                    <select 
                      className="w-full px-6 py-4 bg-stone-100 border-2 border-stone-200 outline-none font-bold uppercase text-xs tracking-widest text-stone-600 appearance-none rounded-xl"
                      required
                      disabled={true}
                      value={selectedStudentForGrade}
                      onChange={e => setSelectedStudentForGrade(e.target.value)}
                    >
                      <option value="">Selecciona un estudiante...</option>
                      {allUsers.map(s => <option key={s.uid} value={s.uid}>{s.displayName}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-12">
                  <div className="space-y-6">
                     <div className="flex items-center gap-4">
                        <div className="h-[2px] flex-1 bg-stone-100" />
                        <h4 className="text-sm font-black text-stone-900 uppercase italic tracking-widest font-serif">Formulario de Notas</h4>
                        <div className="h-[2px] flex-1 bg-stone-100" />
                     </div>
                     <p className="text-[10px] text-stone-400 text-center font-bold uppercase tracking-widest">Ingresa las notas para Midterm y Final.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Midterm Section */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-4 mb-4">
                        <h5 className="text-xl font-serif font-black italic text-bordeaux">Midterm</h5>
                        <div className="flex-1 h-px bg-bordeaux/20" />
                      </div>
                      <div className="space-y-4">
                        {[
                          { label: 'Attendance (1-10)', field: 'midtermAttendance', max: 10 },
                          { label: 'Participation (1-35)', field: 'midtermParticipation', max: 35 },
                          { label: 'Oral Com. (1-20)', field: 'midtermOral', max: 20 },
                          { label: 'Written Com. (1-25)', field: 'midtermWritten', max: 25 },
                          { label: 'Practices (1-10)', field: 'midtermPractices', max: 10 }
                        ].map(item => (
                          <div key={item.field} className="group">
                            <label className="block text-[9px] font-black text-stone-400 uppercase tracking-widest mb-1 group-focus-within:text-bordeaux transition-colors">{item.label}</label>
                            <input 
                              type="number" max={item.max} min="0" step="0.01"
                              className="w-full px-4 py-3 bg-stone-50 border-b-2 border-stone-100 focus:border-bordeaux outline-none text-sm font-bold transition-all"
                              value={gradeForm[item.field as keyof typeof gradeForm] || 0}
                              onChange={e => setGradeForm({...gradeForm, [item.field]: parseFloat(e.target.value) || 0})}
                              onFocus={e => e.target.select()}
                            />
                          </div>
                        ))}
                        <div className="pt-6">
                          <div className="bg-stone-50 p-4 border-l-4 border-bordeaux flex justify-between items-center">
                            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Total Midterm</span>
                            <span className="text-2xl font-serif font-black text-stone-900">{gradeForm.midtermTotal}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Final Section */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-4 mb-4">
                        <h5 className="text-xl font-serif font-black italic text-bordeaux">Final</h5>
                        <div className="flex-1 h-px bg-bordeaux/20" />
                      </div>
                      <div className="space-y-4">
                        {[
                          { label: 'Attendance (1-10)', field: 'finalAttendance', max: 10 },
                          { label: 'Participation (1-35)', field: 'finalParticipation', max: 35 },
                          { label: 'Oral Com. (1-20)', field: 'finalOral', max: 20 },
                          { label: 'Written Com. (1-25)', field: 'finalWritten', max: 25 },
                          { label: 'Practices (1-10)', field: 'finalPractices', max: 10 }
                        ].map(item => (
                          <div key={item.field} className="group">
                            <label className="block text-[9px] font-black text-stone-400 uppercase tracking-widest mb-1 group-focus-within:text-bordeaux transition-colors">{item.label}</label>
                            <input 
                              type="number" max={item.max} min="0" step="0.01"
                              className="w-full px-4 py-3 bg-stone-50 border-b-2 border-stone-100 focus:border-bordeaux outline-none text-sm font-bold transition-all"
                              value={gradeForm[item.field as keyof typeof gradeForm] || 0}
                              onChange={e => setGradeForm({...gradeForm, [item.field]: parseFloat(e.target.value) || 0})}
                              onFocus={e => e.target.select()}
                            />
                          </div>
                        ))}
                        <div className="pt-6">
                          <div className="bg-stone-50 p-4 border-l-4 border-bordeaux flex justify-between items-center">
                            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Total Final</span>
                            <span className="text-2xl font-serif font-black text-stone-900">{gradeForm.finalTotal}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest pl-1">Observaciones</label>
                    <textarea 
                      className="w-full px-6 py-4 bg-stone-50 border-2 border-stone-100 focus:border-stone-900 outline-none text-sm font-bold min-h-[120px] transition-all rounded-2xl"
                      placeholder="Añade comentarios sobre el desempeño del estudiante..."
                      value={gradeForm.comments}
                      onChange={e => setGradeForm({...gradeForm, comments: e.target.value})}
                    />
                  </div>

                  <div className="bg-stone-900 text-white p-8 border-l-[12px] border-bordeaux flex flex-col items-center justify-center gap-6 shadow-2xl rounded-3xl">
                    <div className="text-center">
                      <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] mb-2">Average (Promedio)</p>
                      <p className="text-7xl font-serif font-black italic tracking-tighter text-orange-primary">{gradeForm.average}</p>
                    </div>
                    <button 
                      type="button"
                      onClick={handleCalculateTotals}
                      className="px-8 py-3 bg-white/10 hover:bg-white/20 transition-all rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Calcular Totales
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      type="button"
                      onClick={() => setIsGradeModalOpen(false)}
                      className="px-8 py-5 border-2 border-stone-100 font-black uppercase tracking-widest text-[10px] hover:bg-stone-50 transition-all rounded-xl"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      onClick={handleSaveGrade}
                      className="px-8 py-5 bg-bordeaux text-white font-black uppercase tracking-widest text-[10px] hover:bg-stone-900 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl rounded-xl"
                    >
                      {isSubmitting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Guardar Calificaciones
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
