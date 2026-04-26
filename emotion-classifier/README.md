# emotion-classifier

A small TypeScript Node.js library that classifies the emotional tone of a phrase and its constituent sentences using the [GoEmotions](https://github.com/google-research/google-research/tree/master/goemotions) taxonomy (28 labels), powered by [`@huggingface/transformers`](https://huggingface.co/docs/transformers.js) running the ONNX-quantized [`SamLowe/roberta-base-go_emotions-onnx`](https://huggingface.co/SamLowe/roberta-base-go_emotions-onnx) model.

Inspired by [Sapling.ai's Tone API](https://sapling.ai/docs/api/tone/), but fully open-source and runnable locally.

## Install

```bash
npm install
npm run build
```

The first call to the classifier will download the ONNX model (~80 MB quantized) into the local Hugging Face cache. Subsequent calls run fully offline.

## Usage

```ts
import { get_phrase_emotion_classification } from 'emotion-classifier';

const result = await get_phrase_emotion_classification(
  'I am ecstatic! I got a promotion.',
);

console.log(JSON.stringify(result, null, 2));
```

Sample output (scores will vary slightly depending on the model build):

```json
{
  "phrase": {
    "text": "I am ecstatic! I got a promotion.",
    "tone": [
      { "label": "excitement", "score": 0.78 },
      { "label": "joy",        "score": 0.41 },
      { "label": "admiration", "score": 0.12 }
    ]
  },
  "sentences": [
    {
      "text": "I am ecstatic!",
      "tone": [
        { "label": "excitement", "score": 0.91 },
        { "label": "joy",        "score": 0.34 },
        { "label": "approval",   "score": 0.05 }
      ]
    },
    {
      "text": "I got a promotion.",
      "tone": [
        { "label": "admiration", "score": 0.46 },
        { "label": "joy",        "score": 0.39 },
        { "label": "pride",      "score": 0.21 }
      ]
    }
  ]
}
```

## API

### `get_phrase_emotion_classification(text, options?)`

```ts
function get_phrase_emotion_classification(
  text: string,
  options?: { topK?: number; classifier?: Classifier },
): Promise<PhraseEmotionClassification>;
```

- `text` - the input phrase. Can contain multiple sentences.
- `options.topK` - number of top tones to keep per item, default `3`.
- `options.classifier` - inject a custom `Classifier` (mainly for testing).

The returned shape:

```ts
interface ToneScore { label: string; score: number }
interface ClassifiedItem { text: string; tone: ToneScore[] }
interface PhraseEmotionClassification {
  phrase: ClassifiedItem;
  sentences: ClassifiedItem[];
}
```

A camelCase alias `getPhraseEmotionClassification` is also exported.

## How phrase-level tones are computed

- If the full text fits within the model's 512-token limit, it is fed to the model directly (most accurate).
- Otherwise, per-sentence vectors are combined via a **length-weighted average** (weight = sentence character count) to produce the phrase tone vector.

In both cases, the final `tone` array is the **top K** labels sorted by score descending.

## Emotion labels

The 28 GoEmotions labels:

> admiration, amusement, anger, annoyance, approval, caring, confusion, curiosity, desire, disappointment, disapproval, disgust, embarrassment, excitement, fear, gratitude, grief, joy, love, nervousness, optimism, pride, realization, relief, remorse, sadness, surprise, neutral

The model is multi-label (sigmoid), so scores per item do not sum to 1.

## Scripts

- `npm run build` - type-check and emit JS/d.ts to `dist/`.
- `npm run example` - run `examples/basic.ts`.
- `npm test` - fast unit tests using an injected fake classifier. Offline, no model download.
- `npm run test:integration` - real-model integration tests under `tests/integration/`. The first run downloads the ~80 MB ONNX model to `~/.cache/huggingface/`; subsequent runs are fully offline.
- `npm run test:all` - run the unit suite followed by the integration suite.

## License

MIT.
