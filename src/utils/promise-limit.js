import { setTimeout as sleep } from 'node:timers/promises';

export async function runTasksWithLimit(tasks, limit) {
  let index = 0;
  const results = [];

  const worker = async () => {
    while (index < tasks.length) {
      const taskIdx = index++;
      const result = await tasks[taskIdx]();
      results[taskIdx] = result;
    }
  };

  await Promise.all(Array.from({ length: limit }, () => worker()));

  return results;
}

export async function processAsync(array, fn, limit) {
  await runTasksWithLimit(
    array.map((item) => () => fn(item)),
    limit,
  );
}

export async function spawnWorkers(queue, handler, limit) {
  let activeWorkers = 0;

  const worker = async () => {
    while (true) {
      let task;
      if (queue.length > 0) {
        task = queue.shift();
      }
      if (task) {
        activeWorkers++;
        await handler(task).catch((err) => {
          console.warn(`Unhandled error in worker: ${err.message}`);
        });
        activeWorkers--;
      } else if (activeWorkers > 0) {
        await sleep(100);
      } else {
        break;
      }
    }
  };

  await Promise.all(Array.from({ length: limit }, () => worker()));
}
