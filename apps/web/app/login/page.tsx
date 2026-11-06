'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput, INTERNAL_ROLES } from '@jo/schemas';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

export default function LoginPage() {
  const router = useRouter();
  const { login, user, loading } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  // Already signed in (e.g. navigated here directly) - bounce to where they belong.
  useEffect(() => {
    if (!loading && user) {
      router.replace(INTERNAL_ROLES.includes(user.role) ? '/dashboard' : '/');
    }
  }, [loading, user, router]);

  const onSubmit = async (values: LoginInput) => {
    setFormError(null);
    try {
      const loggedInUser = await login(values.email, values.password);
      router.push(INTERNAL_ROLES.includes(loggedInUser.role) ? '/dashboard' : '/');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6">
      <Card className="w-full max-w-sm">
        <h1 className="text-xl font-bold text-navy">Sign in</h1>
        <p className="mt-1 text-sm text-ink/70">JO staff and applicant accounts.</p>
        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input label="Email address" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-ink/70">
          No account yet?{' '}
          <Link href="/register" className="font-semibold text-blue hover:text-navy">
            Register
          </Link>
        </p>
      </Card>
    </div>
  );
}
