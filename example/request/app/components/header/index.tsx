import Link from 'next/link';
import ModulesSettings from '../modules-settings';

const btn = 'px-4 py-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor:pointer';

export default function Header() {
  return (
    <>
      <header className='sticky top-0 z-10 border-b p-4 bg-black text-white'>
        <div className='max-w-6xl mx-auto flex gap-4'>
          <Link href='/' className={btn}>Home</Link>
          <Link href='/queue' className={btn}>Query queue</Link>
        </div>
      </header>

      <ModulesSettings />
    </>
  );
}
