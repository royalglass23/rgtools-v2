import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authorizeUser } from './auth-helpers'

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: (credentials) =>
        authorizeUser({
          username: credentials.username as string,
          password: credentials.password as string,
        }),
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role: string }).role
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as 'admin' | 'staff'
      return session
    },
  },
})
