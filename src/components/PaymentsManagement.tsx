import React, { useState, useEffect } from 'react';
import { Search, CreditCard, DollarSign, Calendar, FileText, Download, User as UserIcon, Plus, Save, X, ArrowRight, ShieldCheck, CheckCircle, RefreshCw, Send, Trash2, Edit, BookOpen, ShoppingBag, Printer } from 'lucide-react';
import { collection, onSnapshot, query, where, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, orderBy, getDocs, writeBatch, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { Payment, UserProfile, Course, Enrollment, StudentStatus, Book, BookSale } from '../types';
import { useAuth } from '../AuthContext';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const PaymentsManagement = () => {
  const { profile, user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [studentStatuses, setStudentStatuses] = useState<StudentStatus[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [bookSales, setBookSales] = useState<BookSale[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  
  const [search, setSearch] = useState('');
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBookSaleModalOpen, setIsBookSaleModalOpen] = useState(false);
  const [isSellingBook, setIsSellingBook] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [bookSaleFormData, setBookSaleFormData] = useState({
    bookId: '',
    quantity: 1,
    receiptNumber: '',
    discount: 0,
    observations: ''
  });
  const [formData, setFormData] = useState({
    studentId: '',
    courseId: '',
    amountReceived: '',
    monthlyAmount: '350',
    receiptNumber: '',
    year: new Date().getFullYear().toString(),
    paymentMethod: 'Efectivo',
    concept: 'Mensualidad',
    status: 'completed' as 'pending' | 'completed' | 'cancelled',
    authorizationNumber: '',
    invoiceNumber: '',
    taxId: '',
    taxName: '',
    plannedPaymentDate: new Date().toLocaleDateString('sv-SE'),
    paymentDate: new Date().toLocaleDateString('sv-SE'),
    notes: ''
  });

  const monthsList = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // Automatically calculate plannedPaymentDate (vencimiento) using the day from enrollment's startDate for the month selected
  useEffect(() => {
    if (selectedMonths.length > 0 && selectedEnrollment) {
      const year = formData.year || new Date().getFullYear().toString();
      const monthIndex = monthsList.indexOf(selectedMonths[0]);
      if (monthIndex !== -1) {
        let day = '10'; // Fallback standard scheduled day
        if (selectedEnrollment.startDate) {
          const parts = selectedEnrollment.startDate.split('-');
          if (parts.length === 3) {
            day = parts[2]; // Day of start date
          }
        }
        const formattedMonth = String(monthIndex + 1).padStart(2, '0');
        const calculatedDate = `${year}-${formattedMonth}-${day}`;
        setFormData(prev => ({
          ...prev,
          plannedPaymentDate: calculatedDate
        }));
      }
    }
  }, [selectedMonths, formData.year, selectedEnrollment]);

  // Automatically update amountReceived when selectedMonths or monthlyAmount changes
  useEffect(() => {
    const total = selectedMonths.length * Number(formData.monthlyAmount);
    setFormData(prev => ({
      ...prev,
      amountReceived: total > 0 ? total.toString() : ''
    }));
  }, [selectedMonths, formData.monthlyAmount]);

  useEffect(() => {
    const unsubPayments = onSnapshot(query(collection(db, 'payments'), orderBy('createdAt', 'desc')), (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'payments'));

    const unsubEnrollments = onSnapshot(collection(db, 'enrollments'), (snapshot) => {
      setEnrollments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Enrollment)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'enrollments'));

    const unsubStatuses = onSnapshot(collection(db, 'statuses'), (snapshot) => {
      setStudentStatuses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentStatus)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'statuses'));

    const unsubCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'courses'));

    const unsubBookSales = onSnapshot(query(collection(db, 'bookSales'), orderBy('createdAt', 'desc')), (snapshot) => {
      setBookSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BookSale)));
    }, (error) => console.error("Error fetching bookSales:", error));

    const unsubBooks = onSnapshot(query(collection(db, 'books'), orderBy('title', 'asc')), (snapshot) => {
      setBooks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Book)));
    }, (error) => console.error("Error fetching books:", error));

    return () => {
      unsubPayments();
      unsubEnrollments();
      unsubStatuses();
      unsubCourses();
      unsubBookSales();
      unsubBooks();
    };
  }, []);

  const generateBookReceiptPDF = (sale: BookSale) => {
    const docObj = new jsPDF();
    const pageWidth = docObj.internal.pageSize.getWidth();
    
    docObj.setFillColor(30, 30, 30);
    docObj.rect(0, 0, pageWidth, 40, 'F');
    
    docObj.setTextColor(255, 255, 255);
    docObj.setFont('helvetica', 'bold');
    docObj.setFontSize(24);
    docObj.text('RECIBO VENTA DE LIBRO', pageWidth / 2, 25, { align: 'center' });
    
    docObj.setTextColor(30, 30, 30);
    docObj.setFontSize(10);
    docObj.text(`Nº RECIBO: ${sale.receiptNumber}`, pageWidth - 20, 50, { align: 'right' });
    docObj.text(`FECHA: ${sale.createdAt ? sale.createdAt.toDate().toLocaleDateString() : new Date().toLocaleDateString()}`, pageWidth - 20, 55, { align: 'right' });

    autoTable(docObj, {
      startY: 65,
      head: [['Descripción', 'Detalles']],
      body: [
        ['Cliente', sale.customerName],
        ['Producto', sale.bookTitle],
        ['Cantidad', sale.quantity.toString()],
        ['Precio Unitario', `$${sale.price}`],
        ['Descuento', `$${sale.discount}`],
        ['Total Pagado', `$${sale.total}`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [249, 115, 22] },
      styles: { fontSize: 10 }
    });

    const finalY = (docObj as any).lastAutoTable.finalY + 20;
    docObj.setFont('helvetica', 'italic');
    docObj.text('Este documento es un comprobante de adquisición de material didáctico.', 20, finalY);
    
    docObj.save(`ReciboLibro_${sale.receiptNumber}.pdf`);
  };

  const handleOpenBookSaleModal = (enrollment: Enrollment) => {
    setBookSaleFormData({
      bookId: '',
      quantity: 1,
      receiptNumber: '',
      discount: 0,
      observations: ''
    });
    setIsBookSaleModalOpen(true);
  };

  const handleSellBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrollment) return;
    setIsSellingBook(true);
    try {
      const book = books.find(b => b.id === bookSaleFormData.bookId);

      if (!book) {
         alert('Seleccione un producto válido');
         setIsSellingBook(false);
         return;
      }

      if (book.stock < bookSaleFormData.quantity) {
         alert('Stock insuficiente');
         setIsSellingBook(false);
         return;
      }

      const total = (book.price * bookSaleFormData.quantity) - bookSaleFormData.discount;

      const batch = writeBatch(db);
      
      const saleRef = doc(collection(db, 'bookSales'));
      batch.set(saleRef, {
        bookId: book.id,
        bookTitle: book.title,
        customerName: `${selectedEnrollment.firstName} ${selectedEnrollment.lastName}`,
        studentId: selectedEnrollment.id || null,
        studentCode: selectedEnrollment.studentCode || null,
        receiptNumber: bookSaleFormData.receiptNumber,
        price: book.price,
        quantity: bookSaleFormData.quantity,
        discount: bookSaleFormData.discount,
        total: total,
        observations: bookSaleFormData.observations,
        createdBy: user?.uid,
        createdAt: serverTimestamp()
      });

      const bookRef = doc(db, 'books', book.id!);
      batch.update(bookRef, {
        stock: increment(-bookSaleFormData.quantity)
      });

      await batch.commit();

      setIsBookSaleModalOpen(false);
      setBookSaleFormData({
        bookId: '',
        quantity: 1,
        receiptNumber: '',
        discount: 0,
        observations: ''
      });
      alert('Venta de libro registrada exitosamente.');
    } catch (error) {
      console.error(error);
      alert('Error al registrar la venta del libro.');
    } finally {
      setIsSellingBook(false);
    }
  };

  const handleOpenModalWithStudent = (enrollment: Enrollment) => {
    // Find matching course by level and modality or just the course name
    const matchingCourse = courses.find(c => 
      c.name.toLowerCase().includes(enrollment.course.toLowerCase()) ||
      (c.level === enrollment.level && c.schedule === enrollment.schedule)
    ) || courses.find(c => c.name.toLowerCase() === enrollment.course.toLowerCase());

    const studentStatus = studentStatuses.find(s => s.id === enrollment.statusId);

    setSelectedEnrollment(enrollment);
    setFormData({
      ...formData,
      studentId: enrollment.id!,
      courseId: matchingCourse?.id || '',
      taxId: enrollment.idCard,
      taxName: `${enrollment.firstName} ${enrollment.lastName}`,
      monthlyAmount: studentStatus?.fee.toString() || '350',
      plannedPaymentDate: enrollment.startDate || new Date().toLocaleDateString('sv-SE'),
      paymentDate: new Date().toLocaleDateString('sv-SE'),
    });
    setIsModalOpen(true);
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMonths.length === 0) {
      alert('Debes seleccionar al menos un mes.');
      return;
    }
    setIsSubmitting(true);
    try {
      const enrollment = enrollments.find(env => env.id === formData.studentId);
      const course = courses.find(c => c.id === formData.courseId);

      // Create a batch or sequence of payments for each selected month
      for (const month of selectedMonths) {
        let monthPlannedDate = formData.plannedPaymentDate || new Date().toLocaleDateString('sv-SE');
        const monthIndex = monthsList.indexOf(month);
        if (monthIndex !== -1 && enrollment) {
          let day = '10'; // Fallback
          if (enrollment.startDate) {
            const parts = enrollment.startDate.split('-');
            if (parts.length === 3) {
              day = parts[2];
            }
          }
          const formattedMonth = String(monthIndex + 1).padStart(2, '0');
          monthPlannedDate = `${formData.year || new Date().getFullYear().toString()}-${formattedMonth}-${day}`;
        }

        const paymentData = {
          ...formData,
          monthToPay: month,
          plannedPaymentDate: monthPlannedDate,
          monthlyAmount: Number(formData.monthlyAmount),
          totalToPay: Number(formData.monthlyAmount),
          amountReceived: Number(formData.monthlyAmount), // We register per month
          studentName: enrollment ? `${enrollment.firstName} ${enrollment.lastName}` : 'Unknown',
          courseName: course?.name || 'Unknown',
          studentCode: enrollment?.studentCode || '',
          createdBy: user?.uid,
          createdAt: serverTimestamp()
        };
        await addDoc(collection(db, 'payments'), paymentData);
      }

      setShowSuccess(true);
      
      // Auto close after 1.5 seconds
      setTimeout(() => {
        setIsModalOpen(false);
        setShowSuccess(false);
        setSelectedMonths([]);
        setFormData({
          studentId: '',
          courseId: '',
          amountReceived: '',
          monthlyAmount: '350',
          receiptNumber: '',
          year: new Date().getFullYear().toString(),
          paymentMethod: 'Efectivo',
          concept: 'Mensualidad',
          status: 'completed',
          authorizationNumber: '',
          invoiceNumber: '',
          taxId: '',
          taxName: '',
          plannedPaymentDate: new Date().toLocaleDateString('sv-SE'),
          paymentDate: new Date().toLocaleDateString('sv-SE'),
          notes: ''
        });
      }, 1500);

    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, 'payments');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEditPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment || !editingPayment.id) return;
    setIsSavingEdit(true);
    try {
      const paymentRef = doc(db, 'payments', editingPayment.id);
      await updateDoc(paymentRef, {
        year: editingPayment.year,
        monthToPay: editingPayment.monthToPay,
        monthlyAmount: Number(editingPayment.monthlyAmount),
        amountReceived: Number(editingPayment.amountReceived),
        receiptNumber: editingPayment.receiptNumber,
        invoiceNumber: editingPayment.invoiceNumber || '',
        taxId: editingPayment.taxId || '',
        taxName: editingPayment.taxName || '',
        authorizationNumber: editingPayment.authorizationNumber || '',
        plannedPaymentDate: editingPayment.plannedPaymentDate || '',
        paymentDate: editingPayment.paymentDate || '',
        paymentMethod: editingPayment.paymentMethod || 'Efectivo',
        observations: editingPayment.observations || ''
      });
      setEditingPayment(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'payments');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const generateStatementPDF = (enrollment: Enrollment, studentPayments: Payment[]) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header - Style based on the institutional aesthetic
    doc.setFillColor(30, 30, 30);
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('EXTRACTO DE PAGOS', pageWidth / 2, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('CONTROL DE MENSUALIDADES Y SALDO HISTÓRICO', pageWidth / 2, 33, { align: 'center' });
    
    // Student Info Section
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL ESTUDIANTE', 20, 58);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Nombre: ${enrollment.firstName} ${enrollment.lastName}`, 20, 66);
    doc.text(`Código: ${enrollment.studentCode}`, 20, 72);
    doc.text(`C.I.: ${enrollment.idCard}`, 20, 78);
    doc.text(`Curso: ${enrollment.course} (${enrollment.modality})`, 20, 84);
    
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-ES')}`, pageWidth - 20, 66, { align: 'right' });
    doc.text(`Estado: ${enrollment.status.toUpperCase()}`, pageWidth - 20, 72, { align: 'right' });

    // Table of Payments
    const tableData = studentPayments.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()).map(p => [
      p.createdAt?.toDate().toLocaleDateString('es-ES') || '-',
      p.receiptNumber,
      `${p.monthToPay} ${p.year}`,
      p.courseName || '-',
      `Bs. ${Number(p.amountReceived).toFixed(2)}`,
      p.paymentMethod || 'Efectivo'
    ]);

    autoTable(doc, {
      startY: 95,
      head: [['Fecha', 'Recibo', 'Periodo', 'Curso', 'Monto', 'Método']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [128, 0, 32], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        4: { fontStyle: 'bold', textColor: [22, 101, 52] }
      }
    });

    const total = studentPayments.reduce((acc, p) => acc + (Number(p.amountReceived) || 0), 0);
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL RECAUDADO: Bs. ${total.toFixed(2)}`, pageWidth - 20, finalY, { align: 'right' });
    
    // Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 150, 150);
    doc.text('Este documento es un extracto informativo generado por el sistema de gestión.', 20, doc.internal.pageSize.getHeight() - 15);

    doc.save(`Extracto_${enrollment.studentCode}_${enrollment.lastName}.pdf`);
  };

  const generateReceiptPDF = (payment: Payment) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header - Style based on the image's aesthetic
    doc.setFillColor(30, 30, 30);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text('RECIBO DE PAGO', pageWidth / 2, 25, { align: 'center' });
    
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    doc.text(`Nº RECIBO: ${payment.receiptNumber}`, pageWidth - 20, 50, { align: 'right' });
    doc.text(`FECHA: ${new Date().toLocaleDateString()}`, pageWidth - 20, 55, { align: 'right' });

    // Payment Info
    autoTable(doc, {
      startY: 65,
      head: [['Concepto de Pago', 'Detalles']],
      body: [
        ['Estudiante', payment.studentName],
        ['Curso', payment.courseName],
        ['Periodo', `${payment.monthToPay} ${payment.year}`],
        ['Método de Pago', payment.paymentMethod],
        ['Importe Recibido', `Bs. ${payment.amountReceived}`]
      ],
      theme: 'striped',
      headStyles: { fillColor: [128, 0, 32] },
      styles: { fontSize: 10 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFont('helvetica', 'italic');
    doc.text('Este documento sirve como comprobante oficial de pago para los servicios educativos detallados.', 20, finalY);
    
    doc.save(`Recibo_${payment.receiptNumber}_${payment.studentName.replace(/\s+/g, '_')}.pdf`);
  };

  const filteredEnrollments = enchantmentsSearch(search, enrollments);

  function enchantmentsSearch(term: string, list: Enrollment[]) {
    if (!term) return [];
    return list.filter(e => 
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(term.toLowerCase()) ||
      e.studentCode.includes(term) ||
      e.idCard.includes(term)
    ).slice(0, 5);
  }

  const selectedStudentPayments = selectedEnrollment 
    ? payments.filter(p => p.studentCode === selectedEnrollment.studentCode)
    : [];

  const studentSales = selectedEnrollment
    ? bookSales.filter(sale => 
        sale.studentId === selectedEnrollment.id || 
        (selectedEnrollment.studentCode && sale.studentCode === selectedEnrollment.studentCode) ||
        (sale.customerName?.toLowerCase() === `${selectedEnrollment.firstName} ${selectedEnrollment.lastName}`.toLowerCase())
      )
    : [];

  const getStatusName = (enrollment: Enrollment) => {
    const status = studentStatuses.find(s => s.id === enrollment.statusId);
    return status ? `${status.name} - ${enrollment.modality}` : `${enrollment.status.toUpperCase()} - ${enrollment.modality}`;
  };

  const getPaidMonthsForStudent = (enrollment: Enrollment, year: string) => {
    return payments
      .filter(p => p.studentCode === enrollment.studentCode && p.year === year && p.status === 'completed')
      .map(p => p.monthToPay);
  };

  const isMonthDue = (monthName: string, yearStr: string, enrollment: Enrollment) => {
    const monthIndex = monthsList.indexOf(monthName);
    if (monthIndex === -1) return false;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth(); // 0-11

    let startYear = currentYear;
    let startMonthIndex = 0;
    if (enrollment.startDate) {
      const parts = enrollment.startDate.split('-');
      if (parts.length === 3) {
        startYear = parseInt(parts[0], 10);
        startMonthIndex = parseInt(parts[1], 10) - 1; // 0-11
      }
    }

    const selectedYear = parseInt(yearStr, 10);
    if (isNaN(selectedYear)) return false;

    // If selected year is before enrollment start year, they don't owe anything
    if (selectedYear < startYear) return false;

    // If selected year is the enrollment year, they can only owe from enrollment month onwards
    if (selectedYear === startYear) {
      if (monthIndex < startMonthIndex) return false;
    }

    // If selected year is the current year, they can only owe up to the current month (cuando ya se haya cumplido)
    if (selectedYear === currentYear) {
      if (monthIndex > currentMonthIndex) return false;
    }

    // If selected year is in the future, they don't owe anything yet
    if (selectedYear > currentYear) return false;

    return true;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900 tracking-tight">Gestión de Pagos</h2>
          <p className="text-stone-500 mt-1">Control de mensualidades, recibos y salud financiera.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 relative group">
          <Search className="absolute left-10 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300 group-focus-within:text-stone-900 transition-colors" />
          <input 
            type="text"
            placeholder="Buscar por nombre, código o carnet del estudiante..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-14 pr-6 py-3 bg-stone-50 border-2 border-stone-100 rounded-2xl outline-none focus:bg-white focus:border-stone-900 focus:ring-8 focus:ring-stone-900/5 transition-all text-sm font-bold"
          />
        </div>
      </div>

      <AnimatePresence>
        {selectedEnrollment && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Student Info and Actions Card */}
            <div className="bg-stone-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32" />
               <div className="relative flex flex-col lg:flex-row gap-8 items-start justify-between">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 flex-1">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Nombre Completo</p>
                      <p className="text-xl font-serif italic font-bold">{selectedEnrollment.firstName} {selectedEnrollment.lastName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Código / C.I.</p>
                      <p className="text-xl font-bold font-mono">{selectedEnrollment.studentCode} / {selectedEnrollment.idCard}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Estatus</p>
                      <p className="text-sm font-black uppercase tracking-wider text-emerald-400">{getStatusName(selectedEnrollment)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Curso / Horario</p>
                      <p className="text-lg font-bold">{selectedEnrollment.course} | {selectedEnrollment.shift} {selectedEnrollment.schedule ? `/ ${selectedEnrollment.schedule}` : ''}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <button 
                      onClick={() => generateStatementPDF(selectedEnrollment, selectedStudentPayments)}
                      className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-4 rounded-2xl font-bold transition-all backdrop-blur-sm"
                    >
                      <Download className="w-4 h-4" />
                      Descargar Extracto
                    </button>
                    <button 
                      onClick={() => handleOpenBookSaleModal(selectedEnrollment)}
                      className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-orange-500/20"
                    >
                      <BookOpen className="w-4 h-4" />
                      Vender Libro
                    </button>
                    <button 
                      onClick={() => handleOpenModalWithStudent(selectedEnrollment)}
                      className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-emerald-500/20"
                    >
                      <Plus className="w-4 h-4" />
                      Registrar Nuevo Pago
                    </button>
                  </div>
               </div>
               <button 
                  onClick={() => setSelectedEnrollment(null)}
                  className="absolute top-8 right-8 p-2 hover:bg-white/10 rounded-xl transition-colors text-white/40 hover:text-white"
               >
                 <X className="w-5 h-5" />
               </button>
            </div>

            {selectedEnrollment.status === 'frozen' && (
              <div className="bg-blue-50 border-2 border-blue-200/50 p-6 rounded-[2rem] flex flex-col gap-2">
                <div className="flex items-center gap-2.5 text-blue-800 font-black uppercase text-sm tracking-wider">
                  <span>❄️ ESTUDIANTE CON MATRÍCULA CONGELADA / SUSPENDIDA</span>
                </div>
                {selectedEnrollment.freezeReason ? (
                  <p className="text-blue-700 italic font-black text-xs uppercase">
                    Motivo: "{selectedEnrollment.freezeReason}"
                  </p>
                ) : (
                  <p className="text-blue-700 italic font-black text-xs uppercase text-stone-500">
                    No se especificó motivo de congelamiento.
                  </p>
                )}
                <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest mt-1">
                  Por favor tome en cuenta este estado antes de proceder a la facturación o cobro de cuotas.
                </p>
              </div>
            )}

            {/* Payment History Table */}
            <div className="space-y-4">
              <h3 className="text-xl font-black text-stone-900 uppercase tracking-tighter italic">Historial de Pagos</h3>
              <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-stone-50 border-b border-stone-100 text-[9px] font-black text-stone-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-5">Autorizado</th>
                      <th className="px-6 py-5">Nro. Factura</th>
                      <th className="px-6 py-5">Nro. Recibo</th>
                      <th className="px-6 py-5">Gestión</th>
                      <th className="px-6 py-5">Mensualidad</th>
                      <th className="px-6 py-5">Monto (Bs)</th>
                      <th className="px-6 py-5">NIT Factura</th>
                      <th className="px-6 py-5">Nombre Factura</th>
                      <th className="px-6 py-5">Fecha Planificada</th>
                      <th className="px-6 py-5">Fecha de Pago</th>
                      <th className="px-6 py-5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50 text-[11px] font-bold text-stone-600">
                    {selectedStudentPayments.map(payment => (
                      <tr key={payment.id} className="group hover:bg-stone-50/50 transition-colors uppercase">
                        <td className="px-6 py-4 font-mono text-stone-400">{payment.authorizationNumber || '-'}</td>
                        <td className="px-6 py-4 font-mono">{payment.invoiceNumber || '-'}</td>
                        <td className="px-6 py-4 font-black text-stone-900">#{payment.receiptNumber}</td>
                        <td className="px-6 py-4">{payment.year}</td>
                        <td className="px-6 py-4">{payment.monthToPay}</td>
                        <td className="px-6 py-4">
                          <span className="text-emerald-600 font-black">Bs.{payment.amountReceived}</span>
                        </td>
                        <td className="px-6 py-4 text-stone-400">{payment.taxId || '-'}</td>
                        <td className="px-6 py-4 truncate max-w-[150px]">{payment.taxName || '-'}</td>
                        <td className="px-6 py-4 text-stone-400">{payment.plannedPaymentDate || '-'}</td>
                        <td className="px-6 py-4">{payment.paymentDate || '-'}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {profile?.role === 'master' && (
                              <button 
                                onClick={() => setEditingPayment(payment)}
                                className="p-2 hover:bg-stone-100 rounded-xl transition-colors group/btn"
                                title="Editar Pago (Master)"
                              >
                                <Edit className="w-4 h-4 text-stone-400 group-hover/btn:text-bordeaux" />
                              </button>
                            )}
                            <button 
                              onClick={() => generateReceiptPDF(payment)}
                              className="p-2 hover:bg-stone-100 rounded-xl transition-colors group/btn"
                              title="Descargar Recibo"
                            >
                              <Download className="w-4 h-4 text-stone-400 group-hover/btn:text-stone-900" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {selectedStudentPayments.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-6 py-12 text-center text-stone-400 italic">No se encontraron pagos registrados para este estudiante.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Book Purchases History Table */}
            <div className="space-y-4 pt-4">
              <h3 className="text-xl font-black text-stone-900 uppercase tracking-tighter italic flex items-center gap-2 px-2">
                <ShoppingBag className="w-5 h-5 text-orange-500" /> Historial de Compras de Libros
              </h3>
              <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-stone-50 border-b border-stone-100 text-[10px] font-black text-stone-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-5">Fecha</th>
                      <th className="px-6 py-5">Libro / Producto</th>
                      <th className="px-6 py-5">Nro. Recibo</th>
                      <th className="px-6 py-5 text-center">Cantidad</th>
                      <th className="px-6 py-5 text-right">Precio Unitario</th>
                      <th className="px-6 py-5 text-right">Descuento</th>
                      <th className="px-6 py-5 text-right">Total</th>
                      <th className="px-6 py-5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50 text-[11px] font-bold text-stone-600">
                    {studentSales.map(sale => (
                      <tr key={sale.id} className="hover:bg-stone-50/50 transition-colors uppercase">
                        <td className="px-6 py-4 font-mono text-stone-400">
                          {sale.createdAt ? (typeof sale.createdAt.toDate === 'function' ? sale.createdAt.toDate().toLocaleDateString() : new Date(sale.createdAt).toLocaleDateString()) : new Date().toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 font-black text-stone-900">
                          {sale.bookTitle}
                        </td>
                        <td className="px-6 py-4 font-mono text-stone-500">
                          #{sale.receiptNumber}
                        </td>
                        <td className="px-6 py-4 text-center text-stone-500">
                          {sale.quantity}
                        </td>
                        <td className="px-6 py-4 text-right text-stone-500">
                          Bs.{sale.price}
                        </td>
                        <td className="px-6 py-4 text-right text-rose-500">
                          -Bs.{sale.discount}
                        </td>
                        <td className="px-6 py-4 text-right text-emerald-600 font-extrabold">
                          Bs.{sale.total}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => generateBookReceiptPDF(sale)}
                            className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-400 hover:text-stone-950 inline-flex items-center gap-1 bg-stone-50"
                            title="Descargar Recibo del Libro"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {studentSales.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-stone-400 italic">No se han registrado compras de libros para este estudiante.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!selectedEnrollment && (
          <div className="space-y-4">
            <h3 className="text-xl font-black text-stone-900 uppercase tracking-tighter italic px-2">Seleccionar Estudiante</h3>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm overflow-hidden overflow-x-auto"
            >
              <table className="w-full text-left">
                <thead className="bg-stone-50 border-b border-stone-100 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Nombre Completo</th>
                    <th className="px-6 py-4">Carnet / C.I.</th>
                    <th className="px-6 py-4">Código</th>
                    <th className="px-6 py-4">Libros Adquiridos</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50 text-sm font-bold text-stone-600">
                  {enrollments
                    .filter(e => {
                      const term = search.toLowerCase();
                      return (
                        !term ||
                        `${e.firstName} ${e.lastName}`.toLowerCase().includes(term) ||
                        (e.studentCode && e.studentCode.toLowerCase().includes(term)) ||
                        (e.idCard && e.idCard.toLowerCase().includes(term))
                      );
                    })
                    .map(e => (
                      <tr 
                        key={e.id} 
                        onClick={() => {
                          setSelectedEnrollment(e);
                          setSearch('');
                        }}
                        className="group hover:bg-stone-50/50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-5 font-bold">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-stone-900 group-hover:text-bordeaux transition-colors">{e.firstName} {e.lastName}</p>
                            {e.status === 'frozen' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-blue-50 text-blue-600 uppercase tracking-widest border border-blue-100 animate-pulse">
                                ❄️ Congelado
                              </span>
                            )}
                          </div>
                          {e.status === 'frozen' && e.freezeReason && (
                            <p className="text-xs font-medium text-blue-500 mt-1 uppercase italic">Motivo: "{e.freezeReason}"</p>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <span className="font-mono text-stone-500">{e.idCard}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="bg-stone-100 text-stone-700 px-3 py-1 rounded-full text-xs font-mono">{e.studentCode || 'No asignado'}</span>
                        </td>
                        <td className="px-6 py-5">
                          {(() => {
                            const studentSalesCount = bookSales.filter(sale => 
                              sale.studentId === e.id || 
                              (e.studentCode && sale.studentCode === e.studentCode) ||
                              (sale.customerName?.toLowerCase() === `${e.firstName} ${e.lastName}`.toLowerCase())
                            );
                            return studentSalesCount.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-[220px]">
                                {studentSalesCount.map((sale, idx) => (
                                  <span key={idx} className="bg-orange-50 text-orange-600 px-2.5 py-1 rounded border border-orange-100 text-[9px] uppercase font-black" title={`${sale.bookTitle} (F: ${sale.receiptNumber})`}>
                                    📖 {sale.bookTitle}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-stone-300 font-normal italic text-xs">Sin libros</span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-5 text-right">
                          <button 
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedEnrollment(e);
                              setSearch('');
                            }}
                            className="bg-stone-50 group-hover:bg-bordeaux group-hover:text-white text-stone-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ml-auto"
                          >
                            Ingresar
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  {enrollments.filter(e => {
                      const term = search.toLowerCase();
                      return (
                        !term ||
                        `${e.firstName} ${e.lastName}`.toLowerCase().includes(term) ||
                        (e.studentCode && e.studentCode.toLowerCase().includes(term)) ||
                        (e.idCard && e.idCard.toLowerCase().includes(term))
                      );
                    }).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-stone-400 italic">No se encontraron estudiantes para la búsqueda especificada.</td>
                      </tr>
                    )}
                </tbody>
              </table>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm"
               onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden p-10 flex flex-col max-h-[95vh]"
            >
              <AnimatePresence>
                {showSuccess && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 bg-white flex flex-col items-center justify-center text-center space-y-6"
                  >
                    <motion.div 
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", damping: 12 }}
                      className="w-24 h-24 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/30"
                    >
                      <CheckCircle className="w-12 h-12" />
                    </motion.div>
                    <div className="space-y-2">
                       <h4 className="text-2xl font-black text-stone-900 uppercase tracking-tighter italic">Pago Registrado</h4>
                       <p className="text-stone-500 font-bold uppercase tracking-widest text-xs">La transacción se guardó con éxito en el historial.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mb-6">
                <h3 className="text-3xl font-black text-stone-900 tracking-tighter uppercase italic">Nuevo Registro de Pago</h3>
                {formData.studentId && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-1">
                    <p className="text-stone-500 font-bold uppercase tracking-widest text-xs">
                      Ingresa los datos para <span className="text-bordeaux underline decoration-bordeaux/30">{enrollments.find(e => e.id === formData.studentId)?.firstName} {enrollments.find(e => e.id === formData.studentId)?.lastName}</span>
                    </p>
                    <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest w-fit border border-emerald-200">
                      Estatus: {studentStatuses.find(s => s.id === enrollments.find(e => e.id === formData.studentId)?.statusId)?.name || 'Estándar'}
                    </span>
                  </div>
                )}
              </div>

              <form onSubmit={handleAddPayment} className="grid grid-cols-1 md:grid-cols-2 gap-10 overflow-y-auto pr-4 scrollbar-hide pb-6">
                {/* Left Column: Mensualidad Details */}
                <div className="space-y-8">
                  <div className="bg-stone-50/50 p-8 rounded-3xl border border-stone-100 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                       <div className="w-10 h-10 rounded-xl bg-bordeaux/10 text-bordeaux flex items-center justify-center">
                          <DollarSign className="w-5 h-5 font-black" />
                       </div>
                       <h4 className="text-sm font-black uppercase tracking-widest text-stone-900">Datos de la Mensualidad</h4>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Gestión (Año)</label>
                      <input 
                        type="text"
                        value={formData.year}
                        onChange={e => setFormData({...formData, year: e.target.value})}
                        className="w-full bg-white border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-stone-900"
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Meses que Debe (Selecciona 1 o más)</label>
                        {selectedMonths.length === 0 && <span className="text-[9px] text-red-500 font-bold uppercase">Debes seleccionar al menos un mes</span>}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {monthsList.filter(month => {
                          const student = enrollments.find(e => e.id === formData.studentId);
                          if (!student) return false;
                          
                          const isPaid = getPaidMonthsForStudent(student, formData.year).includes(month);
                          if (isPaid) return false;

                          return isMonthDue(month, formData.year, student);
                        }).map(month => {
                          const isSelected = selectedMonths.includes(month);
                          
                          return (
                            <button
                              key={month}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedMonths(prev => prev.filter(m => m !== month));
                                } else {
                                  setSelectedMonths(prev => [...prev, month]);
                                }
                              }}
                              className={cn(
                                "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                isSelected 
                                  ? "bg-red-600 text-white shadow-lg shadow-red-600/20 scale-105 border border-red-700" 
                                  : "bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 hover:border-red-400"
                              )}
                            >
                              {month}
                            </button>
                          );
                        })}
                        {monthsList.filter(month => {
                          const student = enrollments.find(e => e.id === formData.studentId);
                          if (!student) return false;
                          
                          const isPaid = getPaidMonthsForStudent(student, formData.year).includes(month);
                          if (isPaid) return false;

                          return isMonthDue(month, formData.year, student);
                        }).length === 0 && (
                          <div className="col-span-3 text-center py-4 text-emerald-600 font-extrabold text-[11px] uppercase tracking-wider bg-emerald-50 rounded-xl">
                            🎉 ¡Todas las mensualidades están pagadas para este año!
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Monto Mensual</label>
                        <div className="relative">
                           <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-stone-400">Bs.</span>
                           <input 
                              type="number"
                              value={formData.monthlyAmount}
                              onChange={e => setFormData({...formData, monthlyAmount: e.target.value})}
                              required
                              className="w-full bg-white border-2 border-stone-100 rounded-2xl pl-14 pr-6 py-4 font-bold outline-none focus:border-stone-900"
                           />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Meses Adelantados</label>
                        <div className="w-full bg-stone-100/50 border-2 border-transparent rounded-2xl px-6 py-4 font-bold text-stone-500">
                          {Math.max(0, selectedMonths.length - 1)}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Fecha Planificada</label>
                        <input 
                          type="date"
                          value={formData.plannedPaymentDate}
                          onChange={e => setFormData({...formData, plannedPaymentDate: e.target.value})}
                          className="w-full bg-white border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-stone-900"
                        />
                    </div>
                  </div>

                  <div className="bg-stone-50/50 p-8 rounded-3xl border border-stone-100 space-y-4">
                     <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Observaciones</label>
                     <textarea 
                        value={formData.notes}
                        onChange={e => setFormData({...formData, notes: e.target.value})}
                        placeholder="Detalles sobre el medio de pago o acuerdos..."
                        className="w-full bg-white border-2 border-stone-100 rounded-2xl p-6 font-bold text-sm outline-none focus:border-stone-900 min-h-[100px] resize-none"
                     />
                  </div>
                </div>
                
                {/* Right Column: Billing and Calculation */}
                <div className="space-y-8">
                  <div className="bg-stone-50/50 p-8 rounded-3xl border border-stone-100 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                       <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                          <FileText className="w-5 h-5 font-black" />
                       </div>
                       <h4 className="text-sm font-black uppercase tracking-widest text-stone-900">Facturación y Cobro</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">NIT / CI Factura</label>
                        <input 
                          type="text"
                          value={formData.taxId}
                          onChange={e => setFormData({...formData, taxId: e.target.value})}
                          className="w-full bg-white border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-stone-900"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Autorizado</label>
                        <input 
                          type="text"
                          value={formData.authorizationNumber}
                          onChange={e => setFormData({...formData, authorizationNumber: e.target.value})}
                          className="w-full bg-white border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-stone-900"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Nombre en Factura</label>
                      <input 
                        type="text"
                        value={formData.taxName}
                        onChange={e => setFormData({...formData, taxName: e.target.value})}
                        className="w-full bg-white border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-stone-900"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">N° Factura (Opc.)</label>
                        <input 
                          type="text"
                          value={formData.invoiceNumber}
                          onChange={e => setFormData({...formData, invoiceNumber: e.target.value})}
                          className="w-full bg-white border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-stone-900"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">N° Recibo</label>
                        <input 
                          type="text"
                          value={formData.receiptNumber}
                          onChange={e => setFormData({...formData, receiptNumber: e.target.value})}
                          required
                          className="w-full bg-white border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-stone-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Método de Pago</label>
                        <select 
                          value={formData.paymentMethod}
                          onChange={e => setFormData({...formData, paymentMethod: e.target.value})}
                          className="w-full bg-white border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-stone-900 appearance-none"
                        >
                          <option value="Efectivo">Efectivo</option>
                          <option value="Transferencia">Transferencia</option>
                          <option value="Tarjeta">Tarjeta</option>
                          <option value="Depósito">Depósito</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Fecha de Pago</label>
                        <input 
                          type="date"
                          value={formData.paymentDate}
                          onChange={e => setFormData({...formData, paymentDate: e.target.value})}
                          className="w-full bg-white border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-stone-900"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-stone-900 text-white p-8 rounded-[2rem] shadow-2xl space-y-6">
                    <div className="flex items-center justify-between">
                       <p className="text-xs font-black uppercase tracking-widest text-white/40">Total a Pagar</p>
                       <p className="text-3xl font-black italic">Bs. {(selectedMonths.length * Number(formData.monthlyAmount)).toFixed(2)}</p>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Monto Recibido</label>
                       <div className="relative">
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-stone-400">Bs.</span>
                          <input 
                             type="number"
                             value={formData.amountReceived}
                             onChange={e => setFormData({...formData, amountReceived: e.target.value})}
                             placeholder="0.00"
                             className="w-full bg-white/5 border-2 border-white/10 rounded-2xl pl-14 pr-6 py-4 font-black text-xl outline-none focus:border-white/30 transition-all"
                          />
                       </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                       <p className="text-xs font-black uppercase tracking-widest text-white/40">Cambio</p>
                       <p className="text-2xl font-black text-emerald-400">
                         Bs. {Math.max(0, Number(formData.amountReceived) - (selectedMonths.length * Number(formData.monthlyAmount))).toFixed(2)}
                       </p>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 pt-8 border-t border-stone-100 flex items-center justify-end gap-6">
                   <button 
                     type="button" 
                     onClick={() => setIsModalOpen(false)} 
                     className="px-8 py-4 text-stone-400 font-black uppercase tracking-widest text-[10px] hover:text-stone-900 transition-colors"
                   >
                     Cancelar
                   </button>
                   <button 
                      type="submit" 
                      disabled={isSubmitting || selectedMonths.length === 0}
                      className="px-12 py-5 bg-bordeaux text-white rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl active:scale-95 disabled:opacity-50 flex items-center gap-3 group transition-all"
                   >
                     {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                     Confirmar y Guardar Pago
                   </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingPayment && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm"
               onClick={() => setEditingPayment(null)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden p-10 flex flex-col max-h-[90vh]"
            >
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-black text-stone-900 tracking-tighter uppercase italic">Editar Registro de Pago</h3>
                  <p className="text-stone-500 font-bold uppercase tracking-widest text-xs mt-1">
                    Usuario MASTER: Modificando pago de <span className="text-bordeaux underline">{editingPayment.studentName}</span>
                  </p>
                </div>
                <button 
                   onClick={() => setEditingPayment(null)}
                   className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-400 hover:text-stone-950"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditPayment} className="space-y-6 overflow-y-auto pr-2 pb-4 scrollbar-hide">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Gestiones */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Gestión (Año)</label>
                    <input 
                      type="text"
                      value={editingPayment.year}
                      onChange={e => setEditingPayment({...editingPayment, year: e.target.value})}
                      className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-stone-900"
                    />
                  </div>

                  {/* Mes */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Mes</label>
                    <select
                      value={editingPayment.monthToPay}
                      onChange={e => setEditingPayment({...editingPayment, monthToPay: e.target.value})}
                      className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-stone-900 appearance-none"
                    >
                      {monthsList.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Montos */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Monto Mensual (Bs)</label>
                    <input 
                      type="number"
                      value={editingPayment.monthlyAmount}
                      onChange={e => setEditingPayment({...editingPayment, monthlyAmount: Number(e.target.value)})}
                      className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-stone-900"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Monto Recibido (Bs)</label>
                    <input 
                      type="number"
                      value={editingPayment.amountReceived}
                      onChange={e => setEditingPayment({...editingPayment, amountReceived: Number(e.target.value)})}
                      className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-stone-900"
                    />
                  </div>

                  {/* Recibo y Factura */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">N° Recibo</label>
                    <input 
                      type="text"
                      value={editingPayment.receiptNumber}
                      onChange={e => setEditingPayment({...editingPayment, receiptNumber: e.target.value})}
                      required
                      className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-stone-900"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">N° Factura</label>
                    <input 
                      type="text"
                      value={editingPayment.invoiceNumber || ''}
                      onChange={e => setEditingPayment({...editingPayment, invoiceNumber: e.target.value})}
                      className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-stone-900"
                    />
                  </div>

                  {/* Facturación */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">NIT / CI Factura</label>
                    <input 
                      type="text"
                      value={editingPayment.taxId || ''}
                      onChange={e => setEditingPayment({...editingPayment, taxId: e.target.value})}
                      className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-stone-900"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Nombre Factura</label>
                    <input 
                      type="text"
                      value={editingPayment.taxName || ''}
                      onChange={e => setEditingPayment({...editingPayment, taxName: e.target.value})}
                      className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-stone-900"
                    />
                  </div>

                  {/* Autorizado */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Autorizado</label>
                    <input 
                      type="text"
                      value={editingPayment.authorizationNumber || ''}
                      onChange={e => setEditingPayment({...editingPayment, authorizationNumber: e.target.value})}
                      className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-stone-950"
                    />
                  </div>

                  {/* Método Pago */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Método de Pago</label>
                    <select 
                      value={editingPayment.paymentMethod || 'Efectivo'}
                      onChange={e => setEditingPayment({...editingPayment, paymentMethod: e.target.value})}
                      className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-stone-950 appearance-none"
                    >
                      <option value="Efectivo">Efectivo</option>
                      <option value="Transferencia">Transferencia</option>
                      <option value="Tarjeta">Tarjeta</option>
                      <option value="Depósito">Depósito</option>
                    </select>
                  </div>

                  {/* Fechas */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Fecha Planificada</label>
                    <input 
                      type="date"
                      value={editingPayment.plannedPaymentDate || ''}
                      onChange={e => setEditingPayment({...editingPayment, plannedPaymentDate: e.target.value})}
                      className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-stone-900"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Fecha de Pago</label>
                    <input 
                      type="date"
                      value={editingPayment.paymentDate || ''}
                      onChange={e => setEditingPayment({...editingPayment, paymentDate: e.target.value})}
                      className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-stone-900"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Observaciones</label>
                  <textarea 
                    value={editingPayment.observations || ''}
                    onChange={e => setEditingPayment({...editingPayment, observations: e.target.value})}
                    className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-6 font-bold text-sm outline-none focus:border-stone-900 min-h-[80px] resize-none"
                  />
                </div>

                <div className="pt-6 border-t border-stone-100 flex items-center justify-end gap-6">
                  <button 
                    type="button" 
                    onClick={() => setEditingPayment(null)} 
                    className="px-8 py-4 text-stone-400 font-black uppercase tracking-widest text-[10px] hover:text-stone-900 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                     type="submit" 
                     disabled={isSavingEdit}
                     className="px-12 py-5 bg-bordeaux text-white rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl active:scale-95 flex items-center gap-3 group transition-all"
                  >
                    {isSavingEdit ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* MODAL VENTA DE LIBRO DESDE PAGOS */}
        {isBookSaleModalOpen && selectedEnrollment && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm"
               onClick={() => setIsBookSaleModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 z-10 overflow-y-auto max-h-[90vh]"
            >
              <h3 className="text-3xl font-black text-stone-900 tracking-tighter uppercase mb-2">VENDER LIBRO</h3>
              <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-6">
                REGISTRAR COMPRA PARA: <span className="text-orange-500 underline">{selectedEnrollment.firstName} {selectedEnrollment.lastName}</span>
              </p>
              <form onSubmit={handleSellBookSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Elegir Producto / Libro</label>
                  <select 
                    value={bookSaleFormData.bookId}
                    onChange={e => setBookSaleFormData({...bookSaleFormData, bookId: e.target.value})}
                    required
                    className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-orange-500"
                  >
                    <option value="">Seleccionar material...</option>
                    {books.map(b => (
                      <option key={b.id} value={b.id} disabled={b.stock <= 0}>
                        {b.title} - Bs.{b.price} ({b.stock} en stock)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Cantidad</label>
                  <input 
                    type="number"
                    min="1"
                    value={bookSaleFormData.quantity}
                    onChange={e => setBookSaleFormData({...bookSaleFormData, quantity: Number(e.target.value)})}
                    required
                    className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-orange-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Nº Recibo</label>
                  <input 
                    type="text"
                    placeholder="Ej: 1002"
                    value={bookSaleFormData.receiptNumber}
                    onChange={e => setBookSaleFormData({...bookSaleFormData, receiptNumber: e.target.value})}
                    required
                    className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-orange-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Descuento (Bs)</label>
                  <input 
                    type="number"
                    value={bookSaleFormData.discount}
                    onChange={e => setBookSaleFormData({...bookSaleFormData, discount: Number(e.target.value)})}
                    className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-orange-500"
                  />
                </div>
                <div className="space-y-2">
                    <div className="h-full flex flex-col justify-end">
                       <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Total Estimado</p>
                       <p className="text-4xl font-black text-stone-900">
                         Bs.{( (books.find(b => b.id === bookSaleFormData.bookId)?.price || 0) * bookSaleFormData.quantity ) - bookSaleFormData.discount}
                       </p>
                    </div>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Observaciones / Notas</label>
                  <textarea 
                    value={bookSaleFormData.observations}
                    onChange={e => setBookSaleFormData({...bookSaleFormData, observations: e.target.value})}
                    className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 font-bold text-sm outline-none focus:border-orange-500 min-h-[60px]"
                    placeholder="Detalle extra..."
                  />
                </div>
                <div className="md:col-span-2 pt-6 flex gap-4">
                  <button type="button" onClick={() => setIsBookSaleModalOpen(false)} className="flex-1 py-5 text-stone-400 font-bold uppercase tracking-widest text-[10px]">Cancelar</button>
                  <button 
                    type="submit" disabled={isSellingBook}
                    className="flex-[2] py-5 bg-orange-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isSellingBook ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-5 h-5" />}
                    Confirmar Venta
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
