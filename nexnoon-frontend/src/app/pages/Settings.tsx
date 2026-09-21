import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import BackendState from '@/app/components/BackendState';
import { useAuth } from '@/contexts/AuthContext';

export default function Settings() {
  const { user, isLoading, updateProfile, logout } = useAuth();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setName(user?.name || ''); }, [user?.name]);
  if (isLoading && !user) return <BackendState title="Settings" loading message="Loading Nexnoon" />;
  if (!user) return <BackendState title="Settings" message="Sign in to manage your account." />;
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setMessage('');
    try { await updateProfile({ name: name.trim() }); setMessage('Your account has been updated.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save changes.'); }
    finally { setSaving(false); }
  };
  return <div className="min-h-screen flex flex-col bg-gray-50"><Header />
    <main className="flex-1 w-[90vw] max-w-4xl mx-auto py-12"><h1 className="text-3xl font-bold mb-8">Account Settings</h1>
      <form onSubmit={save} className="bg-white border rounded-xl p-6 space-y-5">
        <label className="block">Name<input required value={name} onChange={e => setName(e.target.value)} className="block w-full rounded-lg border p-3 mt-2" /></label>
        <div><span>Email</span><p className="text-gray-600 mt-2">{user.email}</p></div>
        <div><span>Account role</span><p className="text-gray-600 mt-2 capitalize">{user.role}</p></div>
        {message && <p role="status">{message}</p>}
        <button type="submit" disabled={saving || !name.trim()} className="bg-black text-white px-6 py-3 rounded-lg disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
      </form>
      <div className="bg-white border rounded-xl p-6 mt-6 flex flex-wrap gap-6"><Link className="underline" to="/profile">Profile</Link><Link className="underline" to="/notifications">Notifications</Link><Link className="underline" to="/forgot-password">Reset password</Link><button className="text-red-600 underline" onClick={logout}>Sign out</button></div>
    </main><Footer /></div>;
}
