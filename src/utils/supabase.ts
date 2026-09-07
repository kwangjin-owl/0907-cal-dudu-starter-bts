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

  const { error } = await client.auth.signOut();
  if (error) throw error;
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