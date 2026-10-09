import React, { useEffect, useState } from 'react';
import { X, UserPlus, Trash2, KeyRound, Users } from 'lucide-react';
import { HouseholdUser, Role } from '../types';
import { useAuth } from '../context/AuthContext';
import { ALLERGEN_OPTIONS } from '../utils/allergens';
import { addUserApi, changeMyPasswordApi, fetchUsersApi, removeUserApi, updateUserApi } from '../services/apiService';

interface HouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  avoidList: string[];
  onChangeAvoidList: (list: string[]) => void;
}

const ROLE_HELP: Record<Role, string> = {
  admin: 'Manages people and edits everything',
  member: 'Edits the pantry, planner, recipes and shopping list',
  viewer: 'Can look at everything and make requests, but not change anything',
};

export const HouseholdModal: React.FC<HouseholdModalProps> = ({ isOpen, onClose, avoidList, onChangeAvoidList }) => {
  const auth = useAuth();
  const isAdmin = auth.role === 'admin';
  const [users, setUsers] = useState<HouseholdUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newRole, setNewRole] = useState<Role>('member');

  const [curPass, setCurPass] = useState('');
  const [nextPass, setNextPass] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setMessage(null);
    fetchUsersApi().then(setUsers).catch((e) => setError(e.message));
  }, [isOpen]);

  if (!isOpen) return null;

  const run = async (fn: () => Promise<HouseholdUser[]>, ok?: string) => {
    setError(null);
    setMessage(null);
    try {
      setUsers(await fn());
      if (ok) setMessage(ok);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(() => addUserApi(newName, newPass, newRole), `Added ${newName.trim().toLowerCase()}`);
    setNewName('');
    setNewPass('');
  };

  const handleResetPassword = (u: HouseholdUser) => {
    const pw = window.prompt(`New password for ${u.username}:`);
    if (pw) run(() => updateUserApi(u.username, { password: pw }), `Password changed for ${u.username}`);
  };

  const handleChangeMine = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await changeMyPasswordApi(curPass, nextPass);
      setCurPass('');
      setNextPass('');
      setMessage('Your password was changed');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-900 flex items-center space-x-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <span>Household</span>
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          <p className="text-xs text-stone-500">
            Everyone here shares the same pantry, recipes, meal planner and shopping list. Signed in as <strong>{auth.user}</strong> ({auth.role}).
          </p>

          {(error || message) && (
            <p role={error ? 'alert' : 'status'} className={`text-xs font-medium rounded-lg px-3 py-2 border ${error ? 'text-red-700 bg-red-50 border-red-200' : 'text-emerald-800 bg-emerald-50 border-emerald-200'}`}>
              {error || message}
            </p>
          )}

          <ul className="divide-y divide-stone-100 border border-stone-200 rounded-xl">
            {users.map(u => (
              <li key={u.username} className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-bold text-stone-900">{u.username}</span>
                  {u.username === auth.user && <span className="ml-1.5 text-[10px] font-bold uppercase text-emerald-700">you</span>}
                  <div className="text-[11px] text-stone-500">{ROLE_HELP[u.role]}</div>
                </div>
                {isAdmin ? (
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <select
                      value={u.role}
                      onChange={(e) => run(() => updateUserApi(u.username, { role: e.target.value as Role }))}
                      className="bg-stone-100 border border-stone-200 rounded-md px-1.5 py-1 text-xs font-semibold text-stone-700"
                      aria-label={`Role for ${u.username}`}
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">View only</option>
                    </select>
                    <button onClick={() => handleResetPassword(u)} className="p-1.5 text-stone-400 hover:text-stone-800" title="Set a new password" aria-label={`Set a new password for ${u.username}`}>
                      <KeyRound className="w-4 h-4" />
                    </button>
                    {u.username !== auth.user && (
                      <button
                        onClick={() => { if (window.confirm(`Remove ${u.username}? They will be signed out.`)) run(() => removeUserApi(u.username), `Removed ${u.username}`); }}
                        className="p-1.5 text-stone-300 hover:text-red-600"
                        title="Remove"
                        aria-label={`Remove ${u.username}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-stone-500 capitalize">{u.role === 'viewer' ? 'view only' : u.role}</span>
                )}
              </li>
            ))}
          </ul>

          {isAdmin && (
            <form onSubmit={handleAdd} className="space-y-2">
              <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">Add someone</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="Username" autoCapitalize="none" className="px-3 py-2 border border-stone-300 rounded-lg text-sm" />
                <input value={newPass} onChange={(e) => setNewPass(e.target.value)} required placeholder="Password" className="px-3 py-2 border border-stone-300 rounded-lg text-sm" />
              </div>
              <div className="flex items-center space-x-2">
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)} className="px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white">
                  <option value="member">Member (can edit)</option>
                  <option value="viewer">View only (can make requests)</option>
                  <option value="admin">Admin (manages people)</option>
                </select>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5">
                  <UserPlus className="w-4 h-4" /><span>Add</span>
                </button>
              </div>
            </form>
          )}

          <section className="space-y-2 pt-2 border-t border-stone-100">
            <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">Foods the household avoids</h3>
            <p className="text-[11px] text-stone-500">Items and recipes that contain these are flagged in red. It goes by what the product database says and the words in the name, so always check labels for allergies.</p>
            <div className="flex flex-wrap gap-1.5">
              {ALLERGEN_OPTIONS.map(o => {
                const on = avoidList.includes(o.key);
                return (
                  <button
                    key={o.key}
                    type="button"
                    disabled={auth.role === 'viewer'}
                    aria-pressed={on}
                    onClick={() => onChangeAvoidList(on ? avoidList.filter(k => k !== o.key) : [...avoidList, o.key])}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${on ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-100'} disabled:opacity-60`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </section>

          <form onSubmit={handleChangeMine} className="space-y-2 pt-2 border-t border-stone-100">
            <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">Change my password</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input type="password" value={curPass} onChange={(e) => setCurPass(e.target.value)} required placeholder="Current password" autoComplete="current-password" className="px-3 py-2 border border-stone-300 rounded-lg text-sm" />
              <input type="password" value={nextPass} onChange={(e) => setNextPass(e.target.value)} required placeholder="New password" autoComplete="new-password" className="px-3 py-2 border border-stone-300 rounded-lg text-sm" />
            </div>
            <button type="submit" className="px-4 py-2 border border-stone-300 text-stone-700 hover:bg-stone-100 rounded-xl text-xs font-semibold">Change password</button>
          </form>
        </div>
      </div>
    </div>
  );
};
