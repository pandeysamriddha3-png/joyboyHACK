const http = require('http');

async function testPermissions() {
  console.log('Testing JoyBoy Permissions & API integrity...');

  // 1. Test video range streaming endpoint
  const streamReq = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/videos/stream/sample_demo_video.mp4',
    method: 'GET',
    headers: {
      'Range': 'bytes=0-1023'
    }
  }, (res) => {
    console.log('Streaming Range response status:', res.statusCode);
    // Since /videos/stream requires auth, it redirects 302 to login or returns 206 when authenticated
    console.log('Location header (if unauthenticated):', res.headers.location);
  });
  streamReq.end();
}

testPermissions();
