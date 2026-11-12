'use client';
/* The app only ever runs in the browser: it needs localStorage, IndexedDB, Web Crypto and the screen size from the start. */
import dynamic from 'next/dynamic';

const App = dynamic(() => import('./App'), { ssr: false });
export default function ClientApp() { return <App />; }
