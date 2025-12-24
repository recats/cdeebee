import { useAppSelector } from '@/lib/hooks';

export default function useLoading(api: string) {
  const active = useAppSelector(state => state.cdeebee.request.active);
  return active.some(req => req.api === api);
}
