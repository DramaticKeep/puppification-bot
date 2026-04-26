import { get_phrase_emotion_classification } from '../src/index.js';

async function main() {
  const text = 'I am ecstatic! I got a promotion.';
  const result = await get_phrase_emotion_classification(text);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
