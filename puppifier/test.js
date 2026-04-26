import { puppify } from './dist/index.js';
import { defaultProfile } from './dist/profile.js';


const sources = [
    'mm.. this time of night, I listen to really cheesy songs..',
    'What are you talking about?',
    'I\'m not sure what you mean.',
    'WTF??!?!?!?',
    'God, I\'m so hungry!',
    'I\'m so happy!',
    'I\'m so sad!',
    'I\'m so angry!',
    'I\'m so scared!',
    'I\'m so confused!',
    'I\'m so excited!',
    'I\'m so disappointed!',
    'Communicative behavior may be a language but it is not speech yall. If you wanna “speak” it has to be made up of syllabic sounds creating words which in turn create sentences. 👏',
    "I'm with you on this tbh. surely there must be a reason the standard command to get a dog to bark is 'speak' and not 'bark'",
];

async function main() {
  const options = {
    // seed: 42,
    profile: defaultProfile,
  };
  const profile = defaultProfile;
  profile.actionShape.includeObjects = false;
  profile.actionShape.includeModifiers = false;
  profile.actionsAtEndOnly = true;
  options.profile = profile;
  for (const source of sources) {
    const result = await puppify(source, options);
    console.log(`${result.source} -> ${result.text} (emotion: ${result.phraseTone[0].label})`);
  }
}

main().then(() => {});