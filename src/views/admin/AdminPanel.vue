<template>
  <AppLayout :show-back="true" :scroll-y="true">
    <IonGrid>
      <IonRow class="ion-justify-content-center">
        <IonCol size="12">
          <IonText color="dark">
            <h2 class="titol">Panell d'administració</h2>
          </IonText>
          <IonText color="medium" class="ion-text-center">
            <h2 class="user-email negreta">Gestió de tots els usuaris i dades del sistema</h2>
          </IonText>
        </IonCol>
      </IonRow>
    </IonGrid>

    <IonLoading :is-open="loadingUsers" message="Carregant usuaris..." spinner="crescent" />

    <div v-if="!loadingUsers" class="ion-margin-top">
      <IonSegment v-model="currentTab" @ionChange="onTabChange($event)">
        <IonSegmentButton value="usuaris">
          <IonLabel>Usuaris</IonLabel>
        </IonSegmentButton>
        <IonSegmentButton value="cronometres">
          <IonLabel>Sessions</IonLabel>
        </IonSegmentButton>
      </IonSegment>
    </div>

    <div v-if="currentTab === 'usuaris' && !loadingUsers" class="ion-margin-top">
      <IonRow class="ion-justify-content-center ion-margin-top">
        <IonCol size="12" size-md="6">
          <IonItem lines="none" class="search-item">
            <IonInput v-model="searchQuery" :debounce="300" placeholder="Cerca per nom de nadó o correu..." />
          </IonItem>
        </IonCol>
      </IonRow>

      <IonGrid class="ion-margin-top">
        <IonRow v-if="filteredUsers.length" class="ion-justify-content-center">
          <IonCol size="12" size-xl="10">
            <IonCard v-for="user in filteredUsers" :key="user.uid" class="user-main-card">
              <IonCardContent>
                <IonRow class="ion-align-items-center">
                  <IonCol size="12" size-md="5">
                    <div class="user-info-flex">
                      <IonAvatar class="user-avatar">
                        <img src="/src/assets/kangur_new_petit.png" />
                      </IonAvatar>
                      <div class="user-details">
                        <div class="user-name">{{ user.name }}</div>
                        <div class="user-email-sub">{{ user.email }}</div>
                        <div class="user-date">Creat: {{ formatDate(user.createdAt) }}</div>
                        <div class="user-role" v-if="currentRole === 'gestor'" style="margin-top: 4px; font-size: 0.9em; color: #666;">Rol: <strong>{{ user.rol }}</strong></div>
                      </div>
                    </div>
                  </IonCol>
                  <IonCol
                    size="12"
                    :size-md="currentRole === 'admin' ? '3' : '7'"
                    :class="['stats-col', { 'stats-col-manager': currentRole !== 'admin' }]"
                  >
                    <template v-if="user.detailsLoaded">
                      <div class="stat-item">Nadons: <strong>{{ user.nadons.length }}</strong></div>
                      <div class="stat-item">Sessions: <strong>{{ user.cronometres.length }}</strong></div>
                      <div v-if="user.cangurs.length" class="stat-item cangurs-list">
                        Cangurs: <span>{{ getCangursList(user.cangurs) }}</span>
                      </div>
                    </template>
                    <div v-else class="stat-loader">
                      <IonSpinner name="crescent" color="medium" />
                      <span>Carregant resum...</span>
                    </div>
                  </IonCol>
                  <!-- Admin actions column: only visible for admin -->
                  <IonCol v-if="currentRole === 'admin'" size="12" size-md="4" class="admin-actions">
                    <IonItem lines="none" class="admin-toggle-item">
                      <IonLabel>Rol del usuari</IonLabel>
                      <IonSelect placeholder="Selecciona rol" :value="user.rol"
                        @ionChange="(event) => onRoleChange(user.uid, event.detail.value)">
                        <IonSelectOption value="usuari">Usuari</IonSelectOption>
                        <IonSelectOption value="admin">Admin</IonSelectOption>
                        <IonSelectOption value="gestor">Gestor</IonSelectOption>
                      </IonSelect>
                    </IonItem>
                    <IonSpinner v-if="isSavingAdminId === user.uid" name="dots" color="primary"></IonSpinner>
                    <IonButton
                      fill="clear"
                      color="danger"
                      :disabled="isSavingAdminId === user.uid"
                      @click="confirmDeleteUser(user.uid, user.name)"
                      size="small"
                    >
                      <IonIcon :icon="trashOutline" />
                    </IonButton>
                  </IonCol>
                </IonRow>
              </IonCardContent>
            </IonCard>
          </IonCol>
        </IonRow>
        <IonRow v-else>
          <IonCol class="ion-text-center ion-padding">
            <IonText color="medium">{{ usersLoadError || "No s'han trobat usuaris" }}</IonText>
          </IonCol>
        </IonRow>
      </IonGrid>
    </div>

    <div v-if="currentTab === 'cronometres' && !loadingUsers" class="ion-margin-top">
      <IonRow class="ion-justify-content-center">
        <IonCol size="12" size-lg="11">
          <IonCard class="export-panel-compact">
            <IonCardContent>
              <div class="export-flex-row">
                <div class="flex-item-users">
                  <IonItem lines="none" class="input-data-compact selector-item" button @click="isModalOpen = true">
                    <div class="selector-content">
                      <IonLabel color="medium">Usuaris</IonLabel>
                      <div class="selected-users-text">
                        {{ isAllSelected ? 'Tots' : `${selectedExportUsers.length} sel.` }}
                      </div>
                    </div>
                  </IonItem>
                </div>

                <div class="flex-item-date">
                  <IonItem lines="none" class="input-data-compact date-item">
                    <div class="containerDate">
                      <IonLabel class="labelDate">Des de:</IonLabel>
                      <input ref="exportDateFromRef" type="date" v-model="exportDateFrom" class="custom-date-input" />
                    </div>
                  </IonItem>
                </div>
                <div class="flex-item-date">
                  <IonItem lines="none" class="input-data-compact date-item">
                    <div class="containerDate">
                      <IonLabel class="labelDate">Fins a:</IonLabel>
                      <input ref="exportDateToRef" type="date" v-model="exportDateTo" class="custom-date-input" />
                    </div>
                    
                  </IonItem>
                </div>

                <div class="flex-item-actions">
                  <IonButton color="success" class="btn-export-inline" :disabled="loadingDetails" @click="exportSessionsCSV"
                    title="Descarregar CSV">
                    <IonIcon slot="start" :icon="downloadOutline"></IonIcon>
                    <span class="csv-btn-label">CSV</span>
                  </IonButton>
                </div>
              </div>
              <div class="export-mail-row">
                <IonButton expand="block" fill="outline" color="primary" class="btn-export-mail" :disabled="loadingDetails" @click="sendSessionsCSVByMail">
                  <IonIcon slot="start" :icon="mailOutline"></IonIcon>
                  Enviar CSV al meu correu
                </IonButton>
              </div>
            </IonCardContent>
          </IonCard>
        </IonCol>
      </IonRow>

      <div v-if="loadingDetails" class="ion-padding ion-text-center">
        <IonSpinner name="crescent" color="primary" />
        <p class="sessions-loading-text">Carregant sessions, nadons i cangurs...</p>
      </div>
      <div v-else-if="cronometresByUser.length > 0" class="ion-padding">
        <div v-for="userGroup in cronometresByUser" :key="userGroup.userEmail" class="session-group">
          <div class="group-header">
            <span class="user-title">{{ userGroup.userName || userGroup.userEmail }}</span>
            <IonBadge color="light">{{ userGroup.cronometres.length }} sessions</IonBadge>
          </div>
          <IonCard class="session-inner-card">
            <IonCardContent>
              <div v-for="crono in userGroup.cronometres" :key="crono.id" class="session-row">
                <div class="session-info">
                  <div class="session-names">
                    {{ crono.cangurNom }}
                    <IonIcon :icon="chevronForwardOutline" />
                    {{ crono.nadoNom }}
                  </div>
                  <div class="session-motiu" v-if="crono.motiuFinal">{{ crono.motiuFinal }}</div>
                </div>
                <div class="session-time-data">
                  <div class="s-date">{{ formatDate(crono.createdAt) }}</div>
                  <div class="s-duration">{{ formatSecondsToMMSS(crono.temps) }}</div>
                </div>
                <!-- Allow admin and gestor to delete sessions -->
                <IonButton
                  v-if="currentRole === 'admin' || currentRole === 'gestor'"
                  fill="clear"
                  color="danger"
                  class="session-delete-btn"
                  @click="confirmDeleteSession(crono.userId, crono.sessionId, crono.nadoNom || 'sessió')"
                  size="small"
                >
                  <IonIcon :icon="trashOutline" />
                </IonButton>
              </div>
            </IonCardContent>
          </IonCard>
        </div>
      </div>
      <div v-else class="ion-padding ion-text-center">
        <IonText color="medium">{{ detailsLoadError || 'No hi ha sessions disponibles.' }}</IonText>
      </div>
    </div>
    
    <IonToast :is-open="showToast" :message="toastMessage" color="primary" duration="3000"
      @didDismiss="showToast = false" />

    <IonModal :is-open="showDeleteUserAlert" @didDismiss="() => { showDeleteUserAlert = false; pendingDeleteUser = null }" class="delete-user-modal">
      <IonContent :scroll-y="true">
        <div class="modal-content-compact">
          <p class="modal-title">Confirmació</p>
          <p class="modal-message">Segur que vols eliminar l'usuari <strong>{{ pendingDeleteUser?.name }}</strong>?</p>
          <div class="modal-buttons-compact">
            <IonButton fill="outline" color="medium" @click="() => { showDeleteUserAlert = false; pendingDeleteUser = null }">
              Cancel·lar
            </IonButton>
            <IonButton fill="solid" color="primary" @click="deleteUserConfirmed">
              Eliminar
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonModal>

    <IonModal :is-open="showDeleteSessionAlert" @didDismiss="() => { showDeleteSessionAlert = false; pendingDeleteSession = null }" class="delete-user-modal">
      <IonContent>
        <div class="modal-content-compact">
          <p class="modal-title">Confirmacio</p>
          <p class="modal-message">Segur que vols eliminar aquesta sessio de <strong>{{ pendingDeleteSession?.sessionLabel }}</strong>?</p>
          <div class="modal-buttons-compact">
            <IonButton fill="outline" color="medium" @click="() => { showDeleteSessionAlert = false; pendingDeleteSession = null }">
              Cancel·lar
            </IonButton>
            <IonButton fill="solid" color="primary" @click="deleteSessionConfirmed">
              Eliminar
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonModal>

    <IonModal :is-open="isModalOpen" @didDismiss="isModalOpen = false">
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Selecciona Usuaris</IonTitle>
          <IonButtons slot="end">
            <IonButton @click="isModalOpen = false">Fet</IonButton>
          </IonButtons>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar v-model="userSearchModal" placeholder="Cerca per nom o email..." :debounce="200" />
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList>
          <IonItem lines="full">
            <IonLabel><strong>Seleccionar-ho tot</strong></IonLabel>
            <IonCheckbox slot="start" :checked="isAllSelected" @ionChange="toggleSelectAll"></IonCheckbox>
          </IonItem>
          <IonItem v-for="user in filteredUsersModal" :key="user.uid">
            <IonAvatar slot="start" class="mini-avatar">
              <img src="/src/assets/kangur_new_petit.png" />
            </IonAvatar>
            <IonLabel>
              <h2>{{ user.name }}</h2>
              <p>{{ user.email }}</p>
            </IonLabel>
            <IonCheckbox slot="end" :checked="selectedExportUsers.includes(user.email)"
              @ionChange="toggleUserSelection(user.email)">
            </IonCheckbox>
          </IonItem>
        </IonList>
      </IonContent>
    </IonModal>
  </AppLayout>
</template>

<script setup lang="ts">
import {
  IonButton, IonIcon, IonGrid, IonRow, IonCol, IonCard, IonCardContent,
  IonLabel, IonSegment, IonSegmentButton, IonLoading, IonText, IonAvatar,
  onIonViewDidEnter, IonSpinner, IonItem, IonInput, IonSelect, IonSelectOption,
  IonBadge, IonModal, IonHeader, IonToolbar, IonTitle,
  IonButtons, IonContent, IonList, IonCheckbox, IonSearchbar, IonToast
} from '@ionic/vue'
import { downloadOutline, chevronForwardOutline, mailOutline, trashOutline } from 'ionicons/icons'
import AppLayout from '@/components/AppLayout.vue'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { db, auth } from '@/services/firebase'
import { collection, addDoc } from 'firebase/firestore'
import adminService from '@/services/admin.service'
import { formatSecondsToMMSS } from '@/utils/time'
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'

const router = useRouter()
const loadingUsers = ref(true)
const loadingDetails = ref(false)
const detailsLoaded = ref(false)
const currentTab = ref('usuaris')
const isSavingAdminId = ref('')
const currentRole = ref('')
const searchQuery = ref('')

const isModalOpen = ref(false)
const userSearchModal = ref('')
const exportDateFrom = ref('')
const exportDateTo = ref('')
const selectedExportUsers = ref<string[]>([])

const showToast = ref(false)
const toastMessage = ref('')
const toastColor = ref('success')
const usersLoadError = ref('')
const detailsLoadError = ref('')

const showDeleteUserAlert = ref(false)
const showDeleteSessionAlert = ref(false)
const pendingDeleteUser = ref<{id: string; name: string} | null>(null)
const pendingDeleteSession = ref<{userId: string; sessionId: string; sessionLabel: string} | null>(null)

const exportDateFromRef = ref<HTMLInputElement | null>(null)
const exportDateToRef = ref<HTMLInputElement | null>(null)

const focusDateInput = (which: 'from' | 'to') => {
  const ref = which === 'from' ? exportDateFromRef : exportDateToRef
  ref.value?.focus()
}

interface User {
  uid: string;
  name: string;
  email: string;
  rol: string;
  createdAt: any;
  cronometres: any[];
  nadons: any[];
  cangurs: any[];
  detailsLoaded: boolean;
  eliminado?: boolean;
}

const allUsers = ref<User[]>([])
const allCronometres = ref<any[]>([])
const cronometresByUser = ref<any[]>([])

const filteredUsers = computed(() => {
  const query = (searchQuery.value || '').toLowerCase().trim()
  if (!query) return allUsers.value
  return allUsers.value.filter(user =>
    (user.name || '').toLowerCase().includes(query) ||
    (user.email || '').toLowerCase().includes(query) ||
    (user.nadons || []).some(n => (n.name || n.nom || '').toLowerCase().includes(query))
  )
});

const filteredUsersModal = computed(() => {
  const q = (userSearchModal.value || '').toLowerCase().trim()
  if (!q) return allUsers.value
  return allUsers.value.filter(u =>
    (u.name && u.name.toLowerCase().includes(q)) ||
    (u.email && u.email.toLowerCase().includes(q))
  )
});

const isAllSelected = computed(() => {
  return allUsers.value.length > 0 && selectedExportUsers.value.length === allUsers.value.length
});

const toggleSelectAll = (event: any) => {
  if (event.detail.checked) {
    selectedExportUsers.value = allUsers.value.map(u => u.email)
  } else {
    selectedExportUsers.value = []
  }
}

const toggleUserSelection = (email: string) => {
  const index = selectedExportUsers.value.indexOf(email)
  if (index > -1) {
    selectedExportUsers.value = selectedExportUsers.value.filter((_, i) => i !== index)
  } else {
    selectedExportUsers.value = [...selectedExportUsers.value, email]
  }
}

function getCSVData() {
  let data = [...allCronometres.value]
  if (selectedExportUsers.value.length > 0) {
    data = data.filter(c => selectedExportUsers.value.includes(c.userEmail))
  } else {
    return { error: 'Selecciona almenys un usuari.' }
  }

  if (exportDateFrom.value || exportDateTo.value) {
    data = data.filter(c => {
      const cDate = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt)
      if (exportDateFrom.value && cDate < new Date(exportDateFrom.value)) return false
      if (exportDateTo.value) {
        const toDate = new Date(exportDateTo.value); toDate.setHours(23, 59, 59)
        if (cDate > toDate) return false
      }
      return true
    })
  }

  if (!data.length) return { error: 'No hi ha dades per exportar.' }

  const headers = ['Data', 'Email Usuari', 'Nom Usuari', 'Cangur', 'Nadó', 'Temps', 'Motiu']
  const rows = data.map(c => [
    `"${formatDate(c.createdAt)}"`,
    `"${c.userEmail}"`,
    `"${c.userName}"`,
    `"${c.cangurNom}"`,
    `"${c.nadoNom}"`,
    `"${formatSecondsToMMSS(c.temps)}"`,
    `"${(c.motiuFinal || 'N/A').replace(/\n/g, ' ')}"`
  ])

  return {
    content: "sep=;\n\uFEFF" + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n'),
    filename: `export_kangur_${new Date().getTime()}.csv`
  }
}

async function exportSessionsCSV() {
  const result = getCSVData()
  if (result.error) {
    toastMessage.value = result.error
    toastColor.value = 'danger'
    showToast.value = true
    return
  }

  const content = result.content!
  const filename = result.filename!

  // En mòbil natiu (APK), guardem el fitxer directament al dispositiu.
  if (Capacitor.isNativePlatform()) {
    try {
      const isAndroid = Capacitor.getPlatform() === 'android'
      const nativeDirectory = isAndroid ? Directory.ExternalStorage : Directory.Documents
      const nativePath = isAndroid
        ? `Download/KangurApp/${filename}`
        : `KangurApp/${filename}`

      await Filesystem.writeFile({
        path: nativePath,
        data: content,
        directory: nativeDirectory,
        encoding: Encoding.UTF8,
        recursive: true
      })

      toastMessage.value = isAndroid
        ? `CSV desat a Descàrregues: ${filename}`
        : `CSV desat: ${filename}`
      toastColor.value = 'success'
      showToast.value = true
      return
    } catch (error) {
      console.error('Error desant CSV al mòbil:', error)
      toastMessage.value = 'No s\'ha pogut desar el fitxer al dispositiu.'
      toastColor.value = 'danger'
      showToast.value = true
      return
    }
  }

  // En web mantenim la descàrrega estàndard.
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  toastMessage.value = 'S\'ha iniciat la descàrrega del CSV.'
  toastColor.value = 'success'
  showToast.value = true
}

async function sendSessionsCSVByMail() {
  const result = getCSVData()
  if (result.error) {
    toastMessage.value = result.error
    toastColor.value = 'danger'
    showToast.value = true
    return
  }

  const receiverEmail = (auth.currentUser?.email || localStorage.getItem('email') || '').trim()
  
  if (!receiverEmail) {
    toastMessage.value = 'No hem trobat el teu correu. Torna a iniciar sessió.'
    toastColor.value = 'warning'
    showToast.value = true
    return
  }

  const csvContent = result.content || ''
  const filename = result.filename || `export_kangur_${Date.now()}.csv`

  try {
    await addDoc(collection(db, 'mail'), {
      to: receiverEmail,
      message: {
        subject: `[NO-REPLY] - Exportació de sessions KangurApp`,
        text: `Hola,\n\nT'adjuntem el fitxer CSV amb les teves sessions exportades.\n\nAquest és un correu automàtic, per favor no el responguis.\n\nSalutacions,\nL'equip de KangurApp.`,
        attachments: [
          {
            filename: filename,
            content: csvContent, 
            contentType: 'text/csv; charset=utf-8'
          }
        ]
      }
    })

    toastMessage.value = `CSV enviat correctament a ${receiverEmail}!`
    toastColor.value = 'success'
    showToast.value = true
  } catch (error) {
    console.error('Error enviant email:', error)
    toastMessage.value = 'Error enviant el correu. Revisa la teva connexió.'
    toastColor.value = 'danger'
    showToast.value = true
  }
}

function onRoleChange(userId: string, newRole: string) {
  if (currentRole.value !== 'admin') {
    toastMessage.value = 'Només els administradors poden canviar rols.'
    toastColor.value = 'warning'
    showToast.value = true
    return
  }

  if (!newRole || !['usuari', 'admin', 'gestor'].includes(newRole)) return
  toggleAdmin(userId, newRole)
}

function confirmDeleteUser(userId: string, userName: string) {
  if (currentRole.value !== 'admin') {
    toastMessage.value = 'Només els administradors poden esborrar usuaris.'
    toastColor.value = 'warning'
    showToast.value = true
    return
  }

  pendingDeleteUser.value = { id: userId, name: userName }
  showDeleteUserAlert.value = true
}

async function deleteUserConfirmed() {
  if (!pendingDeleteUser.value) return

  const { id, name } = pendingDeleteUser.value
  pendingDeleteUser.value = null
  showDeleteUserAlert.value = false

  try {
    isSavingAdminId.value = id
    await adminService.deleteUser(id)
    toastMessage.value = `Usuari ${name} eliminat correctament.`
    toastColor.value = 'success'
    showToast.value = true
    await loadAdminData()
  } catch (error) {
    console.error('Error esborrant usuari:', error)
    toastMessage.value = 'Error esborrant usuari. Torna-ho a intentar.'
    toastColor.value = 'danger'
    showToast.value = true
  } finally {
    isSavingAdminId.value = ''
  }
}

function confirmDeleteSession(userId: string, sessionId: string, sessionLabel: string) {
  if (currentRole.value !== 'admin' && currentRole.value !== 'gestor') {
    toastMessage.value = 'Només els administradors i gestors poden esborrar sessions.'
    toastColor.value = 'warning'
    showToast.value = true
    return
  }

  pendingDeleteSession.value = { userId, sessionId, sessionLabel }
  showDeleteSessionAlert.value = true
}

async function deleteSessionConfirmed() {
  if (!pendingDeleteSession.value) return

  const { userId, sessionId, sessionLabel } = pendingDeleteSession.value
  pendingDeleteSession.value = null
  showDeleteSessionAlert.value = false

  try {
    isSavingAdminId.value = userId
    await adminService.deleteSession(userId, sessionId)
    toastMessage.value = `Sessió ${sessionLabel} eliminada correctament.`
    toastColor.value = 'success'
    showToast.value = true
    await loadUserDetailsData(true, true)
    currentTab.value = 'cronometres'
  } catch (error) {
    console.error('Error esborrant sessió:', error)
    toastMessage.value = 'Error esborrant sessió. Torna-ho a intentar.'
    toastColor.value = 'danger'
    showToast.value = true
  } finally {
    isSavingAdminId.value = ''
  }
}

function formatDate(date: any) {
  if (!date) return '-'
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('ca-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function getCangursList(cangurs: any[]) {
  return cangurs.map(c => c.name || c.nom).join(', ')
}

async function loadAdminData() {
  loadingUsers.value = true
  usersLoadError.value = ''
  try {
    detailsLoaded.value = false
    detailsLoadError.value = ''
    allCronometres.value = []
    cronometresByUser.value = []

    const data = await adminService.getAllUsersBasicData()
    const activeUsers = data.filter((u: any) => !u.eliminado)

    allUsers.value = activeUsers.map((u: any) => ({
      uid: u.uid,
      name: u.name,
      email: u.email,
      rol: u.rol || 'usuari',
      createdAt: u.createdAt,
      cronometres: [],
      nadons: [],
      cangurs: [],
      detailsLoaded: false,
      eliminado: false
    }))

    selectedExportUsers.value = allUsers.value.map(u => u.email)

    // Launch heavy reads after users are already visible.
    window.setTimeout(() => {
      loadUserDetailsData(false).catch(() => {
        // Error handled in loadUserDetailsData
      })
    }, 0)
  } catch (error: any) {
    console.error('Error carregant dades del panell admin:', error)
    allUsers.value = []
    allCronometres.value = []
    cronometresByUser.value = []
    usersLoadError.value = 'No hem pogut carregar els usuaris ara mateix. Torna-ho a provar en uns moments.'
  } finally {
    loadingUsers.value = false
  }
}

function buildSessionsFromUsers() {
  const list: any[] = []

  allUsers.value.forEach((u) => {
    u.cronometres.forEach((c: any) => list.push({
      ...c,
      id: `${u.uid}-${c.id}`,
      sessionId: c.id,
      userId: u.uid,
      userName: u.name,
      userEmail: u.email,
      cangurNom: c.cangurNom || 'Desconegut',
      nadoNom: c.nadoNom || 'Desconegut'
    }))
  })

  allCronometres.value = list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))

  const groups = new Map<string, any[]>()
  allCronometres.value.forEach((c) => {
    if (!groups.has(c.userEmail)) groups.set(c.userEmail, [])
    groups.get(c.userEmail)?.push(c)
  })

  cronometresByUser.value = Array.from(groups.entries()).map(([email, cronos]) => ({
    userEmail: email,
    userName: cronos[0]?.userName,
    cronometres: cronos
  }))
}

async function loadUserDetailsData(_showLoader = false, force = false) {
  if (loadingDetails.value) return
  if (detailsLoaded.value && !force) return
  if (!allUsers.value.length) {
    detailsLoaded.value = true
    return
  }

  loadingDetails.value = true
  detailsLoadError.value = ''

  try {
    const userIds = allUsers.value.map(u => u.uid)
    const details = await adminService.getUsersDetailsData(userIds)
    const detailsMap = new Map(details.map((d: any) => [d.uid, d]))

    allUsers.value = allUsers.value.map((user) => {
      const detail = detailsMap.get(user.uid)
      return {
        ...user,
        cronometres: detail?.cronometres || [],
        nadons: detail?.nadons || [],
        cangurs: detail?.cangurs || [],
        detailsLoaded: true
      }
    })

    buildSessionsFromUsers()
    detailsLoaded.value = true
  } catch (error) {
    console.error('Error carregant detall d\'usuaris:', error)
    detailsLoadError.value = 'No hem pogut carregar les sessions ara mateix. Torna-ho a provar en uns moments.'
  } finally {
    loadingDetails.value = false
  }
}

function onTabChange(event: CustomEvent) {
  currentTab.value = event.detail.value as string
  if (currentTab.value === 'cronometres' && !detailsLoaded.value) {
    loadUserDetailsData(true).catch(() => {
      // Error handled in loadUserDetailsData
    })
  }
}

async function toggleAdmin(userId: string, newRole: string) {
  isSavingAdminId.value = userId
  try {
    await adminService.updateUserRol(userId, newRole)
    const u = allUsers.value.find(u => u.uid === userId)
    if (u) u.rol = newRole
  } finally {
    isSavingAdminId.value = ''
  }
}

onIonViewDidEnter(async () => {
  const user = auth.currentUser
  if (!user) return router.push('/login')
  const hasAccess = await adminService.getCurrentUserAdminStatus()
  if (!hasAccess) {
    console.error('Access denied to admin panel for user:', user.uid)
    toastMessage.value = 'No tens permisos per accedir al panell d\'administració. Contacta amb l\'administrador.'
    toastColor.value = 'danger'
    showToast.value = true
    setTimeout(() => {
      router.back()
    }, 2000)
    return
  }

  try {
    const me = await adminService.getUserData(user.uid)
    currentRole.value = me?.rol || 'usuari';
  } catch (err) {
    console.warn('No s’ha pogut obtenir el rol de l’usuari actual', err)
    currentRole.value = 'admin'
  }

  await loadAdminData()
})
</script>

<style scoped>
.user-main-card {
  margin-bottom: 15px;
  border-radius: 12px;
  border-left: 5px solid #26a69a;
}

.user-info-flex {
  display: flex;
  align-items: center;
  gap: 15px;
}

.user-avatar {
  width: 50px;
  height: 50px;
}

.mini-avatar {
  width: 35px;
  height: 35px;
}

.user-name {
  font-weight: bold;
  font-size: 1.1rem;
  color: #333;
}

.user-email-sub {
  font-size: 0.9rem;
  color: #666;
}

.user-date {
  font-size: 0.75rem;
  color: #999;
}

.stat-item {
  font-size: 0.9rem;
  margin: 4px 0;
}

.stat-loader {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: #666;
}

.sessions-loading-text {
  margin-top: 10px;
  font-size: 0.95rem;
  color: #666;
}

.cangurs-list span {
  font-style: italic;
  color: #26a69a;
}

.admin-toggle-item{
  width: 70%;
}

.stats-col {
  text-align: left;
}

.stats-col-manager {
  text-align: right;
}

.admin-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 100px;
  flex-wrap: wrap;
}

.admin-actions .ion-item {
  width: auto;
  max-width: 180px;
}

.admin-actions .ion-button,
.admin-actions ion-select {
  min-width: 120px;
}

.export-panel-compact {
  border-top: 4px solid #26a69a;
  border-radius: 12px;
  margin-bottom: 20px;
  background: #fdfdfd;
}

.export-flex-row {
  display: flex;
  flex: 1;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 10px;
}

.flex-item-users {
  flex: 2;
  min-width: 140px;
}

.selector-item {
  --background: #f0f2f2;
  --border-radius: 8px;
  --min-height: 56px;
  --padding-start: 12px;
  --padding-top: 0;
  --padding-bottom: 0;
  margin: 0;
  height: 56px;
  display: flex;
  align-items: center;
}

.containerDate{
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 4px;
}

.selector-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.selector-content IonLabel {
  margin: 0;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.selected-users-text {
  padding-top: 2px;
  font-weight: 700;
  color: #26a69a;
  font-size: 1rem;
}

.selector-arrow {
  font-size: 1.2rem;
  color: #999;
  margin-left: 4px;
}

.flex-item-date {
  flex: 1.5;
  min-width: 110px;
  height: 56px;
}

.flex-item-actions {
  display: flex;
  flex: 0.8;
  min-width: 60px;
}

.input-data-compact {
  --background: #f0f2f2;
  --border-radius: 8px;
  --min-height: 56px;
  --padding-top: 0;
  --padding-bottom: 0;
  margin: 0;
  height: 56px;
  display: flex;
  align-items: center;
}

.date-item {
  --background: transparent;
  --border-radius: 0;
  box-shadow: none;
}

.custom-date-input {
  font-size: 0.75rem;
  font-weight: 600;
  height: 100%;
  flex: 1;
  min-width: 120px;
  padding-right: 2.5rem;
  background: transparent;
  border: none;
  outline: none;
  position: relative;
  z-index: 1;
}

.custom-date-input::-webkit-calendar-picker-indicator {
  opacity: 0.8;
}

.date-icon {
  color: rgba(0, 0, 0, 0.45);
  font-size: 1.1rem;
  cursor: pointer;
  margin-left: 4px;
  position: relative;
  z-index: 2;
}


.btn-export-inline {
  --border-radius: 8px;
  --padding-start: 10px;
  --padding-end: 10px;
  height: 100%;
  min-height: 44px;
  margin: 0;
  width: 100%;
}

.csv-btn-label {
  font-size: 0.85rem;
  font-weight: 700;
}

.export-mail-row {
  margin-top: 12px;
}

.btn-export-mail {
  --border-radius: 8px;
}

.session-group {
  margin-bottom: 20px;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 10px 8px;
}

.user-title {
  font-weight: bold;
  color: #26a69a;
  font-size: 1rem;
}

.session-inner-card {
  margin: 0;
  border-radius: 8px;
}

.session-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #eee;
  gap: 12px;
}

.session-row:last-child {
  border-bottom: none;
}

.session-names {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 5px;
}

.session-motiu {
  font-size: 0.8rem;
  color: #888;
  margin-top: 3px;
}

.session-time-data {
  width: 120px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
}

.session-info {
  flex: 1;
  min-width: 0;
}

.s-date {
  font-size: 0.75rem;
  color: #999;
}

.s-duration {
  font-weight: bold;
  color: #333;
}

.search-item {
  --border-radius: 20px;
  --background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  margin-bottom: 10px;
}

.titol {
  text-align: center;
  margin-bottom: 24px;
  font-weight: 800;
}

.labelDate {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.delete-user-modal::part(content) {
  --height: 25%;
  max-width: 350px;
  margin: auto;
}

.modal-content-compact {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-title {
  font-weight: 600;
  font-size: 1rem;
  margin: 0;
  color: var(--ion-color-primary);
}

.modal-message {
  font-size: 0.95rem;
  color: #555;
  margin: 0;
  line-height: 1.4;
}

.modal-buttons-compact {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 12px;
}

.modal-buttons-compact IonButton {
  flex: 1;
}

@media (max-width: 768px) {
  .export-flex-row {
    flex-wrap: wrap;
  }
  .flex-item-users {
    flex: 1 1 100%;
  }
  .flex-item-date {
    flex: 1 1 42%;
  }
  .flex-item-actions {
    flex: 1 1 100%;
  }

  .btn-export-inline {
    min-height: 46px;
  }

  .csv-btn-label {
    font-size: 0.9rem;
  }
}
</style>