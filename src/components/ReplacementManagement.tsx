import React, { useState, useEffect } from 'react';
import { Search, Calendar, User as UserIcon, Plus, FileDown, Clock, ShieldCheck, CheckCircle, X, RefreshCw } from 'lucide-react';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, updateDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { UserProfile, TeacherReplacement, ReplacementRequest, Course } from '../types';
import { useCourses } from '../hooks/useCollections';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils/cn';
import { handleFirestoreError, OperationType } from '../firebase';

export const TeacherReplacementManagement = () => {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [replacements, setReplacements] = useState<TeacherReplacement[]>([]);
  const [requests, setRequests] = useState<ReplacementRequest[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    replacedTeacherId: '',
    replacingTeacherId: '',
    classLevel: '',
    classType: 'Regular',
    schedule: '',
    date: new Date().toLocaleDateString('sv-SE'),
    progressReport: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', 'in', ['teacher', 'master']));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTeachers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'teacherReplacements'),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReplacements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherReplacement)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'teacherReplacements'));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const q = query(
      collection(db, 'replacementRequests'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReplacementRequest)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'replacementRequests'));
    return () => unsubscribe();
  }, []);

  const handleResolveRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'replacementRequests', requestId), {
        status: 'resolved',
        resolvedAt: serverTimestamp(),
        resolvedBy: user?.uid
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'replacementRequests');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const replacingTeacher = teachers.find(t => t.uid === formData.replacingTeacherId);
      const replacedTeacher = teachers.find(t => t.uid === formData.replacedTeacherId);

      const replacementData: Omit<TeacherReplacement, 'id'> = {
        ...formData,
        date: new Date(formData.date),
        replacingTeacherName: replacingTeacher?.displayName || 'Unknown',
        replacedTeacherName: replacedTeacher?.displayName || 'Unknown',
        createdAt: serverTimestamp(),
        createdBy: user?.uid || ''
      };

      await addDoc(collection(db, 'teacherReplacements'), replacementData);
      setFormData({
        replacedTeacherId: '',
        replacingTeacherId: '',
        classLevel: '',
        classType: 'Regular',
        schedule: '',
        date: new Date().toLocaleDateString('sv-SE'),
        progressReport: ''
      });
      alert('Reemplazo registrado exitosamente.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'teacherReplacements');
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadReport = () => {
    const headers = ['Reemplaza', 'Reemplazado', 'Nivel', 'Fecha'];
    const rows = replacements.map(r => [
      r.replacingTeacherName,
      r.replacedTeacherName,
      r.classLevel,
      r.date.toDate().toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reemplazos_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  return (
    <div className="space-y-12 max-w-6xl mx-auto p-4 lg:p-8">
      {/* Requests Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black text-stone-900 tracking-tighter uppercase italic">Solicitudes de Reemplazo</h2>
            <p className="text-stone-400 font-bold text-[10px] uppercase tracking-widest mt-1">Pendientes de gestión académica</p>
          </div>
          <div className="flex items-center gap-2 bg-bordeaux text-white px-4 py-2 rounded-full">
            <RefreshCw className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">{requests.filter(r => r.status === 'pending').length} Pendientes</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {requests.filter(r => r.status === 'pending').map(req => {
            const requester = teachers.find(t => t.uid === req.teacherId);
            return (
              <div key={req.id} className="bg-white p-6 rounded-[2rem] border-2 border-stone-100 shadow-sm relative overflow-hidden group hover:border-stone-900 transition-all">
                <div className="absolute top-0 right-0 w-16 h-16 bg-stone-50 rotate-45 translate-x-8 -translate-y-8" />
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-bordeaux text-white rounded-2xl flex items-center justify-center font-black">
                    {requester?.displayName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-black text-stone-900 uppercase italic text-sm">{requester?.displayName}</h4>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{req.courseName}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-stone-50">
                    <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Fecha:</span>
                    <span className="text-[11px] font-black text-stone-700 italic">{req.date}</span>
                  </div>
                  <div className="py-3 px-4 bg-stone-50 rounded-xl">
                    <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1">Motivo:</p>
                    <p className="text-[11px] font-bold text-stone-600 line-clamp-2 italic">“{req.reason}”</p>
                  </div>
                  <button 
                    onClick={() => handleResolveRequest(req.id!)}
                    className="w-full py-3 bg-bordeaux text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-bordeaux-dark transition-all active:scale-95 shadow-xl"
                  >
                    Marcar como Resuelto
                  </button>
                </div>
              </div>
            );
          })}
          {requests.filter(r => r.status === 'pending').length === 0 && (
            <div className="col-span-full py-16 bg-white rounded-[2rem] border-2 border-dashed border-stone-200 text-center flex flex-col items-center justify-center gap-3">
              <CheckCircle className="w-12 h-12 text-stone-100" />
              <p className="text-stone-300 font-bold uppercase tracking-[0.3em] text-[10px]">No hay solicitudes pendientes</p>
            </div>
          )}
        </div>
      </section>

      {/* Registration Section */}
      <section className="bg-stone-900 rounded-[3rem] p-8 md:p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-48 -mt-48 blur-3xl pointer-events-none" />
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4 space-y-6">
            <h3 className="text-4xl font-serif text-white tracking-tighter uppercase italic font-black">Registrar Reemplazo</h3>
            <p className="text-stone-400 font-bold text-sm leading-relaxed">Completa el formulario para formalizar un reemplazo docente y mantener el historial académico actualizado.</p>
            <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-white font-bold text-xs">Validación Automática</p>
                  <p className="text-stone-500 text-[10px] uppercase font-bold tracking-widest">Sincronizado con Reportes</p>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest px-2">Docente Reemplazado</label>
              <select
                value={formData.replacedTeacherId}
                onChange={e => setFormData({ ...formData, replacedTeacherId: e.target.value })}
                required
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:ring-4 focus:ring-white/10 focus:bg-white/10 transition-all appearance-none"
              >
                <option value="" className="bg-stone-900">Seleccionar...</option>
                {teachers.map(t => <option key={t.uid} value={t.uid} className="bg-stone-900">{t.displayName}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest px-2">Docente que Reemplaza</label>
              <select
                value={formData.replacingTeacherId}
                onChange={e => setFormData({ ...formData, replacingTeacherId: e.target.value })}
                required
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:ring-4 focus:ring-white/10 focus:bg-white/10 transition-all appearance-none"
              >
                <option value="" className="bg-stone-900">Seleccionar...</option>
                {teachers.map(t => <option key={t.uid} value={t.uid} className="bg-stone-900">{t.displayName}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest px-2">Nivel / Curso</label>
              <input
                type="text"
                placeholder="Ej. EF 1B, Inter 3, etc."
                value={formData.classLevel}
                onChange={e => setFormData({ ...formData, classLevel: e.target.value })}
                required
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold placeholder:text-stone-600 outline-none focus:ring-4 focus:ring-white/10 focus:bg-white/10 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest px-2">Horario</label>
              <div className="relative">
                 <Clock className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
                 <input
                   type="text"
                   placeholder="Ej. 15:00 - 16:15"
                   value={formData.schedule}
                   onChange={e => setFormData({ ...formData, schedule: e.target.value })}
                   required
                   className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-white font-bold placeholder:text-stone-600 outline-none focus:ring-4 focus:ring-white/10 focus:bg-white/10 transition-all"
                 />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest px-2">Tipo de Clase</label>
              <select
                value={formData.classType}
                onChange={e => setFormData({ ...formData, classType: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:ring-4 focus:ring-white/10 focus:bg-white/10 transition-all appearance-none"
              >
                {['Regular', 'Acelerado', 'Sábados', 'Privado'].map(t => <option key={t} value={t} className="bg-stone-900">{t}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest px-2">Fecha del Reemplazo</label>
              <div className="relative">
                <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-white font-bold outline-none focus:ring-4 focus:ring-white/10 focus:bg-white/10 transition-all"
                />
              </div>
            </div>

            <div className="md:col-span-2 space-y-2">
               <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest px-2">Avance de Clase (Reporte)</label>
               <textarea
                 rows={3}
                 placeholder="Describe brevemente lo avanzado durante la sesión de reemplazo..."
                 value={formData.progressReport}
                 onChange={e => setFormData({ ...formData, progressReport: e.target.value })}
                 required
                 className="w-full bg-white/5 border border-white/10 rounded-[2rem] px-8 py-6 text-white font-bold placeholder:text-stone-600 outline-none focus:ring-4 focus:ring-white/10 focus:bg-white/10 transition-all scrollbar-hide resize-none shadow-inner"
               />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-12 py-5 bg-white text-stone-900 rounded-2xl font-black uppercase tracking-widest hover:bg-stone-100 transition-all active:scale-95 shadow-2xl flex items-center gap-3"
              >
                {isSubmitting ? (
                   <>
                     <RefreshCw className="w-5 h-5 animate-spin" />
                     Registrando...
                   </>
                ) : (
                  <>
                    <Plus className="w-6 h-6" />
                    Registrar Reemplazo
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* History Section */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div>
             <h3 className="text-3xl font-black text-stone-900 tracking-tighter uppercase italic">Historial de Reemplazos</h3>
             <p className="text-stone-400 font-bold text-[10px] uppercase tracking-widest mt-1">Auditoría completa de movimientos docentes</p>
           </div>
           <button 
             onClick={downloadReport}
             className="flex items-center gap-2 px-6 py-3 bg-stone-100 text-stone-500 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-stone-200 transition-all group"
           >
             <FileDown className="w-4 h-4 group-hover:bounce" />
             Exportar CSV
           </button>
        </div>

        <div className="bg-white rounded-[2.5rem] border-2 border-stone-900 overflow-hidden shadow-2xl overflow-x-auto border-b-8 border-b-black">
          <table className="w-full text-left min-w-[800px]">
             <thead>
               <tr className="bg-stone-900 text-white uppercase text-[9px] font-black tracking-widest">
                 <th className="px-6 py-6 border-r border-stone-700">Docente que Reemplaza</th>
                 <th className="px-6 py-6 border-r border-stone-700">Docente Reemplazado</th>
                 <th className="px-6 py-6 border-r border-stone-700">Nivel / Curso</th>
                 <th className="px-6 py-6 border-r border-stone-700">Horario</th>
                 <th className="px-6 py-6 border-r border-stone-700">Tipo</th>
                 <th className="px-6 py-6 border-r border-stone-700">Fecha</th>
                 <th className="px-6 py-6">Avance</th>
               </tr>
             </thead>
             <tbody className="divide-y-2 divide-stone-50 text-[11px] font-bold text-stone-800">
               {replacements.map(r => (
                 <tr key={r.id} className="hover:bg-stone-50/50 transition-colors">
                   <td className="px-6 py-5 border-r border-stone-50 font-black">{r.replacingTeacherName}</td>
                   <td className="px-6 py-5 border-r border-stone-50 text-stone-400 italic">{r.replacedTeacherName}</td>
                   <td className="px-6 py-5 border-r border-stone-50 uppercase tracking-wider">{r.classLevel}</td>
                   <td className="px-6 py-5 border-r border-stone-50 font-mono tracking-tighter">{r.schedule}</td>
                   <td className="px-6 py-5 border-r border-stone-50">
                     <span className={cn(
                       "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest",
                       r.classType === 'Regular' ? 'bg-emerald-100 text-emerald-700' : 
                       r.classType === 'Acelerado' ? 'bg-indigo-100 text-indigo-700' : 'bg-stone-100 text-stone-600'
                     )}>
                       {r.classType}
                     </span>
                   </td>
                   <td className="px-6 py-5 border-r border-stone-50 whitespace-nowrap text-stone-400">{r.date.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                   <td className="px-6 py-5 italic text-stone-500 max-w-xs truncate" title={r.progressReport}>“{r.progressReport}”</td>
                 </tr>
               ))}
               {replacements.length === 0 && (
                 <tr>
                   <td colSpan={7} className="px-6 py-20 text-center text-stone-300 font-bold uppercase tracking-[0.4em] text-[10px]">Sin historial de reemplazos registrado</td>
                 </tr>
               )}
             </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export const TeacherReplacementSection = () => {
  const { user, profile } = useAuth();
  const { data: courses } = useCourses();
  const [activeTab, setActiveTab] = useState<'assigned' | 'replaced' | 'requests'>('assigned');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [requestedDate, setRequestedDate] = useState(new Date().toLocaleDateString('sv-SE'));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [assignedReplacements, setAssignedReplacements] = useState<TeacherReplacement[]>([]);
  const [myReplacedClasses, setMyReplacedClasses] = useState<TeacherReplacement[]>([]);
  const [myRequests, setMyRequests] = useState<ReplacementRequest[]>([]);

  const teacherCourses = courses.filter(c => c.teacherId === user?.uid);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'teacherReplacements'),
      where('replacingTeacherId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherReplacement));
      data.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      });
      setAssignedReplacements(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'teacherReplacements'));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'teacherReplacements'),
      where('replacedTeacherId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherReplacement));
      data.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      });
      setMyReplacedClasses(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'teacherReplacements'));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'replacementRequests'),
      where('teacherId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReplacementRequest));
      data.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
      setMyRequests(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'replacementRequests'));
    return () => unsubscribe();
  }, [user]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setIsSubmitting(true);
    try {
      const selectedCourse = courses.find(c => c.id === selectedCourseId);
      const requestData: Omit<ReplacementRequest, 'id'> = {
        teacherId: user.uid,
        teacherName: profile.displayName,
        courseId: selectedCourseId,
        courseName: selectedCourse?.name || '---',
        requestedDate,
        reason,
        status: 'pending',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'replacementRequests'), requestData);
      setReason('');
      setSelectedCourseId('');
      setIsModalOpen(false);
      alert('Solicitud enviada. La administración se pondrá en contacto contigo.');
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, 'replacementRequests');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateVal: any) => {
    if (!dateVal) return '---';
    const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-stone-900 tracking-tighter uppercase italic">Control de Reemplazos</h2>
          <p className="text-stone-400 font-bold text-[10px] uppercase tracking-widest mt-1">Gestiona tus coberturas y solicitudes de ausencia</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-8 py-4 bg-bordeaux text-white rounded-2xl font-bold hover:bg-bordeaux-dark transition-all shadow-lg active:scale-95 group"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          Nueva Solicitud de Ausencia
        </button>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-stone-200 gap-8 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('assigned')}
          className={cn(
            "pb-4 text-xs font-black uppercase tracking-widest relative whitespace-nowrap transition-colors",
            activeTab === 'assigned' ? "text-stone-900" : "text-stone-400 hover:text-stone-600"
          )}
        >
          Clases que Reemplazo
          {assignedReplacements.length > 0 && (
            <span className="ml-2 bg-bordeaux text-white text-[9px] px-2 py-0.5 rounded-full font-black animate-pulse">
              {assignedReplacements.length}
            </span>
          )}
          {activeTab === 'assigned' && (
            <motion.div layoutId="activeTeacherTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-bordeaux" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('replaced')}
          className={cn(
            "pb-4 text-xs font-black uppercase tracking-widest relative whitespace-nowrap transition-colors",
            activeTab === 'replaced' ? "text-stone-900" : "text-stone-400 hover:text-stone-600"
          )}
        >
          Quién me Reemplazó
          {myReplacedClasses.length > 0 && (
            <span className="ml-2 bg-stone-100 text-stone-600 text-[9px] px-2 py-0.5 rounded-full font-black">
              {myReplacedClasses.length}
            </span>
          )}
          {activeTab === 'replaced' && (
            <motion.div layoutId="activeTeacherTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-bordeaux" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={cn(
            "pb-4 text-xs font-black uppercase tracking-widest relative whitespace-nowrap transition-colors",
            activeTab === 'requests' ? "text-stone-900" : "text-stone-400 hover:text-stone-600"
          )}
        >
          Mis Solicitudes
          {myRequests.length > 0 && (
            <span className="ml-2 bg-stone-100 text-stone-600 text-[9px] px-2 py-0.5 rounded-full font-black">
              {myRequests.length}
            </span>
          )}
          {activeTab === 'requests' && (
            <motion.div layoutId="activeTeacherTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-bordeaux" />
          )}
        </button>
      </div>

      {/* Tabs Content */}
      <div className="space-y-6">
        {activeTab === 'assigned' ? (
          <div className="space-y-6">
            <div className="bg-stone-50 border-2 border-dashed border-stone-200 rounded-[2.5rem] p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-bordeaux/5 text-bordeaux rounded-2xl flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-stone-800 text-sm">Clases Asignadas</h4>
                  <p className="text-stone-500 text-xs mt-0.5 leading-relaxed">
                    Aquí se listan de manera cronológica todas las clases que la Dirección Académica te ha asignado cubrir en reemplazo de otro docente.
                  </p>
                </div>
              </div>
            </div>

            {assignedReplacements.length > 0 ? (
              <div className="bg-white rounded-[2.5rem] border-2 border-stone-900 shadow-xl overflow-hidden overflow-x-auto border-b-8 border-b-black">
                <table className="w-full text-left min-w-[750px]">
                  <thead>
                    <tr className="bg-stone-900 text-white uppercase text-[9px] font-black tracking-widest">
                      <th className="px-6 py-5 border-r border-stone-700">Fecha</th>
                      <th className="px-6 py-5 border-r border-stone-700">Nivel / Curso</th>
                      <th className="px-6 py-5 border-r border-stone-700">Horario</th>
                      <th className="px-6 py-5 border-r border-stone-700">Tipo de Clase</th>
                      <th className="px-6 py-5 border-r border-stone-700">Docente Reemplazado</th>
                      <th className="px-6 py-5">Contenido / Avance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-stone-100 text-[11px] font-bold text-stone-850">
                    {assignedReplacements.map((r) => (
                      <tr key={r.id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="px-6 py-4 border-r border-stone-50 font-mono tracking-tight text-stone-600 whitespace-nowrap">
                          {formatDate(r.date)}
                        </td>
                        <td className="px-6 py-4 border-r border-stone-50 font-black uppercase text-stone-900">
                          {r.classLevel}
                        </td>
                        <td className="px-6 py-4 border-r border-stone-50 font-mono text-stone-700">
                          {r.schedule}
                        </td>
                        <td className="px-6 py-4 border-r border-stone-50">
                          <span className={cn(
                            "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest",
                            r.classType === 'Regular' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            r.classType === 'Acelerado' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                            r.classType === 'Sábados' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-stone-50 text-stone-600 border border-stone-200'
                          )}>
                            {r.classType}
                          </span>
                        </td>
                        <td className="px-6 py-4 border-r border-stone-50 text-stone-600 italic font-medium">
                          {r.replacedTeacherName}
                        </td>
                        <td className="px-6 py-4 max-w-xs truncate text-stone-500 italic font-medium" title={r.progressReport}>
                          {r.progressReport ? `“${r.progressReport}”` : <span className="text-stone-300">Sin reporte cargado</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-16 bg-white rounded-[2.5rem] border-2 border-dashed border-stone-200 text-center flex flex-col items-center justify-center gap-3">
                <CheckCircle className="w-12 h-12 text-stone-200" />
                <p className="text-stone-400 font-bold uppercase tracking-[0.2em] text-[10px]">No tienes reemplazos asignados en tu registro</p>
              </div>
            )}
          </div>
        ) : activeTab === 'replaced' ? (
          <div className="space-y-6">
            <div className="bg-stone-50 border-2 border-dashed border-stone-200 rounded-[2.5rem] p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-bordeaux/5 text-bordeaux rounded-2xl flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-stone-800 text-sm">¿Quién me Reemplazó?</h4>
                  <p className="text-stone-500 text-xs mt-0.5 leading-relaxed">
                    Aquí puedes ver el historial de las clases tuyas que fueron cubiertas por otros docentes, permitiéndote saber quién te reemplazó.
                  </p>
                </div>
              </div>
            </div>

            {myReplacedClasses.length > 0 ? (
              <div className="bg-white rounded-[2.5rem] border-2 border-stone-900 shadow-xl overflow-hidden overflow-x-auto border-b-8 border-b-black">
                <table className="w-full text-left min-w-[750px]">
                  <thead>
                    <tr className="bg-stone-900 text-white uppercase text-[9px] font-black tracking-widest">
                      <th className="px-6 py-5 border-r border-stone-700">Fecha</th>
                      <th className="px-6 py-5 border-r border-stone-700">Nivel / Curso</th>
                      <th className="px-6 py-5 border-r border-stone-700">Horario</th>
                      <th className="px-6 py-5 border-r border-stone-700">Tipo de Clase</th>
                      <th className="px-6 py-5 border-r border-stone-700">Docente que Reemplazó</th>
                      <th className="px-6 py-5">Contenido / Avance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-stone-100 text-[11px] font-bold text-stone-850">
                    {myReplacedClasses.map((r) => (
                      <tr key={r.id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="px-6 py-4 border-r border-stone-50 font-mono tracking-tight text-stone-600 whitespace-nowrap">
                          {formatDate(r.date)}
                        </td>
                        <td className="px-6 py-4 border-r border-stone-50 font-black uppercase text-stone-900">
                          {r.classLevel}
                        </td>
                        <td className="px-6 py-4 border-r border-stone-50 font-mono text-stone-700">
                          {r.schedule}
                        </td>
                        <td className="px-6 py-4 border-r border-stone-50">
                          <span className={cn(
                            "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest",
                            r.classType === 'Regular' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            r.classType === 'Acelerado' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                            r.classType === 'Sábados' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-stone-50 text-stone-600 border border-stone-200'
                          )}>
                            {r.classType}
                          </span>
                        </td>
                        <td className="px-6 py-4 border-r border-stone-50 text-stone-600 font-bold">
                          {r.replacingTeacherName}
                        </td>
                        <td className="px-6 py-4 max-w-xs truncate text-stone-500 italic font-medium" title={r.progressReport}>
                          {r.progressReport ? `“${r.progressReport}”` : <span className="text-stone-300">Sin reporte cargado</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-16 bg-white rounded-[2.5rem] border-2 border-dashed border-stone-200 text-center flex flex-col items-center justify-center gap-3">
                <CheckCircle className="w-12 h-12 text-stone-200" />
                <p className="text-stone-400 font-bold uppercase tracking-[0.2em] text-[10px]">No tienes registros de clases reemplazadas por otros docentes</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myRequests.map((req) => (
                <div key={req.id} className="bg-white p-6 rounded-[2rem] border-2 border-stone-150 shadow-sm relative overflow-hidden group hover:border-stone-900 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest",
                        req.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      )}>
                        {req.status === 'pending' ? 'Pendiente' : 'Resuelto'}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-stone-400">
                        {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString('es-ES') : ''}
                      </span>
                    </div>

                    <h4 className="font-black text-stone-900 uppercase italic text-sm">{req.courseName}</h4>
                    
                    <div className="mt-4 space-y-2 border-t border-stone-50 pt-3">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-bold text-stone-400 uppercase tracking-wider text-[9px]">Fecha Ausencia:</span>
                        <span className="font-black text-stone-700">{req.requestedDate}</span>
                      </div>
                      <div className="bg-stone-50 p-3 rounded-xl mt-2">
                        <span className="font-bold text-stone-400 uppercase tracking-widest text-[8px] block mb-1">Motivo:</span>
                        <p className="text-stone-600 font-medium italic text-[11px] leading-relaxed">“{req.reason}”</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {myRequests.length === 0 && (
                <div className="col-span-full p-16 bg-white rounded-[2.5rem] border-2 border-dashed border-stone-200 text-center flex flex-col items-center justify-center gap-3">
                  <X className="w-12 h-12 text-stone-200" />
                  <p className="text-stone-400 font-bold uppercase tracking-[0.2em] text-[10px]">No has registrado solicitudes de ausencia</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
               onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden p-10"
            >
              <div className="flex flex-col gap-8">
                <div className="space-y-1">
                   <h3 className="text-3xl font-black text-stone-900 tracking-tighter italic uppercase">Nueva Solicitud</h3>
                   <p className="text-stone-400 font-bold text-[10px] uppercase tracking-widest">Formaliza tu ausencia docente</p>
                </div>

                <form onSubmit={handleRequest} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Curso a Reemplazar</label>
                    <select
                      value={selectedCourseId}
                      onChange={e => setSelectedCourseId(e.target.value)}
                      required
                      className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold text-stone-700 outline-none focus:ring-4 focus:ring-stone-900/5 focus:border-stone-900 transition-all appearance-none"
                    >
                      <option value="">Selecciona un curso...</option>
                      {teacherCourses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.schedule})</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Fecha</label>
                        <input
                          type="date"
                          value={requestedDate}
                          onChange={e => setRequestedDate(e.target.value)}
                          required
                          className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold text-stone-700 outline-none focus:ring-4 focus:ring-stone-900/5 focus:border-stone-900 transition-all"
                        />
                     </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Motivo del Permiso / Reemplazo</label>
                    <textarea 
                      rows={4}
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      required
                      placeholder="Ej. Asuntos personales, enfermedad, capacitación..."
                      className="w-full bg-stone-50 border-2 border-stone-100 rounded-3xl px-8 py-6 font-bold text-stone-700 placeholder:text-stone-300 outline-none focus:ring-4 focus:ring-stone-900/5 focus:border-stone-900 transition-all resize-none shadow-inner"
                    />
                  </div>

                  <div className="pt-4 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-4 text-stone-400 font-black uppercase tracking-widest text-[10px] hover:text-stone-900 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-[2] py-4 bg-bordeaux text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-bordeaux-dark transition-all shadow-xl active:scale-95 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
