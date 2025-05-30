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

export async function mapAsync(array, fn, limit) {
  await runTasksWithLimit(
    array.map((item) => () => fn(item)),
    limit,
  );
}
