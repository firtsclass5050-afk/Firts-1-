import React from 'react';
import { 
  BookOpen, 
  CheckCircle2, 
  Info, 
  HelpCircle, 
  Clock, 
  Users, 
  User as UserIcon, 
  PlusCircle, 
  CreditCard, 
  LayoutDashboard, 
  ShieldCheck 
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { motion } from 'motion/react';

const TEACHER_MANUAL = [
  {
    title: '1. Toma de Asistencia Diaria y Seguimiento',
    content: 'Dirígete al módulo "Asistencia" en el menú de navegación izquierdo. Selecciona el curso y la fecha actual de dictado. Haz clic en el estado correspondiente para cada alumno de la lista: Presente (verde), Ausente (rojo), Tarde (amarillo) o Licencia (azul). Es altamente recomendado registrar observaciones aclaratorias sobre inasistencias prolongadas o reiteradas para que la dirección se mantenga informada. Al finalizar la revisión, presiona indefectiblemente el botón "Guardar Asistencias" para asentar y registrar los cambios de manera definitiva en el Kardex Estudiantil del alumno.',
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />
  },
  {
    title: '2. Reportes de Progreso Mensual (Class Reports)',
    content: 'Accede al módulo "Class Reports" para rellenar tus informes de avance organizados mensualmente. El sistema está estructurado para registrar exactamente un reporte unificado por curso seleccionado y por cada mes del año. Puedes seleccionar de manera selectiva la modalidad del curso (Regular o Acelerado). Las clases personalizadas y las de los sábados cuentan con vistas equivalentes a la de lunes a viernes brindando un formato de cuadrícula uniforme de 25 celdas de avance para registrar sistemáticamente de manera amigable las fechas, las páginas avanzadas y un descriptor minucioso de la materia explicada.',
    icon: <Clock className="w-5 h-5 text-amber-500" />
  },
  {
    title: '3. Registro y Carga de Calificaciones',
    content: 'Ingresa al módulo "Mis Notas" para visualizar y administrar la carga académica asignada a tu perfil. Digita de forma cuantitativa las calificaciones periódicas y de exámenes de los alumnos. El sistema calcula en tiempo real e instantáneamente el promedio final respectivo de cada estudiante una vez que ingresas notas adicionales. Estas notas son transferidas inmediatamente al expediente académico del Kardex del alumno, de modo que estén listas para consulta de dirección o secretaría.',
    icon: <Info className="w-5 h-5 text-blue-500" />
  },
  {
    title: '4. Gestión y Control de Reemplazos',
    content: 'Si por motivos de fuerza mayor necesitas ausentarte o has realizado un reemplazo de clases a un colega, dirígete al módulo "Reemplazo de Clases". Presiona "Registrar Reemplazo" y completa el formulario con la sucursal, horario del curso, fecha de ejecución, el motivo comercial / personal de la suplencia y el docente seleccionado. Esto permite al equipo contable y de dirección llevar una auditoría justa y precisa de las horas devengadas para cada docente a fin de mes.',
    icon: <Users className="w-5 h-5 text-purple-500" />
  },
  {
    title: '5. Mi Perfil e Información de Contacto',
    content: 'Dentro de "Mi Perfil" puedes corroborar tu información de facilitador. Asegúrate de registrar correctamente tu número de teléfono móvil, tu dirección de correo electrónico institucional, disponibilidad horaria de sucursales y tus competencias curriculares. Mantener este apartado al día facilita el contacto expedito con administración escolar en caso de urgencias académicas.',
    icon: <UserIcon className="w-5 h-5 text-orange-500" />
  }
];

const ADMIN_MANUAL = [
  {
    title: '1. Inscripción y Alta de Nuevos Estudiantes',
    content: 'Para ingresar un nuevo matriculado, pulsa en el botón general "Inscripción" ubicado en el panel administrativo. Asegúrate de capturar el nombre completo del estudiante, filiación de contacto de tutores, número de teléfono primario, dirección y Cédula de Identidad (CI). Deberás asignar el curso de inicio y la sucursal correspondiente (Santa Cruz, Sopocachi, Central, Sur, etc.). Tras guardar, el sistema asignará de inmediato un Código de Estudiante institucional inteligente y creará su ficha de antecedentes académicos (Kardex) para que la información esté totalmente unificada.',
    icon: <PlusCircle className="w-5 h-5 text-blue-500" />
  },
  {
    title: '2. Gestión Administrativa de Cobros y Mensualidades',
    content: 'En la pantalla de "Pagos", ingresa el código o el apellido paterno del alumno. El sistema desplegará su estado de solvencia actual. Puedes añadir registros de pagos ingresando el monto cancelado, el método de cobro, el mes y el año calendario de la cuota amortizada. A través del widget del Dashboard administrativo, una alerta de campana roja ("Cuotas Atrasadas") se disparará automáticamente e indicará los deudores vigentes del periodo corriente para evitar pérdidas comerciales.',
    icon: <CreditCard className="w-5 h-5 text-emerald-500" />
  },
  {
    title: '3. Planificación y Gestión Curricular de Cursos',
    content: 'Define los grupos institucionales ingresando a "Gestión Curricular". Desde este módulo puedes crear nuevos cursos, dar de baja aulas inactivas, y definir características como nivel académico (Starter, Elementary, Intermediate, Advanced), el docente a cargo, fecha de inicio y término del programa de estudios, y si corresponde a días hábiles regulares o clases estructuradas de Sábados para una clasificación automática de los contadores.',
    icon: <LayoutDashboard className="w-5 h-5 text-amber-500" />
  },
  {
    title: '4. Auditoría Integral del Kardex Estudiantil',
    content: 'Utiliza la consulta de "Kardex" para analizar y supervisar los expedientes académicos de los estudiantes en tiempo real. Este panel centraliza de manera interactiva: asistencia acumulada clasificada por estados, notas acumuladas reportadas por el plantel docente responsable, e historial administrativo de cuotas saldadas. Es el documento oficial unificado que debe ser impreso o consultado para responder consultas de padres de familia o autorizar trámites de baja.',
    icon: <BookOpen className="w-5 h-5 text-stone-600" />
  },
  {
    title: '5. Aprobación de Cuentas de Personal y Permisos',
    content: 'En el panel "Usuarios" puedes supervisar y moderar las cuentas de acceso al software de gestión. Deberá aprobar manualmente todo registro con estado "Pendiente" antes de que el usuario logre iniciar sesión en la plataforma. Además, se le otorga la atribución exclusiva de seleccionar el rol adecuado (Profesor, Secretaría, Administrador) para el personal asignado, resguardando la consistencia y seguridad del sistema corporativo.',
    icon: <ShieldCheck className="w-5 h-5 text-rose-500" />
  }
];

export const UserManual = () => {
  const { viewMode } = useAuth();
  const manual = viewMode === 'admin' ? ADMIN_MANUAL : TEACHER_MANUAL;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col gap-2 relative">
        <div className="absolute -top-6 right-0">
          <span className="px-3 py-1 bg-stone-100 text-stone-400 text-[10px] font-black uppercase tracking-widest rounded-full">
            Versión 1.0.2
          </span>
        </div>
        <h2 className="text-4xl font-black text-stone-800 tracking-tight">Manual Operativo</h2>
        <p className="text-stone-500 font-bold text-sm uppercase tracking-widest flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          Guía detallada para el personal de {viewMode === 'admin' ? 'Dirección y Administración' : 'Cuerpo Docente'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {manual.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-8 bg-white rounded-[2.5rem] border-2 border-stone-100 shadow-sm hover:border-bordeaux-dark/20 transition-all group"
          >
            <div className="flex items-start gap-6">
              <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                {item.icon}
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="text-xl font-bold text-stone-800">{item.title}</h3>
                <p className="text-stone-600 leading-relaxed font-medium text-xs md:text-sm">
                  {item.content}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="p-8 bg-bordeaux-dark/5 rounded-[2.5rem] border-2 border-bordeaux-dark/10">
        <div className="flex items-center gap-4 mb-4">
          <HelpCircle className="w-8 h-8 text-bordeaux-dark" />
          <h3 className="text-xl font-black text-bordeaux-dark">¿Necesitas más ayuda?</h3>
        </div>
        <p className="text-bordeaux-dark/70 font-bold text-xs md:text-sm">
          Si tienes dudas adicionales sobre el uso del sistema, por favor contacta con el soporte técnico o con la Dirección General. Este manual se actualiza periódicamente con nuevas funciones.
        </p>
      </div>
    </div>
  );
};
