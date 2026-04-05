const { createClient } = require('@supabase/supabase-js');
const config = require('../config/config');

if (!config.SUPABASE_URL || !config.SUPABASE_KEY) {
  console.warn('[Supabase] GEREKLİ AYARLAR EKSİK! (.env kontrol edin)');
}

const supabase = createClient(
  config.SUPABASE_URL || '',
  config.SUPABASE_KEY || ''
);

module.exports = supabase;
