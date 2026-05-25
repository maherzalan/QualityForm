/**
 * فحص جاهزية قاعدة البيانات من المتصفح + تعبئة البيانات المرجعية
 */
(function () {
    'use strict';

    const EXPECTED_MIGRATIONS = 6;
    let checkPromise = null;

    function normalizeHealth(data) {
        const h = typeof data === 'string' ? JSON.parse(data) : { ...data };
        const regionsOk = (h.regions_count ?? 0) > 0;
        const tablesOk = !!h.ready;
        const migrationsOk = (h.migrations_applied ?? 0) >= EXPECTED_MIGRATIONS;

        h.needsSetup = !tablesOk;
        h.needsMigrate = tablesOk && !migrationsOk && (h.migrations_applied ?? 0) === 0;
        h.ok = tablesOk && regionsOk;
        h.skipBanner = false;
        return h;
    }

    async function checkDatabaseHealth() {
        if (checkPromise) return checkPromise;

        checkPromise = (async () => {
            const client = typeof getSupabase === 'function' ? getSupabase() : null;
            if (!client) {
                return { ok: false, needsSetup: true, skipBanner: true, reason: 'no_client' };
            }

            let rpcData = null;
            let rpcError = null;
            try {
                const rpcResult = await Promise.race([
                    client.rpc('check_database_health'),
                    new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('health rpc timeout')), 10000);
                    })
                ]);
                rpcData = rpcResult.data;
                rpcError = rpcResult.error;
            } catch (e) {
                console.warn('[db-health] rpc:', e);
                rpcError = e;
            }

            if (!rpcError && rpcData) {
                return normalizeHealth(rpcData);
            }

            if (rpcError && rpcError.code !== 'PGRST202') {
                console.warn('[db-health] check_database_health:', rpcError.message || rpcError);
            }

            const rpcMissing =
                rpcError?.code === 'PGRST202' ||
                rpcError?.message?.includes('check_database_health') ||
                rpcError?.message?.includes('Could not find the function');

            if (rpcMissing) {
                return {
                    ok: false,
                    needsSetup: true,
                    skipBanner: false,
                    reason: 'functions_missing',
                    hint: 'dashboard_or_migrate',
                    rpcError: rpcError?.message
                };
            }

            try {
                const { error: regErr, count } = await client
                    .from('regions')
                    .select('id', { count: 'exact', head: true });

                if (regErr) {
                    const missing =
                        regErr.code === '42P01' ||
                        regErr.code === 'PGRST205' ||
                        regErr.message?.includes('does not exist');
                    return {
                        ok: false,
                        needsSetup: missing,
                        skipBanner: !missing,
                        reason: missing ? 'schema_missing' : 'regions_error',
                        message: regErr.message
                    };
                }

                return {
                    ok: true,
                    ready: true,
                    regions_count: count ?? 0,
                    migrations_applied: null,
                    needsSetup: false,
                    skipBanner: false,
                    fallback: true
                };
            } catch (e) {
                return { ok: false, needsSetup: true, reason: 'unknown', message: e.message };
            }
        })();

        return checkPromise;
    }

    async function ensureReferenceData() {
        const health = await checkDatabaseHealth();
        if (!health.ok && health.needsSetup) return health;
        if ((health.regions_count ?? 0) > 0) {
            health.ok = true;
            return health;
        }

        try {
            const { data, error } = await getSupabase().rpc('ensure_regions_seed');
            if (error) {
                console.warn('[db-health] ensure_regions_seed:', error);
                return health;
            }
            console.info('[db-health] تم تعبئة المناطق:', data);
            checkPromise = null;
            const refreshed = await checkDatabaseHealth();
            refreshed.ok = (refreshed.regions_count ?? 0) > 0;
            return refreshed;
        } catch (e) {
            console.warn('[db-health]', e);
            return health;
        }
    }

    async function ensureDatabaseReady(options = {}) {
        const { silent = false } = options;
        const health = await ensureReferenceData();

        if (health.ok || health.skipBanner) {
            return health;
        }

        if (!silent && typeof Swal !== 'undefined' && health.needsSetup) {
            const useDashboard = health.hint === 'dashboard_or_migrate';
            Swal.fire({
                icon: 'warning',
                title: 'إعداد قاعدة البيانات مطلوب',
                html: useDashboard
                    ? `<p><b>الطريقة 1 (بدون DATABASE_URL):</b></p>
                       <p>Supabase → SQL Editor → الصق محتوى الملف:</p>
                       <pre style="text-align:left;direction:ltr;font-size:12px">supabase/APPLY_IN_DASHBOARD.sql</pre>
                       <p style="margin-top:12px"><b>الطريقة 2:</b> أضف DATABASE_URL في .env ثم:</p>
                       <pre style="text-align:left;direction:ltr">npm run db:migrate</pre>`
                    : `<p>شغّل: <code dir="ltr">npm run db:migrate</code></p>`,
                confirmButtonText: 'حسناً',
                width: 520
            });
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

        if (health.ok || health.skipBanner) {
            banner.classList.add('hidden');
            return;
        }

        const dashboardHint = health.hint === 'dashboard_or_migrate'
            ? ' أو الصق <code dir="ltr">supabase/APPLY_IN_DASHBOARD.sql</code> في Supabase → SQL Editor'
            : '';

        banner.classList.remove('hidden');
        banner.innerHTML = `
            <strong>⚠️ قاعدة البيانات تحتاج إعداداً لمرة واحدة</strong>
            <span>${dashboardHint || ' أضف <code dir="ltr">DATABASE_URL</code> في .env ثم <code dir="ltr">npm run db:migrate</code>'}</span>
            <button type="button" onclick="this.parentElement.classList.add('hidden')">✕</button>
        `;
    }

    window.checkDatabaseHealth = checkDatabaseHealth;
    window.ensureReferenceData = ensureReferenceData;
    window.ensureDatabaseReady = ensureDatabaseReady;
    window.showDbBanner = showDbBanner;
    window.EXPECTED_DB_MIGRATIONS = EXPECTED_MIGRATIONS;
})();
