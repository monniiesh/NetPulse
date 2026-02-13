import cron from 'node-cron';

interface Job {
  name: string;
  schedule: string;
  task: () => Promise<void>;
  running: boolean;
}

const jobs: Job[] = [];

export function registerJob(name: string, schedule: string, task: () => Promise<void>): void {
  jobs.push({ name, schedule, task, running: false });
}

export function startAllJobs(): void {
  for (const job of jobs) {
    cron.schedule(job.schedule, async () => {
      if (job.running) {
        console.log(`[jobs] Skipping ${job.name} - already running`);
        return;
      }

      job.running = true;
      const start = Date.now();
      try {
        await job.task();
        console.log(`[jobs] ${job.name} completed in ${Date.now() - start}ms`);
      } catch (err) {
        console.error(`[jobs] ${job.name} failed:`, err);
      } finally {
        job.running = false;
      }
    });

    console.log(`[jobs] Registered: ${job.name} (${job.schedule})`);
  }
}

export function getJobStatus(): { name: string; running: boolean }[] {
  return jobs.map((j) => ({ name: j.name, running: j.running }));
}
