import React, { useState } from 'react';
import { Search, CreditCard, CheckCircle, Snowflake, Users } from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { useEnrollments, usePayments, useCourses } from '../hooks/useCollections';
import { firestoreService } from '../services/firestoreService';
import { Enrollment } from '../types';

const FreezeManagement = () => {
  const { data: enrollments } = useEnrollments();
  const { data: payments } = usePayments();
  const { data: courses } = useCourses();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Enrollment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [freezeReason, setFreezeReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeStudents = enrollments.filter(s => s.status === 'active');

  const filteredStudents = activeStudents.filter(s => 
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.studentCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.idCard.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const hasPendingPayments = (studentId: string) => {
    const studentPayments = payments.filter(p => p.studentId === studentId);
    const currentMonth = new Date().toLocaleString('es-ES', { month: 'long' });
    const capitalizedMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);
    const currentYear = new Date().getFullYear().toString();
    
    const paidThisMonth = studentPayments.some(p => p.monthToPay === capitalizedMonth && p.year === currentYear);
    return !paidThisMonth;
  };

  const handleFreezeClick = (student: Enrollment) => {
    setSelectedStudent(student);
    setFreezeReason('');
    setIsModalOpen(true);
  };

  const handleFreeze = async () => {
    if (!selectedStudent || !selectedStudent.id) return;
    setIsSubmitting(true);
    try {
      await firestoreService.update('enrollments', selectedStudent.id, {
        status: 'frozen',
        freezeReason: freezeReason
      });

      // Log the freezing status change in statusHistory
      await addDoc(collection(db, 'statusHistory'), {
        studentId: selectedStudent.studentCode,
        oldStatusId: selectedStudent.statusId || selectedStudent.status || 'active',
        newStatusId: 'frozen',
        reason: freezeReason,
        changedBy: 'admin',
        changedAt: Timestamp.now()
      });

      setIsModalOpen(false);
      setSelectedStudent(null);
      setFreezeReason('');
    } catch (error) {
      console.error("Freeze error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900">Congelamiento de Cuentas</h2>
          <p className="text-stone-500">Suspende temporalmente las cuentas de los alumnos activos.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Buscar alumno activo..." 
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
                <th className="px-6 py-4 border-b border-stone-100">Modalidad</th>
                <th className="px-6 py-4 border-b border-stone-100">CI</th>
                <th className="px-6 py-4 border-b border-stone-100">Turno</th>
                <th className="px-6 py-4 border-b border-stone-100">Pagos</th>
                <th className="px-6 py-4 border-b border-stone-100">Acción</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredStudents.map((student) => {
                const pending = hasPendingPayments(student.id!);
                return (
                  <tr key={student.id} className="hover:bg-stone-50/50 transition-colors border-b border-stone-50 last:border-0">
                    <td className="px-6 py-4">
                      <p className="font-bold text-stone-800">{student.firstName} {student.lastName}</p>
                      <p className="text-[10px] text-stone-400">Cod: {student.studentCode}</p>
                    </td>
                    <td className="px-6 py-4 text-stone-600 font-medium">
                      {courses.find(c => c.id === student.course)?.name || student.course}
                    </td>
                    <td className="px-6 py-4 text-stone-600">{student.idCard}</td>
                    <td className="px-6 py-4 text-stone-600">{student.shift}</td>
                    <td className="px-6 py-4">
                      {pending ? (
                        <span className="px-2 py-1 bg-red-100 text-red-600 text-[10px] font-bold rounded flex items-center gap-1 w-fit">
                          <CreditCard className="w-3 h-3" />
                          Pendiente
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-600 text-[10px] font-bold rounded flex items-center gap-1 w-fit">
                          <CheckCircle className="w-3 h-3" />
                          Al día
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleFreezeClick(student)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg text-xs font-bold hover:bg-stone-200 transition-all"
                      >
                        <Snowflake className="w-3.5 h-3.5" />
                        Congelar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredStudents.length === 0 && (
          <div className="py-20 text-center">
            <Users className="w-12 h-12 text-stone-200 mx-auto mb-2" />
            <p className="text-stone-500 italic">No se encontraron alumnos activos.</p>
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
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-8"
            >
              <div className="w-16 h-16 bg-bordeaux/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Snowflake className="w-8 h-8 text-bordeaux" />
              </div>
              <h3 className="text-2xl font-bold text-stone-900 text-center mb-2">Congelar Cuenta</h3>
              <p className="text-stone-500 text-center text-sm mb-6">
                Estás a punto de congelar la cuenta de <span className="font-bold text-stone-800">{selectedStudent.firstName} {selectedStudent.lastName}</span>.
              </p>

              <div className="mb-6">
                <label className="block text-xs font-bold text-stone-600 uppercase mb-2">Motivo del congelamiento</label>
                <textarea 
                  rows={3}
                  className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux outline-none resize-none text-sm"
                  placeholder="Escribe el motivo aquí..."
                  value={freezeReason}
                  onChange={e => setFreezeReason(e.target.value)}
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-stone-500 hover:bg-stone-100 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleFreeze}
                  disabled={isSubmitting || !freezeReason}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-bordeaux hover:bg-bordeaux-dark shadow-lg transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Procesando...' : 'Congelar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FreezeManagement;
