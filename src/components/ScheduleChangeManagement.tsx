import React, { useState, useEffect } from 'react';
import { Search, Users, Clock, Edit, History, ArrowRight, Calendar, Layers } from 'lucide-react';
import { Timestamp, collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';
import { useEnrollments, useCourses, useScheduleChanges } from '../hooks/useCollections';
import { firestoreService } from '../services/firestoreService';
import { db } from '../firebase';
import { Enrollment, ScheduleChange } from '../types';

const ScheduleChangeManagement = () => {
  const { profile } = useAuth();
  const { data: enrollments } = useEnrollments();
  const { data: courses } = useCourses();
  const { data: scheduleChanges } = useScheduleChanges();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Enrollment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [levels, setLevels] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    newCourseId: '',
    newShift: '',
    newSchedule: '',
    levelChanged: false,
    newLevel: '',
    paidForChange: false,
    paymentAmount: 0,
    receiptNumber: ''
  });

  useEffect(() => {
    const unsubLevels = onSnapshot(collection(db, 'levels'), (snapshot) => {
      setLevels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error fetching levels:", error));
    return () => unsubLevels();
  }, []);

  const filteredStudents = enrollments.filter(s => 
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.studentCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.idCard.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditClick = (student: Enrollment) => {
    setSelectedStudent(student);
    const studentCourse = courses.find(c => 
      c.id === student.course || 
      c.studentIds?.includes(student.studentCode) || 
      c.studentIds?.includes(student.id)
    );
    setFormData({
      newCourseId: studentCourse ? studentCourse.id : (student.course || ''),
      newShift: student.shift,
      newSchedule: student.schedule || '',
      levelChanged: false,
      newLevel: student.level,
      paidForChange: false,
      paymentAmount: 0,
      receiptNumber: ''
    });
    setIsModalOpen(true);
  };

  const handleCourseChange = (courseId: string) => {
    const selectedCourse = courses.find(c => c.id === courseId);
    setFormData(prev => ({
      ...prev,
      newCourseId: courseId,
      newShift: selectedCourse ? (selectedCourse.type === 'Sábados' ? 'Sábado' : 'Noche') : prev.newShift,
      newSchedule: selectedCourse ? selectedCourse.schedule : prev.newSchedule,
      newLevel: selectedCourse ? selectedCourse.level : prev.newLevel,
    }));
  };

  const handleUpdateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedStudent.id || !profile) return;
    setIsSubmitting(true);
    try {
      const oldCourse = courses.find(c => 
        c.id === selectedStudent.course || 
        c.studentIds?.includes(selectedStudent.studentCode) || 
        c.studentIds?.includes(selectedStudent.id)
      );
      const oldCourseId = oldCourse ? oldCourse.id : (selectedStudent.course || '');
      const newCourseId = formData.newCourseId;

      // 1. If course changed, remove from old course and add to new course
      if (newCourseId && newCourseId !== oldCourseId) {
        if (oldCourseId) {
          const oldCourseRef = doc(db, 'courses', oldCourseId);
          const oldCourseDoc = courses.find(c => c.id === oldCourseId);
          if (oldCourseDoc) {
            const currentIds = oldCourseDoc.studentIds || [];
            const updatedIds = currentIds.filter(id => id !== selectedStudent.studentCode && id !== selectedStudent.id);
            await updateDoc(oldCourseRef, { studentIds: updatedIds });
          }
        }

        const newCourseRef = doc(db, 'courses', newCourseId);
        const newCourseDoc = courses.find(c => c.id === newCourseId);
        if (newCourseDoc) {
          const currentIds = newCourseDoc.studentIds || [];
          const studentIdToLink = selectedStudent.studentCode || selectedStudent.id;
          if (studentIdToLink && !currentIds.includes(studentIdToLink)) {
            await updateDoc(newCourseRef, { studentIds: [...currentIds, studentIdToLink] });
          }
        }
      }

      // 2. Prepare enrollment updates
      const updateData: any = {
        course: newCourseId,
        shift: formData.newShift,
        schedule: formData.newSchedule,
        level: formData.levelChanged ? formData.newLevel : (courses.find(c => c.id === newCourseId)?.level || formData.newLevel)
      };

      const currentComments = selectedStudent.comments || '';
      let logMessage = `[${new Date().toLocaleDateString()}] Cambio de horario a ${formData.newSchedule} (${formData.newShift})`;
      if (formData.levelChanged) logMessage += ` y nivel a ${formData.newLevel}`;
      if (formData.paidForChange) logMessage += `. Pago: ${formData.paymentAmount} Bs. Recibo: ${formData.receiptNumber}`;
      
      updateData.comments = `${currentComments}\n${logMessage}`.trim();

      await firestoreService.update('enrollments', selectedStudent.id, updateData);

      // 3. Create schedule revision log
      const historyRecord: Omit<ScheduleChange, 'id'> = {
        studentId: selectedStudent.id,
        studentName: `${selectedStudent.firstName} ${selectedStudent.lastName}`,
        oldShift: selectedStudent.shift,
        newShift: formData.newShift,
        oldSchedule: selectedStudent.schedule,
        newSchedule: formData.newSchedule,
        oldLevel: selectedStudent.level,
        newLevel: formData.levelChanged ? formData.newLevel : (courses.find(c => c.id === newCourseId)?.level || selectedStudent.level),
        oldCourseId: oldCourseId,
        newCourseId: newCourseId,
        paidForChange: formData.paidForChange,
        paymentAmount: formData.paymentAmount,
        receiptNumber: formData.paidForChange ? formData.receiptNumber : undefined,
        createdAt: Timestamp.now(),
        createdBy: profile.uid
      };
      await firestoreService.create('scheduleChanges', historyRecord);

      setIsModalOpen(false);
      setSelectedStudent(null);
      alert('Cambio de horario registrado correctamente');
    } catch (error) {
      console.error("Schedule change error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900 tracking-tight">Cambio de Horario</h2>
          <p className="text-stone-500">Gestiona los cambios de turno y nivel de los alumnos.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Buscar alumno..." 
            className="pl-10 pr-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux outline-none w-full md:w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden">
          <div className="p-6 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-bold text-stone-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-bordeaux" />
              Lista de Alumnos
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-stone-50 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4 border-b border-stone-100">Nombre del Alumno</th>
                  <th className="px-6 py-4 border-b border-stone-100">Curso / Nivel</th>
                  <th className="px-6 py-4 border-b border-stone-100">Horario Actual</th>
                  <th className="px-6 py-4 border-b border-stone-100">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-stone-50/50 transition-colors border-b border-stone-50 last:border-0">
                    <td className="px-6 py-4">
                      <p className="font-bold text-stone-800">{student.firstName} {student.lastName}</p>
                      <p className="text-[10px] text-stone-400">Cod: {student.studentCode}</p>
                    </td>
                    <td className="px-6 py-4 text-stone-600 font-medium">
                      {courses.find(c => c.id === student.course)?.name || student.course} / {student.level}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-stone-100 text-stone-600 text-[10px] font-bold rounded flex items-center gap-1 w-fit">
                        <Clock className="w-3 h-3" />
                        {student.shift}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleEditClick(student)}
                        className="p-2 bg-bordeaux/10 text-bordeaux rounded-lg hover:bg-bordeaux hover:text-white transition-all shadow-sm"
                        title="Cambiar Horario"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredStudents.length === 0 && (
            <div className="py-20 text-center">
              <Users className="w-12 h-12 text-stone-200 mx-auto mb-2" />
              <p className="text-stone-500 italic">No se encontraron alumnos.</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100">
            <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <History className="w-4 h-4" />
              Historial Reciente
            </h3>
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {scheduleChanges.map((change) => (
                <div key={change.id} className="p-4 bg-stone-50 rounded-2xl border border-stone-100 space-y-2">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-bold text-stone-800">{change.studentName}</p>
                    <span className="text-[10px] text-stone-400 font-bold">
                      {change.createdAt?.toDate().toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-stone-500">
                    <div className="flex items-center gap-2">
                       <span className="text-[9px] font-bold uppercase w-8">Turno:</span>
                       <span className="px-1.5 py-0.5 bg-stone-200 rounded">{change.oldShift}</span>
                       <ArrowRight className="w-3 h-3" />
                       <span className="px-1.5 py-0.5 bg-bordeaux/10 text-bordeaux rounded font-bold">{change.newShift}</span>
                    </div>
                    {(change.oldSchedule || change.newSchedule) && (
                      <div className="flex items-center gap-2">
                         <span className="text-[9px] font-bold uppercase w-8">Hora:</span>
                         <span className="px-1.5 py-0.5 bg-stone-200 rounded">{change.oldSchedule || '---'}</span>
                         <ArrowRight className="w-3 h-3" />
                         <span className="px-1.5 py-0.5 bg-bordeaux/10 text-bordeaux rounded font-bold">{change.newSchedule || '---'}</span>
                      </div>
                    )}
                  </div>
                  {change.oldLevel !== change.newLevel && (
                    <div className="flex items-center gap-2 text-xs text-stone-500">
                      <span className="px-1.5 py-0.5 bg-stone-200 rounded">{change.oldLevel}</span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold">{change.newLevel}</span>
                    </div>
                  )}
                </div>
              ))}
              {scheduleChanges.length === 0 && (
                <p className="text-stone-400 text-xs italic text-center py-8">No hay registros de cambios.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && selectedStudent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[2rem] shadow-2xl p-10 max-h-[90vh] overflow-y-auto"
            >
              <div className="w-16 h-16 bg-bordeaux/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-bordeaux" />
              </div>
              <h3 className="text-2xl font-black text-stone-900 text-center uppercase tracking-tighter italic">Cambio de Horario</h3>
              <p className="text-stone-500 text-center text-xs font-bold uppercase tracking-wider mb-6">
                Estudiante: <span className="text-bordeaux underline">{selectedStudent.firstName} {selectedStudent.lastName}</span>
              </p>

              <form onSubmit={handleUpdateSchedule} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-stone-600 uppercase mb-2 flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-bordeaux" /> Asignar Nuevo Curso
                  </label>
                  <select 
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white font-bold outline-none focus:ring-2 focus:ring-bordeaux/20 focus:border-bordeaux text-sm"
                    value={formData.newCourseId}
                    onChange={e => handleCourseChange(e.target.value)}
                  >
                    <option value="">Seleccionar curso...</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.level} - {c.schedule})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-600 uppercase mb-2">Cambio de Turno</label>
                    <select 
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm outline-none focus:ring-2 focus:ring-bordeaux/20 focus:border-bordeaux"
                      value={formData.newShift}
                      onChange={e => setFormData({...formData, newShift: e.target.value})}
                    >
                      <option value="Mañana">Mañana</option>
                      <option value="Tarde">Tarde</option>
                      <option value="Noche">Noche</option>
                      <option value="Sábado">Sábado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-600 uppercase mb-2">Nuevo Horario</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-bordeaux/20 focus:border-bordeaux"
                      placeholder="Ej: 08:00 - 09:15"
                      value={formData.newSchedule}
                      onChange={e => setFormData({...formData, newSchedule: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <input 
                    type="checkbox" 
                    id="levelChanged"
                    className="w-4 h-4 text-bordeaux focus:ring-bordeaux border-stone-300 rounded"
                    checked={formData.levelChanged}
                    onChange={e => setFormData({...formData, levelChanged: e.target.checked})}
                  />
                  <label htmlFor="levelChanged" className="text-sm font-bold text-stone-700 cursor-pointer">¿Cambio de nivel de curso?</label>
                </div>

                {formData.levelChanged && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                    <label className="block text-xs font-bold text-stone-600 uppercase mb-2">Nuevo Nivel</label>
                    <select 
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm outline-none focus:ring-2 focus:ring-bordeaux/20 focus:border-bordeaux"
                      value={formData.newLevel}
                      onChange={e => setFormData({...formData, newLevel: e.target.value})}
                    >
                      <option value="">Seleccionar nivel...</option>
                      {levels.map(lvl => (
                        <option key={lvl.id} value={lvl.name}>{lvl.name}</option>
                      ))}
                      {levels.length === 0 && Array.from(new Set(courses.map(c => c.level).filter(Boolean))).map(lvl => (
                        <option key={lvl} value={lvl}>{lvl}</option>
                      ))}
                    </select>
                  </motion.div>
                )}

                <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <input 
                    type="checkbox" 
                    id="paidForChange"
                    className="w-4 h-4 text-bordeaux focus:ring-bordeaux border-stone-300 rounded"
                    checked={formData.paidForChange}
                    onChange={e => setFormData({...formData, paidForChange: e.target.checked})}
                  />
                  <label htmlFor="paidForChange" className="text-sm font-bold text-stone-700 cursor-pointer">¿Pagó por el cambio?</label>
                </div>

                {formData.paidForChange && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-600 uppercase mb-2">Monto Pagado (Bs.)</label>
                      <input 
                        type="number" 
                        className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux outline-none text-sm"
                        value={formData.paymentAmount === 0 ? '' : formData.paymentAmount}
                        onChange={e => setFormData({...formData, paymentAmount: parseFloat(e.target.value) || 0})}
                        onFocus={e => e.target.select()}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-600 uppercase mb-2">Número de Recibo</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux outline-none text-sm"
                        placeholder="Ej: REC-001"
                        value={formData.receiptNumber}
                        onChange={e => setFormData({...formData, receiptNumber: e.target.value})}
                      />
                    </div>
                  </motion.div>
                )}

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 rounded-xl font-bold text-stone-500 hover:bg-stone-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-bordeaux hover:bg-bordeaux-dark shadow-lg transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Procesando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ScheduleChangeManagement;
