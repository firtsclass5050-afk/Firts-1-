import React, { useState } from 'react';
import { Search, Edit, Users, Calendar } from 'lucide-react';
import { query, collection, where, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { useEnrollments, useCourses } from '../hooks/useCollections';
import { firestoreService } from '../services/firestoreService';
import { Enrollment } from '../types';

const DateManagement = () => {
  const { data: enrollments } = useEnrollments();
  const { data: courses } = useCourses();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Enrollment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dates, setDates] = useState({
    startDate: ''
  });

  const filteredStudents = enrollments.filter(s => 
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.studentCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.idCard.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditClick = (student: Enrollment) => {
    setSelectedStudent(student);
    const rawDate = student.startDate || '';
    const formattedDate = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
    setDates({
      startDate: formattedDate
    });
    setIsModalOpen(true);
  };

  const handleUpdateDates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedStudent.id) return;
    setIsSubmitting(true);
    try {
      // 1. Update Enrollment
      await firestoreService.update('enrollments', selectedStudent.id, {
        startDate: dates.startDate
      });

      // 2. Update existing payments for this student to reflect their planned date based on the new start date
      const paymentsQuery = query(collection(db, 'payments'), where('studentId', '==', selectedStudent.id));
      const paymentsSnapshot = await getDocs(paymentsQuery);
      
      const monthsList = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      
      const updatePromises = paymentsSnapshot.docs.map(paymentDoc => {
        const paymentData = paymentDoc.data();
        let day = '10'; // Fallback
        if (dates.startDate) {
          const parts = dates.startDate.split('-');
          if (parts.length === 3) {
            day = parts[2]; // Day of new start date
          }
        }
        
        const cleanMonth = (paymentData.monthToPay || '').trim().toLowerCase();
        const monthIndex = monthsList.findIndex(m => m.toLowerCase() === cleanMonth);
        const year = paymentData.year || new Date().getFullYear().toString();
        
        let newPlannedDate = dates.startDate; // Fallback to start date directly if month index is not found
        if (monthIndex !== -1) {
          const formattedMonth = String(monthIndex + 1).padStart(2, '0');
          newPlannedDate = `${year}-${formattedMonth}-${day}`;
        }
        
        return firestoreService.update('payments', paymentDoc.id, {
          plannedPaymentDate: newPlannedDate
        });
      });
      await Promise.all(updatePromises);

      setIsModalOpen(false);
      setSelectedStudent(null);
    } catch (error) {
      console.error("Date update error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900">Cambio de Fechas</h2>
          <p className="text-stone-500">Administra la fecha de inicio de los alumnos.</p>
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

      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-stone-50 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4 border-b border-stone-100">Nombre del Alumno</th>
                <th className="px-6 py-4 border-b border-stone-100">Modalidad Actual</th>
                <th className="px-6 py-4 border-b border-stone-100">Fecha Inicio</th>
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
                  <td className="px-6 py-4 text-stone-600 font-bold">
                    {courses.find(c => c.id === student.course)?.name || student.course}
                  </td>
                  <td className="px-6 py-4 text-stone-600">
                    {student.startDate ? student.startDate.split('-').reverse().join('/') : 'No definida'}
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => handleEditClick(student)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg text-xs font-bold hover:bg-stone-200 transition-all"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Editar Fecha
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
                <Calendar className="w-8 h-8 text-bordeaux" />
              </div>
              <h3 className="text-2xl font-bold text-stone-900 text-center mb-2">Editar Fecha de Inicio</h3>
              <p className="text-stone-500 text-center text-sm mb-6">
                Actualiza la fecha de inicio para <span className="font-bold text-stone-800">{selectedStudent.firstName} {selectedStudent.lastName}</span>.
              </p>

              <form onSubmit={handleUpdateDates} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-600 uppercase mb-2">Fecha de Inicio</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux outline-none transition-all"
                    value={dates.startDate}
                    onChange={e => setDates({...dates, startDate: e.target.value})}
                    required
                  />
                </div>

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
                    className="flex-1 bg-bordeaux text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-bordeaux/20 hover:bg-bordeaux-dark transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
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

export default DateManagement;
