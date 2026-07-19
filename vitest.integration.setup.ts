import dotenv from 'dotenv'

// Carrega credenciais locais de dev (não versionadas) para os testes de integração.
dotenv.config({ path: '.env.local' })
