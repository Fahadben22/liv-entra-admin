'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    router.push(token ? '/dashboard' : '/login');
  }, []);
  return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}><p style={{color:'#94a3b8',fontSize:14}}>جاري التحميل...</p></div>;
}