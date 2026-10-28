import { ApiReferenceReact } from '@scalar/api-reference-react'
import '@scalar/api-reference-react/style.css'

export default function DocsPage() {
  return (
    <div className="h-dvh w-full">
      <ApiReferenceReact configuration={{ url: '/api/openapi.json' }} />
    </div>
  )
}
