import React, { useState, useEffect } from 'react';
import { 
  Search, 
  ShoppingBag, 
  DollarSign, 
  FileText, 
  Plus, 
  Save, 
  X, 
  Package, 
  RefreshCw, 
  Trash2, 
  Printer, 
  History, 
  LayoutDashboard, 
  PlusCircle, 
  AlertCircle, 
  TrendingUp, 
  Edit3, 
  ArrowUpRight, 
  ArrowUp, 
  Layers, 
  Tag, 
  CheckCircle,
  Filter,
  Boxes
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  serverTimestamp, 
  orderBy, 
  increment, 
  writeBatch 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Book, BookSale, BookStockLog, Enrollment } from '../types';
import { useAuth } from '../AuthContext';
import { cn } from '../utils/cn';
import { handleFirestoreError, OperationType } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const BookSalesManagement = () => {
  const { profile, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'history'>('dashboard');
  const [sales, setSales] = useState<BookSale[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [stockLogs, setStockLogs] = useState<BookStockLog[]>([]);
  const [students, setStudents] = useState<Enrollment[]>([]);
  const [search, setSearch] = useState('');
  
  // Modals state
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History filtering
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'sales' | 'stock'>('all');
  const [selectedBookFilter, setSelectedBookFilter] = useState<string>('all');

  const [saleFormData, setSaleFormData] = useState({
    customerName: '',
    studentId: '',
    studentCode: '',
    bookId: '',
    quantity: 1,
    receiptNumber: '',
    discount: 0,
    observations: ''
  });

  const [bookFormData, setBookFormData] = useState({
    title: '',
    price: 0,
    stock: 0
  });

  // Edit / Add Stock Form state
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    price: 0,
    currentStock: 0,
    additionalStock: 0,
    notes: ''
  });

  useEffect(() => {
    const unsubSales = onSnapshot(
      query(collection(db, 'bookSales'), orderBy('createdAt', 'desc')), 
      (snapshot) => {
        setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BookSale)));
      }, 
      (error) => handleFirestoreError(error, OperationType.LIST, 'bookSales')
    );

    const unsubBooks = onSnapshot(
      query(collection(db, 'books'), orderBy('title', 'asc')), 
      (snapshot) => {
        setBooks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Book)));
      }, 
      (error) => handleFirestoreError(error, OperationType.LIST, 'books')
    );

    const unsubStockLogs = onSnapshot(
      query(collection(db, 'bookStockHistory'), orderBy('createdAt', 'desc')), 
      (snapshot) => {
        setStockLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BookStockLog)));
      }, 
      (error) => handleFirestoreError(error, OperationType.LIST, 'bookStockHistory')
    );

    const unsubStudents = onSnapshot(
      query(collection(db, 'enrollments'), where('status', '==', 'active')), 
      (snapshot) => {
        setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Enrollment)));
      }, 
      (error) => handleFirestoreError(error, OperationType.LIST, 'enrollments')
    );

    return () => {
      unsubSales();
      unsubBooks();
      unsubStockLogs();
      unsubStudents();
    };
  }, []);

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const bookRef = await addDoc(collection(db, 'books'), {
        ...bookFormData,
        createdAt: serverTimestamp()
      });

      // If initial stock was given > 0, log it in stock history
      if (bookFormData.stock > 0) {
        await addDoc(collection(db, 'bookStockHistory'), {
          bookId: bookRef.id,
          bookTitle: bookFormData.title,
          quantityAdded: Number(bookFormData.stock),
          previousStock: 0,
          newStock: Number(bookFormData.stock),
          notes: 'Stock inicial al crear el producto en inventario',
          createdBy: user?.uid || 'admin',
          creatorName: profile?.displayName || profile?.email || 'Administrador',
          createdAt: serverTimestamp()
        });
      }

      setIsBookModalOpen(false);
      setBookFormData({ title: '', price: 0, stock: 0 });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'books');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditModal = (book: Book) => {
    setEditingBook(book);
    setEditFormData({
      title: book.title,
      price: book.price,
      currentStock: book.stock,
      additionalStock: 0,
      notes: ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateBookAndStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBook || !editingBook.id) return;
    setIsSubmitting(true);
    try {
      const added = Number(editFormData.additionalStock) || 0;
      const previousStock = editingBook.stock;
      const finalStock = previousStock + added;

      if (added < 0) {
        alert('La cantidad a agregar no puede ser negativa.');
        setIsSubmitting(false);
        return;
      }

      const bookRef = doc(db, 'books', editingBook.id);
      
      if (added > 0) {
        const batch = writeBatch(db);
        
        batch.update(bookRef, {
          title: editFormData.title.trim(),
          price: Number(editFormData.price),
          stock: finalStock
        });

        const historyRef = doc(collection(db, 'bookStockHistory'));
        batch.set(historyRef, {
          bookId: editingBook.id,
          bookTitle: editFormData.title.trim(),
          quantityAdded: added,
          previousStock: previousStock,
          newStock: finalStock,
          notes: editFormData.notes.trim() || 'Aumento de stock en inventario',
          createdBy: user?.uid || 'admin',
          creatorName: profile?.displayName || profile?.email || 'Administrador',
          createdAt: serverTimestamp()
        });

        await batch.commit();
      } else {
        // Just updating title/price
        await updateDoc(bookRef, {
          title: editFormData.title.trim(),
          price: Number(editFormData.price)
        });
      }

      setIsEditModalOpen(false);
      setEditingBook(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'books');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const book = books.find(b => b.id === saleFormData.bookId);

      if (!book) {
         alert('Seleccione un producto válido');
         setIsSubmitting(false);
         return;
      }

      if (book.stock < saleFormData.quantity) {
         alert(`Stock insuficiente. Solo quedan ${book.stock} unidades.`);
         setIsSubmitting(false);
         return;
      }

      const total = (book.price * saleFormData.quantity) - saleFormData.discount;

      const batch = writeBatch(db);
      
      const saleRef = doc(collection(db, 'bookSales'));
      batch.set(saleRef, {
        bookId: book.id,
        bookTitle: book.title,
        customerName: saleFormData.customerName,
        studentId: saleFormData.studentId || null,
        studentCode: saleFormData.studentCode || null,
        receiptNumber: saleFormData.receiptNumber,
        price: book.price,
        quantity: saleFormData.quantity,
        discount: saleFormData.discount,
        total: total,
        observations: saleFormData.observations,
        createdBy: user?.uid || 'admin',
        createdAt: serverTimestamp()
      });

      const bookRef = doc(db, 'books', book.id!);
      batch.update(bookRef, {
        stock: increment(-saleFormData.quantity)
      });

      await batch.commit();

      setIsSaleModalOpen(false);
      setSaleFormData({
        customerName: '',
        studentId: '',
        studentCode: '',
        bookId: '',
        quantity: 1,
        receiptNumber: '',
        discount: 0,
        observations: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'bookSales');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBook = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este producto del inventario?')) {
      try {
        await deleteDoc(doc(db, 'books', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'books');
      }
    }
  };

  const generateReceiptPDF = (sale: BookSale) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(30, 30, 30);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text('RECIBO VENTA DE LIBRO', pageWidth / 2, 25, { align: 'center' });
    
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    doc.text(`Nº RECIBO: ${sale.receiptNumber}`, pageWidth - 20, 50, { align: 'right' });
    doc.text(`FECHA: ${new Date().toLocaleDateString()}`, pageWidth - 20, 55, { align: 'right' });

    autoTable(doc, {
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

    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFont('helvetica', 'italic');
    doc.text('Este documento es un comprobante de adquisición de material didáctico.', 20, finalY);
    
    doc.save(`ReciboLibro_${sale.receiptNumber}.pdf`);
  };

  const stats = {
    totalRevenue: sales.reduce((acc, s) => acc + s.total, 0),
    totalSales: sales.length,
    lowStock: books.filter(b => b.stock < 5).length,
    totalInventoryUnits: books.reduce((acc, b) => acc + (b.stock || 0), 0),
    totalRestocks: stockLogs.length
  };

  // Inventory filtered items
  const filteredBooks = books.filter(b => 
    b.title.toLowerCase().includes(search.toLowerCase())
  );

  // Unified history items
  const combinedHistory = [
    ...sales.map(s => {
      const date = s.createdAt?.toDate ? s.createdAt.toDate() : (s.createdAt ? new Date(s.createdAt) : new Date());
      return {
        id: s.id,
        kind: 'sale' as const,
        timestamp: date,
        bookId: s.bookId,
        bookTitle: s.bookTitle,
        title: `Venta de Libro: ${s.bookTitle}`,
        subtitle: `Cliente: ${s.customerName} • Recibo #${s.receiptNumber}`,
        quantity: s.quantity,
        total: s.total,
        discount: s.discount,
        observations: s.observations,
        rawSale: s
      };
    }),
    ...stockLogs.map(l => {
      const date = l.createdAt?.toDate ? l.createdAt.toDate() : (l.createdAt ? new Date(l.createdAt) : new Date());
      return {
        id: l.id,
        kind: 'stock_addition' as const,
        timestamp: date,
        bookId: l.bookId,
        bookTitle: l.bookTitle,
        title: `Aumento de Stock: ${l.bookTitle}`,
        subtitle: `+${l.quantityAdded} unidades • Stock: ${l.previousStock} ➔ ${l.newStock}`,
        quantityAdded: l.quantityAdded,
        previousStock: l.previousStock,
        newStock: l.newStock,
        notes: l.notes,
        creatorName: l.creatorName || l.createdBy,
        rawLog: l
      };
    })
  ]
  .filter(item => {
    // Filter by type
    if (historyTypeFilter === 'sales' && item.kind !== 'sale') return false;
    if (historyTypeFilter === 'stock' && item.kind !== 'stock_addition') return false;
    
    // Filter by selected book
    if (selectedBookFilter !== 'all' && item.bookId !== selectedBookFilter && item.bookTitle !== selectedBookFilter) {
      return false;
    }

    // Filter by search text
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      item.bookTitle.toLowerCase().includes(term) ||
      (item.kind === 'sale' && (
        item.rawSale.customerName.toLowerCase().includes(term) || 
        item.rawSale.receiptNumber.toLowerCase().includes(term)
      )) ||
      (item.kind === 'stock_addition' && (
        (item.notes && item.notes.toLowerCase().includes(term)) ||
        (item.creatorName && item.creatorName.toLowerCase().includes(term))
      ))
    );
  })
  .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <div className="space-y-8">
      {/* Header with Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-primary/10 text-orange-primary flex items-center justify-center font-black">
              <Boxes className="w-6 h-6" />
            </div>
            <h2 className="text-4xl font-black text-stone-900 tracking-tighter">VENTA E INVENTARIO DE LIBROS</h2>
          </div>
          <p className="text-stone-500 font-bold mt-1">Control de material didáctico, ventas, reabastecimiento y stock histórico.</p>
        </div>
        <div className="flex gap-2 bg-stone-100 p-1.5 rounded-2xl">
          {[
            { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
            { id: 'inventory', label: 'Inventario', icon: Package },
            { id: 'history', label: 'Historial', icon: History }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                if (tab.id !== 'history') {
                  setSelectedBookFilter('all');
                }
              }}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all",
                activeTab === tab.id 
                  ? "bg-white text-orange-primary shadow-sm" 
                  : "text-stone-400 hover:text-stone-900"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* DASHBOARD VIEW */}
      {activeTab === 'dashboard' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-7 rounded-[2.5rem] text-white shadow-xl shadow-emerald-200/50">
               <DollarSign className="w-9 h-9 mb-4 opacity-70" />
               <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Ingresos Totales</p>
               <h3 className="text-3xl font-black">${stats.totalRevenue.toLocaleString()}</h3>
            </div>
            <div className="bg-white p-7 rounded-[2.5rem] border border-stone-100 shadow-sm">
               <ShoppingBag className="w-9 h-9 mb-4 text-orange-primary opacity-30" />
               <p className="text-[10px] font-black text-stone-300 uppercase tracking-[0.2em] mb-1">Ventas Realizadas</p>
               <h3 className="text-3xl font-black text-stone-900">{stats.totalSales}</h3>
            </div>
            <div className="bg-white p-7 rounded-[2.5rem] border border-stone-100 shadow-sm">
               <Boxes className="w-9 h-9 mb-4 text-blue-500 opacity-30" />
               <p className="text-[10px] font-black text-stone-300 uppercase tracking-[0.2em] mb-1">Unidades en Almacén</p>
               <h3 className="text-3xl font-black text-stone-900">{stats.totalInventoryUnits}</h3>
            </div>
            <div className="bg-white p-7 rounded-[2.5rem] border border-stone-100 shadow-sm relative overflow-hidden">
               {stats.lowStock > 0 && (
                 <div className="absolute top-4 right-4 animate-pulse">
                    <AlertCircle className="w-6 h-6 text-rose-500" />
                 </div>
               )}
               <Package className="w-9 h-9 mb-4 text-bordeaux opacity-30" />
               <p className="text-[10px] font-black text-stone-300 uppercase tracking-[0.2em] mb-1">Stock Bajo (&lt;5)</p>
               <h3 className={cn("text-3xl font-black", stats.lowStock > 0 ? "text-rose-500" : "text-stone-900")}>
                 {stats.lowStock}
               </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="bg-white p-10 rounded-[3rem] border border-stone-100 shadow-sm flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-orange-50 rounded-[2rem] flex items-center justify-center text-orange-primary mb-6">
                   <ShoppingBag className="w-10 h-10" />
                </div>
                <h4 className="text-2xl font-black text-stone-900 mb-2">Registrar Venta</h4>
                <p className="text-stone-500 text-sm mb-8 px-8">Realiza una nueva venta a un alumno del instituto o cliente particular.</p>
                <button 
                  onClick={() => setIsSaleModalOpen(true)}
                  className="w-full py-5 bg-orange-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all hover:bg-orange-dark flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Nueva Venta
                </button>
             </div>
             <div className="bg-white p-10 rounded-[3rem] border border-stone-100 shadow-sm flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-emerald-50 rounded-[2rem] flex items-center justify-center text-emerald-600 mb-6">
                   <PlusCircle className="w-10 h-10" />
                </div>
                <h4 className="text-2xl font-black text-stone-900 mb-2">Nuevo Producto</h4>
                <p className="text-stone-500 text-sm mb-8 px-8">Agrega un nuevo libro, guía de estudio o material didáctico al catálogo.</p>
                <button 
                  onClick={() => setIsBookModalOpen(true)}
                  className="w-full py-5 bg-bordeaux text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all hover:bg-bordeaux-dark flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  Crear Producto
                </button>
             </div>
          </div>

          {/* Recent movements preview */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xl font-black text-stone-900">Últimos Movimientos del Inventario</h4>
                <p className="text-xs font-bold text-stone-400">Últimas ventas y aumentos de stock registrados</p>
              </div>
              <button 
                onClick={() => setActiveTab('history')}
                className="text-xs font-black uppercase tracking-widest text-orange-primary hover:underline flex items-center gap-1.5"
              >
                Ver todo el historial <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {combinedHistory.slice(0, 5).map(item => (
                <div 
                  key={item.id}
                  className="p-4 rounded-2xl bg-stone-50 border border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-100/60 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center font-black",
                      item.kind === 'sale' ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                    )}>
                      {item.kind === 'sale' ? <ShoppingBag className="w-5 h-5" /> : <ArrowUp className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider",
                          item.kind === 'sale' ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                        )}>
                          {item.kind === 'sale' ? 'Venta' : 'Aumento de Stock'}
                        </span>
                        <h5 className="font-black text-sm text-stone-900">{item.bookTitle}</h5>
                      </div>
                      <p className="text-xs text-stone-500 font-medium mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="text-right sm:pl-4">
                    <span className="text-[10px] font-bold text-stone-400">
                      {item.timestamp.toLocaleDateString()} {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
              {combinedHistory.length === 0 && (
                <p className="text-center py-8 text-stone-400 text-xs font-bold uppercase tracking-widest">
                  No hay movimientos registrados aún
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* INVENTORY TAB */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 relative group flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="flex-1 flex items-center gap-3 bg-stone-50 border-2 border-stone-100 rounded-2xl px-4 py-1.5 focus-within:bg-white focus-within:border-orange-primary focus-within:ring-4 focus-within:ring-orange-primary/5 transition-all">
              <Search className="w-5 h-5 text-stone-400" />
              <input 
                type="text"
                placeholder="Buscar producto por título..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent py-2.5 outline-none text-sm font-bold text-stone-800"
              />
            </div>
            <button 
              onClick={() => setIsBookModalOpen(true)}
              className="bg-bordeaux text-white px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-bordeaux-dark transition-all whitespace-nowrap shadow-md flex items-center justify-center gap-2 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Nuevo Producto
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBooks.map(book => (
              <div 
                key={book.id} 
                className="bg-white p-7 rounded-[2.5rem] border border-stone-100 shadow-sm relative group flex flex-col justify-between hover:shadow-xl transition-all"
              >
                <div>
                  <div className="flex justify-between items-start mb-5">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">
                        Stock Actual
                      </span>
                      <div className={cn(
                        "px-4 py-2 rounded-2xl flex items-center gap-2 font-black text-2xl w-fit",
                        book.stock < 5 ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                      )}>
                        <Package className="w-5 h-5" />
                        {book.stock}
                        <span className="text-xs font-bold text-stone-400">unid.</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleDeleteBook(book.id!)}
                        className="p-2.5 text-stone-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                        title="Eliminar producto"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-stone-900 mb-1">{book.title}</h3>
                    <p className="text-2xl font-black text-orange-primary">${book.price}</p>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-stone-100 space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                    <span className="text-stone-400">Estado</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-md",
                      book.stock < 5 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                    )}>
                      {book.stock < 5 ? 'Reabastecer Urgente' : 'Stock Disponible'}
                    </span>
                  </div>

                  {/* Actions for this book */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      onClick={() => handleOpenEditModal(book)}
                      className="py-3 px-3 bg-stone-900 hover:bg-orange-primary text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Editar / + Stock
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBookFilter(book.id || book.title);
                        setActiveTab('history');
                      }}
                      className="py-3 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <History className="w-3.5 h-3.5" />
                      Historial
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {filteredBooks.length === 0 && (
              <div className="col-span-full py-20 bg-stone-50 rounded-[3rem] border-2 border-dashed border-stone-200 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
                No se encontraron libros en el inventario
              </div>
            )}
          </div>
        </div>
      )}

      {/* HISTORY TAB (Combined sales & stock additions) */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Type Filter Buttons */}
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'Todos los Movimientos', count: combinedHistory.length },
                  { id: 'stock', label: '📦 Aumentos de Stock', count: stockLogs.length },
                  { id: 'sales', label: '🛒 Ventas', count: sales.length }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setHistoryTypeFilter(f.id as any)}
                    className={cn(
                      "px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2",
                      historyTypeFilter === f.id 
                        ? "bg-orange-primary text-white shadow-md shadow-orange-500/20" 
                        : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Specific Book Dropdown Filter */}
              <div className="flex items-center gap-2 min-w-[240px]">
                <Filter className="w-4 h-4 text-stone-400" />
                <select
                  value={selectedBookFilter}
                  onChange={(e) => setSelectedBookFilter(e.target.value)}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-xl px-3 py-2 text-xs font-bold text-stone-700 outline-none focus:border-orange-primary"
                >
                  <option value="all">Todos los productos</option>
                  {books.map(b => (
                    <option key={b.id} value={b.id || b.title}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-3 bg-stone-50 border-2 border-stone-100 rounded-2xl px-4 py-1.5 focus-within:bg-white focus-within:border-orange-primary focus-within:ring-4 focus-within:ring-orange-primary/5 transition-all">
              <Search className="w-5 h-5 text-stone-400" />
              <input 
                type="text"
                placeholder="Buscar por libro, cliente, notas, autor o nº de recibo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent py-2.5 outline-none text-sm font-bold text-stone-800"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-stone-400 hover:text-stone-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* History List */}
          <div className="space-y-4">
            {combinedHistory.map(item => {
              if (item.kind === 'stock_addition') {
                return (
                  <div 
                    key={item.id}
                    className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-stone-100 shadow-sm relative group hover:shadow-md transition-all border-l-8 border-l-emerald-500"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 font-black shadow-inner">
                          <ArrowUp className="w-7 h-7" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                              <Package className="w-3 h-3" /> Aumento de Stock
                            </span>
                            <span className="text-xs font-bold text-stone-400">
                              {item.timestamp.toLocaleDateString('es-ES', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                              })} a las {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <h4 className="text-xl font-black text-stone-900">{item.bookTitle}</h4>
                          <div className="flex items-center gap-3 text-xs font-bold text-stone-600">
                            <span className="text-emerald-600 font-black bg-emerald-50 px-2.5 py-1 rounded-md">
                              +{item.quantityAdded} unidades agregadas
                            </span>
                            <span className="text-stone-400">
                              (Stock anterior: {item.previousStock} ➔ Nuevo stock: <strong className="text-stone-800">{item.newStock}</strong>)
                            </span>
                          </div>
                          {item.notes && (
                            <p className="text-xs text-stone-500 italic mt-2 bg-stone-50 p-2.5 rounded-xl border border-stone-100 max-w-2xl">
                              Motivo / Nota: {item.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex md:flex-col items-center md:items-end justify-between border-t md:border-t-0 pt-3 md:pt-0 border-stone-100 text-right">
                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                          Registrado por
                        </span>
                        <span className="text-xs font-bold text-stone-700 bg-stone-100 px-3 py-1 rounded-lg mt-0.5">
                          {item.creatorName}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              // Sale card
              const sale = item.rawSale;
              return (
                <div 
                  key={item.id}
                  className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-stone-100 shadow-sm relative group hover:shadow-md transition-all border-l-8 border-l-amber-500"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 font-black shadow-inner">
                        <ShoppingBag className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                            <Tag className="w-3 h-3" /> Venta de Libro
                          </span>
                          <span className="text-xs font-bold text-stone-400">
                            {item.timestamp.toLocaleDateString('es-ES', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })} a las {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-xs font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                            Recibo: #{sale.receiptNumber}
                          </span>
                        </div>
                        <h4 className="text-xl font-black text-stone-900">{sale.bookTitle}</h4>
                        <div className="flex items-center gap-3 text-xs font-bold text-stone-600">
                          <span>Cliente: <strong className="text-stone-900">{sale.customerName}</strong></span>
                          <span>•</span>
                          <span>Cantidad: <strong className="text-stone-900">{sale.quantity} unid.</strong></span>
                        </div>
                        {sale.observations && (
                          <p className="text-xs text-stone-500 italic mt-2 bg-stone-50 p-2.5 rounded-xl border border-stone-100 max-w-2xl">
                            Obs: {sale.observations}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-stone-100">
                      <div className="text-left md:text-right">
                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">
                          Total Pagado
                        </span>
                        <span className="text-2xl font-black text-emerald-600">
                          ${sale.total}
                        </span>
                      </div>
                      <button 
                        onClick={() => generateReceiptPDF(sale)}
                        className="p-3.5 bg-stone-100 text-stone-700 hover:bg-orange-primary hover:text-white rounded-2xl transition-all shadow-sm flex items-center gap-2 font-bold text-xs uppercase tracking-wider"
                        title="Imprimir Recibo"
                      >
                        <Printer className="w-4 h-4" />
                        <span className="hidden sm:inline">Recibo</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {combinedHistory.length === 0 && (
              <div className="py-20 bg-stone-50 rounded-[3rem] border-2 border-dashed border-stone-200 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">
                No se encontraron registros en el historial
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      <AnimatePresence>
        {/* MODAL: EDIT PRODUCT & INCREASE STOCK */}
        {isEditModalOpen && editingBook && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm"
               onClick={() => setIsEditModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden p-8 md:p-10"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-black text-stone-900 tracking-tighter uppercase">EDITAR PRODUCTO Y STOCK</h3>
                  <p className="text-xs font-bold text-stone-400">Actualiza los datos o reabastece el inventario</p>
                </div>
                <button 
                  onClick={() => setIsEditModalOpen(false)} 
                  className="p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateBookAndStock} className="space-y-6">
                {/* Book Details */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Título del Libro / Material</label>
                  <input 
                    type="text"
                    value={editFormData.title}
                    onChange={e => setEditFormData({...editFormData, title: e.target.value})}
                    required
                    className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-5 py-3.5 font-bold outline-none focus:border-orange-primary text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Precio ($)</label>
                    <input 
                      type="number"
                      min="0"
                      step="any"
                      value={editFormData.price}
                      onChange={e => setEditFormData({...editFormData, price: Number(e.target.value)})}
                      required
                      className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-5 py-3.5 font-bold outline-none focus:border-orange-primary text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Stock Actual</label>
                    <div className="w-full bg-stone-100 border-2 border-stone-200/60 rounded-2xl px-5 py-3.5 font-black text-stone-700 text-sm flex items-center justify-between">
                      <span>{editingBook.stock} unidades</span>
                      <Package className="w-4 h-4 text-stone-400" />
                    </div>
                  </div>
                </div>

                {/* Stock Addition Section */}
                <div className="bg-orange-50/70 border-2 border-orange-100 p-6 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="font-black text-xs uppercase tracking-widest text-orange-900 flex items-center gap-1.5">
                      <ArrowUp className="w-4 h-4 text-orange-primary" />
                      Aumentar Stock / Reabastecimiento
                    </h5>
                    {editFormData.additionalStock > 0 && (
                      <span className="text-[11px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                        +{editFormData.additionalStock} unid.
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-orange-900/60 uppercase tracking-widest">
                      Cantidad a agregar al inventario
                    </label>
                    <input 
                      type="number"
                      min="0"
                      value={editFormData.additionalStock}
                      onChange={e => setEditFormData({...editFormData, additionalStock: Math.max(0, Number(e.target.value))})}
                      placeholder="0"
                      className="w-full bg-white border-2 border-orange-200 rounded-2xl px-5 py-3 font-black text-lg text-stone-900 outline-none focus:border-orange-primary"
                    />
                  </div>

                  {/* Preset Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <span className="text-[10px] font-bold text-orange-900/50 self-center mr-1">Rápido:</span>
                    {[5, 10, 20, 50, 100].map(amount => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setEditFormData(prev => ({ 
                          ...prev, 
                          additionalStock: (Number(prev.additionalStock) || 0) + amount 
                        }))}
                        className="px-3 py-1.5 bg-white border border-orange-200 hover:border-orange-primary text-orange-900 font-black text-xs rounded-xl shadow-xs active:scale-95 transition-all"
                      >
                        +{amount}
                      </button>
                    ))}
                    {editFormData.additionalStock > 0 && (
                      <button
                        type="button"
                        onClick={() => setEditFormData(prev => ({ ...prev, additionalStock: 0 }))}
                        className="px-3 py-1.5 bg-rose-50 text-rose-600 font-bold text-xs rounded-xl hover:bg-rose-100"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>

                  {/* Stock Calculation Preview */}
                  <div className="p-3.5 bg-white rounded-2xl border border-orange-100 flex items-center justify-between text-xs font-bold">
                    <span className="text-stone-500">Nuevo Stock Total Resultante:</span>
                    <span className="text-base font-black text-stone-900">
                      {editingBook.stock + (Number(editFormData.additionalStock) || 0)} unidades
                    </span>
                  </div>

                  {/* Notes / Reason for Restock */}
                  {editFormData.additionalStock > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[10px] font-black text-orange-900/60 uppercase tracking-widest">
                        Motivo / Nota del aumento (se guardará en el historial)
                      </label>
                      <input 
                        type="text"
                        value={editFormData.notes}
                        onChange={e => setEditFormData({...editFormData, notes: e.target.value})}
                        placeholder="Ej: Pedido recibido de editorial / Reabastecimiento mensual"
                        className="w-full bg-white border-2 border-orange-200 rounded-xl px-4 py-2.5 text-xs font-bold text-stone-800 outline-none focus:border-orange-primary"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-2 flex gap-4">
                  <button 
                    type="button" 
                    onClick={() => setIsEditModalOpen(false)} 
                    className="flex-1 py-4 text-stone-400 font-black uppercase tracking-widest text-[10px] hover:text-stone-700"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="flex-[2] py-4 bg-stone-900 hover:bg-orange-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                  >
                    {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* MODAL: CREATE BOOK */}
        {isBookModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm"
               onClick={() => setIsBookModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden p-10"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-3xl font-black text-stone-900 tracking-tighter uppercase">CREAR PRODUCTO</h3>
                  <p className="text-xs font-bold text-stone-400">Agrega un nuevo libro o material al inventario</p>
                </div>
                <button onClick={() => setIsBookModalOpen(false)} className="p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateBook} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Título del Libro</label>
                  <input 
                    type="text"
                    value={bookFormData.title}
                    onChange={e => setBookFormData({...bookFormData, title: e.target.value})}
                    required
                    placeholder="Ej: Speak Out Starter"
                    className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-orange-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Precio ($)</label>
                    <input 
                      type="number"
                      min="0"
                      step="any"
                      value={bookFormData.price}
                      onChange={e => setBookFormData({...bookFormData, price: Number(e.target.value)})}
                      required
                      className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-orange-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Stock Inicial</label>
                    <input 
                      type="number"
                      min="0"
                      value={bookFormData.stock}
                      onChange={e => setBookFormData({...bookFormData, stock: Number(e.target.value)})}
                      required
                      className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-orange-primary"
                    />
                  </div>
                </div>
                <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => setIsBookModalOpen(false)} className="flex-1 py-5 text-stone-400 font-black uppercase tracking-widest text-[10px]">Cerrar</button>
                  <button 
                    type="submit" disabled={isSubmitting}
                    className="flex-[2] py-5 bg-bordeaux text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar Producto
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* MODAL: REGISTER SALE */}
        {isSaleModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm"
               onClick={() => setIsSaleModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden p-10"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-3xl font-black text-stone-900 tracking-tighter uppercase">REGISTRAR VENTA</h3>
                  <p className="text-xs font-bold text-stone-400">Emisión de comprobante y descuento automático de stock</p>
                </div>
                <button onClick={() => setIsSaleModalOpen(false)} className="p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddSale} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Tipo de Cliente</label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSaleFormData(prev => ({ ...prev, studentId: '', studentCode: '', customerName: '' }));
                      }}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-xl border-2 font-bold text-xs uppercase tracking-wider transition-all",
                        !saleFormData.studentId ? "border-orange-primary bg-orange-50 text-orange-primary" : "border-stone-100 bg-stone-50 text-stone-400"
                      )}
                    >
                      Cliente Externo / Particular
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (students.length > 0) {
                          const firstStd = students[0];
                          setSaleFormData(prev => ({ 
                            ...prev, 
                            studentId: firstStd.id || '', 
                            studentCode: firstStd.studentCode || '', 
                            customerName: `${firstStd.firstName} ${firstStd.lastName}` 
                          }));
                        } else {
                          alert("No hay alumnos activos registrados.");
                        }
                      }}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-xl border-2 font-bold text-xs uppercase tracking-wider transition-all",
                        saleFormData.studentId ? "border-orange-primary bg-orange-50 text-orange-primary" : "border-stone-100 bg-stone-50 text-stone-400"
                      )}
                    >
                      Alumno Registrado
                    </button>
                  </div>
                </div>

                {!saleFormData.studentId ? (
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Nombre del Cliente Particular</label>
                    <input 
                      type="text"
                      placeholder="Escriba el nombre completo del cliente..."
                      value={saleFormData.customerName}
                      onChange={e => setSaleFormData({...saleFormData, customerName: e.target.value})}
                      required
                      className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-orange-primary"
                    />
                  </div>
                ) : (
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Seleccionar Alumno</label>
                    <select 
                      value={saleFormData.studentId}
                      onChange={e => {
                        const std = students.find(s => s.id === e.target.value);
                        if (std) {
                          setSaleFormData({
                            ...saleFormData,
                            studentId: std.id || '',
                            studentCode: std.studentCode || '',
                            customerName: `${std.firstName} ${std.lastName}`
                          });
                        }
                      }}
                      required
                      className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-orange-primary"
                    >
                      <option value="">Seleccionar alumno...</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} {s.lastName} ({s.studentCode})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Elegir Producto</label>
                  <select 
                    value={saleFormData.bookId}
                    onChange={e => setSaleFormData({...saleFormData, bookId: e.target.value})}
                    required
                    className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-orange-primary"
                  >
                    <option value="">Seleccionar producto...</option>
                    {books.map(b => (
                      <option key={b.id} value={b.id} disabled={b.stock <= 0}>
                        {b.title} - ${b.price} ({b.stock} en stock {b.stock <= 0 ? '- AGOTADO' : ''})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Cantidad</label>
                  <input 
                    type="number"
                    min="1"
                    value={saleFormData.quantity}
                    onChange={e => setSaleFormData({...saleFormData, quantity: Number(e.target.value)})}
                    required
                    className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-orange-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Nº Recibo</label>
                  <input 
                    type="text"
                    value={saleFormData.receiptNumber}
                    onChange={e => setSaleFormData({...saleFormData, receiptNumber: e.target.value})}
                    required
                    className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-orange-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Descuento ($)</label>
                  <input 
                    type="number"
                    value={saleFormData.discount}
                    onChange={e => setSaleFormData({...saleFormData, discount: Number(e.target.value)})}
                    className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-orange-primary"
                  />
                </div>
                <div className="space-y-2">
                    <div className="h-full flex flex-col justify-end">
                       <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Total Estimado</p>
                       <p className="text-4xl font-black text-stone-900">
                         ${Math.max(0, ((books.find(b => b.id === saleFormData.bookId)?.price || 0) * saleFormData.quantity) - saleFormData.discount)}
                       </p>
                    </div>
                </div>
                <div className="md:col-span-2 pt-6 flex gap-4">
                  <button type="button" onClick={() => setIsSaleModalOpen(false)} className="flex-1 py-5 text-stone-400 font-bold uppercase tracking-widest text-[10px]">Cancelar</button>
                  <button 
                    type="submit" disabled={isSubmitting}
                    className="flex-[2] py-5 bg-orange-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-5 h-5" />}
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
