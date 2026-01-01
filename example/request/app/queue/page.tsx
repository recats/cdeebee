import type { Metadata } from 'next';
import CdeebeeDemo from '../components/queue-demo';

export default function QueuePage() {
  return <CdeebeeDemo />;
}

export const metadata: Metadata = {
  title: 'queue demo',
};

