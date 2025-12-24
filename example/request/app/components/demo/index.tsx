'use client';
import { request } from '@recats/cdeebee';
import JsonView from '@uiw/react-json-view';
import { nordTheme } from '@uiw/react-json-view/nord';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import useLoading from '@/app/hook/useLoading';

const btn = 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor:pointer';

const api = '/api/bundle';
export default function Counter () {
  const state = useAppSelector(state => state.cdeebee);
  const loading = useLoading(api);
  const dispatch = useAppDispatch();
  return (
    <>
      <header className='sticy top-0 margin-auto text-center p-3 w-full'>
        <div className='flex items-center justify-center gap-2'>
          <button onClick={() => dispatch(request({ api, method: 'POST', body: { pending: 5000, } }))} className={btn}>
            Slow fetch 
          </button>
          <button onClick={() => dispatch(request({ api, method: 'POST', body: { pending: 1000, } }))} className={btn}>
            Fast fetch
          </button>
        </div>
      </header>
      {loading ? <p className='text-center text-red-600 font-bold'>Loading...</p> : <p>&nbsp;</p>}
      <section className='grid grid-cols-3 gap-4'>
        <article>
          <h3 className='font-bold text-center'>cdeebee.Settings</h3>
          <JsonView value={state.settings} collapsed={false} displayDataTypes={false} style={nordTheme} />
        </article>
        <article>
          <h3 className='font-bold text-center'>cdeebee.request</h3>
          <JsonView value={state.request} collapsed={false} displayDataTypes={false} style={nordTheme} />
        </article>
        <article>
          <h3 className='font-bold text-center'>cdeebee.storage</h3>
          <JsonView value={state.storage ?? {}} collapsed={false} displayDataTypes={false} style={nordTheme} />
        </article>
      </section>
    </>
  );
};
