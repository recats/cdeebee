import { type CdeebeeSettings, type CdeebeeModule } from './types';

export function checkModule(settings: CdeebeeSettings, module: CdeebeeModule, result: () => void) {
  if (settings.modules.includes(module)) {
    result();
  }
}
