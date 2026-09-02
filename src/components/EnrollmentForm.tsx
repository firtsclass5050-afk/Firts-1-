import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Course, StudentStatus, Enrollment, Level } from '../types';
import { useAuth } from '../AuthContext';
import { handleFirestoreError, OperationType } from '../firebase';
import { cn } from '../lib/utils';

export const EnrollmentForm = () => {
  const { profile } = useAuth();

  const calculateAge = (dobString: string): string => {
    if (!dobString) return '';
    const today = new Date();
    const birthDate = new Date(dobString);
    let ageVal = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      ageVal--;
    }
    return ageVal >= 0 ? ageVal.toString() : '';
  };

  const [courses, setCourses] = useState<Course[]>([]);
  const [statuses, setStatuses] = useState<StudentStatus[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [formData, setFormData] = useState({
    studentCode: '',
    firstName: '',
    lastName: '',
    birthDate: '',
    age: '',
    isAdult: true,
    idCard: '',
    issuedIn: '',
    occupation: '',
    educationLevel: '',
    cellphone: '',
    parentCellphone: '',
    referencePhone: '',
    address: '',
    studentEmail: '',
    parentEmail: '',
    parentName: '',
    shift: '',
    modality: '',
    level: '',
    course: '',
    isPromotion: false,
    promotionType: '',
    statusId: '',
    amount: 0,
    startDate: new Date().toLocaleDateString('sv-SE'),
    branch: '',
    referralSource: '',
    comments: '',
    enrollmentDate: new Date().toLocaleDateString('sv-SE')
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const unsubscribeCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'courses'));

    const unsubscribeStatuses = onSnapshot(collection(db, 'statuses'), (snapshot) => {
      setStatuses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentStatus)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'statuses'));

    const unsubscribeLevels = onSnapshot(collection(db, 'levels'), (snapshot) => {
      setLevels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Level)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'levels'));

    return () => {
      unsubscribeCourses();
      unsubscribeStatuses();
      unsubscribeLevels();
    };
  }, []);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.studentCode) newErrors.studentCode = 'El Código de estudiante es requerido.';
    if (formData.firstName.length < 2) newErrors.firstName = 'El nombre debe tener al menos 2 caracteres.';
    if (formData.lastName.length < 2) newErrors.lastName = 'El apellido debe tener al menos 2 caracteres.';
    if (!formData.birthDate) newErrors.birthDate = 'La fecha de nacimiento es requerida.';
    if (formData.idCard.length < 5) newErrors.idCard = 'La cédula de identidad parece muy corta.';
    if (!formData.issuedIn) newErrors.issuedIn = 'Selecciona un departamento.';
    if (!/^\d{7,8}$/.test(formData.cellphone)) newErrors.cellphone = 'Número de celular inválido (debe tener 7-8 dígitos).';
    if (formData.address.length < 5) newErrors.address = 'La dirección es muy corta.';
    if (!formData.shift) newErrors.shift = 'Selecciona un turno.';
    if (!formData.modality) newErrors.modality = 'Selecciona una modalidad.';
    if (!formData.level) newErrors.level = 'El nivel es requerido.';
    if (!formData.course) newErrors.course = 'El curso es requerido.';
    if (formData.amount < 0) newErrors.amount = 'El monto no puede ser negativo.';
    if (!formData.branch) newErrors.branch = 'Selecciona una sucursal.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      // 1. Create the enrollment document
      const enrollmentData = {
        ...formData,
        status: 'active',
        startDate: formData.startDate,
        enrollmentDate: formData.enrollmentDate,
        createdAt: Timestamp.now(),
        createdBy: profile?.uid || 'unknown'
      };

      // Ensure all required fields for security rules are present
      const requiredFields = ['studentCode', 'firstName', 'lastName', 'birthDate', 'isAdult', 'idCard', 'issuedIn', 'cellphone', 'address', 'shift', 'modality', 'level', 'course', 'amount', 'branch'];
      requiredFields.forEach(field => {
        if (enrollmentData[field as keyof typeof enrollmentData] === undefined) {
          if (field === 'isAdult') {
            (enrollmentData as any)[field] = true;
          } else if (field === 'amount') {
            (enrollmentData as any)[field] = 0;
          } else {
            (enrollmentData as any)[field] = '';
          }
        }
      });

      const enrollmentRef = await addDoc(collection(db, 'enrollments'), enrollmentData);

      // 2. Directly enroll the student in the selected course if a course is selected
      if (formData.course) {
        const selectedCourse = courses.find(c => c.id === formData.course || c.name === formData.course);
        if (selectedCourse) {
          const courseRef = doc(db, 'courses', selectedCourse.id);
          const currentStudentIds = selectedCourse.studentIds || [];
          // We use studentCode as a fallback if uid is not available yet
          const studentIdToLink = formData.studentCode; 
          
          if (!currentStudentIds.includes(studentIdToLink)) {
            await updateDoc(courseRef, {
              studentIds: [...currentStudentIds, studentIdToLink]
            });
          }
        }
      }

      // 3. Create a student user profile so they appear in all system functionalities
      const userRef = doc(db, 'users', formData.studentCode);
      await setDoc(userRef, {
        uid: formData.studentCode,
        email: formData.studentEmail || `${formData.studentCode}@example.com`,
        displayName: `${formData.firstName} ${formData.lastName}`,
        role: 'student',
        studentCode: formData.studentCode,
        phone: formData.cellphone,
        idCard: formData.idCard
      }, { merge: true });

      setSuccessMessage('Inscripción registrada con éxito.');
      setFormData({
        studentCode: '',
        firstName: '',
        lastName: '',
        birthDate: '',
        age: '',
        isAdult: true,
        idCard: '',
        issuedIn: '',
        occupation: '',
        educationLevel: '',
        cellphone: '',
        parentCellphone: '',
        referencePhone: '',
        address: '',
        studentEmail: '',
        parentEmail: '',
        parentName: '',
        shift: '',
        modality: '',
        level: '',
        course: '',
        isPromotion: false,
        promotionType: '',
        statusId: '',
        amount: 0,
        startDate: new Date().toLocaleDateString('sv-SE'),
        branch: '',
        referralSource: '',
        comments: '',
        enrollmentDate: new Date().toLocaleDateString('sv-SE')
      });
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);

    } catch (error) {
      console.error("Error submitting enrollment:", error);
      setErrorMessage('Ocurrió un error al procesar la inscripción. Por favor revisa los datos e intenta nuevamente.');
      handleFirestoreError(error, OperationType.CREATE, 'enrollments');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-stone-100 overflow-hidden">
        <div className="bg-white p-8 md:p-12 border-b border-stone-100 relative overflow-hidden">
          <div className="flex items-center gap-4 mb-4">
             <div className="w-12 h-12 bg-bordeaux rounded-xl flex items-center justify-center text-white font-black italic">FC</div>
             <div>
                <h2 className="text-3xl font-black italic uppercase tracking-tighter text-stone-900 leading-none">Formulario de Inscripción</h2>
                <p className="text-stone-400 font-bold tracking-widest uppercase text-[10px] mt-2">Registra los datos de un nuevo estudiante en el sistema.</p>
             </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-16">
          {/* Section 1: Personal Data */}
          <section className="space-y-8">
            <div className="space-y-1">
               <h3 className="text-lg font-black text-stone-900 tracking-tight">Datos Personales</h3>
               <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Información básica del estudiante.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2 outline-none">Código de estudiante</label>
                <input 
                  type="text" 
                  value={formData.studentCode} 
                  onChange={e => setFormData({...formData, studentCode: e.target.value})}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all"
                />
                {errors.studentCode && <p className="text-[10px] text-rose-500 font-bold px-2">{errors.studentCode}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Nombres</label>
                <input 
                  type="text" 
                  value={formData.firstName} 
                  onChange={e => setFormData({...formData, firstName: e.target.value})}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all"
                />
                {errors.firstName && <p className="text-[10px] text-rose-500 font-bold px-2">{errors.firstName}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Apellidos</label>
                <input 
                  type="text" 
                  value={formData.lastName} 
                  onChange={e => setFormData({...formData, lastName: e.target.value})}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all"
                />
                {errors.lastName && <p className="text-[10px] text-rose-500 font-bold px-2">{errors.lastName}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Fecha de Nacimiento</label>
                <input 
                  type="date" 
                  value={formData.birthDate} 
                  onChange={e => {
                    const dob = e.target.value;
                    const computedAge = calculateAge(dob);
                    const ageNum = parseInt(computedAge, 10);
                    const isAdult = isNaN(ageNum) ? true : ageNum >= 18;
                    setFormData({
                      ...formData,
                      birthDate: dob,
                      age: computedAge,
                      isAdult
                    });
                  }}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all"
                />
                {errors.birthDate && <p className="text-[10px] text-rose-500 font-bold px-2">{errors.birthDate}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Edad</label>
                <input 
                  type="number" 
                  value={formData.age} 
                  onChange={e => {
                    const enteredAge = e.target.value;
                    const ageNum = parseInt(enteredAge, 10);
                    const isAdult = isNaN(ageNum) ? true : ageNum >= 18;
                    setFormData({
                      ...formData,
                      age: enteredAge,
                      isAdult
                    });
                  }}
                  placeholder="Ej: 20"
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Fecha de Inscripción</label>
                <input 
                  type="date" 
                  value={formData.enrollmentDate} 
                  onChange={e => setFormData({...formData, enrollmentDate: e.target.value})}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all"
                />
              </div>

              <div className="space-y-1 flex flex-col justify-end">
                <label className="flex items-center gap-3 p-4 bg-stone-50 border-2 border-stone-100 rounded-2xl font-bold cursor-pointer hover:bg-stone-100 transition-all">
                  <input 
                    type="checkbox" 
                    checked={formData.isAdult} 
                    onChange={e => setFormData({...formData, isAdult: e.target.checked})}
                    className="w-5 h-5 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest text-stone-900">¿Mayor de Edad?</span>
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Cédula de Identidad</label>
                <input 
                  type="text" 
                  value={formData.idCard} 
                  onChange={e => setFormData({...formData, idCard: e.target.value})}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all"
                />
                {errors.idCard && <p className="text-[10px] text-rose-500 font-bold px-2">{errors.idCard}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Expedido en</label>
                <select 
                  value={formData.issuedIn} 
                  onChange={e => setFormData({...formData, issuedIn: e.target.value})}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all appearance-none"
                >
                  <option value="">Selecciona...</option>
                  <option value="LP">La Paz</option>
                  <option value="CB">Cochabamba</option>
                  <option value="SC">Santa Cruz</option>
                  <option value="OR">Oruro</option>
                  <option value="PT">Potosí</option>
                  <option value="CH">Chuquisaca</option>
                  <option value="TJ">Tarija</option>
                  <option value="BN">Beni</option>
                  <option value="PA">Pando</option>
                  <option value="EX">Extranjero</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Profesión/Ocupación</label>
                <input 
                  type="text" 
                  value={formData.occupation} 
                  onChange={e => setFormData({...formData, occupation: e.target.value})}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Nivel de Estudios</label>
                <input 
                  type="text" 
                  value={formData.educationLevel} 
                  onChange={e => setFormData({...formData, educationLevel: e.target.value})}
                  placeholder="Ej: Bachiller, Universitario"
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Contact Info */}
          <section className="space-y-8">
            <div className="space-y-1">
               <h3 className="text-lg font-black text-stone-900 tracking-tight">Información de Contacto y Familia</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Celular</label>
                <input 
                  type="tel" 
                  value={formData.cellphone} 
                  onChange={e => setFormData({...formData, cellphone: e.target.value})}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all"
                />
                {errors.cellphone && <p className="text-[10px] text-rose-500 font-bold px-2">{errors.cellphone}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Celular del Padre/Tutor</label>
                <input 
                  type="tel" 
                  value={formData.parentCellphone} 
                  onChange={e => setFormData({...formData, parentCellphone: e.target.value})}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Teléfono de Referencia</label>
                <input 
                  type="tel" 
                  value={formData.referencePhone} 
                  onChange={e => setFormData({...formData, referencePhone: e.target.value})}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all"
                />
              </div>
              <div className="space-y-1 lg:col-span-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Dirección</label>
                <input 
                  type="text" 
                  value={formData.address} 
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Email del Alumno</label>
                <input 
                  type="email" 
                  value={formData.studentEmail} 
                  onChange={e => setFormData({...formData, studentEmail: e.target.value})}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Email del Padre/Tutor</label>
                <input 
                  type="email" 
                  value={formData.parentEmail} 
                  onChange={e => setFormData({...formData, parentEmail: e.target.value})}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Nombre del Padre/Tutor</label>
                <input 
                  type="text" 
                  value={formData.parentName} 
                  onChange={e => setFormData({...formData, parentName: e.target.value})}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all"
                />
              </div>
            </div>
          </section>

          {/* Section 3: Enrollment Details */}
          <section className="space-y-8">
            <div className="space-y-1">
               <h3 className="text-lg font-black text-stone-900 tracking-tight">Detalles de la Inscripción</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Turno</label>
                <select 
                  value={formData.shift} 
                  onChange={e => setFormData({...formData, shift: e.target.value})}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all appearance-none"
                >
                  <option value="">Selecciona...</option>
                  <option value="Mañana">Mañana</option>
                  <option value="Tarde">Tarde</option>
                  <option value="Noche">Noche</option>
                  <option value="Sábados">Sábados</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Modalidad</label>
                <select 
                  value={formData.modality} 
                  onChange={e => setFormData({...formData, modality: e.target.value})}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all appearance-none"
                >
                  <option value="">Selecciona...</option>
                  <option value="Presencial">Presencial</option>
                  <option value="Virtual">Virtual</option>
                  <option value="Híbrido">Híbrido</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Nivel</label>
                <select 
                  value={formData.level} 
                  onChange={e => setFormData({...formData, level: e.target.value})}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all appearance-none"
                >
                  <option value="">Selecciona un nivel...</option>
                  {levels.map(lvl => (
                    <option key={lvl.id} value={lvl.name}>{lvl.name}</option>
                  ))}
                  {levels.length === 0 && Array.from(new Set(courses.map(c => c.level).filter(Boolean))).map(lvl => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Curso</label>
                <select 
                  value={formData.course} 
                  onChange={e => {
                    const selectedId = e.target.value;
                    const foundCourse = courses.find(c => c.id === selectedId);
                    if (foundCourse) {
                      let detectedShift = '';
                      const schedLower = (foundCourse.schedule || '').toLowerCase();
                      if (foundCourse.type === 'Sábados' || schedLower.includes('sab') || schedLower.includes('sáb')) {
                        detectedShift = 'Sábados';
                      } else if (schedLower.includes('noche') || /1[89]:|20:|21:/.test(schedLower)) {
                        detectedShift = 'Noche';
                      } else if (schedLower.includes('tarde') || /1[34567]:/.test(schedLower)) {
                        detectedShift = 'Tarde';
                      } else if (schedLower.includes('mañana') || schedLower.includes('manana') || /0[789]:|10:|11:|12:/.test(schedLower)) {
                        detectedShift = 'Mañana';
                      }

                      let detectedModality = 'Presencial';
                      if ((foundCourse.type as string) === 'Virtual' || foundCourse.name.toLowerCase().includes('virtual')) {
                        detectedModality = 'Virtual';
                      } else if ((foundCourse.type as string) === 'Híbrido' || foundCourse.name.toLowerCase().includes('hibrid') || foundCourse.name.toLowerCase().includes('híbrid')) {
                        detectedModality = 'Híbrido';
                      }

                      setFormData(prev => ({
                        ...prev,
                        course: selectedId,
                        level: foundCourse.level || prev.level,
                        shift: detectedShift || prev.shift,
                        modality: detectedModality || prev.modality
                      }));
                    } else {
                      setFormData(prev => ({ ...prev, course: selectedId }));
                    }
                  }}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all appearance-none"
                >
                  <option value="">Selecciona un curso...</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.level} - {c.schedule})</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2 block">¿Promoción?</label>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, isPromotion: !formData.isPromotion, promotionType: !formData.isPromotion ? formData.promotionType : ''})}
                  className={cn(
                    "w-full rounded-2xl p-4 font-bold transition-all border-2 flex items-center justify-center gap-2",
                    formData.isPromotion 
                      ? "bg-bordeaux border-bordeaux text-white shadow-lg" 
                      : "bg-stone-50 border-stone-100 text-stone-400"
                  )}
                >
                  {formData.isPromotion ? 'Sí, Aplicar Promo' : 'No'}
                </button>
              </div>

              {formData.isPromotion && (
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Tipo de Promoción</label>
                  <input 
                    type="text" 
                    value={formData.promotionType} 
                    onChange={e => setFormData({...formData, promotionType: e.target.value})}
                    placeholder="Ej: Promo 2x1, Descuento 15%, Media Beca"
                    className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Estatus del Alumno</label>
                <select 
                  value={formData.statusId} 
                  onChange={e => {
                    const selectedStatus = statuses.find(s => s.id === e.target.value);
                    setFormData({
                      ...formData, 
                      statusId: e.target.value,
                      amount: selectedStatus ? selectedStatus.fee : formData.amount
                    });
                  }}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all appearance-none"
                >
                  <option value="">Seleccionar estatus...</option>
                  {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Monto</label>
                <input 
                  type="number" 
                  value={formData.amount} 
                  onChange={e => setFormData({...formData, amount: Number(e.target.value)})}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Fecha de Pago</label>
                <input 
                  type="date" 
                  value={formData.startDate} 
                  onChange={e => setFormData({...formData, startDate: e.target.value})}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Sucursal</label>
                <select 
                  value={formData.branch} 
                  onChange={e => setFormData({...formData, branch: e.target.value})}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all appearance-none"
                >
                  <option value="">Selecciona...</option>
                  <option value="Santa Cruz">Santa Cruz</option>
                  <option value="Sopocachi">Sopocachi</option>
                  <option value="Central">Central</option>
                  <option value="Sur">Sur</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">¿Cómo se enteró?</label>
                <select 
                  value={formData.referralSource} 
                  onChange={e => setFormData({...formData, referralSource: e.target.value})}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all appearance-none"
                >
                  <option value="">Selecciona...</option>
                  <option value="Redes sociales">Redes sociales</option>
                  <option value="Recomendación">Recomendación</option>
                  <option value="Publicidad">Publicidad Exterior</option>
                  <option value="Página Web">Página Web</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Comentarios</label>
              <textarea 
                value={formData.comments} 
                onChange={e => setFormData({...formData, comments: e.target.value})}
                placeholder="Añade cualquier comentario adicional aquí..."
                rows={4}
                className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold outline-none focus:border-stone-900 transition-all resize-none"
              />
            </div>
          </section>

          <div className="pt-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border-t border-stone-100 mt-12">
            <div className="space-y-1">
               <p className="text-xs text-stone-900 font-black uppercase tracking-widest italic">First Classe English Institute</p>
               <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Sistema de Gestión Académica v2.0</p>
            </div>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="px-12 py-5 bg-bordeaux text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 group"
            >
              {isSubmitting ? 'Procesando...' : (
                <>
                  Registrar Inscripción
                  <span className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center group-hover:translate-x-1 transition-transform">→</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
