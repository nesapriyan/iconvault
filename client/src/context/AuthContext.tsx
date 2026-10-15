import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { api, getAuthToken } from '../api/client';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  isAdmin: boolean;
  switchableUsers: User[];
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshSwitchableUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [switchableUsers, setSwitchableUsers] = useState<User[]>([]);

  const refreshSwitchableUsers = useCallback(async () => {
    try {
      const users = await api.getSwitchableUsers();
      setSwitchableUsers(users);
    } catch (err) {
      console.warn('Failed to fetch switchable users:', err);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const user = await api.getMe();
      setCurrentUser(user);
    } catch (err) {
      console.warn('Failed to fetch current user profile:', err);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize auth state on mount
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.allSettled([refreshUser(), refreshSwitchableUsers()]);
      setLoading(false);
    };
    init();
  }, [refreshUser, refreshSwitchableUsers]);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    setCurrentUser(res.user);
    await refreshSwitchableUsers();
  };

  const register = async (email: string, name: string, password: string) => {
    const res = await api.register(email, name, password);
    setCurrentUser(res.user);
    await refreshSwitchableUsers();
  };

  const logout = async () => {
    await api.logout();
    setCurrentUser(null);
    // Reload or reset to default demo account
    await refreshUser();
    await refreshSwitchableUsers();
  };

  const switchUser = async (userId: string) => {
    const res = await api.switchUser(userId);
    setCurrentUser(res.user);
    await refreshSwitchableUsers();
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        isAdmin,
        switchableUsers,
        login,
        register,
        logout,
        switchUser,
        refreshUser,
        refreshSwitchableUsers
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
