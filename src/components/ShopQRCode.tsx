import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { publicShopUrl } from '../lib/media'

export function ShopQRCode({ slug }: { slug: string | null }) {
  const [image, setImage] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    setImage('')
    setError(false)
    if (slug) {
      QRCode.toDataURL(publicShopUrl(slug), {
        width: 640,
        margin: 3,
        errorCorrectionLevel: 'H',
        color: { dark: '#161616', light: '#ffffff' },
      }).then((url) => {
        if (active) setImage(url)
      }).catch(() => {
        if (active) setError(true)
      })
    }
    return () => { active = false }
  }, [slug])

  if (!slug) return null

  return (
    <div className="rounded-lg border border-charcoal-light p-6 space-y-4">
      <h3 className="font-medium text-white">QR code da loja</h3>
      <p className="text-sm text-charcoal-muted">
        Aponte a câmera para abrir a página de agendamento. Você pode imprimir ou divulgar a imagem.
      </p>
      {error ? (
        <p className="text-sm text-red-400">Não foi possível gerar o QR code. Tente novamente.</p>
      ) : image ? (
        <>
          <img src={image} alt={`QR code para ${publicShopUrl(slug)}`} width={200} height={200} className="rounded-lg bg-white" />
          <a href={image} download={`onefind-${slug}-qr-code.png`} className="inline-block rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-charcoal">
            Baixar QR code
          </a>
        </>
      ) : (
        <p className="text-sm text-charcoal-muted">Gerando QR code...</p>
      )}
    </div>
  )
}
