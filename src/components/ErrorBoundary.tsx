import React from 'react';
import { X } from 'lucide-react';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Algo salió mal.";
      try {
        const parsedError = JSON.parse(this.state.error.message);
        if (parsedError.error) {
          errorMessage = `Error de Firestore: ${parsedError.error} en ${parsedError.operationType} ${parsedError.path || ''}`;
        }
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-red-100">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <X className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-stone-900 mb-4">¡Ups! Algo salió mal</h2>
            <p className="text-stone-600 mb-6 text-sm">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-stone-900 text-white py-3 rounded-xl font-bold hover:bg-black transition-colors"
            >
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
