import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { User as UserIcon, Edit, Save } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';

export const TeacherProfile = () => {
  const { user, profile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    displayName: profile?.displayName || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
    specialty: profile?.specialty || ''
  });

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), formData);
      alert('Perfil actualizado correctamente');
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-stone-900 tracking-tight">Mi Perfil</h2>
        <p className="text-stone-500 mt-1">Gestiona tu información personal y profesional.</p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden">
        <div className="h-32 bg-bordeaux relative">
          <div className="absolute -bottom-12 left-8">
            <div className="w-24 h-24 rounded-3xl bg-white p-1 shadow-xl">
              <div className="w-full h-full rounded-2xl bg-stone-100 flex items-center justify-center overflow-hidden">
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-10 h-10 text-stone-300" />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-16 p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-2xl font-bold text-stone-900">{profile?.displayName}</h3>
              <p className="text-stone-500 font-bold capitalize">{profile?.role}</p>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-200 text-stone-600 font-bold text-sm hover:bg-stone-50 transition-all"
            >
              <Edit className="w-4 h-4" />
              {isEditing ? 'Cancelar' : 'Editar Perfil'}
            </button>
          </div>

          <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Nombre Completo</label>
              <input 
                type="text" 
                value={formData.displayName}
                onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                disabled={!isEditing}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux outline-none transition-all disabled:bg-stone-50 disabled:text-stone-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Correo Electrónico</label>
              <input 
                type="email" 
                value={formData.email}
                disabled
                className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-stone-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Teléfono</label>
              <input 
                type="tel" 
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                disabled={!isEditing}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux outline-none transition-all disabled:bg-stone-50 disabled:text-stone-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Especialidad</label>
              <input 
                type="text" 
                value={formData.specialty}
                onChange={e => setFormData({ ...formData, specialty: e.target.value })}
                disabled={!isEditing}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux outline-none transition-all disabled:bg-stone-50 disabled:text-stone-500"
              />
            </div>

            {isEditing && (
              <div className="md:col-span-2 pt-4">
                <button
                  type="submit"
                  className="w-full bg-bordeaux text-white py-4 rounded-2xl font-bold shadow-lg shadow-bordeaux/20 hover:bg-bordeaux-dark transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  Guardar Cambios
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
