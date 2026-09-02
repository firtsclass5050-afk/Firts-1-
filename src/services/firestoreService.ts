import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { toast } from 'react-hot-toast';

export const firestoreService = {
  create: async (collectionName: string, data: any, successMessage?: string) => {
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: serverTimestamp()
      });
      if (successMessage) toast.success(successMessage);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, collectionName);
      throw error;
    }
  },

  update: async (collectionName: string, id: string, data: any, successMessage?: string) => {
    try {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, data);
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, collectionName);
      throw error;
    }
  },

  delete: async (collectionName: string, id: string, successMessage?: string) => {
    if (!window.confirm('¿Está seguro de que desea eliminar este registro?')) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, collectionName);
      throw error;
    }
  },

  upsert: async (collectionName: string, id: string, data: any, successMessage?: string) => {
    try {
      await setDoc(doc(db, collectionName, id), data, { merge: true });
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, collectionName);
      throw error;
    }
  }
};
