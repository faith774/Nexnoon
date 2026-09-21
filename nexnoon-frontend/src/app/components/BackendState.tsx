import BrandLoader from './BrandLoader';
import { Link } from 'react-router';
import Header from './Header';
import Footer from './Footer';

export default function BackendState({ title, message, retry, loading = false }: { title: string; message: string; loading?: boolean; retry?: () => void }) {
  return <div className="min-h-screen flex flex-col bg-gray-50">
    <Header /><main className="flex-1 w-[90vw] max-w-7xl mx-auto py-12">
      {loading ? <BrandLoader label={message} /> : <><h1 className="text-3xl font-bold mb-4">{title}</h1>
      <p role="status" className="text-gray-600 mb-6">{message}</p>
      {retry && <button className="bg-black text-white rounded-lg px-5 py-2 mr-4" onClick={retry}>Try again</button>}
      <Link to="/my-classes" className="underline mr-4">My Classes</Link>
      <Link to="/login" className="underline">Sign in</Link></>}
    </main><Footer />
  </div>;
}
