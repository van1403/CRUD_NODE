require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const requiredEnvironmentVariables = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missingEnvironmentVariables = requiredEnvironmentVariables.filter(
  (name) => !process.env[name]
);

if (missingEnvironmentVariables.length > 0) {
  throw new Error(
    `Faltan variables de entorno requeridas: ${missingEnvironmentVariables.join(', ')}`
  );
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

function createAuthenticatedClient(accessToken) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    }
  );
}

module.exports = { supabase, createAuthenticatedClient };
