export type UserProfile = {
  displayName: string
  email: string
  phone: string
  createdAt: string
  updatedAt: number
}

export const emptyProfile = (email = ''): UserProfile => ({
  displayName: '',
  email,
  phone: '',
  createdAt: new Date().toISOString(),
  updatedAt: Date.now(),
})
