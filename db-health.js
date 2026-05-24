/**
 * فحص جاهزية قاعدة البيانات من المتصفح + تعبئة البيانات المرجعية
 */
(function () {
    'use strict';

    const EXPECTED_MIGRATIONS = 3;
    let lastHealth = null;
    let checkPromise = null;

    async function checkDatabaseHealth() {
        if (checkPromise) return checkPromise;

        checkPromise = (async () => {
            const client = typeof getSupabase === 'function' ? getSupabase() : null;
            if (!client) {
                return { ready: false, reason: 'no_client' };
            }

            try {
                const { data, error } = await client.rpc('check_database_health');
                if (!error && data) {
                    lastHealth = typeof data === 'string' ? JSON.parse(data) : data;
                    return lastHealth;
                }
            } catch (e) {
                console.warn('[db-health] rpc check_database_health:', e);
            }

            try {
                const { error: regErr } = await client.from('regions').select('id').limit(1);
                if (regErr) {
                    if (regErr.code === '42P01' || regErr.message?.includes('does not exist') || regErr.code === 'PGRST205') {
                        return { ready: false, reason: 'schema_missing', message: regErr.message };
                    }
                    return { ready: false, reason: 'regions_error', message: regErr.message };
                }
                const { count } = await client.from('regions').select('*', { count: 'exact', head: true });
                return {
                    ready: true,
                    regions_count: count ?? 0,
                    migrations_applied: null,
                    fallback: true
                };
            } catch (e) {
                return { ready: false, reason: 'unknown', message: e.message };
            }
        })();

        return checkPromise;
    }

    async function ensureReferenceData() {
        const health = await checkDatabaseHealth();
        if (!health.ready) return health;

        if ((health.regions_count ?? 0) > 0) return health;

        try {
            const { data, error } = await getSupabase().rpc('ensure_regions_seed');
            if (error) {
                console.warn('[db-health] ensure_regions_seed:', error);
                return health;
            }
            console.info('[db-health] تم تعبئة المناطق:', data);
            checkPromise = null;
            return checkDatabaseHealth();
        } catch (e) {
            console.warn('[db-health]', e);
            return health;
        }
    }

    async function ensureDatabaseReady(options = {}) {
        const { silent = false } = options;
        const health = await ensureReferenceData();

        if (health.ready && (health.migrations_applied == null || health.migrations_applied >= EXPECTED_MIGRATIONS)) {
            return health;
        }

        if (health.ready && health.regions_count > 0 && health.fallback) {
            return health;
        }

        if (!silent && typeof Swal !== 'undefined') {
            const needsMigrate = health.reason === 'schema_missing' ||
                (health.migrations_applied != null && health.migrations_applied < EXPECTED_MIGRATIONS);

            if (needsMigrate) {
                Swal.fire({
                    icon: 'warning',
                    title: 'قاعدة البيانات تحتاج تحديث',
                    html: `
                        <p>شغّل الهجرات مرة واحدة من الطرفية:</p>
                        <pre style="text-align:left;direction:ltr;background:#f1f5f9;padding:12px;border-radius:8px">npm install
npm run db:migrate</pre>
                        <p style="font-size:13px;color:#64748b">أضف <b>DATABASE_URL</b> في ملف <b>.env</b> من Supabase → Database → Connection string</p>
                    `,
                    confirmButtonText: 'حسناً'
                });
            }
        }

        return health;
    }

    function showDbBanner(health) {
        let banner = document.getElementById('dbHealthBanner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'dbHealthBanner';
            banner.className = 'db-health-banner hidden';
            document.body.prepend(banner);
        }

        if (health.ready && (health.regions_count ?? 0) > 0) {
            banner.classList.add('hidden');
            return;
        }

        banner.classList.remove('hidden');
        banner.innerHTML = `
            <strong>⚠️ قاعدة البيانات غير جاهزة</strong>
            <span>نفّذ: <code dir="ltr">npm run db:migrate</code> بعد ضبط DATABASE_URL في .env</span>
            <button type="button" onclick="this.parentElement.classList.add('hidden')">✕</button>
        `;
    }

    window.checkDatabaseHealth = checkDatabaseHealth;
    window.ensureReferenceData = ensureReferenceData;
    window.ensureDatabaseReady = ensureDatabaseReady;
    window.showDbBanner = showDbBanner;
    window.EXPECTED_DB_MIGRATIONS = EXPECTED_MIGRATIONS;
})();
