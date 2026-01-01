'use client';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import type { CdeebeeModule } from '@recats/cdeebee';
import { useState } from 'react';

const allModules: CdeebeeModule[] = ['history', 'listener', 'storage', 'cancelation', 'queryQueue'];

const moduleDescriptions: Record<CdeebeeModule, string> = {
  history: 'Tracks request history (done and errors)',
  listener: 'Tracks active requests',
  storage: 'Stores response data in state',
  cancelation: 'Cancels previous requests to the same API',
  queryQueue: 'Processes requests sequentially in queue order',
};

export default function ModulesSettings() {
  const enabledModuleList = useAppSelector(state => state.cdeebee.settings.modules);
  const dispatch = useAppDispatch();
  const [open, toggle] = useState(false);

  const toggleModule = (module: CdeebeeModule) => {
    const currentModules = [...enabledModuleList] as string[];
    const moduleStr = module as string;
    const index = currentModules.indexOf(moduleStr);
    
    const newModules: string[] = index === -1 ? [...currentModules, moduleStr] : currentModules.filter(m => m !== moduleStr);
    dispatch({ type: 'cdeebee/setModules', payload: newModules, } );
  };

  return (
    <div className='p-4 mb-2'>
      <div className='flex items-center justify-between gap-2'>
        <h3 className='font-bold text-lg mb-3'>Modules</h3>
        <button type='button' onClick={() => toggle(q => !q)} className='cursor-pointer'>toggle</button>
      </div>

      <div className={open ? '' : 'hidden'}>
        {allModules.map(module => {
          const isEnabled = enabledModuleList.includes(module);
          return (
            <label
              key={module}
              className={`flex items-center gap-3 p-3 rounded border-2 cursor-pointer transition-colors ${
                isEnabled
                  ? 'bg-green-50 border-green-300'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <input
                type='checkbox'
                checked={isEnabled}
                onChange={() => toggleModule(module)}
                className='w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500'
              />
              <div className='flex-1'>
                <div className='font-semibold text-gray-800'>
                  {module}
                  {isEnabled && (
                    <span className='ml-2 text-xs text-green-600 font-normal'>(enabled)</span>
                  )}
                </div>
                <div className='text-xs text-gray-600 mt-1'>{moduleDescriptions[module]}</div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

