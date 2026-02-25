import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";
import { isAllowedEmail } from "./utils";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email || !isAllowedEmail(user.email)) {
        return "/unauthorized";
      }

      // Upsert user in database
      if (user.email && account) {
        const dbUser = await prisma.user.upsert({
          where: { email: user.email.toLowerCase() },
          update: {
            name: user.name || user.email.split("@")[0],
            image: user.image,
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            tokenExpiry: account.expires_at
              ? new Date(account.expires_at * 1000)
              : null,
          },
          create: {
            email: user.email.toLowerCase(),
            name: user.name || user.email.split("@")[0],
            image: user.image,
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            tokenExpiry: account.expires_at
              ? new Date(account.expires_at * 1000)
              : null,
          },
        });

        // Also store in Account model for NextAuth
        await prisma.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          update: {
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
          },
          create: {
            userId: dbUser.id,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
          },
        });
      }

      return true;
    },
    async session({ session }) {
      if (session.user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email.toLowerCase() },
          select: { id: true, atCapacity: true },
        });
        if (dbUser) {
          (session as unknown as Record<string, unknown>).userId = dbUser.id;
          (session as unknown as Record<string, unknown>).atCapacity = dbUser.atCapacity;
        }
      }
      return session;
    },
    async jwt({ token: jwtToken, account }) {
      if (account) {
        jwtToken.accessToken = account.access_token;
        jwtToken.refreshToken = account.refresh_token;
      }
      return jwtToken;
    },
  },
  pages: {
    signIn: "/login",
    error: "/unauthorized",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
