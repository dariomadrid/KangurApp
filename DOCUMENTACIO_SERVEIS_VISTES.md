# Documentació: Estructura i arxius clau (services + views)

Aquest document descriu l'estructura de carpetes principal i explica breument les funcions dels arxius dins `src/services` i `src/views`.

**Estructura de carpetes (rellevant)**
- `src/`
  - `services/` - Lògica d'accés a Firebase i sincronització offline
  - `views/` - Vistes (components de pàgina) de l'aplicació
  - `stores/`, `components/`, `utils/`, `assets/`, ... (altres carpetes de suport)

---

## Serveis (src/services)

### 1. Configuració de Firebase a l'arxiu src/services/firebase.ts

Arxiu de configuració per inicialitzar Firebase.

**Funcions:**
- Exporta `db` (instància de Firestore) i `auth` (instància d'Authentication).
- Habilita `persistentLocalCache()` perquè Firestore guardi dades localment en offline.

**Propòsit:** Centralitzar la configuració de Firebase en un arxiu separar, evitant duplicacions.

---

### 2. Authentication Service a l'arxiu src/services/auth.service.ts

Gestiona l'autenticació d'usuaris i l'emmagatzematge local de dades de sessió.

Funcions amb l'autenticació de Firebase Auth:

**`register({name, email, password})`**
- Crea nou usuari a Firebase Auth amb email/contrasenya.
- Actualitza `displayName` a `name`.
- Crea document `users/{uid}` a Firestore amb `{name, email, createdAt}`.
- Desa nom i email a `localStorage` per accés ràpid.

**`login({email, password})`**
- Fa sign-in amb Firebase Auth.
- Guarda `uid`, `displayName`, email a `localStorage` per poder utilitzar les dades de forma offline.
- Intenta carregar llista de `nadons` (bebes) de l'usuari i la guarda a `localStorage`.
- Si hi ha únic nadó, el marca automàticament com `selectedNado`.
- Retorna `{expires_in: null}`.

**`me()`**
- Llegeix usuari autenticat actual (`auth.currentUser`).
- Obté document `users/{uid}` de Firestore.
- Retorna `{uid, email, name, extra: {...}}`.

**`logout()`**
- Tanca sessió amb Firebase (`signOut(auth)`).
- Esborra token de `localStorage`.

**`saveToken(token)` / `removeToken()` / `getToken()`**
- Utilitats per gestionar tokens a `localStorage`.

**Relació amb offline:** Els camps a `localStorage` permeten fallback a dades en cache.

---

### 3. Offline Synchronization Service a l'arxiu src/services/offline.service.ts

Implementa sistema de cua per encolar operacions offline i sincronitzar-les amb connexió.

**Estructura interna:**
- **`PendingItem`** : `{id, userId, collection, data, createdAt}`
- **`offlineQueue`** : clau de `localStorage` que desa la cua
- **`isProcessing`** : flag per evitar processament simultani

**`addPending(collectionName, data, userId)`**
- Crea element amb id temporal: `${Date.now()}-${random}`
- Afegeix informació de col·lecció, dades i usuari
- Si `data` conté `__tempId`, es marca per processar en ordre (dependències)
- Desa a `localStorage`

**`processQueue()`**
- Només executa si hi ha connexió, és a dir, que `navigator.onLine === true` i hi ha usuari.
- Per a cada element en cua:
  - Si és un `nado` amb `__tempId`: crea a Firestore i mapeja ID temporal → ID real.
  - Si és `cronometre` amb `nadoId` local: busca/crea el nadó placeholder.
  - Crea document a Firestore amb IDs normalitzats.
- Guarda elements que fallen per reintentar-los més tard.
- **Lògica de dependències:** assegura que nadons es crein ABANS que cronometres/estades que els referencien.

**`getPendingCount()`**
- Retorna nombre d'elements en cua (útil per indicadors UI).

---

## Vistes (src/views)

### Flux d'aplicació i estructura de vistes

L'aplicació segueix aquest flux:
1. **Inici** → Pàgina inicial per entrar a Login o Register
2. **Register** → Pàgina per regitrar-se
3. **Cangurs** → Pàgina per guardar els cangurs (definir educadors)
4. **Nado** → Pàgina per guardar el nadó (definir nadó)
5. **Funcionalitats** → Funcionalitats (menú principal)
6. **Cronòmetre** → Cronometre (pell amb pell) 
7. **RegisterEntrada** → Guarda el registre d'entrada i sortida de l'unitat
6. **Historial** → Veure gràfics de sessions

---

### Vistes detallades

#### 1. HomePage.vue - Pantalla inicial
**Propòsit:** Portada amb botons de Login/Register.
- Mostra logo de KangurApp.
- Dos botons: `Registrar-se` i `Iniciar sessió`.
- Sense lògica personalitzada.

---

#### 2. Login.vue - Autenticació
**Camps:** Email, Contrasenya.

**`onIonViewWillEnter()`:** Reinicia camps quan la vista apareix (evita mostrar dades anteriors).

**`Login()`:** Valida, crida `authService.login()` i redirigeix a `/funcionalitats` en èxit. Mostra toast d'error si falla.

**Enllaç addicional:** "He oblidat la contrasenya" → `/reset-password`.

---

#### 3. Register.vue - Registre d'usuari
**Camps:** Nom, Email, Contrasenya, Confirmar contrasenya.

**`Register()`:** 
- Valida camps no buits i que les contrasenyes coincideixin.
- Crida `authService.register()`.
- Desa `uid`, `name`, `email` a `localStorage`.
- Redirigeix a `/cangurs`.

---

#### 4. ResetPassword.vue - Recuperació de contrasenya
**Camp:** Email.

**`sendReset()`:** 
- Envia email de recuperació amb `sendPasswordResetEmail()`.
- Mostra toast de confirmació.
- Redirigeix enrere després de 1.2s.

---

#### 5. Cangurs.vue - Gestionar educadors
**Estructura:** Cada cangur és `{id, nom}` (id real o temporal local).

**`onMounted()`:** 
- Carrega cangurs de Firestore (online) o `localStorage` (offline).
- Aplica prioritat: mou nom del registrador al principi si existeix.
- Crea automàticament primer cangur amb nom del registrador.
- Desa a `localStorage` per offline.

**`afegirCangur()`:** 
- Si online: crea a Firestore.
- Si offline: genera id temporal i encola amb `offlineService.addPending()`.

**`eliminarCangur(index)`:** Elimina tots excepte el primer. Esborra de Firestore si id real.

**`guardarCangurs()`:** Sincronitza pendents (Firestore o cua offline) i redirigeix a `/nado`.

---

#### 6. Nado.vue - Registre del bebè
**Camps:** Nom del nadó, Setmanes (gestació), Dies.

**`Registre()`:**
- Crea document `nadons` a Firestore (online) o encola amb `__tempId` (offline).
- El `__tempId` permet que `processQueue()` mapegi l'id temporal → id real de Firestore.
- Guarda `selectedNado` i `selectedNadoName` a `localStorage`.
- Redirigeix a `/funcionalitats`.

---

#### 7. ConfiguracioFamilia.vue - Editar cangurs (accés menú)
**Estructura i funcions:** Idèntiques a `Cangurs.vue` (permet modificar educadors en qualsevol moment).

---

#### 8. Funcionalitats.vue - Menú principal
**Opcions:**
- **`iniciar()`:** Redirigeix a `/cronometre` per registrar pell amb pell.
- **`registre()`:** Redirigeix a `/registerEntrada` per registrar entrada a unitat.

---

#### 9. Cronometre.vue - Cronòmetre pell amb pell
**Estructura:** `temps` (segons), `estaActiu` (bool), `messages` (marquesina rotatiu).

**`startCrono()`:** Inicia interval (+1s cada segon) i rotació de la marquesina cada 8s.

**`stopCrono()`:** Atura intervals i neteja timers.

**`toggleCronometre()`:** 
- Si actiu: para, guarda temps amb `setCronoTemp()`, redirigeix a `/guardarCrono`.
- Si inactiu: comença.

**`formatTime(totalSeconds)`:** Retorna format "MM:SS".

**`onUnmounted()`:** Neteja timers per evitar que es repetiexin les sessions.

---

#### 10. GuardarCrono.vue - Desar sessió pell amb pell
**Estructura:** `temps` (cronòmetre), `cangurs` (educadors), `cangurSeleccionat`.

**`onMounted()`:** 
- Carrega cangurs (Firestore online / cache offline).
- Aplica prioritat al nom amb el que s'ha fet el registre.
- Carrega nadons per validació.

**`guardarSessio()`:**
- Valida el cangur seleccionat.
- Obté dades del nadó (Firestore o cache).
- Prepara payload: `{cangurId, cangurNom, nadoId, nadoNom, temps, dia, hora, createdAt}`.
- Si online: crea `cronometres` a Firestore.
- Si offline: es guarda a la cua amb `offlineService.addPending()`.
- Mostra toast i redirigeix a `/funcionalitats`.

---

#### 11. RegisterEntrada.vue - Registrar entrada/sortida unitat
**Camps:** Hora entrada (time picker), Hora sortida (time picker).

**`onEntryChange()` / `onExitChange()`:** Actualitzen refs amb valors seleccionats.

**`registrar()`:**
- Valida que el temps compleixi que: sortida > entrada.
- Obté ID nadó (Firestore o cache).
- Prepara payload: `{nadoId, dia, horaEntrada, horaSortida, createdAt}`.
- Si online: crea `estades` a Firestore.
- Si offline: guarda a la cua amb `offlineService.addPending()`.
- Mostra toast i redirigeix a `/funcionalitats`.

---

#### 12. Historial.vue - Gràfics de sessions
**Estructura:** `sessions` (filtrada setmana), `allSessions` (totes de Firestore), `barData`/`pieData` (gràfics), `currentWeekStart`.

**`logout()`:** Tanca sessió i redirigeix a Login.

**Utilitats:**
- **`convertirsegonsAMinuts(temps)`:** Converteix segons a minuts (decimal).
- **`obtenirDiaSetmanaCat(dataStr)`:** Retorna dia abreviat en català ("Di", "Dt", etc.).
- **`formatSessioDate(dataStr, horaStr)`:** Formata data/hora llegible en català.
- **`getMonday(d)` / `addDays(date, days)`:** Utilitats de data per setmanes.

**Navegació setmanal:**
- **`previousWeek()` / `nextWeek()`:** Mouen ±7 dies.
- **`weekLabel`** (computed): Retorna "{data_inici} - {data_final}".

**Filtratge i recàlcul:**
- **`filterDataByWeek()`:** Filtra `allSessions` per setmana i crida `recalcCharts()`.
- **`recalcCharts()`:** 
  - Agrupa sessions per cangur i dia.
  - Calcula minuts per cangur/dia → `barData` (gràfic barres).
  - Suma minuts per cangur → `pieData` (gràfic circular).

**Carregament:**
- **`carregarHistorial()`** (a `onMounted`):
  - Llegeix col·lecció `cronometres` de Firestore.
  - Normalitza timestamps (extreu dia/hora si no hi ha `createdAt`).
  - Ordena per data descendent (més recent primer).
  - Crida `filterDataByWeek()`.

---

#### 13. GrafBarres.vue - Gràfic de barres
**Props:** `labels` (dies), `datasets` (cangurs amb dades).

**Plugin:** `dashedGridPlugin` dibuixa línies discontínues en el gràfics de barres.

**Configuració:** Escales apilades per comparar educadors.

---

#### 14. GrafCercle.vue - Gràfic doughnut
**Props:** `data` (objecte `{educador: minuts}`).

**Plugin:** `centerTextPlugin` posa el temps total al centre.

**Configuració:** Llegenda a la dreta, tooltips amb "X min".

---

#### 15. Inici.vue - Plantilla inicial
**Propòsit:** És la pàgina d'inici a on es pot entrar al Login o al Registre.

---

## Resum de patrons d'ús

### 1. Sincronització Offline
**Com funciona:**
- Les vistes detecten `navigator.onLine` per decidir si crear a Firestore o encolar.
- Els elements guardats a la cua es desen a `localStorage` (clau `offlineQueue`).
- Quan hi ha connexió, `processQueue()` (del servei offline) intenta crear els documents.
- Els elements que fallen romanen a la cua per reintentar-los més tard.

**Exemple:** Quando es guarda una sessió de manera offline:
```
1. S'agafen els noms dels cangur i del nadó que hi ha guardats al cache i que prèviament es van descarregar el registrar-se o al fer login.
2. Es guarda la sessió a localStorage
3. Quan connexió retorna:
   - guardarCrono() guarda la sessió a la cua
   - processQueue() en el moment que veu que hi ha connexió crea el document i el puja a Firestore
   - si es guarda una altra sessió es fa el mateix de nou des del punt 1.
```

### 2. Cache Local (localStorage)
**Dades guardades:**
- `token` : token de sessió.
- `uid` : ID de l'usuari.
- `name` : nom complet de l'usuari.
- `email` : correu de l'usuari.
- `selectedNado` : ID del nadó seleccionat (fallback si no hi ha connexió).
- `selectedNadoName` : nom del nadó seleccionat.
- `localCangurs` : JSON array de `{id, name}` dels educadors.
- `localnadons` : JSON array de `{id, name}` dels nadós.
- `offlineQueue` : JSON array de `PendingItem` per sincronitzar.

**Per què:** Garantir que la UI es pot carregar sense connexió a internet.

### 3. Flux d'autenticació
1. **Register** (Inici → Register):
   - L'usuari crea compte amb email/contrasenya.
   - Es crea usuari a Firebase Auth i document Firestore.
   - Es guarda uid/name/email a localStorage.
   - Redirigeix a Cangurs.

2. **Login** (Inici → Login):
   - L'usuari introdueix email/contrasenya.
   - Firebase Auth verifica credencials.
   - Es carreguen dades a localStorage + cache de nadons.
   - Redirigeix a Funcionalitats.

3. **Logout** (des de Historial):
   - Es crida `signOut(auth)`.
   - Es neteja localStorage.
   - Redirigeix a Login.

### 4. Estructura de Firestore
```
users/
  {uid}/
    (document principal amb name, email, createdAt)
    cangurs/ (subcollecció)
      {docId}: { name, createdAt }
    nadons/ (subcollecció)
      {docId}: { name, setmanes, dies, createdAt }
    cronometres/ (subcollecció)
      {docId}: { cangurId, cangurNom, nadoId, nadoNom, temps, dia, hora, createdAt }
    estades/ (subcollecció)
      {docId}: { nadoId, horaEntrada, horaSortida, createdAt }
