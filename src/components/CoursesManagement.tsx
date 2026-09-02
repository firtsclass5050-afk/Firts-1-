import React, { useState, useEffect } from 'react';
import { Plus, Users, Trash2, Clock, User as UserIcon, BookOpen, ChevronRight, X, LayoutDashboard, FileDown, ClipboardList, Award, Layers, Edit2, Save } from 'lucide-react';
import { collection, onSnapshot, query, where, addDoc, deleteDoc, doc, updateDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Course, UserProfile, Attendance, Level } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../firebase';
import { MonthlyAttendanceList } from './AttendanceManagement';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const CoursesManagement = () => {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [allStudents, setAllStudents] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isExamPlanningModalOpen, setIsExamPlanningModalOpen] = useState(false);
  const [isLevelsModalOpen, setIsLevelsModalOpen] = useState(false);
  const [isMonitoringList, setIsMonitoringList] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [editingLevel, setEditingLevel] = useState<Level | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [newLevel, setNewLevel] = useState({ name: '', description: '' });
  const [newCourse, setNewCourse] = useState<{
    name: string;
    level: string;
    schedule: string;
    maxCapacity: number;
    type: 'Regular' | 'Acelerado' | 'Sábados' | 'Personalizadas';
    teacherId: string;
  }>({ name: '', level: '', schedule: '', maxCapacity: 20, type: 'Regular', teacherId: '' });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editCourseData, setEditCourseData] = useState<{
    name: string;
    level: string;
    schedule: string;
    maxCapacity: number;
    type: 'Regular' | 'Acelerado' | 'Sábados' | 'Personalizadas';
    teacherId: string;
  }>({ name: '', level: '', schedule: '', maxCapacity: 20, type: 'Regular', teacherId: '' });

  const [examDates, setExamDates] = useState({ 
    midterm: '', 
    final: '', 
    kardex: '' 
  });

  useEffect(() => {
    if (selectedCourse) {
      setExamDates({
        midterm: selectedCourse.midtermExamDate || '',
        final: selectedCourse.finalExamDate || '',
        kardex: selectedCourse.kardexFillingDate || ''
      });
    }
  }, [selectedCourse]);

  const handleSaveExamDates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;

    try {
      await updateDoc(doc(db, 'courses', selectedCourse.id), {
        midtermExamDate: examDates.midterm,
        finalExamDate: examDates.final,
        kardexFillingDate: examDates.kardex
      });
      alert('Planificación de exámenes guardada con éxito');
      setIsExamPlanningModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'courses');
    }
  };

  useEffect(() => {
    const q = profile?.role === 'teacher' 
      ? query(collection(db, 'courses'), where('teacherId', '==', profile.uid))
      : collection(db, 'courses');
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'courses'));
    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    const q = query(collection(db, 'levels'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLevels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Level)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'levels'));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data() as UserProfile);
      setAllUsers(users);
      setAllStudents(users.filter(u => u.role === 'student'));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedCourse || !isDetailsModalOpen) {
      setAttendanceRecords([]);
      return;
    }

    const q = query(
      collection(db, 'attendance'),
      where('courseId', '==', selectedCourse.id),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAttendanceRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'attendance'));

    return () => unsubscribe();
  }, [selectedCourse, isDetailsModalOpen]);

  const generateCourseAttendancePDF = () => {
    if (!selectedCourse) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const enrolledStudents = allStudents.filter(s => 
      selectedCourse.studentIds?.includes(s.uid) || 
      (s.studentCode && selectedCourse.studentIds?.includes(s.studentCode))
    );

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(128, 0, 32);
    doc.text('CONTROL DE LISTAS', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(60, 60, 60);
    doc.text(`Modalidad: ${selectedCourse.name} (${selectedCourse.level})`, 20, 35);
    doc.text(`Horario: ${selectedCourse.schedule}`, 20, 42);
    doc.text(`Fecha de Reporte: ${new Date().toLocaleDateString()}`, pageWidth - 20, 42, { align: 'right' });

    doc.setDrawColor(128, 0, 32);
    doc.setLineWidth(0.5);
    doc.line(20, 48, pageWidth - 20, 48);

    // Attendance Summary Calculation
    const studentStats = enrolledStudents.map(student => {
      const counts = attendanceRecords.reduce((acc, record) => {
        const studentRecord = record.records.find(r => r.studentId === student.uid);
        if (studentRecord) {
          acc[studentRecord.status] = (acc[studentRecord.status] || 0) + 1;
        }
        return acc;
      }, { present: 0, absent: 0, permission: 0, late: 0 } as any);

      return [
        student.displayName,
        student.studentCode || 'N/A',
        counts.present.toString(),
        counts.absent.toString(),
        counts.late.toString(),
        counts.permission.toString(),
        attendanceRecords.length > 0 
          ? `${Math.round((counts.present / attendanceRecords.length) * 100)}%`
          : '0%'
      ];
    });

    // Individual Statistics Table
    doc.setFontSize(12);
    doc.text('Resumen Individual de Listas', 20, 60);

    autoTable(doc, {
      startY: 65,
      head: [['Estudiante', 'Código', 'Pres.', 'Aus.', 'Tard.', 'Perm.', '% Asist.']],
      body: studentStats,
      headStyles: { fillColor: [128, 0, 32] },
      styles: { fontSize: 9, halign: 'center' },
      columnStyles: { 0: { halign: 'left', cellWidth: 50 } }
    });

    // General Statistics
    const totalRecords = attendanceRecords.length;
    const totalPresents = attendanceRecords.reduce((sum, r) => sum + r.records.filter(sr => sr.status === 'present').length, 0);
    const totalPossible = totalRecords * enrolledStudents.length;
    const generalAvg = totalPossible > 0 ? Math.round((totalPresents / totalPossible) * 100) : 0;

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.text('Estadísticas Generales del Curso', 20, finalY);
    
    autoTable(doc, {
      startY: finalY + 5,
      body: [
        ['Total de Clases Registradas', totalRecords.toString()],
        ['Total de Estudiantes Inscritos', enrolledStudents.length.toString()],
        ['Promedio General', `${generalAvg}%`]
      ],
      theme: 'grid',
      styles: { fontSize: 10 }
    });

    doc.save(`Listas_${selectedCourse.name.replace(/\s+/g, '_')}.pdf`);
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const assignedTeacher = allUsers.find(u => u.uid === newCourse.teacherId);
      const teacherName = assignedTeacher ? assignedTeacher.displayName : '';
      await addDoc(collection(db, 'courses'), { 
        ...newCourse, 
        teacherId: newCourse.teacherId || '', 
        teacherName: teacherName,
        studentIds: [],
        maxCapacity: Number(newCourse.maxCapacity) || 20
      });
      setIsModalOpen(false);
      setNewCourse({ name: '', level: '', schedule: '', maxCapacity: 20, type: 'Regular', teacherId: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'courses');
    }
  };

  const handleEditCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourseId) return;
    try {
      const assignedTeacher = allUsers.find(u => u.uid === editCourseData.teacherId);
      const teacherName = assignedTeacher ? assignedTeacher.displayName : '';
      await updateDoc(doc(db, 'courses', editingCourseId), { 
        ...editCourseData,
        teacherName: teacherName,
        maxCapacity: Number(editCourseData.maxCapacity) || 20
      });
      setIsEditModalOpen(false);
      setEditingCourseId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'courses');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este curso?')) {
      try {
        await deleteDoc(doc(db, 'courses', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'courses');
      }
    }
  };

  const handleAddLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingLevel) {
        await updateDoc(doc(db, 'levels', editingLevel.id), {
          name: newLevel.name,
          description: newLevel.description
        });
        setEditingLevel(null);
      } else {
        await addDoc(collection(db, 'levels'), {
          ...newLevel,
          createdAt: serverTimestamp()
        });
      }
      setNewLevel({ name: '', description: '' });
    } catch (error) {
      handleFirestoreError(error, editingLevel ? OperationType.UPDATE : OperationType.CREATE, 'levels');
    }
  };

  const handleDeleteLevel = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este nivel? Los cursos asociados podrían verse afectados visualmente.')) {
      try {
        await deleteDoc(doc(db, 'levels', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'levels');
      }
    }
  };

  const handleEnroll = async (courseId: string, studentUid: string) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    
    const currentIds = course.studentIds || [];
    if (currentIds.includes(studentUid)) return;

    try {
      await updateDoc(doc(db, 'courses', courseId), {
        studentIds: [...currentIds, studentUid]
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'courses');
    }
  };

  const handleUnenroll = async (courseId: string, studentUid: string) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    
    const currentIds = course.studentIds || [];
    try {
      await updateDoc(doc(db, 'courses', courseId), {
        studentIds: currentIds.filter(id => id !== studentUid)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'courses');
    }
  };

  const currentCourse = selectedCourse ? (courses.find(c => c.id === selectedCourse.id) || selectedCourse) : null;

  if (isMonitoringList && currentCourse) {
    return <MonthlyAttendanceList course={currentCourse} onBack={() => setIsMonitoringList(false)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-stone-900">Cursos</h2>
          <p className="text-stone-500">Gestiona los niveles y horarios del instituto.</p>
        </div>
        {(profile?.role === 'admin' || profile?.role === 'master' || profile?.role === 'dir_acad' || profile?.role === 'secretary') && (
          <div className="flex gap-3">
            <button 
              onClick={() => setIsLevelsModalOpen(true)}
              className="flex items-center gap-2 bg-stone-100 text-stone-700 px-4 py-2 rounded-xl font-bold hover:bg-stone-200 transition-colors"
            >
              <Layers className="w-5 h-5" />
              Gestionar Niveles
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-bordeaux text-white px-4 py-2 rounded-xl font-bold hover:bg-bordeaux-dark transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nuevo Curso
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <div key={course.id} className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden group">
            <div className="bg-stone-50 p-6 border-b border-stone-100 flex justify-between items-start">
              <div>
                <div className="flex gap-2">
                  <span className="text-xs font-bold text-orange-primary uppercase tracking-wider">{course.level}</span>
                  {course.type && (
                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest bg-stone-100 px-2 rounded-full border border-stone-200">
                      {course.type}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-stone-800 mt-1">{course.name}</h3>
              </div>
              {(profile?.role === 'admin' || profile?.role === 'master' || profile?.role === 'dir_acad' || profile?.role === 'secretary') && (
                <div className="flex gap-1">
                  <button 
                    onClick={() => {
                      setSelectedCourse(course);
                      setIsEnrollModalOpen(true);
                    }}
                    className="p-2 text-stone-400 hover:text-orange-primary transition-colors"
                    title="Inscribir Alumnos"
                  >
                    <Users className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => {
                      setEditingCourseId(course.id);
                      setEditCourseData({
                        name: course.name,
                        level: course.level,
                        schedule: course.schedule,
                        maxCapacity: course.maxCapacity || 20,
                        type: course.type || 'Regular',
                        teacherId: course.teacherId || ''
                      });
                      setIsEditModalOpen(true);
                    }}
                    className="p-2 text-stone-400 hover:text-bordeaux transition-colors"
                    title="Editar Curso"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(course.id)} className="p-2 text-stone-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-stone-600">
                <Clock className="w-5 h-5 text-stone-400" />
                <span className="text-sm">{course.schedule}</span>
              </div>
              <div className="flex items-center gap-3 text-stone-600">
                <UserIcon className="w-5 h-5 text-stone-400" />
                <span className="text-sm">
                  {course.teacherId 
                    ? `Profesor: ${allUsers.find(u => u.uid === course.teacherId)?.displayName || 'Cargando...'}` 
                    : 'Sin profesor asignado'}
                </span>
              </div>
              <div className="pt-4 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="block text-sm text-stone-400">{course.studentIds?.length || 0} Estudiantes Inscritos</span>
                </div>
                <button 
                  onClick={() => {
                    setSelectedCourse(course);
                    setIsDetailsModalOpen(true);
                  }}
                  className="text-bordeaux font-bold text-sm flex items-center gap-1 hover:gap-2 transition-all"
                >
                  Detalles <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for New Course */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-8"
            >
              <h3 className="text-2xl font-bold text-stone-900 mb-6">Crear Nuevo Curso</h3>
              <form onSubmit={handleAddCourse} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Modalidad</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux focus:border-transparent outline-none"
                    value={newCourse.name}
                    onChange={e => setNewCourse({...newCourse, name: e.target.value})}
                    placeholder="Ej: English for Beginners"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Nivel</label>
                  <select 
                    required
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux focus:border-transparent outline-none"
                    value={newCourse.level}
                    onChange={e => setNewCourse({...newCourse, level: e.target.value})}
                  >
                    <option value="">Seleccionar nivel</option>
                    {levels.map(level => (
                      <option key={level.id} value={level.name}>{level.name}</option>
                    ))}
                    {levels.length === 0 && (
                      <>
                        <option value="A1">A1 - Beginner</option>
                        <option value="A2">A2 - Elementary</option>
                        <option value="B1">B1 - Intermediate</option>
                        <option value="B2">B2 - Upper Intermediate</option>
                        <option value="C1">C1 - Advanced</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Tipo de Clase</label>
                  <select 
                    required
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux focus:border-transparent outline-none"
                    value={newCourse.type}
                    onChange={e => setNewCourse({...newCourse, type: e.target.value as any})}
                  >
                    <option value="Regular">Regular</option>
                    <option value="Acelerado">Acelerado</option>
                    <option value="Sábados">Sábados</option>
                    <option value="Personalizadas">Personalizadas</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Horario</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux focus:border-transparent outline-none"
                    value={newCourse.schedule}
                    onChange={e => setNewCourse({...newCourse, schedule: e.target.value})}
                    placeholder="Ej: Lun y Mie 18:00 - 20:00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Profesor Asignado</label>
                  <select 
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux focus:border-transparent outline-none"
                    value={newCourse.teacherId}
                    onChange={e => setNewCourse({...newCourse, teacherId: e.target.value})}
                  >
                    <option value="">Sin profesor asignado</option>
                    {allUsers.filter(u => u.role === 'teacher' || u.role === 'master' || u.role === 'admin' || u.role === 'dir_acad' || u.role === 'secretary').map(teacher => (
                      <option key={teacher.uid} value={teacher.uid}>{teacher.displayName}</option>
                    ))}
                  </select>
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 rounded-xl font-bold text-stone-600 hover:bg-stone-100 transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 bg-bordeaux text-white px-4 py-2 rounded-xl font-bold hover:bg-bordeaux-dark transition-colors">Crear</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal for Edit Course */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 max-h-[90vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-2xl font-bold text-stone-900">Editar Curso</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full">
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>
              <form onSubmit={handleEditCourse} className="space-y-4 overflow-y-auto pr-1">
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Modalidad</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux focus:border-transparent outline-none"
                    value={editCourseData.name}
                    onChange={e => setEditCourseData({...editCourseData, name: e.target.value})}
                    placeholder="Ej: English for Beginners"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Nivel</label>
                  <select 
                    required
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux focus:border-transparent outline-none"
                    value={editCourseData.level}
                    onChange={e => setEditCourseData({...editCourseData, level: e.target.value})}
                  >
                    <option value="">Seleccionar nivel</option>
                    {levels.map(level => (
                      <option key={level.id} value={level.name}>{level.name}</option>
                    ))}
                    {levels.length === 0 && (
                      <>
                        <option value="A1">A1 - Beginner</option>
                        <option value="A2">A2 - Elementary</option>
                        <option value="B1">B1 - Intermediate</option>
                        <option value="B2">B2 - Upper Intermediate</option>
                        <option value="C1">C1 - Advanced</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Tipo de Clase</label>
                  <select 
                    required
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux focus:border-transparent outline-none"
                    value={editCourseData.type}
                    onChange={e => setEditCourseData({...editCourseData, type: e.target.value as any})}
                  >
                    <option value="Regular">Regular</option>
                    <option value="Acelerado">Acelerado</option>
                    <option value="Sábados">Sábados</option>
                    <option value="Personalizadas">Personalizadas</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Horario</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux focus:border-transparent outline-none"
                    value={editCourseData.schedule}
                    onChange={e => setEditCourseData({...editCourseData, schedule: e.target.value})}
                    placeholder="Ej: Lun y Mie 18:00 - 20:00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Capacidad Máxima</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux focus:border-transparent outline-none"
                    value={editCourseData.maxCapacity}
                    onChange={e => setEditCourseData({...editCourseData, maxCapacity: Number(e.target.value) || 20})}
                    placeholder="Ej: 20"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Profesor Asignado</label>
                  <select 
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux focus:border-transparent outline-none"
                    value={editCourseData.teacherId}
                    onChange={e => setEditCourseData({...editCourseData, teacherId: e.target.value})}
                  >
                    <option value="">Sin profesor asignado</option>
                    {allUsers.filter(u => u.role === 'teacher' || u.role === 'master' || u.role === 'admin' || u.role === 'dir_acad' || u.role === 'secretary').map(teacher => (
                      <option key={teacher.uid} value={teacher.uid}>{teacher.displayName}</option>
                    ))}
                  </select>
                </div>
                <div className="pt-4 flex gap-3 shrink-0">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 px-4 py-2 rounded-xl font-bold text-stone-600 hover:bg-stone-100 transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 bg-bordeaux text-white px-4 py-2 rounded-xl font-bold hover:bg-bordeaux-dark transition-colors">Guardar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal for Course Details & Attendance History */}
      <AnimatePresence>
        {isDetailsModalOpen && currentCourse && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-950/80 backdrop-blur-md" onClick={() => setIsDetailsModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-5xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-stone-50 p-8 border-b border-stone-100 flex justify-between items-start shrink-0">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-bordeaux/10 flex items-center justify-center border-2 border-bordeaux/20">
                    <BookOpen className="w-8 h-8 text-bordeaux" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-stone-900">{currentCourse.name}</h3>
                    <div className="flex items-center gap-4 mt-1 text-stone-500">
                      <span className="text-sm font-medium flex items-center gap-1">
                        <Award className="w-4 h-4 text-orange-primary" />
                        Nivel: {currentCourse.level}
                      </span>
                      <span className="text-sm font-medium flex items-center gap-1">
                        <Clock className="w-4 h-4 text-emerald-500" />
                        Horario: {currentCourse.schedule}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsExamPlanningModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-all shadow-md"
                  >
                    <Award className="w-4 h-4" />
                    Planificación Examen
                  </button>
                  <button 
                    onClick={() => setIsMonitoringList(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-bordeaux text-white rounded-xl text-sm font-bold hover:bg-bordeaux-dark transition-all shadow-md"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Monitorear Lista
                  </button>
                  <button 
                    onClick={generateCourseAttendancePDF}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-md"
                  >
                    <FileDown className="w-4 h-4" />
                    Descargar Lista PDF
                  </button>
                  <button onClick={() => setIsDetailsModalOpen(false)} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
                    <X className="w-6 h-6 text-stone-400" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Student List */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="w-5 h-5 text-bordeaux" />
                      <h4 className="font-bold text-stone-900 uppercase tracking-widest text-xs">Alumnos Inscritos</h4>
                    </div>
                    <div className="space-y-2">
                    {(() => {
                      const enrolled = allStudents.filter(s => 
                        currentCourse.studentIds?.includes(s.uid) || 
                        (s.studentCode && currentCourse.studentIds?.includes(s.studentCode))
                      );
                      return enrolled.length > 0 ? (
                        enrolled.map(student => (
                          <div key={student.uid} className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
                            <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center overflow-hidden">
                              {student.photoURL ? <img src={student.photoURL} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4 text-stone-400" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-stone-800">{student.displayName}</p>
                              <p className="text-[10px] text-stone-400 font-bold">{student.studentCode || 'Sin código'}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-stone-400 italic text-sm text-center py-4">No hay alumnos inscritos.</p>
                      );
                    })()}
                    </div>
                  </div>

                  {/* Attendance History */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <ClipboardList className="w-5 h-5 text-emerald-500" />
                      <h4 className="font-bold text-stone-900 uppercase tracking-widest text-xs">Listas Diarias Enviadas</h4>
                    </div>
                    <div className="space-y-4">
                      {attendanceRecords.map((record) => (
                        <div key={record.id} className="bg-white rounded-2xl border border-stone-100 overflow-hidden shadow-sm">
                          <div className="bg-stone-50 px-6 py-3 border-b border-stone-100 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                              <span className="text-sm font-bold text-stone-800">{record.date.toDate().toLocaleDateString()}</span>
                              <span className="px-2 py-0.5 bg-stone-200 text-stone-600 rounded text-[10px] font-bold uppercase">{record.shift}</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                {record.records.filter(r => r.status === 'present').length} Presentes
                              </span>
                              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                                {record.records.filter(r => r.status === 'absent').length} Ausentes
                              </span>
                            </div>
                          </div>
                          <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                            {record.records.map((r, idx) => {
                              const student = allStudents.find(s => s.uid === r.studentId);
                              return (
                                <div key={idx} className="flex items-center gap-2 text-[11px]">
                                  <div className={`w-2 h-2 rounded-full ${
                                    r.status === 'present' ? "bg-emerald-500" :
                                    r.status === 'absent' ? "bg-rose-500" :
                                    r.status === 'late' ? "bg-amber-500" : "bg-stone-400"
                                  }`} />
                                  <span className="text-stone-600 truncate">{student?.displayName || 'Desconocido'}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {attendanceRecords.length === 0 && (
                        <div className="py-12 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                          <p className="text-stone-400 italic text-sm">No se han registrado listas de asistencia para este curso.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-stone-50 p-6 border-t border-stone-100 flex justify-end shrink-0">
                <button 
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="px-8 py-3 bg-bordeaux text-white rounded-2xl font-bold hover:bg-bordeaux-dark transition-all shadow-lg"
                >
                  Cerrar Detalles
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal for Exam Planning */}
      <AnimatePresence>
        {isExamPlanningModalOpen && selectedCourse && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setIsExamPlanningModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-stone-900">Planificación de Examen</h3>
                <button onClick={() => setIsExamPlanningModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>
              <form onSubmit={handleSaveExamDates} className="space-y-5">
                <div>
                  <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-1 px-1">Mid-term-Exam Date</label>
                  <input 
                    type="date"
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux outline-none font-bold"
                    value={examDates.midterm}
                    onChange={e => setExamDates({ ...examDates, midterm: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-1 px-1">Final-Exam Date</label>
                  <input 
                    type="date"
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux outline-none font-bold"
                    value={examDates.final}
                    onChange={e => setExamDates({ ...examDates, final: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-1 px-1">Kardex-Filling Date</label>
                  <input 
                    type="date"
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux outline-none font-bold"
                    value={examDates.kardex}
                    onChange={e => setExamDates({ ...examDates, kardex: e.target.value })}
                  />
                </div>
                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    Guardar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Modal for Level Management */}
      <AnimatePresence>
        {isLevelsModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => {
                setIsLevelsModalOpen(false);
                setEditingLevel(null);
                setNewLevel({ name: '', description: '' });
              }} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-8 max-h-[85vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-stone-900">Gestionar Niveles</h3>
                <button onClick={() => {
                  setIsLevelsModalOpen(false);
                  setEditingLevel(null);
                  setNewLevel({ name: '', description: '' });
                }} className="p-2 hover:bg-stone-100 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddLevel} className="space-y-4 mb-8 bg-stone-50 p-6 rounded-2xl border border-stone-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-1 px-1">Nombre del Nivel</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux focus:border-transparent outline-none bg-white"
                      value={newLevel.name}
                      onChange={e => setNewLevel({...newLevel, name: e.target.value})}
                      placeholder="Ej: B1 - Intermediate"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-1 px-1">Descripción (Opcional)</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux focus:border-transparent outline-none bg-white"
                      value={newLevel.description}
                      onChange={e => setNewLevel({...newLevel, description: e.target.value})}
                      placeholder="Ej: Nivel intermedio de inglés"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  {editingLevel && (
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingLevel(null);
                        setNewLevel({ name: '', description: '' });
                      }}
                      className="px-4 py-2 rounded-xl font-bold text-stone-500 hover:bg-stone-200 transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                  <button 
                    type="submit" 
                    className="flex items-center gap-2 bg-bordeaux text-white px-6 py-2 rounded-xl font-bold hover:bg-bordeaux-dark transition-colors shadow-lg shadow-bordeaux/20"
                  >
                    {editingLevel ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingLevel ? 'Guardar Cambios' : 'Agregar Nivel'}
                  </button>
                </div>
              </form>

              <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] px-2">Niveles Registrados</h4>
                {levels.map(level => (
                  <div key={level.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-stone-100 group hover:border-bordeaux/30 transition-all shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-orange-primary/10 rounded-xl flex items-center justify-center">
                        <Award className="w-5 h-5 text-orange-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-stone-900">{level.name}</p>
                        {level.description && <p className="text-xs text-stone-500">{level.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setEditingLevel(level);
                          setNewLevel({ name: level.name, description: level.description || '' });
                        }}
                        className="p-2 text-stone-400 hover:text-bordeaux hover:bg-bordeaux/5 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteLevel(level.id)}
                        className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {levels.length === 0 && (
                  <div className="text-center py-12 bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200">
                    <Layers className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                    <p className="text-stone-400 font-medium italic">No hay niveles personalizados registrados.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal for Enrollment */}
      <AnimatePresence>
        {isEnrollModalOpen && currentCourse && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEnrollModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-8 max-h-[80vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-stone-900">Inscribir Alumnos</h3>
                  <p className="text-stone-500 text-sm">Modalidad: {currentCourse.name} ({currentCourse.level})</p>
                </div>
                <button onClick={() => setIsEnrollModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                <div className="grid grid-cols-1 gap-3">
                  {allStudents.map((student) => {
                    const isEnrolled = currentCourse.studentIds?.includes(student.uid) || 
                                      (student.studentCode && currentCourse.studentIds?.includes(student.studentCode));
                    return (
                      <div key={student.uid} className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-100">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-orange-primary/10 flex items-center justify-center overflow-hidden">
                            {student.photoURL ? <img src={student.photoURL} alt={student.displayName} className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-orange-primary" />}
                          </div>
                          <div>
                            <p className="font-bold text-stone-800">{student.displayName}</p>
                            <p className="text-xs text-stone-500">{student.email}</p>
                          </div>
                        </div>
                        {isEnrolled ? (
                          <button 
                            onClick={() => handleUnenroll(currentCourse.id, student.uid)}
                            className="flex items-center gap-1 text-red-600 font-bold text-sm hover:bg-red-50 px-3 py-1 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" /> Desinscribir
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleEnroll(currentCourse.id, student.uid)}
                            className="flex items-center gap-1 text-emerald-600 font-bold text-sm hover:bg-emerald-50 px-3 py-1 rounded-lg transition-colors"
                          >
                            <Plus className="w-4 h-4" /> Inscribir
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {allStudents.length === 0 && (
                    <p className="text-center text-stone-500 py-8 italic">No hay alumnos registrados en el sistema.</p>
                  )}
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-stone-100">
                <button 
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="w-full bg-bordeaux text-white py-3 rounded-xl font-bold hover:bg-bordeaux-dark transition-colors"
                >
                  Listo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
