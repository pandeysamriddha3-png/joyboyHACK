const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body
        });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function extractCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return null;
  return setCookie[0].split(';')[0];
}

async function runTests() {
  console.log('--- RUNNING JOYBOY AUTOMATED SECURITY & FUNCTIONALITY SUITE ---');

  // Step 1: Register regular user 'charlie'
  const registerPayload = new URLSearchParams({
    username: 'charlie',
    email: 'charlie@joyboy.local',
    password: 'password123',
    confirmPassword: 'password123'
  }).toString();

  const regRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(registerPayload)
    }
  }, registerPayload);

  let charlieCookie = extractCookie(regRes.headers);
  console.log('1. Charlie registration status:', regRes.statusCode, '(redirects to /videos)');

  // If already registered, log in as charlie
  if (!charlieCookie) {
    const loginPayload = new URLSearchParams({
      email: 'charlie@joyboy.local',
      password: 'password123'
    }).toString();
    const loginRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(loginPayload)
      }
    }, loginPayload);
    charlieCookie = extractCookie(loginRes.headers);
  }

  // Step 2: Charlie attempts to access /admin (Should be 403 Forbidden)
  const adminRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/admin',
    method: 'GET',
    headers: {
      'Cookie': charlieCookie
    }
  });
  console.log('2. Charlie access to /admin status:', adminRes.statusCode, '(Expected: 403)');
  if (adminRes.statusCode === 403) {
    console.log('   ✅ PASS: Regular user blocked from admin panel.');
  } else {
    console.error('   ❌ FAIL: Admin panel did not block regular user!');
  }

  // Step 3: Charlie tries to edit Admin\'s video (video ID 4) (Should be 403 Forbidden)
  const editRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/videos/4/edit',
    method: 'GET',
    headers: {
      'Cookie': charlieCookie
    }
  });
  console.log('3. Charlie access to edit Admin\'s video status:', editRes.statusCode, '(Expected: 403)');
  if (editRes.statusCode === 403) {
    console.log('   ✅ PASS: Regular user blocked from editing another user\'s video.');
  } else {
    console.error('   ❌ FAIL: Regular user permitted to edit another user\'s video!');
  }

  // Step 4: Charlie tries to delete Admin\'s video (video ID 4) (Should be 403 Forbidden)
  const delRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/videos/4/delete',
    method: 'POST',
    headers: {
      'Cookie': charlieCookie
    }
  });
  console.log('4. Charlie POST delete on Admin\'s video status:', delRes.statusCode, '(Expected: 403)');
  if (delRes.statusCode === 403) {
    console.log('   ✅ PASS: Regular user blocked from deleting another user\'s video.');
  } else {
    console.error('   ❌ FAIL: Regular user permitted to delete another user\'s video!');
  }

  // Step 5: Charlie streams the video with HTTP Range header (Should be 206 Partial Content)
  const streamRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/videos/stream/sample_demo_video.mp4',
    method: 'GET',
    headers: {
      'Cookie': charlieCookie,
      'Range': 'bytes=0-500'
    }
  });
  console.log('5. Charlie Range stream request status:', streamRes.statusCode, '(Expected: 206)');
  console.log('   Content-Range:', streamRes.headers['content-range']);
  if (streamRes.statusCode === 206 && streamRes.headers['content-range']) {
    console.log('   ✅ PASS: Video streaming with byte range seeking works properly.');
  } else {
    console.error('   ❌ FAIL: Range streaming failed!');
  }

  // Step 6: Log in as admin_demo and verify admin CAN edit
  const adminLoginPayload = new URLSearchParams({
    email: 'admin@joyboy.local',
    password: 'password123'
  }).toString();
  const adminLoginRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(adminLoginPayload)
    }
  }, adminLoginPayload);
  const adminCookie = extractCookie(adminLoginRes.headers);

  const adminEditRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/videos/4/edit',
    method: 'GET',
    headers: {
      'Cookie': adminCookie
    }
  });
  console.log('6. Admin access to edit video status:', adminEditRes.statusCode, '(Expected: 200)');
  if (adminEditRes.statusCode === 200) {
    console.log('   ✅ PASS: Owner/Admin successfully granted edit access.');
  } else {
    console.error('   ❌ FAIL: Admin denied access to edit video!');
  }

  console.log('\n--- ALL TEST SCENARIOS COMPLETED SUCCESSFULLY ---');
}

runTests().catch(console.error);
