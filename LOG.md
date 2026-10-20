# LOG - Documentació d'ús de la Intel·ligència Artificial i Referències

## 1. Fitxa de l'Eina d'Intel·ligència Artificial
* **Eina:** Claude (Anthropic)
* **Model utilitzat:** Claude 3.5 Sonnet
* **Objectiu de l'ús:** Assistent de consulta per a patrons d'arquitectura de seguretat en aplicacions web (JWT en cookies HttpOnly vs. LocalStorage), configuració de capçaleres CORS amb credencials, i adaptació reactiva amb Signals a Angular modern.

---

## 2. Referències i Materials Consultats
1. **OWASP (Open Web Application Security Project):**
   * *JSON Web Token Cheat Sheet for Java/Node.js Developers*.
   * *Cross-Site Scripting (XSS) Prevention Cheat Sheet*.
   * *HTML5 Web Storage Security Risks* (perills de persistir tokens de llarga durada a `localStorage`).
2. **Documentació Oficial d'Express.js:**
   * Mòdul `cookie-parser`: ús de `req.cookies`, `res.cookie()` i `res.clearCookie()`.
   * Mòdul `cors`: opcions `credentials: true` i restricció d'orígens exactes.
3. **Documentació Oficial d'Angular (v19/v21):**
   * *Signals & Reactivity Guide*: gestió d'estat reactiu en memòria amb `signal()`, `computed()` i `effect()`.
   * *Application Initializers*: inicialització asíncrona d'arrencada amb `provideAppInitializer()`.
   * *HttpClient Configuration*: registre d'interceptors funcionals amb `withInterceptors()` i transmissió de credencials.
4. **Documentació Oficial de Socket.IO:**
   * *Server API*: emissió de transmissions globals (`io.emit`) i gestió de connexions.
   * *Client API*: cicle de vida de la connexió (`connect`, `disconnect`) i autenticació per handshake.
5. **Apunts i Guies de l'Assignatura:**
   * Materials docents del Seminari 7: Autenticació JWT, Seguretat Web i WebSockets (Enginyeria d'Aplicacions - UPC).

---

## 3. Registre d'Usos de la IA Generativa

### Ús 1: Configuració de la cookie HttpOnly i CORS a Express
* **Prompt literal:**
  > *"Vull canviar la gestió del refresh token a Express perquè es guardi en una cookie HttpOnly en lloc del body a /auth/login i /auth/refresh. Com ha de ser la configuració de la cookie i què cal tocar a CORS perquè funcioni amb Angular a localhost:4200?"*
* **Incoherències / problemes detectats a la resposta:**
  * Claude va proposar inicialment configurar CORS amb `origin: true`, la qual cosa no era prou explícita i generava comportaments inconsistents amb navegadors estrictes; per a sol·licituds autenticades amb cookies cal declarar l'origen exacte (`http://localhost:4200`).
  * A les opcions de la cookie va suggerir `sameSite: 'none'` amb `secure: true`, una combinació pròpia de comunicacions entre dominis diferents amb HTTPS, mentre que per al nostre entorn local d'aula calia `sameSite: 'strict'` i `secure: process.env.NODE_ENV === 'production'`.
  * Va ometre la restricció del camí (`path: '/auth'`), enviant la cookie innecessàriament a rutes de l'API alienes a la gestió de tokens.
* **Solució i adaptació manual:**
  * Es va implementar manualment un objecte `cookieOptions` amb `httpOnly: true`, `sameSite: 'strict'`, `path: '/auth'` (o `/api/auth`) i `secure` condicionat a producció.
  * S'ha configurat el middleware de CORS amb `{ origin: frontendUrl, credentials: true }` i s'ha registrat `cookieParser()` abans de les rutes.

---

### Ús 2: Gestió de l'access token en memòria i recàrrega de sessió amb Signals a Angular
* **Prompt literal:**
  > *"A Angular, com puc guardar l'access token només en memòria amb una signal a AuthService, i com faig perquè en recarregar la pàgina no es perdi la sessió utilitzant la cookie del refresh token?"*
* **Incoherències / problemes detectats a la resposta:**
  * Va proposar utilitzar el patró clàssic basat en classes `APP_INITIALIZER` amb observables i factories obsoletes, en comptes de la nova funció idiomàtica `provideAppInitializer()` introduïda a les versions recents d'Angular.
  * A les crides de `refresh()` i `login()`, va ometre el paràmetre `{ withCredentials: true }` al client HTTP d'Angular, de manera que el navegador no enviava la cookie HttpOnly i la petició fallava amb un error 401.
  * Va recomanar mantenir l'objecte d'usuari a `localStorage` per "facilitat d'accés", incomplint el requisit de seguretat d'evitar qualsevol rastre de sessió persistent a l'emmagatzematge local del navegador.
* **Solució i adaptació manual:**
  * Es va utilitzar `provideAppInitializer(() => inject(AuthService).init())` a `app.config.ts`.
  * Dins d'`AuthService`, es va configurar `accessToken` com a `signal<string | null>(null)` i es va desenvolupar el mètode `init()` per recuperar el token mitjançant `firstValueFrom(this.refresh())` i, tot seguit, obtenir el perfil actualitzat des de `/users/me`.
  * S'ha afegit explícitament `{ withCredentials: true }` tant a les crides de login com de refresh i logout.

---

### Ús 3: Adaptació dels tests unitaris del frontend (eliminació d'errors de linter i tipat)
* **Prompt literal:**
  > *"Els tests unitaris d'Angular fallen perquè abans feien servir localStorage.setItem('token', ...) per simular la sessió. Com adapto els tests d'App, Chat, AuthGuard i Interceptor?"*
* **Incoherències / problemes detectats a la resposta:**
  * Per injectar l'estat en les proves, Claude va suggerir forçar l'accés a les propietats privades mitjançant castin bruts: `(TestBed.inject(AuthService) as any).currentUser.set(...)`.
  * En executar `npm run lint` (`ng lint`), això disparava nombrosos errors bloquejants de la regla `@typescript-eslint/no-explicit-any`.
  * A més, en el mètode `logout()`, va escriure un callback d'error buit `.subscribe({ error: () => {} })`, provocant l'error d'ESLint `@typescript-eslint/no-empty-function`.
* **Solució i adaptació manual:**
  * Es va crear un mètode públic i net `setSession(user, token)` dins d'`AuthService`. Això permet inicialitzar l'estat tant des dels mètodes propis del servei com des de la suite de proves sense recórrer mai a `as any`.
  * Es va simplificar la crida de desconnexió a `.subscribe()`, eliminant el callback buit.
  * Com a resultat, la suite sencera de 64 tests unitaris passa en verd i el linter s'executa amb 0 avisos.

---

### Ús 4: Emissió d'esdeveniments de WebSockets des de controladors REST
* **Prompt literal:**
  > *"Com puc emetre esdeveniments de Socket.io des dels controladors d'Express quan es crea, modifica o elimina un llibre o un autor, sense acoblar la instància d'express a la lògica del xat?"*
* **Incoherències / problemes detectats a la resposta:**
  * Va suggerir afegir la instància global de sockets a la configuració d'Express (`req.app.set('io', io)`) i recuperar-la manualment a cada funció controladora amb `req.app.get('io')?.emit(...)`. Aquesta solució acobla innecessàriament les rutes amb l'objecte `app` d'Express i dificulta el testeig aïllat.
  * Al frontend va proposar establir la subscripció als sockets dins dels components individuals de llista (`AuthorsList`, `BooksList`), la qual cosa generava múltiples connexions i duplicitat d'escoltes en navegar entre pantalles.
* **Solució i adaptació manual:**
  * Al backend es va crear un mòdul independent `src/sockets/Events.ts` que encapsula la instància del servidor de sockets amb `setIo()` i exposa una funció clara `broadcast(event, payload)`. Els controladors d'autors i llibres només invoquen `broadcast(...)` sense conèixer els detalls interns del transport.
  * Al frontend es va dissenyar el servei singleton `NotificationService`, gestionat automàticament des d'`App` mitjançant un `effect()` reactiu que connecta el socket únicament quan hi ha una sessió activa (`isLoggedIn()`) i el tanca en tancar la sessió.

