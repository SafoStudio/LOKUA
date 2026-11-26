import 'dotenv/config';
import sharp from 'sharp';

const BASE_URL = process.env.SMOKE_API_URL ?? process.env.APP_URL ?? 'http://localhost:3003';
const API_PREFIX = '/api/v1';

const cookieJar = new Map<string, string>();

function setCookiesFromResponse(headers: Headers) {
    const setCookieHeaders = headers.getSetCookie();
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
        signal: AbortSignal.timeout(15000),
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
    if (process.argv.includes('--help')) {
        console.log('Usage: pnpm --filter api smoke:onboarding');
        console.log('Set TEST_CITY_ID and TEST_INTEREST_IDS. Use a local API with test storage and email configuration.');
        return;
    }
    const cityId = process.env.TEST_CITY_ID?.trim();
    const interestIds = process.env.TEST_INTEREST_IDS?.split(',').map((id) => id.trim()).filter(Boolean) ?? [];
    if (!cityId || interestIds.length < 3) {
        throw new Error('TEST_CITY_ID and at least three TEST_INTEREST_IDS are required');
    }
    console.log('🚀 Starting onboarding smoke test...\n');

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
    const userId = reg.body.user.id;

    const me1 = await api('/auth/me');
    assert('/auth/me returns 200', me1.status === 200, me1);
    for (const k of ['id', 'email', 'name', 'avatarUrl', 'cityId', 'interestIds', 'onboardingCompleted', 'createdAt']) {
        assert(`Field ${k} exists in /auth/me`, k in me1.body.user, me1.body.user);
    }

    const fixture = await sharp({
        create: { width: 24, height: 24, channels: 3, background: '#8473a0' },
    }).png().toBuffer();
    const upload = await api('/media/images?scope=PROFILE', {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: new Uint8Array(fixture),
    });
    assert('Profile image upload returns a WebP URL', upload.status === 201 &&
        upload.body?.data?.contentType === 'image/webp' && typeof upload.body?.data?.url === 'string');
    const photoUrl = upload.body.data.url;

    const steps = [
        { path: '/onboarding/date-of-birth', body: { birthDate: '1995-06-15' } },
        { path: '/onboarding/profile', body: { name: 'Alex', mainPhotoUrl: photoUrl } },
        { path: '/onboarding/city', body: { cityId } },
        { path: '/onboarding/interests', body: { interestIds } },
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
    const photos = await api('/users/me/photos');
    assert('The uploaded photo is saved as the primary photo', photos.status === 200 &&
        photos.body?.data?.photoUrls?.[0] === photoUrl);

    console.log('\n🧹 Cleaning up test session...');
    const logoutRes = await api('/auth/logout', { method: 'POST' });
    assert('Logout returns 200', logoutRes.status === 200);
    const afterLogout = await api('/auth/me');
    assert('Logged-out session cannot access the profile', afterLogout.status === 401);

    console.log('\n🎉 SMOKE TEST PASSED SUCCESSFULLY!');
    console.log(`ℹ️ Test account ${userId} and uploaded photo remain in the test environment.`);
})().catch((err) => {
    console.error('\n💥 Smoke test aborted:', err.message);
    process.exitCode = 1;
});
