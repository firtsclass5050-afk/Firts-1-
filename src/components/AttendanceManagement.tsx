import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ChevronLeft, Save, Clock, BookOpen, GraduationCap, ArrowRight, ClipboardList, Download } from 'lucide-react';
import { collection, onSnapshot, query, where, getDocs, updateDoc, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Course, UserProfile, Attendance, StudentStatus } from '../types';
import { cn } from '../utils/cn';
import { LOGO_URL } from '../constants';
import { handleFirestoreError, OperationType } from '../firebase';

interface MonthlyAttendanceListProps {
  course: Course;
  onBack: () => void;
}

export const MonthlyAttendanceList = ({ course, onBack }: MonthlyAttendanceListProps) => {
  const { user } = useAuth();
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [allUsersList, setAllUsersList] = useState<UserProfile[]>([]);
  const [activeStudents, setActiveStudents] = useState<UserProfile[]>([]);
  const [scheduleChanges, setScheduleChanges] = useState<any[]>([]);
  const [studentStatuses, setStudentStatuses] = useState<StudentStatus[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, Record<string, string>>>({});
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dynamicTeacherName, setDynamicTeacherName] = useState('');

  useEffect(() => {
    if (!course.teacherId) {
      setDynamicTeacherName('');
      return;
    }
    const unsubscribeTeacher = onSnapshot(doc(db, 'users', course.teacherId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDynamicTeacherName(data.displayName || '');
      } else {
        setDynamicTeacherName('');
      }
    }, (error) => {
      console.error("Error fetching teacher profile:", error);
    });
    return () => unsubscribeTeacher();
  }, [course.teacherId]);

  const statusOptions = [
    { value: 'present', label: '✓', color: 'text-stone-900' },
    { value: 'late', label: 'L', color: 'text-amber-600' },
    { value: 'absent', label: 'A', color: 'text-red-600' },
    { value: 'permission', label: 'P', color: 'text-blue-600' },
    { value: 'holiday', label: 'H', color: 'text-indigo-600' },
    { value: 'withdrawn', label: 'D', color: 'text-stone-400' },
    { value: 'blocked', label: 'B', color: 'text-red-700 font-bold' },
    { value: 'changed_schedule', label: 'C', color: 'text-rose-600 italic font-bold' }
  ];

  const greekStatusOptions = [
    { value: 'alpha', label: 'α' },
    { value: 'beta', label: 'β' },
    { value: 'gamma', label: 'γ' },
    { value: 'epsilon', label: 'ε' },
    { value: 'delta', label: 'δ' },
    { value: 'omega', label: 'Ω' },
    { value: 'psi', label: 'ψ' },
    { value: 'fli', label: 'φ' }
  ];

  const months = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
  ];

  const daysInMonth = 30;
  const daysHeader = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  useEffect(() => {
    const fetchStudents = async () => {
      const q = query(collection(db, 'users'), where('role', '==', 'student'));
      const unsubscribeUser = onSnapshot(q, (snapshot) => {
        const allStudents = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        setAllUsersList(allStudents);
        const enrolledStudents = allStudents.filter(s => 
          course.studentIds?.includes(s.uid) || 
          (s.studentCode && course.studentIds?.includes(s.studentCode))
        );
        setActiveStudents(enrolledStudents);
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

      const unsubscribeStatuses = onSnapshot(collection(db, 'statuses'), (snapshot) => {
        setStudentStatuses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentStatus)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'statuses'));

      return () => {
        unsubscribeUser();
        unsubscribeStatuses();
      };
    };
    fetchStudents();
  }, [course]);

  useEffect(() => {
    // We subscribe to all schedule changes to be able to trace transitions between courses
    const qChanges = query(collection(db, 'scheduleChanges'));
    const unsubscribeChanges = onSnapshot(qChanges, (snapshot) => {
      const changesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setScheduleChanges(changesList);
    }, (error) => console.error("Error fetching schedule changes:", error));

    return () => unsubscribeChanges();
  }, []);

  useEffect(() => {
    const list: any[] = [];
    const queryYear = selectedYear;
    const queryMonth = selectedMonth;

    allUsersList.forEach(student => {
      // Check if student currently has this course assigned
      const isCurrentlyEnrolled = course.studentIds?.includes(student.uid) || 
                                  (student.studentCode && course.studentIds?.includes(student.studentCode));

      // Fetch and sort all schedule changes for this student
      const studentChanges = scheduleChanges.filter(sc => 
        sc.studentId === student.uid || 
        (student.studentCode && sc.studentId === student.studentCode)
      );

      studentChanges.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeA - timeB;
      });

      let belongsToThisCourse = isCurrentlyEnrolled;
      let showAsTransferred = false;
      let transferDetailRecord = null;

      // Chronologically trace each change to determine if they belonged to this course during the selected month/year
      for (const sc of studentChanges) {
        if (!sc.createdAt) continue;
        const scDate = sc.createdAt.toDate();
        const scYear = scDate.getFullYear();
        const scMonth = scDate.getMonth();

        const changeIsAfterSelected = (scYear > queryYear) || (scYear === queryYear && scMonth > queryMonth);
        const changeIsSameSelected = (scYear === queryYear && scMonth === queryMonth);

        if (sc.oldCourseId === course.id) {
          if (changeIsAfterSelected) {
            // Still in this course for the selected month (the change is in the future)
            belongsToThisCourse = true;
          } else if (changeIsSameSelected) {
            // Changed this month. Keep on old course list, marked with schedule change flag
            belongsToThisCourse = true;
            showAsTransferred = true;
            transferDetailRecord = sc;
          } else {
            // Already transferred out in a previous month
            belongsToThisCourse = false;
          }
        } else if (sc.newCourseId === course.id) {
          if (changeIsAfterSelected) {
            // Not in this course yet for the selected month (the change is in the future)
            belongsToThisCourse = false;
          } else {
            // Transferred into this course in the past or during this month
            belongsToThisCourse = true;
          }
        }
      }

      if (belongsToThisCourse) {
        const studentObj: any = { ...student };
        if (showAsTransferred) {
          studentObj.isTransferred = true;
          studentObj.transferDetail = transferDetailRecord;
        }
        list.push(studentObj);
      }
    });

    // Sort alphabetically by name for professional-grade formatting
    list.sort((a, b) => {
      const nameA = (a.displayName || '').trim().toLowerCase();
      const nameB = (b.displayName || '').trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });

    setStudents(list);
  }, [activeStudents, scheduleChanges, selectedMonth, selectedYear, allUsersList, course.id, course.studentIds]);

  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true);
      const startOfMonth = new Date(selectedYear, selectedMonth, 1);
      const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0);
      
      const q = query(
        collection(db, 'attendance'),
        where('courseId', '==', course.id),
        where('date', '>=', startOfMonth),
        where('date', '<=', endOfMonth)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const map: Record<string, Record<string, string>> = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data() as Attendance;
          const dateStr = data.date.toDate().getDate().toString();
          if (!map[dateStr]) map[dateStr] = {};
          data.records.forEach(r => {
            map[dateStr][r.studentId] = r.status;
          });
        });
        setAttendanceMap(map);
        setLoading(false);
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'attendance'));
      return unsubscribe;
    };
    fetchAttendance();
  }, [course.id, selectedMonth, selectedYear]);

  // Handle Auto-save
  useEffect(() => {
    if (!hasChanges || isSaving) return;

    setAutoSaveStatus('idle');
    const timer = setTimeout(() => {
      handleSave();
    }, 3000); // Auto-save after 3 seconds of inactivity

    return () => clearTimeout(timer);
  }, [attendanceMap, hasChanges]);

  const getDayLabel = (day: number) => {
    try {
      const d = new Date(selectedYear, selectedMonth, day);
      return d.toLocaleDateString('en-US', { weekday: 'long' });
    } catch (e) {
      return '';
    }
  };

  const getStatusDisplay = (status?: string) => {
    if (!status) return '';
    return statusOptions.find(o => o.value === status)?.label || '';
  };

  const getStudentStatusInitial = (student?: any) => {
    if (!student) return '';
    if (student.isTransferred) return 'C.H.';
    if (!student.statusId) return '';
    const status = studentStatuses.find(s => s.id === student.statusId);
    return status ? status.name.charAt(0).toUpperCase() : '';
  };

  const toggleStatus = (day: number, studentId: string) => {
    setHasChanges(true);
    const dayStr = day.toString();
    const currentStatus = attendanceMap[dayStr]?.[studentId];
    
    let nextStatus = 'present';
    if (currentStatus) {
      const currentIndex = statusOptions.findIndex(o => o.value === currentStatus);
      nextStatus = statusOptions[(currentIndex + 1) % statusOptions.length].value;
    }

    setAttendanceMap(prev => ({
      ...prev,
      [dayStr]: {
        ...(prev[dayStr] || {}),
        [studentId]: nextStatus
      }
    }));
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const title = `Monthly Attendance List - ${course.name}`;
    const monthYear = `${months[selectedMonth]} ${selectedYear}`;
    const facilitator = dynamicTeacherName || course.teacherName || '...';
    const schedule = course.schedule || '...';
    const level = course.level || '...';

    // Add Logo or Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Monthly Attendance List', 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Course: ${course.name}`, 14, 22);
    doc.text(`Facilitator: ${facilitator}`, 14, 27);
    doc.text(`Schedule: ${schedule}`, 14, 32);
    doc.text(`Level: ${level}`, 150, 22);
    doc.text(`Month: ${monthYear}`, 150, 27);

    // Exam Dates Info
    doc.setFontSize(8);
    doc.text(`Mid-term Exam: ${course.midtermExamDate || 'N/A'}`, 14, 37);
    doc.text(`Final Exam: ${course.finalExamDate || 'N/A'}`, 80, 37);
    doc.text(`Kardex Filling: ${course.kardexFillingDate || 'N/A'}`, 150, 37);

    const headers = [['No', 'Names and Last Names', 'Code', 'Status', ...daysHeader.map(d => d.toString())]];
    
    const data = Array.from({ length: Math.max(students.length, 15) }).map((_, idx) => {
      const student = students[idx];
      const row = [
        (idx + 1).toString(),
        student?.displayName || '',
        student?.studentCode || '',
        getStudentStatusInitial(student),
        ...daysHeader.map(d => getStatusDisplay(attendanceMap[d.toString()]?.[student?.uid]))
      ];
      return row;
    });

    autoTable(doc, {
      head: headers,
      body: data,
      startY: 42,
      styles: { fontSize: 7, cellPadding: 1, lineWidth: 0.1, lineColor: [0, 0, 0] },
      headStyles: { fillColor: [228, 228, 228], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 15 },
        3: { cellWidth: 12 }
      },
      theme: 'grid'
    });

    doc.save(`Attendance_${course.name}_${monthYear}.pdf`);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setAutoSaveStatus('saving');
    try {
      const savePromises = Object.entries(attendanceMap).map(async ([day, records]) => {
        const date = new Date(selectedYear, selectedMonth, parseInt(day));
        const startOfDay = new Date(new Date(date).setHours(0, 0, 0, 0));
        const endOfDay = new Date(new Date(date).setHours(23, 59, 59, 999));

        const q = query(
          collection(db, 'attendance'),
          where('courseId', '==', course.id),
          where('date', '>=', startOfDay),
          where('date', '<=', endOfDay)
        );

        const snapshot = await getDocs(q);
        const attendanceRecords = Object.entries(records).map(([studentId, status]) => ({
          studentId,
          status
        }));

        if (!snapshot.empty) {
          await updateDoc(doc(db, 'attendance', snapshot.docs[0].id), {
            records: attendanceRecords,
            updatedAt: serverTimestamp()
          });
        } else {
          await addDoc(collection(db, 'attendance'), {
            courseId: course.id,
            teacherId: user?.uid,
            date: date,
            records: attendanceRecords,
            createdAt: serverTimestamp()
          });
        }
      });

      await Promise.all(savePromises);
      setLastSaved(new Date());
      setHasChanges(false);
      setAutoSaveStatus('saved');
    } catch (error) {
      console.error("Error saving attendance:", error);
      setAutoSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] pb-20">
      {/* Quick Controls Bar (Non-Printable) */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-40 no-print">
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-stone-50 rounded-xl transition-all">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <h2 className="font-bold text-stone-900 leading-tight">Attendance Dashboard</h2>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  autoSaveStatus === 'saving' ? "bg-amber-400 animate-pulse" : 
                  autoSaveStatus === 'saved' ? "bg-emerald-500" : 
                  autoSaveStatus === 'error' ? "bg-rose-500" : "bg-stone-300"
                )} />
                <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">
                  {autoSaveStatus === 'saving' ? 'Sincronizando...' : 
                   autoSaveStatus === 'saved' ? 'Sincronizado con monitoreo' : 
                   autoSaveStatus === 'error' ? 'Error de sincronización' : 
                   hasChanges ? 'Cambios pendientes' : 'Listo para el llamado'}
                </span>
                {lastSaved && (
                  <span className="text-[9px] font-bold text-stone-300 uppercase">
                    • Último guardado: {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="px-3 py-1.5 bg-stone-50 border rounded-lg text-xs font-bold">
              {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="px-3 py-1.5 bg-stone-50 border rounded-lg text-xs font-bold">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button 
              onClick={handleSave} 
              disabled={isSaving || !hasChanges}
              className={cn(
                "flex items-center gap-2 px-6 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm",
                hasChanges ? "bg-bordeaux text-white hover:bg-bordeaux-dark" : "bg-white text-stone-300 border border-stone-100 cursor-not-allowed shadow-none"
              )}
            >
              <Save className={cn("w-3.5 h-3.5", isSaving && "animate-spin")} />
              {isSaving ? 'Guardando...' : 'Guardar lista mensual'}
            </button>
            <button 
              onClick={handleDownloadPDF} 
              className="flex items-center gap-2 px-4 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-bold hover:bg-stone-800 transition-all shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar en PDF
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 flex justify-center">
        <div className="w-full max-w-[1400px] bg-white shadow-xl border border-stone-300 print:shadow-none print:border-none p-6 md:p-8">
          
          {/* Header Legend Section */}
          <div className="flex flex-col md:flex-row gap-6 mb-4 items-start">
             <div className="flex-shrink-0">
                <img src={LOGO_URL} alt="Logo" className="h-16 md:h-20 w-auto" />
                <h1 className="text-xl font-black uppercase text-center mt-2 leading-[0.8] tracking-tight">Monthly<br />Attendance List</h1>
             </div>

             <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-2 gap-x-6 border-2 border-stone-900 p-4 rounded-sm text-[11px]">
                <div className="flex gap-2 items-center">
                   <span className="font-bold min-w-[70px]">Facilitator:</span>
                   <span className="flex-1 border-b border-dotted border-stone-400 px-2 font-bold">{dynamicTeacherName || course.teacherName || '...'}</span>
                </div>
                <div className="flex gap-2 items-center">
                   <span className="font-bold min-w-[70px]">Schedule:</span>
                   <span className="flex-1 border-b border-dotted border-stone-400 px-2 font-bold">{course.schedule}</span>
                </div>
                <div className="flex gap-2 items-center">
                   <span className="font-bold min-w-[70px]">Month:</span>
                   <span className="flex-1 border-b border-dotted border-stone-400 px-2 font-bold">{months[selectedMonth]} {selectedYear}</span>
                </div>
                <div className="flex gap-2 items-center">
                   <span className="font-bold min-w-[70px]">Start Date:</span>
                   <span className="flex-1 border-b border-dotted border-stone-400 px-2 font-bold">{course.startDate || '...'}</span>
                </div>
                <div className="flex gap-2 items-center">
                   <span className="font-bold min-w-[70px]">End Date:</span>
                   <span className="flex-1 border-b border-dotted border-stone-400 px-2 font-bold">{course.endDate || '...'}</span>
                </div>
                <div className="flex gap-2 items-center">
                   <span className="font-bold min-w-[70px]">Classroom:</span>
                   <span className="flex-1 border-b border-dotted border-stone-400 px-2 font-bold">...</span>
                </div>
                <div className="flex gap-2 items-center md:col-span-2">
                   <span className="font-bold min-w-[70px]">Level:</span>
                   <span className="flex-1 border-b border-dotted border-stone-400 px-2 font-bold uppercase tracking-widest">{course.level}</span>
                </div>
             </div>
          </div>

          {/* Legends */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 text-[9px] font-bold uppercase tracking-tight">
             <div className="flex flex-wrap gap-x-4 gap-y-1 bg-stone-50 p-2 border border-stone-200">
                <span className="text-stone-400 tracking-widest">Legend:</span>
                {statusOptions.map(opt => (
                   <div key={opt.value} className="flex items-center gap-1">
                      <span className="text-stone-400">{opt.value} =</span>
                      <span className={opt.color}>{opt.label}</span>
                   </div>
                ))}
             </div>
             <div className="flex flex-wrap gap-x-4 gap-y-1 bg-stone-50 p-2 border border-stone-200">
                <span className="text-stone-400 tracking-widest">Status:</span>
                {greekStatusOptions.map(opt => (
                   <div key={opt.value} className="flex items-center gap-1">
                      <span className="text-stone-900">{opt.label} =</span>
                      <span className="text-stone-400">{opt.value}</span>
                   </div>
                ))}
             </div>
          </div>

          {/* Main Grid Table */}
          <div className="overflow-x-auto border-2 border-stone-900 bg-white">
            <table className="w-full border-collapse">
              <thead className="bg-[#e4e4e4] border-b-2 border-stone-900">
                <tr>
                  <th rowSpan={2} className="w-8 border-r-2 border-stone-900 text-[10px] font-black uppercase text-center">No</th>
                  <th rowSpan={2} className="px-4 border-r-2 border-stone-900 text-[10px] font-black uppercase text-left min-w-[300px]">Last Names and Names</th>
                  <th rowSpan={2} className="w-14 border-r-2 border-stone-900 text-[10px] font-black uppercase text-center"><div className="rotate-270 whitespace-nowrap">Code</div></th>
                  <th rowSpan={2} className="w-12 border-r-2 border-stone-900 text-[10px] font-black uppercase text-center"><div className="rotate-270 whitespace-nowrap">Status</div></th>
                  
                  {daysHeader.map(d => (
                    <th key={d} className="w-5 min-w-[20px] border-r border-stone-900 text-[9px] font-black uppercase bg-stone-100 text-center">
                      {d}
                    </th>
                  ))}
                </tr>
                <tr className="h-24">
                  {daysHeader.map(d => (
                    <th key={d} className={cn(
                      "w-5 min-w-[20px] border-r border-stone-400 text-[8px] font-black uppercase text-center relative py-2",
                      ['Saturday', 'Sunday'].includes(getDayLabel(d)) ? "bg-stone-300" : ""
                    )}>
                       <div className="absolute inset-0 flex items-center justify-center">
                          <span className="-rotate-90 whitespace-nowrap origin-center tracking-tight leading-none text-stone-600">
                             {getDayLabel(d)}
                          </span>
                       </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-900">
                {Array.from({ length: Math.max(students.length, 15) }).map((_, idx) => {
                  const student = students[idx];
                  return (
                    <tr key={idx} className="h-8 group divide-x divide-stone-900 hover:bg-stone-50 transition-colors">
                      <td className="text-center text-[10px] font-bold">{idx + 1}</td>
                      <td className="px-4 text-[10px] font-black uppercase truncate">
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span className="truncate">{student?.displayName || ''}</span>
                          {(student as any)?.isTransferred && (
                            <span className="text-[7.5px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded px-1 py-0.5 tracking-tight whitespace-nowrap normal-case animate-pulse">
                              ➡️ Cambio de Horario
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-center text-[10px] font-bold">{student?.studentCode || ''}</td>
                      <td className="text-center text-[10px] font-bold text-stone-600 bg-stone-50/50">
                         {student && getStudentStatusInitial(student)}
                      </td>

                      {/* Attendance Cells */}
                      {daysHeader.map(d => (
                         <td 
                           key={d} 
                           onClick={() => student && toggleStatus(d, student.uid)}
                           className={cn(
                             "w-5 h-8 border-r border-stone-400 cursor-pointer text-center font-black text-xs transition-all",
                             !student && "cursor-default",
                             ['Saturday', 'Sunday'].includes(getDayLabel(d)) ? "bg-stone-100" : ""
                           )}
                         >
                            {student && getStatusDisplay(attendanceMap[d.toString()]?.[student.uid])}
                         </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-2 border-stone-900 border-t-0 p-3 gap-6 bg-white shrink-0">
             <div className="flex gap-2 items-center text-[11px]">
                <span className="font-bold whitespace-nowrap">Mid-term-Exam Date:</span>
                <span className="flex-1 border-b border-stone-300 font-bold px-2">{course.midtermExamDate || '...'}</span>
             </div>
             <div className="flex gap-2 items-center text-[11px]">
                <span className="font-bold whitespace-nowrap">Final-Exam Date:</span>
                <span className="flex-1 border-b border-stone-300 font-bold px-2">{course.finalExamDate || '...'}</span>
             </div>
             <div className="flex gap-2 items-center text-[11px]">
                <span className="font-bold whitespace-nowrap">Kardex-Filling Date:</span>
                <span className="flex-1 border-b border-stone-300 font-bold px-2">{course.kardexFillingDate || '...'}</span>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export const TeacherAttendance = () => {
  const { user, profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  useEffect(() => {
    if (!user || !profile) return;
    const isSpecialRole = ['master', 'admin', 'dir_acad'].includes(profile.role || '');
    const q = isSpecialRole
      ? query(collection(db, 'courses'))
      : query(collection(db, 'courses'), where('teacherId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'courses'));
    return () => unsubscribe();
  }, [user, profile]);

  if (selectedCourse) {
    const currentCourse = courses.find(c => c.id === selectedCourse.id) || selectedCourse;
    return (
      <MonthlyAttendanceList 
        course={currentCourse} 
        onBack={() => setSelectedCourse(null)} 
      />
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-stone-900 tracking-tight">Registro de Listas</h2>
        <p className="text-stone-500 mt-1">Selecciona un curso para gestionar el registro mensual de listas y evaluaciones.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map(course => (
          <button
            key={course.id}
            onClick={() => setSelectedCourse(course)}
            className="group bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 hover:shadow-xl hover:scale-[1.02] transition-all text-left relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-stone-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500" />
            <div className="relative">
              <div className="w-14 h-14 bg-bordeaux text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:rotate-6 transition-transform">
                <BookOpen className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-2 truncate">{course.name}</h3>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-stone-100 text-stone-600 rounded-lg text-xs font-bold uppercase tracking-wider">{course.level}</span>
                <span className="px-3 py-1 bg-stone-50 text-stone-400 rounded-lg text-xs font-bold uppercase tracking-wider">{course.schedule}</span>
              </div>
              <div className="mt-8 flex items-center justify-between">
                <span className="text-stone-400 text-sm font-bold">Ver Registro Mensual</span>
                <div className="w-10 h-10 rounded-full bg-stone-50 flex items-center justify-center group-hover:bg-bordeaux group-hover:text-white transition-all">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </div>
            </div>
          </button>
        ))}
        {courses.length === 0 && (
          <div className="col-span-full py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-stone-200 text-center">
            <ClipboardList className="w-16 h-16 text-stone-200 mx-auto mb-4" />
            <p className="text-stone-400 font-bold text-lg italic tracking-tight">No tienes cursos asignados actualmente.</p>
          </div>
        )}
      </div>
    </div>
  );
};
