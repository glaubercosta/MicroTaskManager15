import { THEME_COOKIE, THEME_COOKIE_MAX_AGE } from '@/domain/theme'

/**
 * Fallback localStorage (RF-6): roda antes do paint quando NÃO há cookie de tema.
 * É uma string inline (não importa módulo), então replica a lógica de
 * hasThemeCookie/themeCookie de src/domain/theme.ts (GC-20):
 * - detecção exata do cookie via split + startsWith ('x-theme=' não casa);
 * - `secure` só quando a página é servida via HTTPS (dev local em HTTP segue).
 */
export const themeFallbackScript =
  `(function(){try{` +
  `var has=document.cookie.split('; ').some(function(c){return c.startsWith('${THEME_COOKIE}=')});` +
  `if(!has){var t=localStorage.getItem('${THEME_COOKIE}');` +
  `if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;` +
  `var c='${THEME_COOKIE}='+t+'; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax';` +
  `if(location.protocol==='https:'){c+='; secure'}` +
  `document.cookie=c}}}catch(e){}})()`
