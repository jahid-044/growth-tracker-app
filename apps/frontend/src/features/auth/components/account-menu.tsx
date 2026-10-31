import { LogOut, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { useCurrentUser } from '@/features/auth/hooks/use-current-user';
import { logout } from '@/features/auth/services/auth.api';
import { tokenStorage } from '@/services/token-storage';
import { useAuthStore } from '@/store/auth.store';

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

/** Navbar avatar button with a Profile / Logout dropdown. */
export function AccountMenu() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    // Best effort: an already-expired token can't be revoked, and either way
    // the local session ends below.
    await logout().catch(() => undefined);
    tokenStorage.clearTokens();
    useAuthStore.getState().clear();
    navigate('/login');
  };

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Account"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex size-11 items-center justify-center rounded-full border bg-muted md:size-9 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {user ? (
          initialsOf(user.name)
        ) : (
          <User className="size-[18px]" strokeWidth={1.75} />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg"
        >
          {user && (
            <div className="border-b px-4 py-3">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
          )}
          <div className="p-1.5">
            <span
              aria-disabled
              className="flex cursor-default items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium md:py-2 text-muted-foreground/50"
            >
              <User className="size-[18px]" strokeWidth={1.75} />
              <span className="flex-1">Profile</span>
              <span className="rounded-full border border-border/60 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Soon
              </span>
            </span>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium md:py-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
            >
              <LogOut className="size-[18px]" strokeWidth={1.75} />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
