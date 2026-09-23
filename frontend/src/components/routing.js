// The operator app runs full-screen at /... or inside the Stage View tablet frame at /stage/...
// These helpers keep screens unaware of which one they are in.
import { useLocation, useNavigate } from 'react-router-dom';

export const STAGE = '/stage';

export const isStagePath = (pathname) => pathname === STAGE || pathname.startsWith(`${STAGE}/`);

export function operatorPath(pathname) {
  const p = isStagePath(pathname) ? pathname.slice(STAGE.length) : pathname;
  return p === '' || p === '/' ? '/morning' : p;
}

export function useOperatorPath() {
  return operatorPath(useLocation().pathname);
}

export function useGo() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (to) => navigate(isStagePath(pathname) ? `${STAGE}${to}` : to);
}
