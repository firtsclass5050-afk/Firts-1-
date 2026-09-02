import React, { useState, useEffect } from 'react';
import { Search, Plus, Users, Calendar, Clock, BookOpen, Layers } from 'lucide-react';
import { Timestamp, collection, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';
import { useEnrollments, useCourses } from '../hooks/useCollections';
import { firestoreService } from '../services/firestoreService';
import { db } from '../firebase';
import { Enrollment } from '../types';

const ReinstatementManagement = () => {
  const { profile } = useAuth();
  const { data: enrollments } = useEnrollments();
  const { data: courses } = useCourses();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Enrollment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [levels, setLevels] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    amount: 0,
    receiptNumber: '',
    invoiceNumber: '',
    authorizationNumber: '',
    course: '',
    level: '',
    shift: '',
    schedule: ''
  });

  useEffect(() => {
    const unsubLevels = onSnapshot(collection(db, 'levels'), (snapshot) => {
      setLevels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error fetching levels:", error));
    return () => unsubLevels();
  }, []);

  const frozenStudents = enrollments.filter(s => s.status === 'frozen');

  const filteredStudents = frozenStudents.filter(s => 
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.studentCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.idCard.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleReinstatementClick = (student: Enrollment) => {
    setSelectedStudent(student);
    setFormData({
      amount: 0,
      receiptNumber: '',
      invoiceNumber: '',
      authorizationNumber: '',
      course: student.course || '',
      level: student.level || '',
      shift: student.shift || '',
      schedule: student.schedule || '',
    });
    setIsModalOpen(true);
  };

  const handleCourseChange = (courseId: string) => {
    const selectedCourse = courses.find(c => c.id === courseId);
    setFormData(prev => ({
      ...prev,
      course: courseId,
      level: selectedCourse ? selectedCourse.level : prev.level,
      schedule: selectedCourse ? selectedCourse.schedule : prev.schedule,
    }));
  };

  const handleReinstatement = async () => {
    if (!selectedStudent || !selectedStudent.id) return;
    setIsSubmitting(true);
    try {
      const oldCourseId = selectedStudent.course || '';
      const newCourseId = formData.course;

      // 1. If course changed, remove student from the old course
      if (oldCourseId && newCourseId !== oldCourseId) {
        const oldCourseRef = doc(db, 'courses', oldCourseId);
        const oldCourseDoc = courses.find(c => c.id === oldCourseId);
        if (oldCourseDoc) {
          const currentIds = oldCourseDoc.studentIds || [];
          const updatedIds = currentIds.filter(id => id !== selectedStudent.studentCode && id !== selectedStudent.id);
          await updateDoc(oldCourseRef, { studentIds: updatedIds });
        }
      }

      // 2. If new course is assigned, add student to the new course
      if (newCourseId) {
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

      // 3. Reactivate account with course, level, shift, and schedule synchronizations
      await firestoreService.update('enrollments', selectedStudent.id, {
        status: 'active',
        freezeReason: '',
        course: formData.course,
        level: formData.level,
        shift: formData.shift,
        schedule: formData.schedule
      });

      // Log the reinstatement status change in statusHistory
      await addDoc(collection(db, 'statusHistory'), {
        studentId: selectedStudent.studentCode,
        oldStatusId: 'frozen',
        newStatusId: 'active',
        reason: 'Reincorporación',
        changedBy: 'admin',
        changedAt: Timestamp.now()
      });

      // 4. Create payment record for reinstatement if amount > 0
      if (formData.amount > 0 || formData.receiptNumber) {
        await firestoreService.create('payments', {
          studentId: selectedStudent.id,
          studentName: `${selectedStudent.firstName} ${selectedStudent.lastName}`,
          year: new Date().getFullYear().toString(),
          monthToPay: 'Reincorporación',
          monthlyAmount: formData.amount,
          monthsInAdvance: 0,
          plannedPaymentDate: new Date().toLocaleDateString('sv-SE'),
          paymentDate: new Date().toLocaleDateString('sv-SE'),
          taxId: '',
          authorizationNumber: formData.authorizationNumber,
          taxName: 'Reincorporación',
          invoiceNumber: formData.invoiceNumber,
          receiptNumber: formData.receiptNumber,
          totalToPay: formData.amount,
          amountReceived: formData.amount,
          change: 0,
          observations: `Reincorporación. Motivo congelamiento previo: ${selectedStudent.freezeReason || 'N/A'}. Nuevo Curso: ${courses.find(c => c.id === formData.course)?.name || formData.course}, Horario: ${formData.schedule}, Nivel: ${formData.level}`,
          createdAt: Timestamp.now(),
          createdBy: profile?.uid || 'unknown'
        });
      }

      setIsModalOpen(false);
      setSelectedStudent(null);
    } catch (error) {
      console.error("Reinstatement error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900">Reincorporación de Alumnos</h2>
          <p className="text-stone-500">Reactiva las cuentas de los alumnos que fueron congelados.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Buscar alumno congelado..." 
            className="pl-10 pr-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux outline-none w-full md:w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-stone-50 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4 border-b border-stone-100">Nombre del Alumno</th>
                <th className="px-6 py-4 border-b border-stone-100">Último Curso</th>
                <th className="px-6 py-4 border-b border-stone-100">CI</th>
                <th className="px-6 py-4 border-b border-stone-100">Motivo Congelamiento</th>
                <th className="px-6 py-4 border-b border-stone-100">Acción</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-stone-50/50 transition-colors border-b border-stone-50 last:border-0">
                  <td className="px-6 py-4">
                    <p className="font-bold text-stone-800">{student.firstName} {student.lastName}</p>
                    <p className="text-[10px] text-stone-400">Cod: {student.studentCode}</p>
                  </td>
                  <td className="px-6 py-4 text-stone-600 font-bold">
                    {courses.find(c => c.id === student.course)?.name || student.course}
                  </td>
                  <td className="px-6 py-4 text-stone-600">{student.idCard}</td>
                  <td className="px-6 py-4 text-stone-500 italic max-w-xs truncate">
                    {student.freezeReason || 'No especificado'}
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => handleReinstatementClick(student)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-200 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Reincorporar
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
            <p className="text-stone-500 italic">No se encontraron alumnos congelados.</p>
          </div>
        )}
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
              className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-10 max-h-[90vh] overflow-y-auto flex flex-col"
            >
              <div className="mb-6">
                <h3 className="text-2xl font-black text-stone-900 uppercase italic tracking-tighter">Reincorporación Académica</h3>
                <p className="text-stone-500 text-xs font-bold uppercase tracking-widest mt-1">
                  Estudiante: <span className="text-bordeaux underline">{selectedStudent.firstName} {selectedStudent.lastName}</span>
                </p>
              </div>

              <div className="space-y-8 flex-1">
                {/* Academic Configuration */}
                <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100 space-y-4">
                  <h4 className="text-[11px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-stone-200/50 pb-2">
                    <Calendar className="w-3.5 h-3.5 text-bordeaux" /> Datos de Asignación / Horarios (Sincronización Kardex)
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1 md:col-span-2">
                      <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest px-1">Asignar Nuevo Curso</label>
                      <select 
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white font-bold outline-none focus:ring-2 focus:ring-bordeaux/20 focus:border-bordeaux appearance-none"
                        value={formData.course}
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

                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest px-1">Nivel</label>
                      <select 
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white font-bold outline-none focus:ring-2 focus:ring-bordeaux/20 focus:border-bordeaux appearance-none"
                        value={formData.level}
                        onChange={e => setFormData({...formData, level: e.target.value})}
                      >
                        <option value="">Seleccionar nivel...</option>
                        {levels.map(lvl => (
                          <option key={lvl.id} value={lvl.name}>{lvl.name}</option>
                        ))}
                        {levels.length === 0 && Array.from(new Set(courses.map(c => c.level).filter(Boolean))).map(lvl => (
                          <option key={lvl} value={lvl}>{lvl}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest px-1">Turno (Shift)</label>
                      <select 
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white font-bold outline-none focus:ring-2 focus:ring-bordeaux/20 focus:border-bordeaux appearance-none"
                        value={formData.shift}
                        onChange={e => setFormData({...formData, shift: e.target.value})}
                      >
                        <option value="">Seleccionar turno...</option>
                        <option value="Mañana">Mañana</option>
                        <option value="Tarde">Tarde</option>
                        <option value="Noche">Noche</option>
                        <option value="Sábados">Sábados</option>
                      </select>
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest px-1">Horario Específico</label>
                      <input 
                        type="text" 
                        placeholder="Ej: 19:00 - 21:00"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white font-bold outline-none focus:ring-2 focus:ring-bordeaux/20 focus:border-bordeaux"
                        value={formData.schedule}
                        onChange={e => setFormData({...formData, schedule: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Billing and Financial info */}
                <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100 space-y-4">
                  <h4 className="text-[11px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-stone-200/50 pb-2">
                    <Clock className="w-3.5 h-3.5 text-bordeaux" /> Datos Financieros / Cargo Reincorporación
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest px-1">Monto Cobrado (Bs.)</label>
                      <input 
                        type="number" 
                        placeholder="0.00"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white font-bold outline-none focus:ring-2 focus:ring-bordeaux/20 focus:border-bordeaux"
                        value={formData.amount === 0 ? '' : formData.amount}
                        onChange={e => setFormData({...formData, amount: parseFloat(e.target.value) || 0})}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest px-1">N° Recibo</label>
                      <input 
                        type="text" 
                        placeholder="Ej: 1004"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white font-bold outline-none focus:ring-2 focus:ring-bordeaux/20 focus:border-bordeaux"
                        value={formData.receiptNumber}
                        onChange={e => setFormData({...formData, receiptNumber: e.target.value})}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest px-1">N° Factura (Opcional)</label>
                      <input 
                        type="text" 
                        placeholder="Ej: 45012"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white font-bold outline-none focus:ring-2 focus:ring-bordeaux/20 focus:border-bordeaux"
                        value={formData.invoiceNumber}
                        onChange={e => setFormData({...formData, invoiceNumber: e.target.value})}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest px-1">Autorización</label>
                      <input 
                        type="text" 
                        placeholder="N° Autorización"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white font-bold outline-none focus:ring-2 focus:ring-bordeaux/20 focus:border-bordeaux"
                        value={formData.authorizationNumber}
                        onChange={e => setFormData({...formData, authorizationNumber: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-stone-100 mt-6 shrink-0">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest text-stone-500 hover:bg-stone-100 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleReinstatement}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white bg-bordeaux/90 hover:bg-bordeaux shadow-lg hover:shadow-bordeaux/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Procesando...' : 'Confirmar Reincorporación'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReinstatementManagement;
