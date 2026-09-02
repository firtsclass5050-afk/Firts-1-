import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { UserProfile, UserRole } from './types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  viewMode: 'admin' | 'teacher' | null;
  setViewMode: (mode: 'admin' | 'teacher' | null) => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [viewMode, setViewMode] = useState<'admin' | 'teacher' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      setUser(user);
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        
        // Use onSnapshot for real-time profile updates
        unsubProfile = onSnapshot(docRef, async (docSnap) => {
          try {
            let currentProfile: UserProfile;
            if (docSnap.exists()) {
              const existingProfile = docSnap.data() as UserProfile;
              // Force master role for the owner email
              if (user.email === 'joanpablex@gmail.com' && existingProfile.role !== 'master') {
                currentProfile = { ...existingProfile, role: 'master' as UserRole };
                await setDoc(docRef, currentProfile);
              } else {
                currentProfile = existingProfile;
              }
            } else {
              // Default role for new users
              const isMaster = user.email === 'joanpablex@gmail.com';
              currentProfile = {
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || '',
                role: isMaster ? 'master' : 'pending',
                status: isMaster ? 'active' : 'pending',
                photoURL: user.photoURL || undefined,
                createdAt: serverTimestamp()
              };
              await setDoc(docRef, currentProfile);
            }
            setProfile(currentProfile);

            // Set initial viewMode only if it's not set yet
            setViewMode(prev => {
              if (prev) return prev;
              if (currentProfile.role === 'master') return null;
              if (['admin', 'secretary', 'dir_acad', 'accounting'].includes(currentProfile.role)) return 'admin';
              if (currentProfile.role === 'teacher') return 'teacher';
              return null; // For pending or student roles (students no longer have a panel)
            });
            setLoading(false);
          } catch (err) {
            console.error("Error loading or creating user profile:", err);
            setLoading(false);
          }
        }, (error) => {
          console.error("onSnapshot error on user profile:", error);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setViewMode(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, viewMode, setViewMode, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
