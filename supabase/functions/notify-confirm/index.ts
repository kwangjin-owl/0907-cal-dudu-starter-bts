// 확정된 예약을 고객 이메일로 알려주는 함수
// 어드민이 확정 버튼을 누른 뒤 앱에서 호출한다.
//
// 배포:  supabase functions deploy notify-confirm
// 키 등록: supabase secrets set RESEND_API_KEY=re_...

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // 브라우저가 먼저 보내는 확인 요청
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { requestId } = await req.json();
    if (!requestId) return json({ error: 'requestId가 없습니다' }, 400);

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) return json({ error: 'RESEND_API_KEY가 등록되지 않았습니다' }, 500);

    // 1. 호출한 사람이 어드민인지 확인한다
    const authHeader = req.headers.get('Authorization') ?? '';
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: me, error: meErr } = await caller.auth.getUser();
    if (meErr || !me?.user) return json({ error: '로그인이 필요합니다' }, 401);
    if (me.user.app_metadata?.role !== 'admin') {
      return json({ error: '어드민만 호출할 수 있습니다' }, 403);
    }

    // 2. 여기서부터는 서버 권한으로 읽는다 (남의 이메일을 읽어야 하므로)
    const admin = createClient(url, serviceKey);

    const { data: reqRow, error: reqErr } = await admin
      .from('requests')
      .select('id, customer_id, status, confirmed_slot_id, confirmed_at')
      .eq('id', requestId)
      .single();
    if (reqErr || !reqRow) return json({ error: '신청을 찾을 수 없습니다' }, 404);
    if (reqRow.status !== 'confirmed') {
      return json({ error: '아직 확정되지 않은 신청입니다' }, 400);
    }

    // 3. 슬롯 정보
    const { data: slot } = await admin
      .from('slots')
      .select('date, time_label')
      .eq('id', reqRow.confirmed_slot_id)
      .single();

    const TIME_TEXT: Record<string, string> = {
      am: '오전 09:00',
      pm: '오후 13:00',
      ev: '저녁 18:00',
    };
    const when = slot ? `${slot.date} ${TIME_TEXT[slot.time_label] ?? slot.time_label}` : '';

    // 4. 고객 이메일 찾기
    const { data: userRes, error: userErr } =
      await admin.auth.admin.getUserById(reqRow.customer_id);
    const to = userRes?.user?.email;
    if (userErr || !to) return json({ error: '고객 이메일을 찾을 수 없습니다' }, 404);

    // 5. 메일 보내기
    const html = `
      <div style="font-family:system-ui,-apple-system,'Malgun Gothic',sans-serif;
                  max-width:560px;margin:0 auto;padding:24px;color:#14263B;line-height:1.6">
        <p style="font-size:13px;color:#1F6F63;font-weight:700;margin:0 0 8px">
          cal.dudu-works.com
        </p>
        <h1 style="font-size:22px;margin:0 0 16px">예약이 확정되었습니다</h1>
        <div style="background:#DCE9D5;border:1px solid #A9C39B;padding:18px 20px;margin:0 0 18px">
          <p style="margin:0 0 4px;font-size:13px;color:#4A5C70">확정된 시간</p>
          <p style="margin:0;font-size:20px;font-weight:700">${when}</p>
        </div>
        <p style="margin:0 0 8px">신청하신 시간 중 위 시간으로 확정되었습니다.</p>
        <p style="margin:0;font-size:13px;color:#4A5C70">
          자세한 내용은 앱의 <b>내 신청 현황</b>에서 확인하실 수 있습니다.
        </p>
      </div>
    `;

    const mail = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'cal.dudu-works <onboarding@resend.dev>',
        to: [to],
        subject: `예약이 확정되었습니다 · ${when}`,
        html,
      }),
    });

    if (!mail.ok) {
      const detail = await mail.text();
      return json({ error: '메일 발송 실패', detail }, 502);
    }

    return json({ success: true, to });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});