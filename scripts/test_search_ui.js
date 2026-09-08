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

async function runSearchTests() {
  console.log('--- TESTING SEARCH & MOBILE SEARCH UI ON /videos ---');

  // Log in as demo user to get session
  const loginPayload = new URLSearchParams({
    email: 'admin@joyboy.local',
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

  const authCookie = extractCookie(loginRes.headers);
  console.log('1. Login status:', loginRes.statusCode);

  // 2. Fetch /videos without search
  const videosRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/videos',
    method: 'GET',
    headers: {
      'Cookie': authCookie
    }
  });

  console.log('2. GET /videos status:', videosRes.statusCode);
  if (videosRes.statusCode !== 200) {
    throw new Error(`Expected 200 on /videos, got ${videosRes.statusCode}`);
  }

  const html = videosRes.body;

  // Check essential elements
  const checks = [
    { name: 'Desktop search form', pass: html.includes('id="search-form"') },
    { name: 'Desktop search input', pass: html.includes('id="search-input"') },
    { name: 'Mobile search trigger button', pass: html.includes('id="mobile-search-btn"') },
    { name: 'Mobile search overlay', pass: html.includes('id="mobile-search-overlay"') },
    { name: 'Mobile search back button', pass: html.includes('id="mobile-search-back-btn"') },
    { name: 'Mobile search form', pass: html.includes('id="mobile-search-form"') },
    { name: 'Mobile search input', pass: html.includes('id="mobile-search-input"') },
    { name: 'Mobile search clear button', pass: html.includes('id="mobile-search-clear-btn"') },
    { name: 'Mobile recent searches container', pass: html.includes('id="mobile-recent-searches"') },
    { name: 'Recent searches list', pass: html.includes('id="recent-searches-list"') },
    { name: 'Recent clear all button', pass: html.includes('id="recent-clear-all-btn"') },
  ];

  checks.forEach(c => {
    console.log(`   ${c.pass ? '✅ PASS' : '❌ FAIL'}: ${c.name}`);
    if (!c.pass) throw new Error(`Missing element: ${c.name}`);
  });

  // 3. Search query test: GET /videos?search=sample
  const searchRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/videos?search=sample',
    method: 'GET',
    headers: {
      'Cookie': authCookie
    }
  });

  console.log('3. GET /videos?search=sample status:', searchRes.statusCode);
  const searchHtml = searchRes.body;
  const searchChecks = [
    { name: 'Search title rendered in heading', pass: searchHtml.includes('Search results for &quot;sample&quot;') || searchHtml.includes('Search results for "sample"') },
    { name: 'Desktop input has value="sample"', pass: searchHtml.includes('value="sample"') },
    { name: 'Mobile input has value="sample"', pass: searchHtml.includes('id="mobile-search-input"') && searchHtml.includes('value="sample"') },
    { name: 'Clear search link rendered', pass: searchHtml.includes('Clear search') },
  ];

  searchChecks.forEach(c => {
    console.log(`   ${c.pass ? '✅ PASS' : '❌ FAIL'}: ${c.name}`);
    if (!c.pass) throw new Error(`Search check failed: ${c.name}`);
  });

  console.log('\n--- ALL SEARCH & MOBILE SEARCH UI TESTS PASSED! ---');
}

runSearchTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
