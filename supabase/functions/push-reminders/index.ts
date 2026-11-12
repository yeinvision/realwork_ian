// 일정 알림 웹 푸시: 1분마다 cron이 불러요.
// 일정마다 전날 같은 시간 · 1시간 전 · 10분 전에 등록된 기기(push_subs)로 알림을 보내요.
// 웹앱 설정(settings.remind)의 전체 끄기(until)·일정별 끄기(off)를 그대로 따라요.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const STAGES = [
  { k: 'day', min: 1440, grace: 180, name: '전날' },
  { k: 'h1', min: 60, grace: 20, name: '1시간 전' },
  { k: 'm10', min: 10, grace: 10, name: '10분 전' },
];
const pad = (n: number) => String(n).padStart(2, '0');

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) return new Response('forbidden', { status: 403 });
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || Deno.env.get('SUPABASE_URL')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  const { data: subs, error } = await db.from('push_subs').select('id,user_id,endpoint,p256dh,auth,tz_offset');
  if (error) return new Response(error.message, { status: 500 });
  const byUser = new Map<string, typeof subs>();
  for (const s of subs || []) byUser.set(s.user_id, [...(byUser.get(s.user_id) || []), s]);

  const now = Date.now();
  let sent = 0, gone = 0;
  for (const [uid, list] of byUser) {
    const tzo = list![0].tz_offset ?? 540;
    const local = (ms: number) => new Date(ms + tzo * 60e3);   // UTC 메서드로 읽으면 기기 현지 시각
    const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    const today = ymd(local(now)), tomorrow = ymd(local(now + 864e5));
    const { data: rows } = await db.from('notes').select('id,data').eq('user_id', uid).in('id', ['settings', 'day-' + today, 'day-' + tomorrow]);
    const doc = (id: string) => (rows || []).find((r) => r.id === id)?.data || {};
    const rem = doc('settings').remind || {};
    const paused = rem.until === 'forever' || (rem.until && Date.parse(rem.until) > now);
    const off = rem.off || {};

    for (const date of [today, tomorrow]) {
      for (const e of (doc('day-' + date).events || [])) {
        if (!e || !e.time || !/^\d\d:\d\d$/.test(e.time)) continue;
        const [y, m, d] = date.split('-').map(Number), [h, mi] = e.time.split(':').map(Number);
        const at = Date.UTC(y, m - 1, d, h, mi) - tzo * 60e3;
        const key = 'l:' + e.id;
        for (let i = 0; i < STAGES.length; i++) {
          const st = STAGES[i], next = STAGES[i + 1], from = at - st.min * 60e3;
          const to = Math.min(from + st.grace * 60e3, next ? at - next.min * 60e3 : at);
          if (now < from || now >= to) continue;
          if (e.rmk && Date.parse(e.rmk) > from) continue;        // 이 단계가 지난 뒤에 만들거나 시간을 바꾼 일정
          const fid = `${key}|${st.k}|${date}|${e.time}`;
          const { error: dup } = await db.from('push_sent').insert({ user_id: uid, fid });
          if (dup) continue;                                        // 이미 보냈어요
          if (paused || off[key]) continue;                         // 꺼져 있던 동안의 알림은 나중에 몰아서 보내지 않아요
          const left = Math.round((at - now) / 60e3);
          const when = date !== today ? `내일 ${e.time}` : left <= 0 ? '지금 시작' : left < 60 ? `${left}분 후` : `${Math.floor(left / 60)}시간${left % 60 ? ` ${left % 60}분` : ''} 후`;
          const sub = String(e.memo || '').split('\n')[0].slice(0, 80);
          const payload = JSON.stringify({
            title: `🔔 ${when} · ${e.title || '(제목 없음)'}`,
            body: `${date === today ? '오늘' : '내일'} ${e.time}${e.end ? '–' + e.end : ''}${sub ? ' · ' + sub : ''}`,
            tag: fid, date, sticky: st.k !== 'day',
          });
          for (const s of list!) {
            try {
              await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 900, urgency: 'high' });
              sent++;
              await db.from('push_subs').update({ last_ok: new Date().toISOString() }).eq('id', s.id);
            } catch (err) {
              const code = (err as { statusCode?: number }).statusCode;
              if (code === 404 || code === 410) { await db.from('push_subs').delete().eq('id', s.id); gone++; }
              else console.error('push failed', code, String(err).slice(0, 200));
            }
          }
        }
      }
    }
  }
  if (new Date(now).getUTCMinutes() === 0) await db.from('push_sent').delete().lt('sent_at', new Date(now - 3 * 864e5).toISOString());
  return new Response(JSON.stringify({ users: byUser.size, sent, gone }), { headers: { 'Content-Type': 'application/json' } });
});
