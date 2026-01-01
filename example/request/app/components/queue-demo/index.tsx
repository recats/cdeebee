'use client';
import { request } from '@recats/cdeebee';
import JsonView from '@uiw/react-json-view';
import { nordTheme } from '@uiw/react-json-view/nord';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import useLoading from '@/app/hook/useLoading';
import { useState, useRef } from 'react';
import Header from '../header';

const btnQueue = 'px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 cursor:pointer';

const api = '/api/bundle';

interface RequestStatus {
  id: number;
  sent: number;
  completed?: number;
  delay: number;
  status: 'pending' | 'processing' | 'completed';
}

export default function QueueDemo() {
  const state = useAppSelector(state => state.cdeebee);
  const loading = useLoading(api);
  const dispatch = useAppDispatch();
  const [requests, setRequests] = useState<RequestStatus[]>([]);
  const startTimeRef = useRef<number>(0);

  const sendSequentialRequests = () => {
    startTimeRef.current = Date.now();
    setRequests([]);
    
    const delays = [1000, 800, 600, 400, 200]; 
    
    delays.forEach((delay, index) => {
      const requestNumber = index + 1;
      const sentTime = Date.now() - startTimeRef.current;
      
      setRequests(prev => [...prev, {
        id: requestNumber,
        sent: sentTime,
        delay,
        status: 'pending'
      }]);

      dispatch(request({ 
        api, 
        method: 'POST', 
        body: { pending: delay, requestId: requestNumber },
        onResult: () => {
          const completedTime = Date.now() - startTimeRef.current;
          setRequests(prev => prev.map(req => 
            req.id === requestNumber 
              ? { ...req, completed: completedTime, status: 'completed' }
              : req.status === 'pending' ? { ...req, status: 'processing' } : req
          ));
        }
      }));
    });
  };

  return (
    <>
      <Header />

      <main className='max-w-6xl mx-auto p-4'>
        <div className='flex flex-col items-center gap-4 mb-8'>
          <button onClick={sendSequentialRequests} className={btnQueue}>
            Send 5 requests to queue (queryQueue)
          </button>
          {requests.length > 0 && (
            <div className='mt-4 w-full p-4 bg-gray-50 rounded-lg border border-gray-200'>
              <div className='font-bold mb-3 text-center text-lg'>Sequential Processing (queryQueue enabled)</div>
              <div className='text-sm text-gray-600 mb-3 text-center'>
                Note: Request #5 has shortest delay (200ms) but completes last due to queue order
              </div>
              <div className='space-y-2'>
                {requests.map(req => (
                  <div key={req.id} className={`p-3 rounded border-2 ${
                    req.status === 'completed' 
                      ? 'bg-green-50 border-green-300' 
                      : req.status === 'processing'
                      ? 'bg-yellow-50 border-yellow-300'
                      : 'bg-gray-100 border-gray-300'
                  }`}>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-3'>
                        <span className={`font-bold text-lg ${
                          req.status === 'completed' ? 'text-green-700' : 
                          req.status === 'processing' ? 'text-yellow-700' : 'text-gray-500'
                        }`}>
                          Request #{req.id}
                        </span>
                        <span className='text-sm text-gray-600'>
                          Delay: {req.delay}ms
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          req.status === 'completed' 
                            ? 'bg-green-200 text-green-800' 
                            : req.status === 'processing'
                            ? 'bg-yellow-200 text-yellow-800'
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {req.status === 'completed' ? '✓ Completed' : 
                           req.status === 'processing' ? '⟳ Processing' : '⏳ Waiting'}
                        </span>
                      </div>
                      <div className='text-sm text-gray-600'>
                        {req.completed ? (
                          <span className='text-green-700 font-semibold'>
                            Completed at +{req.completed}ms
                          </span>
                        ) : (
                          <span>Sent at +{req.sent}ms</span>
                        )}
                      </div>
                    </div>
                    {req.completed && (
                      <div className='mt-2 text-xs text-gray-500'>
                        Total time: {req.completed}ms (sent at +{req.sent}ms)
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className='mt-4 p-2 bg-blue-50 rounded text-sm text-blue-800'>
                <strong>Expected behavior:</strong> Requests complete in order 1→2→3→4→5, 
                even though #5 has the shortest delay. This proves sequential processing!
              </div>
            </div>
          )}
        </div>

        {loading ? <p className='text-center text-red-600 font-bold'>Loading...</p> : <p>&nbsp;</p>}
        
        <section className='grid grid-cols-3 gap-4'>
          <article>
            <h3 className='font-bold text-center mb-2'>cdeebee.Settings</h3>
            <JsonView value={state.settings} collapsed={false} displayDataTypes={false} style={nordTheme} />
          </article>
          <article>
            <h3 className='font-bold text-center mb-2'>cdeebee.request</h3>
            <JsonView value={state.request} collapsed={false} displayDataTypes={false} style={nordTheme} />
          </article>
          <article>
            <h3 className='font-bold text-center mb-2'>cdeebee.storage</h3>
            <JsonView value={state.storage ?? {}} collapsed={false} displayDataTypes={false} style={nordTheme} />
          </article>
        </section>
      </main>
    </>
  );
}

