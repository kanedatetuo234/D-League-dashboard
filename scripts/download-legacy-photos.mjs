import fs from 'node:fs/promises';
import path from 'node:path';

const gasUrl = process.argv[2];
const outputDir = process.argv[3] || 'scripts/import-data/photos';
if (!gasUrl) throw new Error('GAS API URLを指定してください。');
const payload = await fetch(gasUrl).then(response => response.json());
const photos = new Map();
for (const row of payload.results || []) {
  for (const url of row.photo_urls || []) photos.set(url, row.game_id);
}
await fs.mkdir(outputDir, { recursive: true });
const manifest = [];
for (const [index, [url, gameId]] of [...photos.entries()].entries()) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`写真取得失敗 ${response.status}: ${url}`);
  const fileName = `${gameId}-${index + 1}.jpg`;
  const filePath = path.join(outputDir, fileName);
  await fs.writeFile(filePath, Buffer.from(await response.arrayBuffer()));
  manifest.push({ game_id: gameId, source_url: url, file_name: fileName, storage_path: `${gameId}/${index + 1}.jpg` });
}
await fs.writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ count: manifest.length, outputDir, manifest }, null, 2));
