import React, { useState } from 'react';
import { Search, Users, User as UserIcon, X, RefreshCw, ShieldCheck, MapPin, Phone, GraduationCap, Clock, CreditCard, History } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { useUsers, useCourses, useEnrollments } from '../hooks/useCollections';
import { UserProfile, Course, Enrollment } from '../types';

export const InfoItem = ({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) => (
  <div className="space-y-1">
    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{label}</p>
    <div className="flex items-center gap-2">
      {icon}
      <p className="text-sm font-semibold text-stone-700">{value || 'N/A'}</p>
    </div>
  </div>
);

const StudentsList = () => {
  const { data: allUsers } = useUsers();
  const { data: courses } = useCourses();
  const { data: enrollments } = useEnrollments();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<UserProfile | null>(null);
  const [currentEnrollment, setCurrentEnrollment] = useState<Enrollment | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [scheduleChanges, setScheduleChanges] = useState<any[]>([]);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);

  const students = allUsers.filter(u => u.role === 'student');

  const handleViewProfile = async (student: UserProfile) => {
    setSelectedStudentForProfile(student);
    setLoadingProfile(true);
    setScheduleChanges([]);
    setStatusHistory([]);
    try {
      let enrollmentData: Enrollment | null = null;
      if (student.studentCode) {
        const q = query(collection(db, 'enrollments'), where('studentCode', '==', student.studentCode));
        const snap = await getDocs(q);
        if (!snap.empty) {
          enrollmentData = { id: snap.docs[0].id, ...snap.docs[0].data() } as Enrollment;
        }
      }
      
      if (!enrollmentData && (student.email || student.studentCode)) {
        const q = query(collection(db, 'enrollments'), where('studentEmail', '==', student.email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          enrollmentData = { id: snap.docs[0].id, ...snap.docs[0].data() } as Enrollment;
        }
      }
      
      setCurrentEnrollment(enrollmentData);

      // Fetch schedule changes (by uid, code, or enrollment id)
      const scList: any[] = [];
      const scQueries = [
        getDocs(query(collection(db, 'scheduleChanges'), where('studentId', '==', student.uid))),
        student.studentCode ? getDocs(query(collection(db, 'scheduleChanges'), where('studentId', '==', student.studentCode))) : null,
        enrollmentData?.id ? getDocs(query(collection(db, 'scheduleChanges'), where('studentId', '==', enrollmentData.id))) : null
      ].filter(Boolean);

      const scSnapshots = await Promise.all(scQueries);
      scSnapshots.forEach(snap => {
        if (snap) {
          snap.docs.forEach(doc => {
            const item = { id: doc.id, type: 'schedule', ...doc.data() };
            if (!scList.some(sc => sc.id === item.id)) {
              scList.push(item);
            }
          });
        }
      });

      // Fetch status history (by code, or uid)
      const shList: any[] = [];
      const shQueries = [
        student.studentCode ? getDocs(query(collection(db, 'statusHistory'), where('studentId', '==', student.studentCode))) : null,
        getDocs(query(collection(db, 'statusHistory'), where('studentId', '==', student.uid)))
      ].filter(Boolean);

      const shSnapshots = await Promise.all(shQueries);
      shSnapshots.forEach(snap => {
        if (snap) {
          snap.docs.forEach(doc => {
            const item = { id: doc.id, type: 'status', ...doc.data() };
            if (!shList.some(sh => sh.id === item.id)) {
              shList.push(item);
            }
          });
        }
      });

      setScheduleChanges(scList);
      setStatusHistory(shList);
    } catch (err) {
      console.error("Error fetching student profile details:", err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.studentCode && s.studentCode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStudentCourses = (student: UserProfile) => {
    return courses.filter(c => 
      c.studentIds?.includes(student.uid) || 
      (student.studentCode && c.studentIds?.includes(student.studentCode))
    );
  };

  const combinedHistory = [
    ...scheduleChanges.map(sc => {
      const date = sc.createdAt?.toDate ? sc.createdAt.toDate() : (sc.createdAt ? new Date(sc.createdAt) : new Date());
      return {
        id: sc.id,
        timestamp: date,
        type: 'schedule',
        title: 'Cambio de Horario • Nivel 🔄',
        details: `Cambio de horario a ${sc.newSchedule} (${sc.newShift || 'N/A'})` + 
                 (sc.oldLevel !== sc.newLevel ? `, nivel cambió de ${sc.oldLevel || 'N/A'} a ${sc.newLevel}` : '') +
                 (sc.paidForChange ? `. Pago realizado: ${sc.paymentAmount} Bs ${sc.receiptNumber ? `(Recibo: ${sc.receiptNumber})` : ''}` : ''),
        author: sc.createdBy || 'Sistema'
      };
    }),
    ...statusHistory.map(sh => {
      const date = sh.changedAt?.toDate ? sh.changedAt.toDate() : (sh.changedAt ? new Date(sh.changedAt) : new Date());
      let actionTitle = 'Cambio de Estatus 📋';
      let detailsText = `Estatus cambiado de "${sh.oldStatusId || 'Ninguno'}" a "${sh.newStatusId}"`;

      if (sh.newStatusId === 'frozen') {
        actionTitle = 'Congelamiento de Matrícula ❄️';
        detailsText = `Se congeló el perfil del estudiante. Motivo: ${sh.reason || 'No especificado'}`;
      } else if (sh.reason === 'Reincorporación' && sh.newStatusId === 'active') {
        actionTitle = 'Reincorporación Estudiantil ⚡';
        detailsText = `Se reincorporó al estudiante de forma activa.`;
      } else if (sh.newStatusId === 'active' && sh.oldStatusId === 'frozen') {
        actionTitle = 'Reincorporación Estudiantil ⚡';
        detailsText = `Se reactivó al estudiante de un estado de congelamiento previo.`;
      }

      return {
        id: sh.id,
        timestamp: date,
        type: 'status',
        title: actionTitle,
        details: detailsText,
        author: sh.changedBy || 'Sistema'
      };
    })
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900">Alumnos</h2>
          <p className="text-stone-500">Listado completo de estudiantes inscritos.</p>
        </div>
        <div className="relative">
          <input 
            type="text" 
            placeholder="Buscar alumno..." 
            className="pl-10 pr-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux outline-none w-full md:w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Users className="w-5 h-5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStudents.map((student) => {
          const studentCourses = getStudentCourses(student);
          const studentEnrollment = enrollments.find(e => 
            (student.studentCode && e.studentCode === student.studentCode) || 
            (student.email && e.studentEmail === student.email)
          );
          const isFrozen = studentEnrollment?.status === 'frozen';
          
          return (
            <motion.div 
              layout
              key={student.uid} 
              className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-orange-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                  {student.photoURL ? (
                    <img src={student.photoURL} alt={student.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-8 h-8 text-orange-primary" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-stone-800 text-lg truncate leading-tight">{student.displayName}</h3>
                    {isFrozen && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-50 text-blue-600 uppercase tracking-widest border border-blue-100 animate-pulse">
                        ❄️ Congelado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 truncate">{student.email}</p>
                </div>
              </div>
              
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Cursos Inscritos</p>
                  <div className="flex flex-wrap gap-2">
                    {studentCourses.map(c => (
                      <span key={c.id} className="px-2 py-1 bg-bordeaux/5 text-bordeaux text-[10px] font-bold rounded border border-bordeaux/10">
                        {c.name}
                      </span>
                    ))}
                    {studentCourses.length === 0 && (
                      <span className="text-xs text-stone-400 italic">Sin cursos asignados</span>
                    )}
                  </div>
                </div>

                {isFrozen && studentEnrollment?.freezeReason && (
                  <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 text-[11px] text-blue-700">
                    <span className="font-black text-[9px] uppercase tracking-wider block text-blue-500 mb-0.5">Motivo de Congelamiento:</span>
                    <p className="font-medium italic">"{studentEnrollment.freezeReason}"</p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-stone-50 flex justify-between items-center">
                <span className="text-xs text-stone-400">ID: {student.uid.slice(0, 8)}...</span>
                <button 
                  onClick={() => handleViewProfile(student)}
                  className="text-orange-primary text-xs font-bold hover:underline"
                >
                  Ver Perfil
                </button>
              </div>
            </motion.div>
          );
        })}
        {filteredStudents.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-stone-200">
            <Users className="w-12 h-12 text-stone-200 mx-auto mb-2" />
            <p className="text-stone-500 italic">No se encontraron alumnos.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedStudentForProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" 
              onClick={() => setSelectedStudentForProfile(null)} 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-stone-50 p-6 border-b border-stone-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-primary/10 flex items-center justify-center overflow-hidden">
                    {selectedStudentForProfile.photoURL ? (
                      <img src={selectedStudentForProfile.photoURL} alt={selectedStudentForProfile.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-6 h-6 text-orange-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-stone-900">{selectedStudentForProfile.displayName}</h3>
                    <p className="text-xs text-stone-500">{selectedStudentForProfile.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedStudentForProfile(null)}
                  className="p-2 hover:bg-stone-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-stone-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {loadingProfile ? (
                  <div className="h-64 flex flex-col items-center justify-center gap-4">
                    <RefreshCw className="w-10 h-10 text-orange-primary animate-spin" />
                    <p className="text-stone-400 font-medium">Cargando información de inscripción...</p>
                  </div>
                ) : currentEnrollment ? (
                  <div className="space-y-8">
                    {currentEnrollment.status === 'frozen' ? (
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">❄️</span>
                            <div>
                              <p className="text-sm font-bold text-blue-900 uppercase">Inscripción Congelada / Suspendida</p>
                              <p className="text-xs text-blue-700 font-medium">Fecha de Inscripción: {currentEnrollment.createdAt?.toDate().toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Código Alumno</p>
                            <p className="text-lg font-black text-blue-900">{currentEnrollment.studentCode}</p>
                          </div>
                        </div>

                        {currentEnrollment.freezeReason && (
                          <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100/80">
                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Detalle / Motivo de Congelamiento:</p>
                            <p className="text-sm text-blue-900 italic font-medium">"{currentEnrollment.freezeReason}"</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <ShieldCheck className="w-6 h-6 text-emerald-600" />
                          <div>
                            <p className="text-sm font-bold text-emerald-900">Inscripción Activa</p>
                            <p className="text-xs text-emerald-700">Fecha: {currentEnrollment.createdAt?.toDate().toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Código Alumno</p>
                          <p className="text-lg font-black text-emerald-900">{currentEnrollment.studentCode}</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <section className="space-y-4">
                        <h4 className="flex items-center gap-2 text-xs font-bold text-stone-400 uppercase tracking-widest border-b border-stone-100 pb-2">
                          <UserIcon className="w-4 h-4" /> Datos Personales
                        </h4>
                        <div className="grid grid-cols-1 gap-4">
                          <InfoItem label="Nombre Completo" value={`${currentEnrollment.firstName} ${currentEnrollment.lastName}`} />
                          <div className="grid grid-cols-2 gap-4">
                            <InfoItem label="Fecha de Nacimiento" value={currentEnrollment.birthDate} />
                            <InfoItem label="C.I. / Pasaporte" value={`${currentEnrollment.idCard} ${currentEnrollment.issuedIn}`} />
                          </div>
                          <InfoItem label="Ocupación" value={currentEnrollment.occupation} />
                          <InfoItem label="Nivel Educativo" value={currentEnrollment.educationLevel} />
                        </div>
                      </section>

                      <section className="space-y-4">
                        <h4 className="flex items-center gap-2 text-xs font-bold text-stone-400 uppercase tracking-widest border-b border-stone-100 pb-2">
                          <Phone className="w-4 h-4" /> Contacto y Ubicación
                        </h4>
                        <div className="grid grid-cols-1 gap-4">
                          <div className="grid grid-cols-2 gap-4">
                            <InfoItem label="Celular" value={currentEnrollment.cellphone} />
                            <InfoItem label="Tel. Referencia" value={currentEnrollment.referencePhone || 'N/A'} />
                          </div>
                          <InfoItem label="Email de Inscripción" value={currentEnrollment.studentEmail} />
                          <InfoItem label="Dirección" value={currentEnrollment.address} icon={<MapPin className="w-3 h-3 text-stone-400" />} />
                        </div>
                      </section>

                      <section className="space-y-4">
                        <h4 className="flex items-center gap-2 text-xs font-bold text-stone-400 uppercase tracking-widest border-b border-stone-100 pb-2">
                          <GraduationCap className="w-4 h-4" /> Detalles del Curso
                        </h4>
                        <div className="grid grid-cols-1 gap-4">
                          <InfoItem label="Modalidad" value={currentEnrollment.modality} />
                          <div className="grid grid-cols-2 gap-4">
                            <InfoItem label="Nivel" value={currentEnrollment.level} />
                            <InfoItem label="Turno" value={currentEnrollment.shift} />
                          </div>
                          {currentEnrollment.schedule && (
                            <InfoItem label="Horario específico" value={currentEnrollment.schedule} icon={<Clock className="w-3 h-3 text-stone-400" />} />
                          )}
                          <InfoItem label="Curso específico" value={courses.find(c => c.id === currentEnrollment.course)?.name || currentEnrollment.course} />
                        </div>
                      </section>

                      <section className="space-y-4">
                        <h4 className="flex items-center gap-2 text-xs font-bold text-stone-400 uppercase tracking-widest border-b border-stone-100 pb-2">
                          <CreditCard className="w-4 h-4" /> Información Administrativa
                        </h4>
                        <div className="grid grid-cols-1 gap-4">
                          <div className="grid grid-cols-2 gap-4">
                            <InfoItem label="Monto" value={`Bs. ${currentEnrollment.amount}`} />
                            <InfoItem label="Fecha de Inscripción" value={currentEnrollment.enrollmentDate || currentEnrollment.createdAt?.toDate().toLocaleDateString() || 'N/A'} />
                          </div>
                          <InfoItem label="Sucursal" value={currentEnrollment.branch} />
                          <InfoItem label="¿Cómo nos conoció?" value={currentEnrollment.referralSource} />
                        </div>
                      </section>
                    </div>

                    {!currentEnrollment.isAdult && (
                      <section className="mt-8 pt-8 border-t border-stone-100">
                        <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Información del Tutor</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-stone-50 p-6 rounded-3xl">
                          <InfoItem label="Nombre del Tutor" value={currentEnrollment.parentName || 'N/A'} />
                          <InfoItem label="Celular del Tutor" value={currentEnrollment.parentCellphone || 'N/A'} />
                          <InfoItem label="Email del Tutor" value={currentEnrollment.parentEmail || 'N/A'} />
                        </div>
                      </section>
                    )}

                    {currentEnrollment.comments && (
                      <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl">
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">Observaciones</p>
                        <p className="text-sm text-amber-900 italic leading-relaxed">{currentEnrollment.comments}</p>
                      </div>
                    )}

                    {/* Historial Académico */}
                    <section className="mt-8 pt-8 border-t border-stone-100">
                      <h4 className="flex items-center gap-2 text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">
                        <History className="w-4 h-4" /> Historial Académico
                      </h4>
                      {combinedHistory.length > 0 ? (
                        <div className="relative border-l border-stone-100 pl-6 ml-3 space-y-6">
                          {combinedHistory.map((item, index) => (
                            <div key={item.id || index} className="relative">
                              {/* Bullet node */}
                              <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-white border-2 border-orange-primary flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-primary" />
                              </div>
                              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100/80 space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                  <h5 className="font-bold text-sm text-stone-800 flex items-center gap-1.5">
                                    {item.title}
                                  </h5>
                                  <span className="text-[10px] font-bold text-stone-400 whitespace-nowrap">
                                    {item.timestamp.toLocaleString('es-ES', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                                <p className="text-xs text-stone-600 leading-relaxed font-medium">
                                  {item.details}
                                </p>
                                <div className="flex items-center justify-end text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                                  Realizado por: {item.author}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-stone-50 p-6 rounded-3xl border border-dashed border-stone-200 text-center">
                          <History className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                          <p className="text-xs text-stone-500 italic">No se encontraron registros en el historial académico de este estudiante.</p>
                        </div>
                      )}
                    </section>
                  </div>
                ) : (
                  <div className="py-24 text-center">
                    <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="w-10 h-10 text-stone-300" />
                    </div>
                    <h3 className="text-lg font-bold text-stone-800">No se encontró el registro de inscripción</h3>
                    <p className="text-stone-500 max-w-sm mx-auto mt-1">Este alumno puede haber sido creado manualmente sin pasar por el formulario de inscripción.</p>
                  </div>
                )}
              </div>

              <div className="bg-stone-50 p-6 border-t border-stone-100 flex justify-end shrink-0">
                <button 
                  onClick={() => setSelectedStudentForProfile(null)}
                  className="px-8 py-3 bg-bordeaux text-white rounded-2xl font-bold hover:bg-bordeaux-dark transition-all shadow-lg"
                >
                  Cerrar Perfil
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudentsList;
