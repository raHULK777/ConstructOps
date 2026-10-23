'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { BrandButton } from '@/components/BrandButton';
import { Notice } from '@/components/Notice';
import type { ProjectStatus } from '@/lib/types';

const DEFAULT_STAGES = [
  'Permitting',
  'Site preparation',
  'Foundation',
  'Framing',
  'Utilities & inspections',
  'Finishes',
];

export function CreateProjectForm() {
  const router = useRouter();

  const [projectName, setProjectName] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('0');
  const [status, setStatus] = useState<ProjectStatus>('planning');
  const [stagesText, setStagesText] = useState(DEFAULT_STAGES.join('\n'));

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const stages = stagesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const payload: Record<string, unknown> = {
      projectName: projectName.trim(),
      estimatedCost: Number(estimatedCost) || 0,
      status,
    };

    if (email.trim()) {
      payload.customer = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(password ? { password } : {}),
      };
    }
    if (stages.length > 0) payload.stages = stages;

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as
        | { project?: { id: string }; error?: string }
        | null;

      if (!response.ok || !data?.project) {
        setError(data?.error ?? 'Could not create the project.');
        return;
      }

      router.push(`/dashboard/projects/${data.project.id}`);
      router.refresh();
    } catch {
      setError('Unable to reach the server. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {error ? (
        <div className="lg:col-span-2">
          <Notice>{error}</Notice>
        </div>
      ) : null}

      <section className="space-y-5 rounded-brand border border-slate-200 bg-brandSurface p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Project</h2>

        <div>
          <label htmlFor="projectName" className="block text-sm font-medium text-slate-700">
            Project name
          </label>
          <input
            id="projectName"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            required
            minLength={2}
            maxLength={255}
            placeholder="Downtown commercial retrofit"
            className="mt-1.5 w-full rounded-brand border border-slate-300 px-3 py-2 text-sm focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="estimatedCost" className="block text-sm font-medium text-slate-700">
              Contract budget (USD)
            </label>
            <input
              id="estimatedCost"
              type="number"
              min={0}
              step="0.01"
              value={estimatedCost}
              onChange={(event) => setEstimatedCost(event.target.value)}
              className="mt-1.5 w-full rounded-brand border border-slate-300 px-3 py-2 text-sm focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
            />
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-slate-700">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(event) => setStatus(event.target.value as ProjectStatus)}
              className="mt-1.5 w-full rounded-brand border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
            >
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="stages" className="block text-sm font-medium text-slate-700">
            Delivery stages
          </label>
          <p className="mt-1 text-xs text-slate-500">
            One stage per line. The first stage starts in progress and drives the project
            progress.
          </p>
          <textarea
            id="stages"
            value={stagesText}
            onChange={(event) => setStagesText(event.target.value)}
            rows={7}
            maxLength={2000}
            className="mt-1.5 w-full rounded-brand border border-slate-300 px-3 py-2 font-mono text-xs leading-6 focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
          />
        </div>
      </section>

      <section className="space-y-5 rounded-brand border border-slate-200 bg-brandSurface p-6 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Customer
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Add the property owner now and they receive read-only access to this project.
            Leave the email blank for an internal project. An existing customer email is
            linked instead of duplicated.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-slate-700">
              First name
            </label>
            <input
              id="firstName"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              maxLength={100}
              className="mt-1.5 w-full rounded-brand border border-slate-300 px-3 py-2 text-sm focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-slate-700">
              Last name
            </label>
            <input
              id="lastName"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              maxLength={100}
              className="mt-1.5 w-full rounded-brand border border-slate-300 px-3 py-2 text-sm focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Customer email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="owner@example.com"
            className="mt-1.5 w-full rounded-brand border border-slate-300 px-3 py-2 text-sm focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
              Phone
            </label>
            <input
              id="phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={30}
              className="mt-1.5 w-full rounded-brand border border-slate-300 px-3 py-2 text-sm focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Temporary password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={10}
              maxLength={200}
              placeholder="Required for a new customer"
              className="mt-1.5 w-full rounded-brand border border-slate-300 px-3 py-2 text-sm focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
            />
          </div>
        </div>
      </section>

      <div className="lg:col-span-2">
        <BrandButton type="submit" disabled={pending}>
          {pending ? 'Creating project…' : 'Create project'}
        </BrandButton>
      </div>
    </form>
  );
}
