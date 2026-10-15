import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Users, 
  UserPlus, 
  ShieldCheck, 
  User, 
  Trash2, 
  Edit3, 
  Search, 
  Check, 
  AlertCircle,
  Key,
  FolderGit2
} from 'lucide-react';
import { User as UserType } from '../../types';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserManagementModal({ isOpen, onClose }: UserManagementModalProps) {
  const { currentUser, refreshSwitchableUsers } = useAuth();
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state for creating or editing user
  const [isEditing, setIsEditing] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'user'>('user');
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setIsEditing(false);
      setEditingUserId(null);
      setUserToDelete(null);
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, fetchUsers]);

  if (!isOpen) return null;

  const handleOpenAdd = () => {
    setEditingUserId(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('user');
    setIsEditing(true);
    setError(null);
    setSuccessMsg(null);
  };

  const handleOpenEdit = (u: UserType) => {
    setEditingUserId(u.id);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormPassword('');
    setFormRole(u.role);
    setIsEditing(true);
    setError(null);
    setSuccessMsg(null);
  };

  const handleCancelForm = () => {
    setIsEditing(false);
    setEditingUserId(null);
    setError(null);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!formName.trim() || !formEmail.trim()) {
      setError('Name and email are required');
      return;
    }

    if (!editingUserId && (!formPassword || formPassword.length < 6)) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setSubmitting(true);
      if (editingUserId) {
        // Update user
        const payload: any = {
          name: formName.trim(),
          email: formEmail.trim(),
          role: formRole
        };
        if (formPassword.trim()) {
          payload.password = formPassword.trim();
        }
        await api.updateUser(editingUserId, payload);
        setSuccessMsg(`User "${formName}" updated successfully`);
      } else {
        // Create user
        await api.createUser({
          name: formName.trim(),
          email: formEmail.trim(),
          password: formPassword.trim(),
          role: formRole
        });
        setSuccessMsg(`User "${formName}" created successfully`);
      }

      await fetchUsers();
      await refreshSwitchableUsers();
      setIsEditing(false);
      setEditingUserId(null);
    } catch (err: any) {
      setError(err?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: UserType) => {
    try {
      setLoading(true);
      await api.deleteUser(user.id);
      setSuccessMsg(`User "${user.name}" has been deleted`);
      setUserToDelete(null);
      await fetchUsers();
      await refreshSwitchableUsers();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">User Management</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage system users, assign roles (Admin / Member), and monitor project ownership
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback alerts */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 text-emerald-600 dark:text-emerald-400 text-sm">
            <Check className="w-4 h-4 shrink-0" />
            <span className="flex-1">{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Add / Edit Form Modal Sub-view */}
          {isEditing ? (
            <form onSubmit={handleSubmitForm} className="space-y-5 max-w-xl mx-auto bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  {editingUserId ? <Edit3 className="w-4 h-4 text-indigo-500" /> : <UserPlus className="w-4 h-4 text-indigo-500" />}
                  {editingUserId ? 'Edit User Profile & Role' : 'Create New User'}
                </h3>
                <span className="text-xs text-slate-500">
                  {editingUserId ? 'Update permissions or credentials' : 'Add a member to IconVault'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. alex@company.com"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  {editingUserId ? 'New Password (leave empty to keep unchanged)' : 'Password (min 6 characters)'}
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={editingUserId ? 'Leave blank to keep existing password' : 'Enter initial password'}
                    className="w-full pl-9 pr-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                  Permission Role
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormRole('user')}
                    className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                      formRole === 'user'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/30'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-sm mb-1">
                      <User className="w-4 h-4 text-indigo-500" />
                      <span>Standard Member</span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Can create projects, view public projects, and import icons.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormRole('admin')}
                    className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                      formRole === 'admin'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/30'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-sm mb-1">
                      <ShieldCheck className="w-4 h-4 text-indigo-500" />
                      <span>Administrator</span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Full access to manage all users and view/edit all projects.
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-medium rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors flex items-center gap-2"
                >
                  {submitting ? 'Saving...' : editingUserId ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Search & Actions Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search users by name, email, or role..."
                    className="w-full pl-9 pr-3.5 py-1.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={handleOpenAdd}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add New User</span>
                </button>
              </div>

              {/* Users Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4 text-center">Projects</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {loading && users.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">
                          Loading users...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">
                          No users found matching "{search}"
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isSelf = u.id === currentUser?.id;
                        const initials = u.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2);

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                                  {initials || 'U'}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="truncate">{u.name}</span>
                                    {isSelf && (
                                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-500 truncate">{u.email}</div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {u.role === 'admin' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  Admin
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  <User className="w-3.5 h-3.5 text-slate-400" />
                                  Member
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                <FolderGit2 className="w-3 h-3 text-slate-400" />
                                {u.project_count || 0}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenEdit(u)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 dark:hover:text-indigo-400 transition-colors"
                                  title="Edit user & permissions"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setUserToDelete(u)}
                                  disabled={isSelf}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    isSelf
                                      ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                      : 'text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 dark:hover:text-red-400'
                                  }`}
                                  title={isSelf ? 'Cannot delete your own account' : 'Delete user'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Delete confirmation dialog */}
          {userToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4">
                <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                  <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold">Delete User?</h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Are you sure you want to delete user <strong>{userToDelete.name}</strong> ({userToDelete.email})?
                  Their assigned projects will be unassigned or transferred to the admin. This action cannot be undone.
                </p>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setUserToDelete(null)}
                    className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteUser(userToDelete)}
                    className="px-4 py-2 text-sm font-medium rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-sm"
                  >
                    Yes, Delete User
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between text-xs text-slate-500">
          <span>{users.length} registered users in workspace</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
