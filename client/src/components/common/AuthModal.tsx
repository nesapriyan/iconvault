import { useState, useEffect, useRef, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function AuthModal({ onClose }: { onClose: () => void }) {
  const { login, register } = useAuth();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      if (creating) await register(String(data.get('email')), String(data.get('name')), String(data.get('password')));
      else await login(String(data.get('email')), String(data.get('password')));
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.'); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="auth-title"
    className="w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-card p-6 text-foreground shadow-xl backdrop:bg-black/60">
    <div className="mb-6 flex items-center justify-between">
      <h2 id="auth-title" className="text-xl font-semibold">{creating ? 'Create your account' : 'Sign in to IconVault'}</h2>
      <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 hover:bg-secondary"><X size={18} /></button>
    </div>
    <p className="mb-5 text-sm text-muted-foreground">Save your projects and manage your icon collection.</p>
    <form onSubmit={submit} className="space-y-4">
      {creating && <label className="block text-sm">Name<input autoComplete="name" name="name" required maxLength={100} className="mt-1 w-full rounded-lg border border-border bg-background p-2.5" /></label>}
      <label className="block text-sm">Email<input autoComplete="email" type="email" name="email" required className="mt-1 w-full rounded-lg border border-border bg-background p-2.5" /></label>
      <label className="block text-sm">Password<input autoComplete={creating ? 'new-password' : 'current-password'} type="password" name="password" required minLength={creating ? 8 : 1} className="mt-1 w-full rounded-lg border border-border bg-background p-2.5" /></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground disabled:opacity-50">{busy ? 'Please wait…' : creating ? 'Create account' : 'Sign in'}</button>
      <button type="button" disabled={busy} onClick={() => { setCreating(!creating); setError(''); }} className="w-full py-1 text-sm text-muted-foreground hover:text-foreground">{creating ? 'Already have an account? Sign in' : 'Create an account'}</button>
    </form>
  </dialog>;
}
