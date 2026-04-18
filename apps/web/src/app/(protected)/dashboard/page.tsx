import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard — ArenaQuest' };

export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Dashboard
      </h1>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">Welcome to ArenaQuest.</p>
    </main>
  );
}
