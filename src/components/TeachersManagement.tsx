import React, { useState, useEffect } from 'react';
import { Search, User as UserIcon, Briefcase, CheckCircle, ShieldCheck, BookOpen, X, ChevronRight } from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Course } from '../types';
import { cn } from '../utils/cn';
import { handleFirestoreError, OperationType } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

export const TeachersManagement = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<UserProfile | null>(null);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'courses'));
    return () => unsubscribe();
  }, []);

  const filteredUsers = users.filter(u => 
    u.role === 'teacher' && (
      u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const getTeacherCourses = (teacherUid: string) => {
    return courses.filter(c => c.teacherId === teacherUid);
  };

  const handleApproveTeacher = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: 'teacher' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleAssignCourses = async () => {
    if (!selectedTeacher) return;

    try {
      // First, unassign this teacher from any courses they currently have
      const currentTeacherCourses = courses.filter(c => c.teacherId === selectedTeacher.uid);
      for (const course of currentTeacherCourses) {
        if (!selectedCourseIds.includes(course.id)) {
          await updateDoc(doc(db, 'courses', course.id), { teacherId: '' });
        }
      }

      // Then, assign the selected courses to this teacher
      for (const courseId of selectedCourseIds) {
        await updateDoc(doc(db, 'courses', courseId), { teacherId: selectedTeacher.uid });
      }

      setIsAssignModalOpen(false);
      setSelectedTeacher(null);
      setSelectedCourseIds([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'courses');
    }
  };

  const toggleCourseSelection = (courseId: string) => {
    setSelectedCourseIds(prev => 
      prev.includes(courseId) 
        ? prev.filter(id => id !== courseId) 
        : [...prev, courseId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900">SCHEDULE BOARD</h2>
          <p className="text-stone-500">Administra las cuentas y asigna cursos al equipo docente.</p>
        </div>
        <div className="relative">
          <input 
            type="text" 
            placeholder="Buscar usuario..." 
            className="pl-10 pr-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux outline-none w-full md:w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="w-5 h-5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((user) => {
          const isTeacher = user.role === 'teacher' || user.role === 'master';
          const isAdmin = user.role === 'admin' || user.role === 'master' || user.role === 'dir_acad' || user.role === 'secretary';
          const teacherCourses = getTeacherCourses(user.uid);
          
          return (
            <motion.div 
              layout
              key={user.uid} 
              className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-bordeaux/10 flex items-center justify-center overflow-hidden">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-8 h-8 text-bordeaux" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-stone-800 text-lg">{user.displayName}</h3>
                    {isTeacher && <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                  </div>
                  <p className="text-xs text-stone-500">{user.email}</p>
                  <span className={cn(
                    "inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                    user.role === 'admin' ? "bg-bordeaux text-white" : 
                    user.role === 'master' ? "bg-purple-600 text-white" :
                    user.role === 'teacher' ? "bg-orange-primary text-white" : 
                    user.role === 'dir_acad' ? "bg-emerald-600 text-white" :
                    user.role === 'secretary' ? "bg-blue-600 text-white" :
                    "bg-stone-200 text-stone-600"
                  )}>
                    {user.role === 'admin' ? 'Administrador' : 
                     user.role === 'master' ? 'Master' : 
                     user.role === 'teacher' ? 'Profesor' : 
                     user.role === 'dir_acad' ? 'Dir. Acad.' :
                     user.role === 'secretary' ? 'Secretaria' :
                     'Alumno / Pendiente'}
                  </span>
                </div>
              </div>
              
              <div className="flex-1">
                {isTeacher ? (
                  <>
                    <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Cursos Asignados</p>
                    <div className="flex flex-wrap gap-2">
                      {teacherCourses.map(c => (
                        <span key={c.id} className="px-2 py-1 bg-orange-primary/5 text-orange-primary text-[10px] font-bold rounded border border-orange-primary/10">
                          {c.name}
                        </span>
                      ))}
                      {teacherCourses.length === 0 && (
                        <span className="text-xs text-stone-400 italic">Sin cursos asignados</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="bg-stone-50 p-3 rounded-xl border border-dashed border-stone-200">
                    <p className="text-xs text-stone-500 italic">Cuenta pendiente de aprobación como profesor.</p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-stone-50 flex flex-col gap-3">
                {!isTeacher && !isAdmin && (
                  <button 
                    onClick={() => handleApproveTeacher(user.uid)}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Aprobar como Profesor
                  </button>
                )}
                {isTeacher && (
                  <button 
                    onClick={() => {
                      setSelectedTeacher(user);
                      setSelectedCourseIds(teacherCourses.map(c => c.id));
                      setIsAssignModalOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-bordeaux text-white py-2 rounded-xl text-sm font-bold hover:bg-bordeaux-dark transition-colors"
                  >
                    <BookOpen className="w-4 h-4" />
                    Asignar Cursos
                  </button>
                )}
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] text-stone-400">ID: {user.uid.slice(0, 8)}...</span>
                  <Link to="/users" className="text-stone-400 text-[10px] hover:text-bordeaux hover:underline">Gestionar Rol</Link>
                </div>
              </div>
            </motion.div>
          );
        })}
        {filteredUsers.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-stone-200">
            <Briefcase className="w-12 h-12 text-stone-200 mx-auto mb-2" />
            <p className="text-stone-500 italic">No se encontraron usuarios.</p>
          </div>
        )}
      </div>

      {/* Modal for Assigning Existing Courses to Teacher */}
      <AnimatePresence>
        {isAssignModalOpen && selectedTeacher && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAssignModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 max-h-[80vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-stone-900">Asignar Cursos</h3>
                <button onClick={() => setIsAssignModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-sm text-stone-500 mb-4">
                Selecciona los cursos para: <span className="font-bold text-stone-800">{selectedTeacher.displayName}</span>
              </p>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-2 mb-6">
                {courses.length === 0 && (
                  <p className="text-center py-4 text-stone-500 italic">No hay cursos creados.</p>
                )}
                {courses.map(course => (
                  <div 
                    key={course.id}
                    onClick={() => toggleCourseSelection(course.id)}
                    className={cn(
                      "p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between",
                      selectedCourseIds.includes(course.id)
                        ? "bg-bordeaux/5 border-bordeaux shadow-sm"
                        : "bg-stone-50 border-stone-100 hover:border-stone-200"
                    )}
                  >
                    <div>
                      <p className="font-bold text-stone-800">{course.name}</p>
                      <p className="text-xs text-stone-500">{course.level} • {course.schedule}</p>
                      {course.teacherId && course.teacherId !== selectedTeacher.uid && (
                        <p className="text-[10px] text-orange-primary font-bold mt-1 uppercase tracking-tighter">
                          Asignado a otro profesor
                        </p>
                      )}
                    </div>
                    {selectedCourseIds.includes(course.id) && (
                      <CheckCircle className="w-5 h-5 text-bordeaux" />
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-4 flex gap-3 border-t border-stone-100">
                <button type="button" onClick={() => setIsAssignModalOpen(false)} className="flex-1 px-4 py-2 rounded-xl font-semibold text-stone-600 hover:bg-stone-100 transition-colors">Cancelar</button>
                <button 
                  onClick={handleAssignCourses}
                  className="flex-1 bg-bordeaux text-white px-4 py-2 rounded-xl font-semibold hover:bg-bordeaux-dark transition-colors"
                >
                  Guardar Cambios
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
