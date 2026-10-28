import { Button } from '@crashednis/ui/components/button'
import { Link } from '../router'

export default function NotFoundPage() {
  return (
    <section className="flex flex-col items-start gap-4">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground">
        The page you requested does not exist or may have moved.
      </p>
      <Button render={<Link to="/" />}>Return home</Button>
    </section>
  )
}
