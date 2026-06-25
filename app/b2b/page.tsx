'use client'

import React, {useEffect, useState} from 'react'
import {api} from '@/lib/api'
import {formatCents} from '@/lib/utils'
import {Activity, CreditCard, DollarSign, LayoutDashboard, Loader2} from 'lucide-react'
import {Area, AreaChart, CartesianGrid, XAxis, YAxis} from 'recharts'
import {ChartContainer, ChartTooltip, ChartTooltipContent} from '@/components/ui/chart'

export default function B2BDashboard() {
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        api.b2b.getStats().then(setStats).finally(() => setLoading(false))
    }, [])

    if (loading) {
        return <div className="flex justify-center py-12"><Loader2 className="animate-spin"
                                                                   style={{color: 'var(--accent-primary)'}} size={32}/>
        </div>
    }

    if (!stats) return null

    const successRate = stats.totalTransactions > 0
        ? ((stats.successfulTransactions / stats.totalTransactions) * 100).toFixed(1)
        : '0.0'

    const chartConfig = {
        volumeCents: {
            label: "Volume",
            color: "var(--accent-primary)",
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-3">
                <LayoutDashboard style={{color: 'var(--accent-primary)'}} size={24}/>
                <h2 className="text-xl font-bold" style={{color: 'var(--text-primary)'}}>Dashboard</h2>
            </div>
            <p className="text-sm" style={{color: 'var(--text-secondary)'}}>
                Overview of your business performance over the last 30 days.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 rounded-2xl card-shadow"
                     style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg" style={{backgroundColor: 'rgba(108, 92, 231, 0.1)'}}>
                            <DollarSign size={20} style={{color: 'var(--accent-primary)'}}/>
                        </div>
                        <h3 className="text-sm font-medium" style={{color: 'var(--text-secondary)'}}>Gross Volume</h3>
                    </div>
                    <p className="text-3xl font-bold tracking-tight"
                       style={{color: 'var(--text-primary)'}}>{formatCents(stats.totalVolumeCents)}</p>
                </div>

                <div className="p-6 rounded-2xl card-shadow"
                     style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg" style={{backgroundColor: 'rgba(0, 200, 140, 0.1)'}}>
                            <CreditCard size={20} style={{color: 'var(--accent-green)'}}/>
                        </div>
                        <h3 className="text-sm font-medium" style={{color: 'var(--text-secondary)'}}>Successful
                            Payments</h3>
                    </div>
                    <p className="text-3xl font-bold tracking-tight"
                       style={{color: 'var(--text-primary)'}}>{stats.successfulTransactions}</p>
                </div>

                <div className="p-6 rounded-2xl card-shadow"
                     style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg" style={{backgroundColor: 'rgba(255, 171, 0, 0.1)'}}>
                            <Activity size={20} style={{color: '#ffab00'}}/>
                        </div>
                        <h3 className="text-sm font-medium" style={{color: 'var(--text-secondary)'}}>Success Rate</h3>
                    </div>
                    <p className="text-3xl font-bold tracking-tight"
                       style={{color: 'var(--text-primary)'}}>{successRate}%</p>
                </div>
            </div>

            <div className="p-6 rounded-2xl card-shadow"
                 style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
                <div className="mb-6">
                    <h3 className="text-lg font-bold" style={{color: 'var(--text-primary)'}}>Volume over time</h3>
                    <p className="text-sm" style={{color: 'var(--text-secondary)'}}>Daily gross volume for the last 30
                        days</p>
                </div>
                <div className="h-87.5 w-full">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                        <AreaChart data={stats.chartData} margin={{top: 10, right: 0, left: 0, bottom: 0}}>
                            <defs>
                                <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)"/>
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{fill: 'var(--text-hint)', fontSize: 12}}
                                dy={10}
                                minTickGap={30}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{fill: 'var(--text-hint)', fontSize: 12}}
                                tickFormatter={(value) => `$${(value / 100).toLocaleString()}`}
                                dx={-10}
                            />
                            <ChartTooltip
                                content={<ChartTooltipContent formatter={(value: any) => formatCents(value)}/>}/>
                            <Area
                                type="monotone"
                                dataKey="volumeCents"
                                stroke="var(--accent-primary)"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorVolume)"
                            />
                        </AreaChart>
                    </ChartContainer>
                </div>
            </div>
        </div>
    )
}