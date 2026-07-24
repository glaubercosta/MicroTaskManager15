import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Confere, sob a RLS do usuário, se a lista existe e pertence a ele (GC-21).
 * Sem linha (lista alheia/inexistente) ou erro (id malformado) → false.
 */
export async function userOwnsList(
  supabase: SupabaseClient,
  listId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('lists')
    .select('id')
    .eq('id', listId)
    .maybeSingle()
  return error === null && data !== null
}
