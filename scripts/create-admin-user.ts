#!/usr/bin/env tsx
import { config as loadEnv } from 'dotenv';
import crypto from 'node:crypto';
import { getSupabaseServiceClient } from '@/lib/supabase/server-client';

loadEnv({ path: '.env.local' });
loadEnv();

const USAGE = 'Usage: npx tsx scripts/create-admin-user.ts <email> [password]';
const LIST_USERS_PAGE_SIZE = 200;

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const generateStrongPassword = () => {
  const randomPart = crypto.randomBytes(18).toString('base64url');
  return `${randomPart}Aa1!`;
};

const findUserByEmail = async (email: string) => {
  const supabase = getSupabaseServiceClient();

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: LIST_USERS_PAGE_SIZE,
    });

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    const users = data.users || [];
    const existingUser = users.find((user) => normalizeEmail(user.email || '') === email);
    if (existingUser) {
      return existingUser;
    }

    if (users.length < LIST_USERS_PAGE_SIZE) {
      return null;
    }
  }
};

const run = async () => {
  const [, , rawEmail, providedPassword] = process.argv;

  if (!rawEmail) {
    console.error(USAGE);
    process.exit(1);
  }

  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    console.error(`Invalid email: ${rawEmail}`);
    process.exit(1);
  }

  let generatedPassword: string | null = null;

  try {
    const supabase = getSupabaseServiceClient();
    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      const currentAppMetadata =
        existingUser.app_metadata && typeof existingUser.app_metadata === 'object'
          ? existingUser.app_metadata
          : {};

      const updatePayload: {
        app_metadata: Record<string, unknown>;
        password?: string;
      } = {
        app_metadata: {
          ...currentAppMetadata,
          is_admin: true,
        },
      };

      if (providedPassword) {
        updatePayload.password = providedPassword;
      }

      const { error } = await supabase.auth.admin.updateUserById(existingUser.id, updatePayload);

      if (error) {
        throw new Error(`Failed to promote user: ${error.message}`);
      }

      if (providedPassword) {
        console.log(`Admin user updated: ${email} (admin + password reset)`);
      } else {
        console.log(`Admin user promoted: ${email}`);
      }
      return;
    }

    const password = providedPassword || generateStrongPassword();
    generatedPassword = providedPassword ? null : password;

    const { error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { is_admin: true },
    });

    if (error) {
      throw new Error(`Failed to create admin user: ${error.message}`);
    }

    console.log(`Admin user created: ${email}`);
    if (generatedPassword) {
      console.log(`Generated password: ${generatedPassword}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('Supabase service credentials missing')) {
      console.error('Missing Supabase service credentials: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    } else {
      console.error(message);
    }
    process.exit(1);
  }
};

void run();
