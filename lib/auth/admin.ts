import { createClient } from '@/lib/supabase/server';

const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.CRON_SECRET;

type UserWithAppMetadata = { app_metadata?: Record<string, unknown> } | null | undefined;

const getBearerToken = (authorizationHeader: string | null) => {
  if (!authorizationHeader) {
    return null;
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
};

export const isAdminAppMetadata = (user: UserWithAppMetadata): boolean => {
  if (!user?.app_metadata || typeof user.app_metadata !== 'object') {
    return false;
  }

  return user.app_metadata.is_admin === true;
};

export const assertAdminRequest = async (
  request: Request,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> => {
  const bearerToken = getBearerToken(request.headers.get('authorization'));
  if (ADMIN_SECRET && bearerToken === ADMIN_SECRET) {
    return { ok: true };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return { ok: false, status: 401, error: 'Unauthorized' };
    }

    if (!isAdminAppMetadata(user)) {
      return { ok: false, status: 403, error: 'Forbidden' };
    }

    return { ok: true };
  } catch {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
};
