// Cloudflare Worker — proxy CORS stateless cho api.replicate.com (dùng cho plugin Camera Raw Studio).
//
// Vì sao cần: Replicate API không trả header Access-Control-Allow-Origin,
// nên trình duyệt chặn plugin gọi thẳng tới api.replicate.com (lỗi "Failed to fetch").
// Worker này chỉ chuyển tiếp request (kèm Authorization header của từng user) và
// thêm header CORS. KHÔNG lưu token, KHÔNG log body.
//
// Cách deploy (miễn phí):
//  1. Vào https://dash.cloudflare.com -> Workers & Pages -> Create -> Create Worker.
//  2. Xóa code mẫu, dán toàn bộ file này vào -> Deploy.
//  3. Copy URL dạng https://<ten>.workers.dev
//  4. Trong plugin (tab Gen Fill), dán URL vào ô "Proxy URL" rồi bấm Lưu.
//
// Bảo mật: mỗi user vẫn dùng token Replicate của chính mình (BYOK) — chi phí
// trừ vào tài khoản của họ. Worker không cần biến môi trường hay secret nào.

const UPSTREAM = 'https://api.replicate.com';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    const url = new URL(req.url);
    // Chỉ cho phép path của Replicate API để tránh bị lợi dụng làm open proxy linh tinh.
    if (!url.pathname.startsWith('/v1/')) {
      return new Response('Not found', { status: 404, headers: CORS });
    }
    const upstream = new Request(UPSTREAM + url.pathname + url.search, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
      redirect: 'follow',
    });
    let res;
    try {
      res = await fetch(upstream);
    } catch (e) {
      return new Response('Upstream error', { status: 502, headers: CORS });
    }
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
    return out;
  },
};
