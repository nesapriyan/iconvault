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
  FolderGit2,
  ArrowLeftRight,
  Loader2,
  AlertTriangle
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

  // Delete confirmation & transfer on delete state
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);
  const [transferOnDelete, setTransferOnDelete] = useState(true);
  const [deleteRecipientId, setDeleteRecipientId] = useState<string>('');
  const [deletingUser, setDeletingUser] = useState(false);

  // Transfer projects modal state (available for all users)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSourceUserId, setTransferSourceUserId] = useState<string>('');
  const [transferTargetUserId, setTransferTargetUserId] = useState<string>('');
  const [transferringProjects, setTransferringProjects] = useState(false);

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
      setIsTransferModalOpen(false);
      setTransferSourceUserId('');
      setTransferTargetUserId('');
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

  const handleInitiateDelete = (user: UserType) => {
    setUserToDelete(user);
    const otherUsers = users.filter((u) => u.id !== user.id);
    const defaultRecipient = otherUsers.find((u) => u.role === 'admin') || otherUsers[0];
    setDeleteRecipientId(defaultRecipient?.id || '');
    setTransferOnDelete((user.project_count || 0) > 0 && otherUsers.length > 0);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      setDeletingUser(true);
      setError(null);
      const recipientId = transferOnDelete && (userToDelete.project_count || 0) > 0 ? deleteRecipientId : undefined;
      const res = await api.deleteUser(userToDelete.id, recipientId);

      const transferred = res?.transferredCount || 0;
      if (transferred > 0) {
        const recipientUser = users.find((u) => u.id === recipientId);
        setSuccessMsg(`User "${userToDelete.name}" deleted and ${transferred} project(s) transferred to ${recipientUser?.name || 'recipient'}.`);
      } else {
        setSuccessMsg(`User "${userToDelete.name}" has been deleted successfully.`);
      }

      setUserToDelete(null);
      await fetchUsers();
      await refreshSwitchableUsers();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete user');
    } finally {
      setDeletingUser(false);
    }
  };

  const handleOpenTransfer = (user?: UserType) => {
    if (user) {
      setTransferSourceUserId(user.id);
      const otherUsers = users.filter((u) => u.id !== user.id);
      const defaultRecipient = otherUsers.find((u) => u.role === 'admin') || otherUsers[0];
      setTransferTargetUserId(defaultRecipient?.id || '');
    } else {
      const userWithProjects = users.find((u) => (u.project_count || 0) > 0) || users[0];
      const defaultSrcId = userWithProjects?.id || '';
      setTransferSourceUserId(defaultSrcId);
      const otherUsers = users.filter((u) => u.id !== defaultSrcId);
      const defaultRecipient = otherUsers.find((u) => u.role === 'admin') || otherUsers[0];
      setTransferTargetUserId(defaultRecipient?.id || '');
    }
    setIsTransferModalOpen(true);
  };

  const handleSwapTransferUsers = () => {
    if (!transferSourceUserId || !transferTargetUserId) return;
    const oldSrc = transferSourceUserId;
    const oldTarget = transferTargetUserId;
    setTransferSourceUserId(oldTarget);
    setTransferTargetUserId(oldSrc);
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferSourceUserId || !transferTargetUserId) return;

    const sourceUser = users.find((u) => u.id === transferSourceUserId);
    const targetUser = users.find((u) => u.id === transferTargetUserId);

    if (!sourceUser || (sourceUser.project_count || 0) === 0) {
      setError(`User "${sourceUser?.name || 'Selected user'}" currently owns 0 projects.`);
      return;
    }

    try {
      setTransferringProjects(true);
      setError(null);
      const res = await api.transferUserProjects(transferSourceUserId, transferTargetUserId);
      setSuccessMsg(`Successfully transferred ${res.transferredCount} project(s) from "${sourceUser.name}" to "${targetUser?.name || res.newOwnerName}".`);
      setIsTransferModalOpen(false);
      await fetchUsers();
    } catch (err: any) {
      setError(err?.message || 'Failed to transfer user projects');
    } finally {
      setTransferringProjects(false);
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenTransfer()}
                    className="px-3.5 py-2 text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95"
                    title="Transfer projects between any users"
                  >
                    <ArrowLeftRight className="w-4 h-4 text-indigo-500" />
                    <span>Transfer Projects</span>
                  </button>
                  <button
                    onClick={handleOpenAdd}
                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Add New User</span>
                  </button>
                </div>
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
                                {/* Transfer option available for all users */}
                                <button
                                  onClick={() => handleOpenTransfer(u)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                                  title={`Transfer projects for ${u.name} (${u.project_count || 0} owned)`}
                                >
                                  <ArrowLeftRight className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleOpenEdit(u)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                                  title="Edit user & permissions"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>

                                <button
                                  onClick={() => handleInitiateDelete(u)}
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

          {/* Delete confirmation dialog with project transfer options */}
          {userToDelete && (() => {
            const otherUsers = users.filter((u) => u.id !== userToDelete.id);
            const projectCount = userToDelete.project_count || 0;

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                <div 
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center shrink-0">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete User Account</h3>
                      <p className="text-xs text-slate-500">This action cannot be undone</p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Are you sure you want to delete user <strong>{userToDelete.name}</strong> ({userToDelete.email})?
                  </p>

                  {/* Project transfer section */}
                  {projectCount > 0 ? (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2.5">
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-xs">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>This user owns {projectCount} project{projectCount === 1 ? '' : 's'}.</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Select how to handle projects owned by this user:
                      </p>

                      {otherUsers.length > 0 ? (
                        <div className="space-y-2 pt-1">
                          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                            <input
                              type="radio"
                              name="transferChoice"
                              checked={transferOnDelete}
                              onChange={() => setTransferOnDelete(true)}
                              className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div className="flex-1">
                              <span className="font-semibold text-slate-900 dark:text-white">
                                Transfer all {projectCount} project(s) to another user
                              </span>
                              {transferOnDelete && (
                                <div className="mt-1.5">
                                  <select
                                    value={deleteRecipientId}
                                    onChange={(e) => setDeleteRecipientId(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  >
                                    {otherUsers.map((u) => (
                                      <option key={u.id} value={u.id}>
                                        {u.name} ({u.email}) - {u.role === 'admin' ? 'Admin' : 'Member'}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          </label>

                          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                            <input
                              type="radio"
                              name="transferChoice"
                              checked={!transferOnDelete}
                              onChange={() => setTransferOnDelete(false)}
                              className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <span className="font-semibold text-slate-900 dark:text-white">Don't transfer</span>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Projects will remain in the database under System / Unassigned ownership.
                              </p>
                            </div>
                          </label>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">
                          No other users available. Projects will become unassigned.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-400">
                      This user does not own any projects. Their account can be deleted safely.
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setUserToDelete(null)}
                      disabled={deletingUser}
                      className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDelete}
                      disabled={deletingUser || (transferOnDelete && projectCount > 0 && !deleteRecipientId)}
                      className="px-4 py-2 text-sm font-medium rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors flex items-center gap-2"
                    >
                      {deletingUser ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Deleting...</span>
                        </>
                      ) : transferOnDelete && projectCount > 0 ? (
                        <>
                          <ArrowLeftRight className="w-4 h-4" />
                          <span>Transfer & Delete</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>Yes, Delete User</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Standalone Transfer Projects Dialog (supports any user) */}
          {isTransferModalOpen && (() => {
            const sourceUser = users.find((u) => u.id === transferSourceUserId);
            const targetUser = users.find((u) => u.id === transferTargetUserId);
            const sourceProjects = sourceUser?.project_count || 0;

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                <div 
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center shrink-0">
                      <ArrowLeftRight className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Transfer All Projects</h3>
                      <p className="text-xs text-slate-500">Reassign project ownership between users</p>
                    </div>
                  </div>

                  <form onSubmit={handleExecuteTransfer} className="space-y-4">
                    {/* Source User */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                        Transfer From (Current Owner)
                      </label>
                      <select
                        value={transferSourceUserId}
                        onChange={(e) => {
                          const newSrc = e.target.value;
                          setTransferSourceUserId(newSrc);
                          if (transferTargetUserId === newSrc) {
                            const fallback = users.find((u) => u.id !== newSrc);
                            setTransferTargetUserId(fallback?.id || '');
                          }
                        }}
                        required
                        className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.project_count || 0} projects) - {u.role === 'admin' ? 'Admin' : 'Member'}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Swap Direction Button */}
                    <div className="flex justify-center -my-1">
                      <button
                        type="button"
                        onClick={handleSwapTransferUsers}
                        className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs active:scale-95"
                        title="Swap source and recipient"
                      >
                        <ArrowLeftRight className="w-3 h-3 text-indigo-500" />
                        <span>Swap Direction</span>
                      </button>
                    </div>

                    {/* Target User */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                        Transfer To (New Owner)
                      </label>
                      <select
                        value={transferTargetUserId}
                        onChange={(e) => setTransferTargetUserId(e.target.value)}
                        required
                        className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        {users
                          .filter((u) => u.id !== transferSourceUserId)
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.email}) - {u.role === 'admin' ? 'Admin' : 'Member'}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Status Feedback Card */}
                    {sourceProjects > 0 ? (
                      <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2.5">
                        <FolderGit2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                        <div>
                          <strong>{sourceProjects} project{sourceProjects === 1 ? '' : 's'}</strong> owned by{' '}
                          <strong>{sourceUser?.name}</strong> will be transferred to <strong>{targetUser?.name || 'recipient'}</strong>.
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <strong>{sourceUser?.name || 'Selected user'}</strong> does not currently own any projects.
                          Choose a source user who owns projects or click <em>Swap Direction</em>.
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsTransferModalOpen(false)}
                        disabled={transferringProjects}
                        className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={transferringProjects || sourceProjects === 0 || !transferTargetUserId}
                        className={`px-4 py-2 text-sm font-medium rounded-xl text-white shadow-sm transition-all flex items-center gap-2 ${
                          sourceProjects === 0 || !transferTargetUserId
                            ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed opacity-60'
                            : 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer active:scale-95'
                        }`}
                      >
                        {transferringProjects ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Transferring...</span>
                          </>
                        ) : (
                          <>
                            <ArrowLeftRight className="w-4 h-4" />
                            <span>Transfer {sourceProjects > 0 ? `${sourceProjects} Project${sourceProjects === 1 ? '' : 's'}` : 'Projects'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            );
          })()}
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
