'use client'

import {useEffect, useState} from 'react'
import {ArrowLeft} from 'lucide-react'
import {Html5Qrcode} from 'html5-qrcode'
import {captureProductEvent} from '@/lib/analytics'

interface ScanScreenProps {
    onBack: () => void
    onScanResult: (text: string) => void
}

export default function ScanScreen({onBack, onScanResult}: ScanScreenProps) {
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const html5QrCode = new Html5Qrcode("qr-reader")

        html5QrCode.start(
            {facingMode: "environment"},
            {fps: 10, qrbox: {width: 250, height: 250}, aspectRatio: 1.0},
            (decodedText) => {
                html5QrCode.stop().then(() => {
                    onScanResult(decodedText)
                }).catch(() => {
                    onScanResult(decodedText)
                })
            },
            () => {
                // TODO
            }
        ).catch(() => {
            captureProductEvent('qr_parse_failed', {error_code: 'CAMERA_UNAVAILABLE'})
            setError('Camera access denied or not available.')
        })

        return () => {
            if (html5QrCode.isScanning) {
                html5QrCode.stop().catch(() => {
                })
            }
        }
    }, [onScanResult])

    return (
        <div className="flex flex-col w-full h-full" style={{backgroundColor: 'var(--bg-primary)'}}>
            <style dangerouslySetInnerHTML={{
                __html: `
				#qr-reader video {
					object-fit: cover !important;
					width: 100% !important;
					height: 100% !important;
				}
			`
            }}/>
            <div className="flex items-center px-4"
                 style={{paddingTop: '12px', paddingBottom: '16px', position: 'relative', zIndex: 10}}>
                <button onClick={onBack} className="flex items-center justify-center rounded-full"
                        style={{width: '36px', height: '36px', backgroundColor: 'var(--bg-elevated)'}}>
                    <ArrowLeft size={18} color="var(--text-primary)"/>
                </button>
                <span className="absolute left-1/2 -translate-x-1/2 text-base font-semibold"
                      style={{color: 'var(--text-primary)'}}>Scan QR</span>
            </div>
            <div className="flex-1 relative flex flex-col items-center justify-center px-6 pb-20">
                {error ? (
                    <p className="text-sm text-center px-6" style={{color: 'var(--accent-red)'}}>{error}</p>
                ) : (
                    <>
                        <div id="qr-reader"
                             className="w-full max-w-sm aspect-square rounded-3xl overflow-hidden shadow-2xl bg-black"/>
                        <p className="text-sm text-center mt-8" style={{color: 'var(--text-secondary)'}}>Point camera at
                            a Stendly QR code or Solana address.</p>
                    </>
                )}
            </div>
        </div>
    )
}
