'use client';
import { request } from '@recats/cdeebee';
import JsonView from '@uiw/react-json-view';
import { nordTheme } from '@uiw/react-json-view/nord';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';

export default function Counter () {
  const state = useAppSelector(state => state.cdeebee);
  const dispatch = useAppDispatch();
  return (
    <>
      <section className='grid grid-cols-3 gap-4'>
        <aside className='sticy bottom-0 justify-around margin-auto'>
        <div className='flex items-center gap-2'>
          <button onClick={() => dispatch(request({ api: '/api/counter', method: 'POST', body: { amount: 1, pending: 5000, } }))}>
            Fetch - 0
          </button>
          <button onClick={() => dispatch(request({ api: '/api/counter', method: 'POST', body: { amount: 1, pending: 1000, } }))}>
            Fetch - 1
          </button>
        </div>
        </aside>
        <article>
          <h3>Settings State</h3>
          <JsonView value={state.settings} collapsed={false} displayDataTypes={false} style={nordTheme} />
        </article>
        <article>
          <h3>Request State</h3>
          <JsonView value={state.request} collapsed={false} displayDataTypes={false} style={nordTheme} />
        </article>
      </section>
    </>
  );
};
