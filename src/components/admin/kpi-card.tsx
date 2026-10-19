'use client';

import { Card, CardContent } from '@/components/ui/card';

export function KPICard({ icon, label, value, subtitle }: {
  icon: React.ReactNode; label: string; value: string | number; subtitle?: string;
}) {
  return (
    <Card className="bg-muted border-border/30">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}
