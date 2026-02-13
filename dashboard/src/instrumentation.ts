export async function register() {
  // Only run background jobs on the server (not during build or in edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeJobs } = await import('@/lib/jobs/init');
    await initializeJobs();
  }
}
