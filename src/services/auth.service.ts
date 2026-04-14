// src/services/auth.service.ts
import { auth, db } from './firebase'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  onAuthStateChanged
} from 'firebase/auth'
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore'

const TOKEN_KEY = 'token'
const TOKEN_EXPIRY_KEY = 'tokenExpiry'
const TOKEN_EXPIRY_HOURS = 7 * 24 // 7 days

type RolePermissionsKey =
  | 'sessions_all_read'
  | 'sessions_all_edit'
  | 'sessions_all_delete'
  | 'sessions_own_read'
  | 'sessions_own_edit'
  | 'sessions_own_delete'

export type RolePermissions = Record<RolePermissionsKey, boolean>

const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  sessions_all_read: false,
  sessions_all_edit: false,
  sessions_all_delete: false,
  sessions_own_read: true,
  sessions_own_edit: true,
  sessions_own_delete: true
}

const PERMISSIONS_KEY = 'permissions'

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)

    promise.then((value) => {
      clearTimeout(timeoutId)
      resolve(value)
    }).catch((error) => {
      clearTimeout(timeoutId)
      reject(error)
    })
  })
}

function generateToken(): string {
  return `token_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function getTokenExpiryTime(): number {
  return Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
}

async function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(TOKEN_EXPIRY_KEY, getTokenExpiryTime().toString())
}

async function removeToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
}

async function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

function parsePermissions(value: string | null): RolePermissions {
  if (!value) return DEFAULT_ROLE_PERMISSIONS

  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_ROLE_PERMISSIONS

    return {
      sessions_all_read: Boolean(parsed.sessions_all_read),
      sessions_all_edit: Boolean(parsed.sessions_all_edit),
      sessions_all_delete: Boolean(parsed.sessions_all_delete),
      sessions_own_read: Boolean(parsed.sessions_own_read),
      sessions_own_edit: Boolean(parsed.sessions_own_edit),
      sessions_own_delete: Boolean(parsed.sessions_own_delete)
    }
  } catch (error) {
    return DEFAULT_ROLE_PERMISSIONS
  }
}

export function getStoredRolePermissions(): RolePermissions {
  return parsePermissions(localStorage.getItem(PERMISSIONS_KEY))
}

export function userHasPermission(permission: RolePermissionsKey): boolean {
  return Boolean(getStoredRolePermissions()[permission])
}

function setStoredRolePermissions(role: string, permissions: RolePermissions) {
  localStorage.setItem('role', role)
  localStorage.setItem('rol', role)
  localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions))
}

function clearStoredRolePermissions() {
  localStorage.removeItem(PERMISSIONS_KEY)
}

function isTokenExpired(): boolean {
  const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY)
  if (!expiryStr) return true
  const expiry = parseInt(expiryStr, 10)
  return Date.now() > expiry
}

async function isTokenValid(): Promise<boolean> {
  const token = await getToken()
  if (!token) return false
  
  if (isTokenExpired()) {
    await removeToken()
    return false
  }

  if (auth.currentUser) return true

  // Wait for Firebase to restore the session
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: boolean) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    const timeoutId = setTimeout(() => {
      finish(true)
    }, 5000)

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      clearTimeout(timeoutId)
      unsubscribe()
      if (user) {
        // Authenticated user and valid token
        finish(true)
      } else {
        // No authenticated user, clear token
        removeToken().then(() => finish(false))
      }
    })
  })
}


async function fetchRolePermissions(role: string): Promise<RolePermissions> {
  try {
    const roleDoc = await getDoc(doc(db, 'rols', role))
    if (!roleDoc.exists()) return DEFAULT_ROLE_PERMISSIONS

    const data = roleDoc.data()
    return {
      sessions_all_read: Boolean(data.sessions_all_read),
      sessions_all_edit: Boolean(data.sessions_all_edit),
      sessions_all_delete: Boolean(data.sessions_all_delete),
      sessions_own_read: Boolean(data.sessions_own_read),
      sessions_own_edit: Boolean(data.sessions_own_edit),
      sessions_own_delete: Boolean(data.sessions_own_delete)
    }
  } catch (error) {
    console.warn('Error fetching role permissions', error)
    return DEFAULT_ROLE_PERMISSIONS
  }
}

async function loadAndStoreRolePermissions(role: string): Promise<RolePermissions> {
  const permissions = await fetchRolePermissions(role)
  setStoredRolePermissions(role, permissions)
  return permissions
}

async function register(payload: { name: string; email: string; password: string }) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, payload.email, payload.password)
    const user = userCredential.user

    await updateProfile(user, { displayName: payload.name })

    await setDoc(doc(db, 'users', user.uid), {
      name: payload.name,
      email: payload.email,
      createdAt: new Date(),
      rol: 'usuari',
      eliminado: false
    })

    localStorage.setItem('name', payload.name)
    localStorage.setItem('email', payload.email)

    return user
  } catch (error: any) {
    if (error?.code === 'auth/email-already-in-use') {
      // If account already exists in Auth, try recovering it with provided password.
      try {
        const existingCredential = await signInWithEmailAndPassword(auth, payload.email, payload.password)
        const existingUser = existingCredential.user
        const existingUserDocRef = doc(db, 'users', existingUser.uid)
        const existingUserDoc = await getDoc(existingUserDocRef)

        await updateProfile(existingUser, { displayName: payload.name })

        if (!existingUserDoc.exists() || existingUserDoc.data().eliminado === true) {
          await setDoc(existingUserDocRef, {
            name: payload.name,
            email: existingUser.email || payload.email,
            createdAt: existingUserDoc.exists() ? existingUserDoc.data().createdAt || new Date() : new Date(),
            rol: existingUserDoc.exists() && typeof existingUserDoc.data().rol === 'string'
              ? existingUserDoc.data().rol
              : 'usuari',
            eliminado: false
          }, { merge: true })
        } else {
          throw new Error('Aquest correu ja està en ús. Inicia sessió.')
        }

        localStorage.setItem('uid', existingUser.uid)
        localStorage.setItem('name', existingUser.displayName || payload.name)
        localStorage.setItem('email', existingUser.email || payload.email)
        localStorage.setItem('admin', 'false')

        return existingUser
      } catch (recoverError: any) {
        if (recoverError?.code === 'auth/wrong-password' || recoverError?.code === 'auth/invalid-credential') {
          try {
            await sendPasswordResetEmail(auth, payload.email)
          } catch {
            // Ignore reset-email secondary failure and return clear primary message.
          }
          throw new Error('Aquest correu ja existeix. Hem enviat un correu per restablir la contrasenya.')
        }

        if (recoverError instanceof Error && recoverError.message) {
          throw recoverError
        }

        throw new Error('No s\'ha pogut recuperar el compte existent. Torna-ho a intentar.')
      }
    }

    throw error
  }
}

async function login(payload: { email: string; password: string }) {
  let userCredential
  try {
    userCredential = await signInWithEmailAndPassword(auth, payload.email, payload.password)
  } catch (error: any) {
    if (error?.code === 'auth/invalid-login-credentials' || error?.code === 'auth/user-not-found' || error?.code === 'auth/wrong-password') {
      throw new Error('Credencials incorrectes. Verifica el correu i la contrasenya.')
    }
    if (error?.code === 'auth/too-many-requests') {
      throw new Error('Massa intents fallits. Torna-ho a intentar més tard.')
    }
    if (error?.code === 'auth/user-disabled') {
      throw new Error('Aquest compte ha estat desactivat.')
    }
    if (error?.code === 'auth/invalid-email') {
      throw new Error('Format de correu electrònic no vàlid.')
    }
    throw new Error('Credencials incorrectes.')
  }
  const user = userCredential.user

  const userDocRef = doc(db, 'users', user.uid)
  let userDoc = null

  try {
    userDoc = await withTimeout(getDoc(userDocRef), 5000, 'Timeout carregant el perfil de l\'usuari')
  } catch (e) {
    console.warn('Error carregant el perfil de l\'usuari, es continuarà amb una sessió mínima', e)
    userDoc = {
      exists: () => true,
      data: () => ({
        name: user.displayName || payload.email.split('@')[0],
        email: user.email || payload.email,
        rol: 'usuari',
        eliminado: false,
        admin: false
      })
    } as any
  }

  if (!userDoc.exists()) {
    await setDoc(userDocRef, {
      name: user.displayName || payload.email.split('@')[0],
      email: user.email || payload.email,
      createdAt: new Date(),
      rol: 'usuari',
      eliminado: false
    })
    userDoc = await getDoc(userDocRef)
  }

  if (!userDoc.exists()) {
    await signOut(auth)
    await removeToken()
    throw new Error('No s\'ha pogut restaurar el perfil de l\'usuari. Torna-ho a intentar.')
  }

  const userData = userDoc.data()

  if (userData?.eliminado) {
    await signOut(auth)
    await removeToken()
    clearStoredRolePermissions()
    localStorage.removeItem('uid')
    localStorage.removeItem('name')
    localStorage.removeItem('rol')
    localStorage.removeItem('role')
    localStorage.removeItem('email')
    localStorage.removeItem('admin')
    localStorage.removeItem('localnadons')
    localStorage.removeItem('selectedNado')
    localStorage.removeItem('selectedNadoName')
    localStorage.removeItem('localCangurs')
    throw new Error('Aquest compte està eliminat. Contacta amb l\'administració per reactivar-lo.')
  }

  if (userData.email && userData.email !== payload.email) {
    await signOut(auth)
    await removeToken()
    throw new Error('Els correus no coincideixen. Credencials incorrectes.')
  }

  // Generate and save token with expiration
  const token = generateToken()
  await saveToken(token)

  localStorage.setItem('uid', user.uid)
  localStorage.setItem('name', user.displayName || '')
  localStorage.setItem('email', user.email || '')

  try {
    const role = (typeof userData.rol === 'string')
      ? userData.rol
      : (userData.admin === true ? 'admin' : 'usuari')

    await loadAndStoreRolePermissions(role)

    localStorage.setItem('admin', role === 'admin' ? 'true' : 'false')
  } catch (e) {
    console.warn('Error loading user data or permissions', e)
    setStoredRolePermissions('usuari', DEFAULT_ROLE_PERMISSIONS)
    localStorage.setItem('admin', 'false')
  }

  try {
    const nadonsSnap = await getDocs(collection(db, 'users', user.uid, 'nadons'))
    if (!nadonsSnap.empty) {
      const nadons = nadonsSnap.docs.map(d => ({ id: d.id, name: d.data().name }))
      try { localStorage.setItem('localnadons', JSON.stringify(nadons)) } catch (e) { }
      if (nadons.length === 1) {
        try { localStorage.setItem('selectedNado', nadons[0].id); localStorage.setItem('selectedNadoName', nadons[0].name) } catch (e) { /* ignore */ }
      }
    }
  } catch (e) {
    console.warn('No babies in local cache', e)
  }

  return {
    expires_in: TOKEN_EXPIRY_HOURS * 60 * 60
  }
}

async function me() {
  const user = auth.currentUser
  if (!user) return null

  const docSnap = await getDoc(doc(db, 'users', user.uid))
  return {
    uid: user.uid,
    email: user.email,
    name: user.displayName,
    extra: docSnap.exists() ? docSnap.data() : null
  }
}

async function logout() {
  await signOut(auth)
  await removeToken()
  
  // Clear all session data
  localStorage.removeItem('uid')
  localStorage.removeItem('name')
  localStorage.removeItem('rol')
  localStorage.removeItem('role')
  localStorage.removeItem('email')
  localStorage.removeItem('admin')
  clearStoredRolePermissions()
  localStorage.removeItem('localnadons')
  localStorage.removeItem('selectedNado')
  localStorage.removeItem('selectedNadoName')
  localStorage.removeItem('localCangurs')
}

export default {
  register,
  login,
  me,
  logout,
  getToken,
  removeToken,
  saveToken,
  isTokenValid,
  isTokenExpired,
  fetchRolePermissions,
  loadAndStoreRolePermissions,
  getStoredRolePermissions,
  userHasPermission
}

