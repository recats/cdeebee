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
      <header className='sticy top-0 margin-auto text-center p-3 w-full'>
        <div className='flex items-center justify-center gap-2'>
          <button onClick={() => dispatch(request({ api: '/api/bundle', method: 'POST', body: { pending: 5000, } }))}>
            Slow fetch
          </button>
          <button onClick={() => dispatch(request({ api: '/api/bundle', method: 'POST', body: { pending: 1000, } }))}>
            Fast fetch
          </button>
        </div>
      </header>
      <section className='grid grid-cols-4 gap-4'>
        <article>
          <h3>Cdeebee.storage</h3>
          <JsonView value={state.storage ?? {}} collapsed={false} displayDataTypes={false} style={nordTheme} />
        </article>
        <article>
          <h3>Cdeebee.Settings</h3>
          <JsonView value={state.settings} collapsed={false} displayDataTypes={false} style={nordTheme} />
        </article>
        <article>
          <h3>Cdeebee.request</h3>
          <JsonView value={state.request} collapsed={false} displayDataTypes={false} style={nordTheme} />
        </article>
      </section>
    </>
  );
};
