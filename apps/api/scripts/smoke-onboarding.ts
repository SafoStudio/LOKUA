import 'dotenv/config';

const BASE_URL = process.env.APP_URL!;
const API_PREFIX = '/api/v1';
const TEST_CITY_ID = process.env.TEST_CITY_ID!;
const TEST_INTEREST_IDS = process.env.TEST_INTEREST_IDS!.split(',');

const cookieJar = new Map<string, string>();

function setCookiesFromResponse(headers: Headers) {
    const setCookieHeaders = (headers as any).getSetCookie?.() ?? [];
    for (const raw of setCookieHeaders) {
        const [nameValue] = raw.split(';');
        const [name, ...valueParts] = nameValue.split('=');
        cookieJar.set(name, valueParts.join('='));
    }
}

function getCookieHeader(): string {
    return Array.from(cookieJar.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
}

async function api(path: string, options: RequestInit = {}) {
    const res = await fetch(BASE_URL + API_PREFIX + path, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(cookieJar.size > 0 ? { Cookie: getCookieHeader() } : {}),
            ...(options.headers as Record<string, string> || {}),
        },
    });
    setCookiesFromResponse(res.headers);
    const text = await res.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body };
}

function assert(label: string, condition: boolean, detail?: any) {
    if (!condition) {
        console.error(`\n❌ FAIL: ${label}`);
        if (detail !== undefined) {
            console.error(JSON.stringify(detail, null, 2));
        }
        throw new Error(`Assertion failed: ${label}`);
    }
    console.log(`✅ PASS: ${label}`);
}

(async () => {
    console.log('🚀 Starting smoke test...\n');

    const email = `smoke-${Date.now()}@example.com`;
    const password = 'Str0ng!Pass1';
    const name = 'SmokeUser';

    const reg = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
    });

    if (reg.status !== 201) {
        console.error(`\n❌ Registration failed with status ${reg.status}`);
        console.error('Response body:', JSON.stringify(reg.body, null, 2));
        throw new Error('Registration failed');
    }

    assert('Registration returns 201', reg.status === 201, reg);
    assert('onboardingCompleted is false', reg.body.user?.onboardingCompleted === false, reg.body);
    const userId = reg.body.user.id; // Сохраняем ID для возможной будущей очистки

    const me1 = await api('/auth/me');
    assert('/auth/me returns 200', me1.status === 200, me1);
    for (const k of ['id', 'email', 'name', 'avatarUrl', 'cityId', 'interestIds', 'onboardingCompleted', 'createdAt']) {
        assert(`Field ${k} exists in /auth/me`, k in me1.body.user, me1.body.user);
    }

    const steps = [
        { path: '/onboarding/date-of-birth', body: { birthDate: '1995-06-15' } },
        { path: '/onboarding/profile', body: { name: 'Alex', mainPhotoUrl: 'https://cdn/a.jpg' } },
        { path: '/onboarding/city', body: { cityId: TEST_CITY_ID } },
        { path: '/onboarding/interests', body: { interestIds: TEST_INTEREST_IDS } },
        { path: '/onboarding/optional', body: { bio: 'hi', languages: ['en'], socialLinks: { instagram: 'https://instagram.com/alex' } } },
    ];

    for (const step of steps) {
        const r = await api(step.path, { method: 'POST', body: JSON.stringify(step.body) });
        if (r.status !== 200) {
            console.error(`\n❌ ${step.path} failed with status ${r.status}`);
            console.error(JSON.stringify(r.body, null, 2));
            throw new Error(`${step.path} failed`);
        }
        assert(`${step.path} returns 200`, r.status === 200, r);
    }

    const done = await api('/onboarding/complete', { method: 'POST' });
    if (done.status !== 200) {
        console.error(`\n❌ /onboarding/complete failed with status ${done.status}`);
        console.error(JSON.stringify(done.body, null, 2));
        throw new Error('/onboarding/complete failed');
    }
    assert('/onboarding/complete returns 200', done.status === 200, done);
    assert('completedAt is set', !!done.body.data?.completedAt, done.body);

    const me2 = await api('/auth/me');
    assert('onboardingCompleted is true after completion', me2.body.user?.onboardingCompleted === true, me2.body);
    assert('Name is saved', me2.body.user?.name === 'Alex', me2.body);

    console.log('\n🧹 Cleaning up test session...');
    const logoutRes = await api('/auth/logout', { method: 'POST' });
    if (logoutRes.status === 200) {
        console.log('✅ PASS: Session cleared (logout)');
    } else {
        console.warn('⚠️ WARN: Logout failed, but test completed.');
    }

    console.log('\n🎉 SMOKE TEST PASSED SUCCESSFULLY!');
    console.log(`ℹ️ Note: User record (ID: ${userId}) remains in DB. Add DELETE endpoint if full cleanup is needed.`);
})().catch((err) => {
    console.error('\n💥 Smoke test aborted:', err.message);
    process.exitCode = 1;
});

// clean test data
// DELETE FROM users WHERE email LIKE 'smoke-%@example.com';