// npm run autoplay の並列実行用（scripts/autoplay.mjs から呼ばれる）。ゲームの自動プレイヤーを読み、渡された仕事をこなして返す。
import { parentPort, workerData } from 'node:worker_threads';
import { loadPlayer, doTask } from './autoplay.mjs';

const ready = loadPlayer(workerData.file);
parentPort.on('message', async (task) => {
  const mod = await ready;
  parentPort.postMessage({ id: task.id, out: await doTask(mod, task) });
});
