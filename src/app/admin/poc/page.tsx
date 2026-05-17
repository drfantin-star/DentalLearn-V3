import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Headphones, ListMusic, Sparkles } from 'lucide-react'

import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface PocLink {
  href: string
  title: string
  tag: string
  description: string
  icon: typeof Headphones
}

const POC_LINKS: PocLink[] = [
  {
    href: '/admin/poc/karaoke',
    title: 'Karaoké transcript',
    tag: 'T3',
    description:
      'Lecture synchronisée mot à mot avec surlignage',
    icon: Headphones,
  },
  {
    href: '/admin/poc/extract-scenes',
    title: 'Extraction scènes',
    tag: 'T5',
    description:
      'Extraction LLM des scènes whiteboard depuis un script',
    icon: Sparkles,
  },
  {
    href: '/admin/audio-jobs',
    title: 'Audio Jobs',
    tag: 'T7',
    description:
      'Monitoring transverse des jobs audio formations + news',
    icon: ListMusic,
  },
]

export default async function PocIndexPage() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }
  if (!(await isSuperAdmin(session.user.id))) {
    redirect('/admin')
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          POC Audio — Visualisation enrichie
        </h1>
        <p className="text-gray-600 mt-1">
          Pages de démonstration des chantiers audio enrichi (karaoké,
          extraction de scènes, monitoring jobs).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {POC_LINKS.map((link) => {
          const Icon = link.icon
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
            >
              <Card className="h-full transition-shadow group-hover:shadow-xl">
                <CardHeader className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary p-2 rounded-xl">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                      {link.tag}
                    </p>
                    <h2 className="text-lg font-bold text-gray-900">
                      {link.title}
                    </h2>
                  </div>
                </CardHeader>
                <CardBody className="flex items-start justify-between gap-3">
                  <p className="text-sm text-gray-600">{link.description}</p>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                </CardBody>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
