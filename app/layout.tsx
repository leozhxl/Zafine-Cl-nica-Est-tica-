import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Zafine Clínica Estética Avançada | Sombrio SC',
  description: 'Há 9 anos referência em depilação a laser em Sombrio, SC, com mais de 130 mil clientes atendidos e a Universidade do Laser. Agende sua avaliação na Zafine.',
  generator: 'v0.app',
  keywords: ['depilação a laser', 'clínica estética Sombrio', 'Zafine Clínica Estética Avançada', 'depilação Sombrio SC', 'Universidade do Laser'],
  openGraph: {
    title: 'Zafine | Uma nova relação com a sua pele',
    description: 'Tecnologia, acolhimento e cuidado para você viver mais leve.',
    type: 'website',
    locale: 'pt_BR',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#102f4a',
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
