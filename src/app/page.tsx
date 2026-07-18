import { createClient } from '@/lib/supabase/server'
import { signOut } from './login/actions'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main style={{ maxWidth: 600, margin: '6vh auto', padding: 24 }}>
      <h1>MicroTaskManager</h1>
      <p>Sessão de {user?.email ?? 'desconhecido'}.</p>
      <form action={signOut}>
        <button type="submit">Sair</button>
      </form>
    </main>
  )
}
