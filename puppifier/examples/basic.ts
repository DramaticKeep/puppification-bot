import { puppify } from '../src/index.js';

async function main() {
  const text = 'I am so happy! I got a promotion!';
  const result = await puppify(text, { seed: 42 });
  console.log('Source:  ', text);
  console.log('Dog:     ', result.text);
  console.log('Seed:    ', result.seed);
  console.log();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
