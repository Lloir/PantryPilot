import { createContext, useContext } from 'react';
import { Role } from '../types';

export interface AuthInfo {
  user: string; // username
  role: Role;
  logout: () => void;
}

export const AuthContext = createContext<AuthInfo>({ user: 'home', role: 'admin', logout: () => {} });
export const useAuth = () => useContext(AuthContext);
