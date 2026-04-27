const fs = require('fs');
const path = require('path');
const { createClient } = require(path.join('C:', 'Users', 'User', 'devVentoGroup', 'vento-nexo', 'node_modules', '@supabase', 'supabase-js'));
const env = fs.readFileSync(path.join('C:', 'Users', 'User', 'devVentoGroup', 'vento-nexo', '.env.local'), 'utf8');
const vars = Object.fromEntries(env.split(/\r?\n/).filter(Boolean).filter(l => !l.trim().startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1)]; }));
const supabase = createClient(vars.NEXT_PUBLIC_SUPABASE_URL, vars.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
(async () => {
  const { data, error } = await supabase.from('restock_requests').select('*').limit(1);
  if (error) throw error;
  const row = data?.[0] || {};
  console.log(Object.keys(row).sort().join('\n'));
})().catch(err => { console.error(err); process.exit(1); });
