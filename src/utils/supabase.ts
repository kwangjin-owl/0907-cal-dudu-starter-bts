// Supabase 클라이언트 및 RPC 호출
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

let supabaseClient: ReturnType<typeof createClient> | null = null;

export function initSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
}

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = initSupabase();
  }
  return supabaseClient;
}

export async function signUpCustomer(email: string, password: string) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client.auth.signUp({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signInCustomer(email: string, password: string) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  // 서버 로그아웃은 세션이 이미 없으면 실패할 수 있다.
  // 실패해도 아래에서 브라우저에 남은 로그인 정보를 직접 지운다.
  try {
    await client.auth.signOut({ scope: 'local' });
  } catch {
    // 무시
  }

  // 새로고침해도 다시 로그인되지 않도록 저장된 세션을 확실히 지운다.
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && (k.startsWith('sb-') || k.includes('supabase.auth'))) keys.push(k);
    }
    keys.forEach(k => window.localStorage.removeItem(k));
  } catch {
    // 무시
  }
}

export async function getCurrentUser() {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data } = await client.auth.getSession();
  return data.session?.user ?? null;
}

export async function getAdminStatus(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const { data } = await client.auth.getSession();
  if (!data.session?.user) return false;

  const isAdmin =
    data.session.user.app_metadata?.role === 'admin' ||
    data.session.user.user_metadata?.is_admin === true;

  return isAdmin;
}

export async function submitRequest(
  customerId: string,
  slotIds: string[],
  operationId: string
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client.rpc('submit_request', {
    p_customer_id: customerId,
    p_slot_ids: slotIds,
    p_operation_id: operationId,
  });

  if (error) throw error;
  return data as { success: boolean; requestId?: string; error?: string };
}

export async function confirmRequest(
  requestId: string,
  slotId: string,
  adminId: string,
  operationId: string
): Promise<{ success: boolean; affectedRequests?: string[]; error?: string }> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client.rpc('confirm_request', {
    p_request_id: requestId,
    p_slot_id: slotId,
    p_admin_id: adminId,
    p_operation_id: operationId,
  });

  if (error) throw error;
  return data as { success: boolean; affectedRequests?: string[]; error?: string };
}

export async function resubmitRequest(
  customerId: string,
  requestId: string,
  slotIds: string[],
  operationId: string
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client.rpc('resubmit_request', {
    p_customer_id: customerId,
    p_request_id: requestId,
    p_slot_ids: slotIds,
    p_operation_id: operationId,
  });

  if (error) throw error;
  return data as { success: boolean; requestId?: string; error?: string };
}

export async function getSlots() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client.from('slots').select('*');
  if (error) throw error;
  return data;
}

export async function getMyRequests(customerId: string) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { data: requests, error: reqError } = await client
    .from('requests')
    .select('*')
    .eq('customer_id', customerId);
  if (reqError) throw reqError;

  if (!requests || requests.length === 0) return { requests: [], candidates: [] };

  const requestIds = requests.map((r: any) => r.id);
  const { data: candidates, error: candError } = await client
    .from('candidates')
    .select('*')
    .in('request_id', requestIds);
  if (candError) throw candError;

  return { requests, candidates };
}

export async function getAllRequests() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { data: requests, error: reqError } = await client
    .from('requests')
    .select('*')
    .order('created_at', { ascending: true });
  if (reqError) throw reqError;

  if (!requests || requests.length === 0) return { requests: [], candidates: [] };

  const requestIds = requests.map((r: any) => r.id);
  const { data: candidates, error: candError } = await client
    .from('candidates')
    .select('*')
    .in('request_id', requestIds);
  if (candError) throw candError;

  return { requests, candidates };
}

export async function getLogs() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client
    .from('operation_logs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export function isSupabaseConfigured(): boolean {
  return !!supabaseUrl && !!supabaseAnonKey;
}

// 확정된 예약을 고객 이메일로 알리는 Edge Function을 호출한다.
// 메일 발송은 서버(Edge Function)에서만 하고, 브라우저는 요청만 보낸다.
export async function notifyConfirm(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase 설정 없음' };

  try {
    const { data, error } = await client.functions.invoke('notify-confirm', {
      body: { requestId },
    });
    if (error) return { success: false, error: error.message };
    if (data?.error) return { success: false, error: String(data.error) };
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// 어드민 화면에서 신청자 이메일 목록을 가져온다. 어드민만 호출된다.
export async function fetchCustomerEmails(): Promise<Record<string, string>> {
  const client = getSupabaseClient();
  if (!client) return {};

  try {
    const { data, error } = await client.functions.invoke('notify-confirm', {
      body: { action: 'emails' },
    });
    if (error || data?.error) return {};
    return (data?.emails ?? {}) as Record<string, string>;
  } catch {
    return {};
  }
}

// ── 구글 로그인 + 캘린더 ────────────────────────────────────────
// 로그인할 때 캘린더에 일정을 넣을 권한까지 함께 받는다.
export async function signInWithGoogle() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'https://www.googleapis.com/auth/calendar.events',
      redirectTo: window.location.origin,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw error;
}

// 구글로 로그인했을 때만 값이 있다. 캘린더 API를 부를 때 쓰는 열쇠.
export async function getGoogleToken(): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return (data.session as unknown as { provider_token?: string })?.provider_token ?? null;
}

// 확정된 시간을 내 구글 캘린더에 바로 넣는다.
export async function addEventToGoogleCalendar(
  date: string,
  timeLabel: string
): Promise<{ success: boolean; error?: string }> {
  const token = await getGoogleToken();
  if (!token) {
    return { success: false, error: '구글로 로그인해야 캘린더에 넣을 수 있습니다' };
  }

  const startHour: Record<string, string> = { am: '09:00:00', pm: '13:00:00', ev: '18:00:00' };
  const endHour: Record<string, string> = { am: '10:00:00', pm: '14:00:00', ev: '19:00:00' };
  const label = startHour[timeLabel] ? timeLabel : 'am';

  try {
    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: 'cal.dudu-works 예약',
          description: '예약이 확정되었습니다.',
          start: { dateTime: `${date}T${startHour[label]}`, timeZone: 'Asia/Seoul' },
          end: { dateTime: `${date}T${endHour[label]}`, timeZone: 'Asia/Seoul' },
        }),
      }
    );
    if (!res.ok) {
      const detail = await res.text();
      return { success: false, error: `캘린더 등록 실패 (${res.status}) ${detail.slice(0, 120)}` };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}