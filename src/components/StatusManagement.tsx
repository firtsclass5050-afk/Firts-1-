import React, { useState } from 'react';
import { Plus, UserPlus, Search, Trash2, Edit2, ShieldCheck, UserCheck, X, History } from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, updateDoc, Timestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useStatuses, useEnrollments, useStatusHistory } from '../hooks/useCollections';
import { handleFirestoreError, OperationType } from '../firebase';
import { StudentStatus, Enrollment } from '../types';
import { cn } from '../utils/cn';

const CreateStatus = ({ onBack }: { onBack: () => void }) => {
  const { data: statuses, loading } = useStatuses();
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', fee: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateDoc(doc(db, 'statuses', isEditing), {
          ...formData,
          createdAt: Timestamp.now()
        });
      } else {
        await addDoc(collection(db, 'statuses'), {
          ...formData,
          createdAt: Timestamp.now()
        });
      }
      setFormData({ name: '', fee: 0 });
      setIsEditing(null);
      alert('Guardado exitosamente');
      onBack();
    } catch (error) {
      handleFirestoreError(error, isEditing ? OperationType.UPDATE : OperationType.CREATE, 'statuses');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (status: StudentStatus) => {
    setIsEditing(status.id);
    setFormData({ name: status.name, fee: status.fee });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este estatus?')) return;
    try {
      await deleteDoc(doc(db, 'statuses', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'statuses');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-stone-900 tracking-tight uppercase">Crear Estatus</h3>
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Define las categorías de estatus para los estudiantes.</p>
        </div>
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
          <X className="w-6 h-6 text-stone-400" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[2rem] shadow-xl border border-stone-100 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Nombre del Estatus</label>
          <input 
            type="text" 
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ej: Mensualidad, Media Beca"
            className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all font-mono"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Monto / Fee (BOB)</label>
          <input 
            type="number" 
            value={formData.fee}
            onChange={e => setFormData({ ...formData, fee: Number(e.target.value) })}
            className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all font-mono"
            required
          />
        </div>
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="bg-stone-900 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-[10px] hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50"
        >
          {isSubmitting ? 'Procesando...' : isEditing ? 'Guardar Cambios' : 'Crear Estatus'}
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-stone-400 font-bold uppercase tracking-widest text-[10px]">Cargando estatus...</div>
        ) : statuses.map(status => (
          <div key={status.id} className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm flex flex-col gap-4 group hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-black text-stone-900 uppercase italic">{status.name}</h4>
                <p className="text-orange-primary font-mono font-bold text-sm">{status.fee} BOB</p>
              </div>
              <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-stone-300" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button 
                onClick={() => handleEdit(status)} 
                className="flex items-center justify-center gap-2 bg-stone-50 hover:bg-stone-900 hover:text-white text-stone-600 py-3 rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest"
              >
                <Edit2 className="w-3 h-3" />
                Editar
              </button>
              <button 
                onClick={() => handleDelete(status.id)} 
                className="flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-500 py-3 rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest"
              >
                <Trash2 className="w-3 h-3" />
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AssignStatus = ({ onBack }: { onBack: () => void }) => {
  const { data: enrollments, loading: loadingEnrollments } = useEnrollments();
  const { data: statuses } = useStatuses();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  const [selectedStatusId, setSelectedStatusId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredEnrollments = enrollments.filter(e => 
    e.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.studentCode?.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 5);

  const handleAssign = async () => {
    if (!selectedEnrollment || !selectedStatusId) return;

    setIsSubmitting(true);
    try {
      const oldStatusId = selectedEnrollment.statusId || '';
      
      // Update enrollment
      await updateDoc(doc(db, 'enrollments', selectedEnrollment.id!), {
        statusId: selectedStatusId,
        updatedAt: Timestamp.now()
      });

      // Update user profile
      await setDoc(doc(db, 'users', selectedEnrollment.studentCode), {
        statusId: selectedStatusId
      }, { merge: true });

      // Create history record
      await addDoc(collection(db, 'statusHistory'), {
        studentId: selectedEnrollment.studentCode,
        oldStatusId,
        newStatusId: selectedStatusId,
        changedBy: 'admin', // Ideally replaced by actual admin name/id
        changedAt: Timestamp.now()
      });

      setSelectedEnrollment(null);
      setSelectedStatusId('');
      setSearchTerm('');
      alert('Guardado exitosamente');
      onBack();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'enrollments');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-stone-900 tracking-tight uppercase">Asignar Estatus</h3>
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Asocia un estatus a un estudiante específico.</p>
        </div>
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
          <X className="w-6 h-6 text-stone-400" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o código..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border-2 border-stone-100 rounded-2xl font-bold outline-none focus:border-stone-900 shadow-sm transition-all"
            />
          </div>

          <div className="space-y-3">
            {searchTerm && filteredEnrollments.map(enrollment => (
              <button 
                key={enrollment.id}
                onClick={() => setSelectedEnrollment(enrollment)}
                className={cn(
                  "w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between text-left",
                  selectedEnrollment?.id === enrollment.id 
                    ? "bg-dark shadow-lg border-dark text-white" 
                    : "bg-white border-stone-50 hover:border-stone-200 text-stone-900"
                )}
              >
                <div>
                  <p className="font-black uppercase italic">{enrollment.firstName} {enrollment.lastName}</p>
                  <p className={cn("text-[10px] font-bold uppercase tracking-widest", selectedEnrollment?.id === enrollment.id ? "text-white/60" : "text-stone-400")}>
                    {enrollment.studentCode} • {enrollment.level}
                  </p>
                </div>
                <UserCheck className={cn("w-5 h-5", selectedEnrollment?.id === enrollment.id ? "text-white" : "text-stone-200")} />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {selectedEnrollment ? (
            <div className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-xl space-y-8 animate-in zoom-in-95 duration-300">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center font-black text-stone-900">
                     {selectedEnrollment.firstName.charAt(0)}
                  </div>
                  <div>
                     <h4 className="font-black text-stone-900 uppercase tracking-tight">{selectedEnrollment.firstName} {selectedEnrollment.lastName}</h4>
                     <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                        {selectedEnrollment.studentCode} • Estatus Actual: {statuses.find(s => s.id === selectedEnrollment.statusId)?.name || 'Ninguno'}
                     </p>
                  </div>
               </div>

               <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Seleccionar Nuevo Estatus</label>
                  <div className="grid grid-cols-1 gap-3">
                    {statuses.map(status => (
                      <button 
                        key={status.id}
                        onClick={() => setSelectedStatusId(status.id)}
                        className={cn(
                          "p-4 rounded-xl border-2 transition-all font-bold text-sm flex items-center justify-between",
                          selectedStatusId === status.id 
                            ? "bg-orange-primary/10 border-orange-primary text-orange-primary shadow-sm" 
                            : "bg-stone-50 border-stone-50 text-stone-600 hover:border-stone-200"
                        )}
                      >
                        {status.name}
                        <span className="text-xs font-mono">{status.fee} BOB</span>
                      </button>
                    ))}
                  </div>
               </div>

               <button 
                  onClick={handleAssign}
                  disabled={!selectedStatusId || isSubmitting}
                  className="w-full bg-stone-900 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 mt-4"
               >
                  {isSubmitting ? 'Asignando...' : 'Confirmar Asignación'}
               </button>
            </div>
          ) : (
            <div className="h-full min-h-[300px] bg-stone-50/50 border-2 border-dashed border-stone-200 rounded-[2.5rem] flex flex-col items-center justify-center p-12 text-center">
              <UserPlus className="w-12 h-12 text-stone-200 mb-4" />
              <p className="text-stone-400 font-bold uppercase tracking-widest text-[10px]">Selecciona un estudiante para asignarle un estatus.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const HistoryView = ({ onBack }: { onBack: () => void }) => {
  const { data: history, loading: loadingHistory } = useStatusHistory();
  const { data: statuses } = useStatuses();
  const { data: enrollments } = useEnrollments();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-stone-900 tracking-tight uppercase">Historial de Cambios</h3>
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Listado cronológico de actualizaciones de estatus.</p>
        </div>
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
          <X className="w-6 h-6 text-stone-400" />
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-stone-100 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-100">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Estudiante</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Estatus Anterior</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Nuevo Estatus</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Fecha</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {loadingHistory ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-stone-400 font-bold uppercase tracking-widest text-[10px]">Cargando historial...</td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-stone-400 font-bold uppercase tracking-widest text-[10px]">No hay registros de cambios.</td>
                </tr>
              ) : history.map(item => {
                const student = enrollments.find(e => e.studentCode === item.studentId);
                const oldStatus = statuses.find(s => s.id === item.oldStatusId);
                const newStatus = statuses.find(s => s.id === item.newStatusId);
                return (
                  <tr key={item.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-black text-stone-900 uppercase italic text-sm">{student ? `${student.firstName} ${student.lastName}` : item.studentId}</p>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{item.studentId}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-stone-400 line-through text-xs font-bold uppercase tracking-widest">{oldStatus?.name || 'Vacio'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-orange-primary/10 text-orange-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-primary/20">
                        {newStatus?.name || 'Desconocido'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-mono text-[10px] font-bold text-stone-600">
                        {item.changedAt?.toDate().toLocaleString()}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] font-bold text-stone-900 uppercase tracking-widest">{item.changedBy}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const StatusManagement = () => {
  const [view, setView] = useState<'menu' | 'create' | 'assign' | 'history'>('menu');

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      {view === 'menu' && (
        <div className="space-y-12 animate-in fade-in duration-700">
          <div className="text-center space-y-4">
            <h2 className="text-5xl font-black text-stone-900 tracking-tighter uppercase italic">Módulo de Estatus</h2>
            <p className="text-stone-400 font-bold tracking-widest uppercase text-xs">Administración y asignación de categorías académicas.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <button 
              onClick={() => setView('create')}
              className="group bg-white p-12 rounded-[3rem] border-2 border-stone-100 shadow-xl hover:border-stone-900 hover:shadow-2xl transition-all text-center space-y-6"
            >
              <div className="w-20 h-20 bg-stone-50 rounded-[2rem] flex items-center justify-center mx-auto group-hover:bg-stone-900 group-hover:text-white transition-all transform group-hover:-rotate-12">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-stone-900 uppercase italic">Crear Estatus</h3>
                <p className="text-stone-400 text-xs font-bold uppercase tracking-widest leading-relaxed">Configura nuevas categorías, becas <br /> y mensualidades especiales.</p>
              </div>
            </button>

            <button 
              onClick={() => setView('assign')}
              className="group bg-white p-12 rounded-[3rem] border-2 border-stone-100 shadow-xl hover:border-stone-900 hover:shadow-2xl transition-all text-center space-y-6"
            >
              <div className="w-20 h-20 bg-stone-50 rounded-[2rem] flex items-center justify-center mx-auto group-hover:bg-orange-primary group-hover:text-white transition-all transform group-hover:rotate-12">
                <UserPlus className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-stone-900 uppercase italic">Asignar Estatus</h3>
                <p className="text-stone-400 text-xs font-bold uppercase tracking-widest leading-relaxed">Vincula a cada estudiante con su <br /> categoría de pago correspondiente.</p>
              </div>
            </button>

            <button 
              onClick={() => setView('history')}
              className="group bg-white p-12 rounded-[3rem] border-2 border-stone-100 shadow-xl hover:border-stone-900 hover:shadow-2xl transition-all text-center space-y-6"
            >
              <div className="w-20 h-20 bg-stone-50 rounded-[2rem] flex items-center justify-center mx-auto group-hover:bg-dark group-hover:text-white transition-all transform group-hover:-rotate-6">
                <History className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-stone-900 uppercase italic">Historial</h3>
                <p className="text-stone-400 text-xs font-bold uppercase tracking-widest leading-relaxed">Consulta el registro de todos los <br /> cambios de estatus realizados.</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {view === 'create' && <CreateStatus onBack={() => setView('menu')} />}
      {view === 'assign' && <AssignStatus onBack={() => setView('menu')} />}
      {view === 'history' && <HistoryView onBack={() => setView('menu')} />}
    </div>
  );
};
