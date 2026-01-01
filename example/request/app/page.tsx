import type { Metadata } from 'next';
import Demo from './components/demo';

export default function IndexPage() {
  return <Demo />;
}

export const metadata: Metadata = {
  title: 'cdeebee home',
};
