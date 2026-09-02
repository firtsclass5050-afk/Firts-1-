import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Trash2, Edit2, Shield, Mail, User as UserIcon, Phone, MapPin, ClipboardList, BookOpen, GraduationCap, ArrowRight, X, UserCog, UserCheck, ShieldCheck } from 'lucide-react';
import { collection, onSnapshot, query, where, doc, updateDoc, deleteDoc, setDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Attendance, ClassReport, Payment } from '../types';
import { useAuth } from '../AuthContext';
import { cn } from '../utils/cn';
import { handleFirestoreError, OperationType } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';

export const UsersManagement = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'teachers' | 'staff'>('all');
  const [search, setSearch] = useState('');
  const [editFormData, setEditFormData] = useState<Partial<UserProfile>>({});

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allFetched = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(allFetched.filter(u => u.role !== 'student'));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    return () => unsubscribe();
  }, []);

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.displayName.toLowerCase().includes(search.toLowerCase()) || 
                         u.email.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'all' || 
                      (activeTab === 'teachers' && u.role === 'teacher') ||
                      (activeTab === 'staff' && ['admin', 'master', 'dir_acad', 'contabilidad', 'secretary'].includes(u.role));
    return matchesSearch && matchesTab;
  });

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      await updateDoc(doc(db, 'users', selectedUser.uid), editFormData);
      setIsEditModalOpen(false);
      setSelectedUser(null);
      alert('Usuario actualizado correctamente.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (confirm('¿Estás seguro de eliminar este usuario?')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'users');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900 tracking-tight">Gestión de Usuarios</h2>
          <p className="text-stone-500 mt-1">Administra perfiles, roles y permisos del sistema.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 flex flex-col md:flex-row items-center gap-6">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300 group-focus-within:text-stone-900 transition-colors" />
          <input 
            type="text"
            placeholder="Buscar por nombre o correo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-6 py-3 bg-stone-50 border-2 border-stone-100 rounded-2xl outline-none focus:bg-white focus:border-stone-900 focus:ring-8 focus:ring-stone-900/5 transition-all text-sm font-bold"
          />
        </div>
        <div className="flex items-center gap-2 p-1 bg-stone-100 rounded-2xl">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'teachers', label: 'Profesores' },
            { id: 'staff', label: 'Personal' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === tab.id ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredUsers.map(u => (
          <div key={u.uid} className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all group">
            <div className="flex items-center justify-between mb-6">
               <div className={cn(
                 "w-12 h-12 rounded-2xl flex items-center justify-center border-2",
                 u.role === 'student' ? 'bg-orange-primary/10 border-orange-primary/20 text-orange-primary' : 
                 u.role === 'teacher' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-bordeaux border-bordeaux text-white'
               )}>
                 {u.photoURL ? <img src={u.photoURL} alt="" className="w-full h-full object-cover rounded-2xl" /> : <UserIcon className="w-6 h-6" />}
               </div>
               <div className="flex gap-1">
                 <button 
                  onClick={() => {
                    setSelectedUser(u);
                    setEditFormData(u);
                    setIsEditModalOpen(true);
                  }}
                  className="p-2 text-stone-400 hover:text-stone-900 transition-colors"
                 >
                   <Edit2 className="w-4 h-4" />
                 </button>
                 {profile?.role === 'master' && (
                    <button onClick={() => handleDeleteUser(u.uid)} className="p-2 text-stone-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                 )}
               </div>
            </div>
            <div className="space-y-2">
               <h3 className="text-lg font-bold text-stone-900 truncate">{u.displayName}</h3>
               <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest mb-4 truncate">{u.email}</p>
            </div>
            <div className="mt-6 pt-6 border-t border-stone-50 flex items-center justify-between">
               <span className={cn(
                 "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em]",
                 u.role === 'student' ? 'bg-orange-primary/10 text-orange-primary' : 
                 u.role === 'teacher' ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-600'
               )}>
                 {u.role}
               </span>
               <UserCheck className="w-4 h-4 text-stone-200 group-hover:text-stone-900 transition-colors" />
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm"
               onClick={() => setIsEditModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden p-10"
            >
              <h3 className="text-2xl font-bold text-stone-900 mb-8">Editar Usuario</h3>
              <form onSubmit={handleUpdateUser} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Nombre Completo</label>
                  <input 
                    type="text"
                    value={editFormData.displayName || ''}
                    onChange={e => setEditFormData({...editFormData, displayName: e.target.value})}
                    className="w-full bg-stone-50 border border-stone-100 rounded-2xl p-4 font-bold outline-none focus:ring-4 focus:ring-stone-900/5 focus:border-stone-900"
                  />
                </div>
                 <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Rol del Sistema</label>
                  <select 
                    value={editFormData.role || ''}
                    onChange={e => setEditFormData({...editFormData, role: e.target.value as any})}
                    className="w-full bg-stone-50 border border-stone-100 rounded-2xl p-4 font-bold outline-none focus:ring-4 focus:ring-stone-900/5 focus:border-stone-900 appearance-none"
                  >
                    <option value="teacher">Profesor</option>
                    <option value="master">Master Admin</option>
                    <option value="admin">Administrador</option>
                    <option value="dir_acad">Dirección Académica</option>
                    <option value="contabilidad">Contabilidad</option>
                    <option value="secretary">Secretaría</option>
                  </select>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-4 text-stone-400 font-black uppercase tracking-widest text-[10px]">Cancelar</button>
                  <button type="submit" className="flex-[2] py-4 bg-bordeaux text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all">Guardar Cambios</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
