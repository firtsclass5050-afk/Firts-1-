import React, { useState, useEffect } from 'react';
import { Plus, ShieldCheck, RefreshCw } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Announcement } from '../types';
import { useAuth } from '../AuthContext';
import { handleFirestoreError, OperationType } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';

export const AnnouncementsManagement = () => {
  const { user, profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAnn, setNewAnn] = useState({ title: '', content: '', targetRole: 'all' as 'all' | 'teacher' | 'admin', type: 'General' });

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'announcements'));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && profile && announcements.length > 0) {
      const lastRead = profile.lastReadAnnouncementsAt?.toDate() || new Date(0);
      const hasUnread = announcements.some(a => 
        (a.targetRole === 'all' || a.targetRole === 'admin') && 
        (a.createdAt?.toDate() || new Date(0)) > lastRead
      );
      
      if (hasUnread) {
        const updateLastRead = async () => {
          try {
            await updateDoc(doc(db, 'users', user.uid), {
              lastReadAnnouncementsAt: serverTimestamp()
            });
          } catch (error) {
            console.error("Error updating lastReadAnnouncementsAt:", error);
          }
        };
        updateLastRead();
      }
    }
  }, [user, profile, announcements]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'announcements'), {
        ...newAnn,
        authorId: profile?.uid,
        authorName: profile?.displayName,
        createdAt: serverTimestamp(),
        date: serverTimestamp() // Also set date for backward compatibility
      });
      setIsModalOpen(false);
      setNewAnn({ title: '', content: '', targetRole: 'all', type: 'General' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'announcements');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-stone-900">Anuncios</h2>
          <p className="text-stone-500">Comunicados oficiales para la comunidad.</p>
        </div>
        {(profile?.role === 'admin' || profile?.role === 'teacher' || profile?.role === 'master' || profile?.role === 'dir_acad' || profile?.role === 'secretary') && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-orange-primary text-white px-4 py-2 rounded-xl font-bold hover:bg-orange-light transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nuevo Anuncio
          </button>
        )}
      </div>

      <div className="space-y-4">
        {announcements.map((ann) => (
          <div key={ann.id} className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="px-2 py-1 bg-stone-100 text-stone-500 text-[10px] font-bold uppercase rounded tracking-widest mb-2 inline-block">
                  Para: {ann.targetRole}
                </span>
                <h3 className="text-2xl font-bold text-stone-800">{ann.title}</h3>
              </div>
              <span className="text-sm text-stone-400">{ann.createdAt?.toDate().toLocaleString()}</span>
            </div>
            <p className="text-stone-600 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
            <div className="mt-6 pt-6 border-t border-stone-50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-bordeaux/10 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-bordeaux" />
              </div>
              <div>
                <p className="text-sm font-bold text-stone-800">{ann.authorName}</p>
                <p className="text-xs text-stone-400">Autor del comunicado</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for New Announcement */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-8"
            >
              <h3 className="text-2xl font-bold text-stone-900 mb-6">Nuevo Anuncio</h3>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Título</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none"
                    value={newAnn.title}
                    onChange={e => setNewAnn({...newAnn, title: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Tipo de Comunicado</label>
                  <select 
                    required
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none"
                    value={newAnn.type}
                    onChange={e => setNewAnn({...newAnn, type: e.target.value})}
                  >
                    <option value="General">General</option>
                    <option value="Académico">Académico</option>
                    <option value="Administrativo">Administrativo</option>
                    <option value="Urgente">Urgente</option>
                    <option value="Evento">Evento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Dirigido a</label>
                  <select 
                    required
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none"
                    value={newAnn.targetRole}
                    onChange={e => setNewAnn({...newAnn, targetRole: e.target.value as any})}
                  >
                    <option value="all">Todos</option>
                    <option value="teacher">Profesores</option>
                    <option value="admin">Administrativos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Contenido</label>
                  <textarea 
                    required
                    rows={6}
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none resize-none"
                    value={newAnn.content}
                    onChange={e => setNewAnn({...newAnn, content: e.target.value})}
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 rounded-xl font-bold text-stone-600 hover:bg-stone-100 transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 bg-orange-primary text-white px-4 py-2 rounded-xl font-bold hover:bg-orange-light transition-colors">Publicar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
