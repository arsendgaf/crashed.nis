import { Field as FormField, Form, type SubmitHandler, useForm } from '@formisch/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useSWRConfig } from 'swr'
import * as v from 'valibot'
import { Button } from '@crashednis/ui/components/button'
import {
  Field as UIField,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@crashednis/ui/components/field'
import { Input } from '@crashednis/ui/components/input'
import { Kbd } from '@crashednis/ui/components/kbd'
import { Logo } from '@crashednis/ui/components/logo'
import { PasswordInput } from '@crashednis/ui/components/password-input'
import { Spinner } from '@crashednis/ui/components/spinner'
import { api } from '@/lib/api/client'

const LoginSchema = v.object({
  iin: v.pipe(
    v.string(),
    v.nonEmpty('Введите ИИН.'),
    v.regex(/^\d{12}$/u, 'ИИН должен состоять ровно из 12 цифр.'),
  ),
  password: v.pipe(
    v.string(),
    v.nonEmpty('Введите пароль.'),
    v.maxLength(256, 'Пароль не должен превышать 256 символов.'),
  ),
})

export default function AuthPage() {
  const navigate = useNavigate()
  const { mutate } = useSWRConfig()
  const passwordInputId = 'login-password'
  const [serverError, setServerError] = useState<string | null>(null)
  const loginForm = useForm({
    schema: LoginSchema,
    initialInput: { iin: '', password: '' },
  })

  const handleLogin: SubmitHandler<typeof LoginSchema> = async ({ iin, password }) => {
    setServerError(null)

    try {
      const response = await api.api.v1.auth.login.$post({ json: { iin, password } })

      if (!response.ok) {
        setServerError(getLoginErrorMessage(response.status))
        return
      }

      const session = await api.api.v1.auth.session.$get()

      if (!session.ok) {
        setServerError('Не удалось подтвердить вход. Попробуйте ещё раз.')
        return
      }

      // Purge the previous session's cache before seeding the new gate: the
      // purge is ordered after the last dashboard mount and BEFORE any data
      // hook exists on this page, so the revalidation pass clears both the
      // cached payloads AND SWR's internal request bookkeeping (which it
      // keeps for the configured dedupe windows) without issuing any
      // doomed requests. Skipping the bookkeeping — a purge with
      // `revalidate: false` — leaves those markers behind, and a remount
      // afterwards silently skips its initial fetch, leaving the first page
      // stuck in skeletons after a logout-then-login without any reload.
      await mutate(() => true, undefined, { revalidate: true })
      await mutate('auth-session', { authenticated: true as const }, { revalidate: false })
      navigate('/', { replace: true })
    } catch {
      setServerError('Не удалось связаться с сервером. Проверьте подключение и повторите попытку.')
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <section className="mx-auto w-full max-w-sm">
        <div className="mb-1 flex items-center gap-2">
          <Logo aria-hidden="true" className="size-8 text-primary" />
          <h1 className="text-2xl font-semibold">Вход</h1>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">Используйте аккаунт СУШ</p>
        <Form of={loginForm} onSubmit={handleLogin} className="flex flex-col gap-4">
          <FieldGroup className="gap-2">
            <FormField of={loginForm} path={['iin']}>
              {(field) => (
                <UIField className="gap-1" data-invalid={field.errors !== null}>
                  <FieldLabel className="sr-only" htmlFor="login-iin">
                    ИИН
                  </FieldLabel>
                  <Input
                    {...field.props}
                    id="login-iin"
                    value={field.input ?? ''}
                    type="text"
                    placeholder="ИИН"
                    inputMode="numeric"
                    autoComplete="username"
                    maxLength={12}
                    aria-required="true"
                    aria-invalid={field.errors !== null}
                    aria-describedby={field.errors !== null ? 'login-iin-error' : undefined}
                    disabled={loginForm.isSubmitting}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        document.getElementById(passwordInputId)?.focus()
                      }
                    }}
                  />
                  <FieldError
                    id="login-iin-error"
                    errors={field.errors?.map((message) => ({ message }))}
                  />
                </UIField>
              )}
            </FormField>

            <FormField of={loginForm} path={['password']}>
              {(field) => (
                <UIField className="gap-1" data-invalid={field.errors !== null}>
                  <FieldLabel className="sr-only" htmlFor={passwordInputId}>
                    Пароль
                  </FieldLabel>
                  <PasswordInput
                    {...field.props}
                    id={passwordInputId}
                    value={field.input ?? ''}
                    placeholder="Пароль"
                    autoComplete="current-password"
                    maxLength={256}
                    aria-required="true"
                    aria-invalid={field.errors !== null}
                    aria-describedby={field.errors !== null ? 'login-password-error' : undefined}
                    disabled={loginForm.isSubmitting}
                  />
                  <FieldError
                    id="login-password-error"
                    errors={field.errors?.map((message) => ({ message }))}
                  />
                </UIField>
              )}
            </FormField>
          </FieldGroup>
          {serverError !== null && (
            <p className="mb-1 text-sm text-destructive" role="alert">
              {serverError}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loginForm.isSubmitting}
            aria-busy={loginForm.isSubmitting}
          >
            {loginForm.isSubmitting && (
              <Spinner
                aria-hidden="true"
                className="motion-reduce:animate-none"
                data-icon="inline-start"
              />
            )}
            {loginForm.isSubmitting ? 'Вход…' : 'Продолжить'}
            {!loginForm.isSubmitting && (
              <>
                <Kbd
                  aria-label="Enter"
                  className="bg-primary-foreground/15 text-primary-foreground"
                >
                  ↵
                </Kbd>
              </>
            )}
          </Button>
        </Form>
      </section>
    </main>
  )
}

function getLoginErrorMessage(status: number): string {
  if (status === 400) {
    return 'Неверный ИИН или пароль.'
  }

  if (status === 429) {
    return 'Слишком много попыток. Повторите позже.'
  }

  return 'Ошибка сервера. Повторите позже.'
}
