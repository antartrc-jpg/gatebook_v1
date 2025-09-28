'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AutoForward({
  to,
  delay = 2000,
}: { to: string; delay?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace(to), delay);
    return () => clearTimeout(t);
  }, [router, to, delay]);
  return null;
}
